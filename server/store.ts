import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020.js';
import { seed, schema } from './seed.ts';
import { privateCollections, targets, type Data, type Row } from '../shared/model.ts';
import { effectiveFundingState } from '../shared/funding.ts';

export class DomainError extends Error {
  status: number;
  code: string;
  constructor(status: number, message: string, code = 'VALIDATION') {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export function assert(ok: unknown, message: string, status = 400): asserts ok {
  if (!ok)
    throw new DomainError(
      status,
      message,
      status === 409 ? 'CONFLICT' : status === 403 ? 'FORBIDDEN' : 'VALIDATION',
    );
}
export type Change = {
  collection: string;
  id: string;
  value: Row | null;
  expectedRevision?: number;
};
export type DatabaseSnapshot = {
  migrations: any[];
  scopes: any[];
  records: any[];
  record_links: any[];
  audit: any[];
  settings: any[];
};
const scalarRefs: Record<string, string> = {
  company_id: 'companies',
  user_id: 'users',
  application_id: 'applications',
  challenge_id: 'challenges',
  solution_id: 'solutions',
  learning_id: 'learning',
  stage_id: 'process_stages',
  source_id: 'sources',
  parent_id: 'topics',
};
const arrayRefs: Record<string, string> = {
  process_ids: 'processes',
  topic_ids: 'topics',
  team_user_ids: 'users',
  document_ids: 'documents',
  evidence_document_ids: 'documents',
  reference_source_ids: 'sources',
  related_challenge_ids: 'challenges',
  suggested_company_ids: 'companies',
};
export class Store {
  db: DatabaseSync;
  path: string;
  private inTransaction = false;
  validators: Record<string, any> = {};
  constructor(path = process.env.DATABASE_PATH || './data/expande.sqlite') {
    this.path = path;
    if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
    this.db = new DatabaseSync(path, { timeout: 5000 });
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    this.db.exec(readFileSync(new URL('./migration.sql', import.meta.url), 'utf8'));
    const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false });
    for (const [k, p] of Object.entries(schema.properties) as [string, any][])
      if (p.items) {
        const contract = structuredClone(p.items);
        if (k === 'users') contract.properties.last_name = { type: 'string' };
        if (k === 'events') {
          contract.properties.thumbnail_url = { type: 'string' };
          contract.properties.thumbnail_alt = { type: 'string' };
        }
        if (k === 'funding_calls') {
          for (const field of ['thumbnail_url', 'thumbnail_alt', 'summary'])
            contract.properties[field] = { type: 'string' };
          contract.properties.reviewed_on = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' };
          contract.properties.closing_at = {
            type: ['string', 'null'],
            pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(Z|[+-]\\d{2}:\\d{2})$',
          };
          contract.properties.catalog_hidden = { type: 'boolean' };
        }
        if (k === 'learning') {
          contract.properties.thumbnail_url = { type: 'string' };
          contract.properties.thumbnail_alt = { type: 'string' };
          contract.properties.reference_source_ids = { type: 'array', items: { type: 'string' } };
        }
        if (['cases', 'news', 'trends', 'funding_calls'].includes(k)) {
          contract.properties.thumbnail_url = { type: 'string' };
          contract.properties.thumbnail_alt = { type: 'string' };
          contract.properties.reference_source_ids = { type: 'array', items: { type: 'string' } };
          contract.properties.body_sections = {
            type: 'array',
            items: {
              type: 'object',
              properties: { heading: { type: 'string' }, body: { type: 'string' } },
              required: ['heading', 'body'],
              additionalProperties: false,
            },
          };
        }
        if (k === 'applications')
          contract.properties.prepared_snapshot.properties.trl = {
            anyOf: [contract.properties.prepared_snapshot.properties.trl, { type: 'null' }],
          };
        this.validators[k] = ajv.compile(contract);
      }
    if (!this.scope('catalog'))
      this.transaction(() => {
        this.addScope('catalog', 'catalog', 'Catálogo compartido');
        this.addScope('templates', 'templates', 'Plantillas de nuevos visitantes');
        for (const [collection, rows] of Object.entries(seed))
          if (Array.isArray(rows))
            for (const row of rows)
              this.rawPut(
                privateCollections.includes(collection) ? 'templates' : 'catalog',
                collection,
                row,
              );
        this.rebuildLinks('catalog');
        this.rebuildLinks('templates');
      });
  }
  transaction<T>(fn: () => T): T {
    if (this.inTransaction) return fn();
    this.db.exec('BEGIN IMMEDIATE');
    this.inTransaction = true;
    try {
      const v = fn();
      this.db.exec('COMMIT');
      return v;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    } finally {
      this.inTransaction = false;
    }
  }
  scope(id: string): any {
    return this.db.prepare('SELECT * FROM scopes WHERE id=?').get(id);
  }
  addScope(id: string, kind: string, label: string) {
    this.db
      .prepare(
        'INSERT INTO scopes(id,kind,label,active_user,demo_now,created_at) VALUES(?,?,?,?,?,?)',
      )
      .run(
        id,
        kind,
        label,
        seed.meta.default_user_id,
        this.scope('templates')?.demo_now || seed.meta.demo_now,
        new Date().toISOString(),
      );
  }
  createSession(label = 'Visitante') {
    const id = randomUUID();
    this.transaction(() => {
      this.addScope(id, 'session', label);
      this.db
        .prepare(
          "INSERT INTO records SELECT ?,collection,id,body,company_id,user_id,application_id,1 FROM records WHERE scope='templates'",
        )
        .run(id);
      this.rebuildLinks(id);
    });
    return id;
  }
  rows(scope: string, collection: string): Row[] {
    return (
      this.db
        .prepare('SELECT body,revision FROM records WHERE scope=? AND collection=? ORDER BY rowid')
        .all(scope, collection) as any[]
    ).map((r) => ({ ...JSON.parse(r.body), _rev: r.revision }));
  }
  get(scope: string, collection: string, id: string): Row | undefined {
    const r: any = this.db
      .prepare('SELECT body,revision FROM records WHERE scope=? AND collection=? AND id=?')
      .get(scope, collection, id);
    return r ? { ...JSON.parse(r.body), _rev: r.revision } : undefined;
  }
  data(scope: string): Data {
    assert(this.scope(scope), 'Sesión no encontrada', 404);
    const d: Data = {
      meta: { ...seed.meta, demo_now: this.scope(scope).demo_now },
      enums: seed.enums,
      source_field_inventory: seed.source_field_inventory,
    };
    for (const key of Object.keys(this.validators).concat('activity'))
      d[key] = this.rows(privateCollections.includes(key) ? scope : 'catalog', key);
    const now = Date.parse(d.meta.demo_now),
      today = d.meta.demo_now.slice(0, 10);
    d.challenges = d.challenges.map((r: Row) => {
      if (!r.demo) return r;
      const closed = r.closes_at && now >= Date.parse(r.closes_at);
      const opened = r.opened_at && now >= Date.parse(r.opened_at);
      return {
        ...r,
        state:
          ['abierto', 'proximo'].includes(r.state) && closed
            ? 'cerrado'
            : r.state === 'proximo' && opened && !closed
              ? 'abierto'
              : r.state,
      };
    });
    d.funding_calls = d.funding_calls.map((r: Row) => {
      const state = effectiveFundingState(r, today);
      return state === r.state ? r : { ...r, state };
    });
    return d;
  }
  visible(scope: string): Data {
    const d = this.data(scope),
      user = d.users.find((u: Row) => u.id === this.scope(scope).active_user);
    assert(user, 'Perfil no encontrado', 404);
    const company = user.company_id;
    d.profiles = d.users
      .filter((u: Row) => u.status === 'activo' && u.demo)
      .map((u: Row) => ({
        id: u.id,
        name: u.name,
        role: u.role,
        company_id: u.company_id,
        company_name: d.companies.find((c: Row) => c.id === u.company_id)?.name,
      }));
    d.users = d.users.filter((u: Row) => u.company_id === company);
    d.companies = d.companies.filter((c: Row) => c.id === company || !c.demo);
    const mine = new Set(
      d.applications.filter((a: Row) => a.company_id === company).map((a: Row) => a.id),
    );
    for (const k of privateCollections)
      if (Array.isArray(d[k]) && !['companies', 'users', 'public_questions'].includes(k))
        d[k] = d[k].filter((r: Row) =>
          r.user_id
            ? r.user_id === user.id
            : r.company_id
              ? r.company_id === company
              : r.application_id
                ? mine.has(r.application_id)
                : false,
        );
    d.public_questions = d.public_questions.filter(
      (r: Row) => !r.visitor_session || r.visitor_session === scope,
    );
    d.context = {
      sessionId: scope,
      userId: user.id,
      companyId: company,
      revision: this.revision(scope),
    };
    return d;
  }
  revision(scope: string) {
    return `${this.scope('catalog').revision}:${this.scope(scope)?.revision || 0}`;
  }
  rawPut(scope: string, collection: string, value: Row) {
    const { _rev, ...clean } = value;
    this.db
      .prepare(
        'INSERT INTO records(scope,collection,id,body,company_id,user_id,application_id) VALUES(?,?,?,?,?,?,?) ON CONFLICT(scope,collection,id) DO UPDATE SET body=excluded.body,company_id=excluded.company_id,user_id=excluded.user_id,application_id=excluded.application_id,revision=records.revision+1',
      )
      .run(
        scope,
        collection,
        clean.id,
        JSON.stringify(clean),
        clean.company_id || null,
        clean.user_id || null,
        clean.application_id || null,
      );
  }
  validate(collection: string, row: Row) {
    const { _rev, ...clean } = row;
    assert(typeof clean.id === 'string' && clean.id.length > 0, 'ID requerido');
    if (this.validators[collection])
      assert(
        this.validators[collection](clean),
        `${collection}: ${JSON.stringify(this.validators[collection].errors)}`,
      );
    else assert(collection === 'activity', 'Colección desconocida');
    if (clean.email) assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email), 'Correo inválido');
    if (collection === 'users')
      assert(String(clean.email).endsWith('@example.com'), 'Usa un correo ficticio example.com');
    if (collection === 'users')
      assert(
        ['administrador', 'colaborador'].includes(clean.role) &&
          ['activo', 'pendiente', 'retirado'].includes(clean.status),
        'Rol o estado de integrante inválido',
      );
    if (collection === 'alert_rules') {
      assert(['inmediata', 'diaria', 'semanal'].includes(clean.frequency), 'Frecuencia inválida');
      assert(
        clean.channels.every((c: string) => ['push', 'email'].includes(c)),
        'Canal inválido',
      );
    }
    if (collection === 'delegations') {
      assert(
        /^\d{4}-\d{2}-\d{2}$/.test(clean.starts_on) &&
          /^\d{4}-\d{2}-\d{2}$/.test(clean.ends_on) &&
          clean.starts_on <= clean.ends_on &&
          !Number.isNaN(Date.parse(clean.starts_on)) &&
          !Number.isNaN(Date.parse(clean.ends_on)),
        'Rango de fechas inválido',
      );
      assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.recipient_email), 'Correo inválido');
      assert(['avisos_publicos', 'segun_rol'].includes(clean.scope), 'Alcance inválido');
    }
    if (collection === 'documents')
      assert(
        [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ].includes(clean.mime_type) &&
          clean.size_bytes > 0 &&
          clean.size_bytes <= 10 * 1024 * 1024,
        'Usa PDF, DOCX o XLSX hasta 10 MB',
      );
  }
  rebuildLinks(scope: string) {
    this.db.prepare('DELETE FROM record_links WHERE scope=?').run(scope);
    const rows = this.db
      .prepare('SELECT collection,id,body FROM records WHERE scope=?')
      .all(scope) as any[];
    const insert = this.db.prepare('INSERT INTO record_links VALUES(?,?,?,?,?,?,?)');
    for (const { collection, id, body } of rows) {
      const row = JSON.parse(body);
      const link = (field: string, targetCollection: string, targetId: string) => {
        if (!targetId) return;
        const targetScope = privateCollections.includes(targetCollection)
          ? scope === 'catalog'
            ? 'templates'
            : scope
          : 'catalog';
        assert(
          this.get(targetScope, targetCollection, targetId),
          `${collection}/${id}: referencia inexistente ${field} → ${targetId}`,
        );
        insert.run(scope, collection, id, field, targetScope, targetCollection, targetId);
      };
      for (const [field, target] of Object.entries(scalarRefs))
        if (row[field]) link(field, target, row[field]);
      for (const [field, target] of Object.entries(arrayRefs))
        for (const value of row[field] || []) link(field, target, value);
      if (row.target_type && row.target_id) {
        assert(targets[row.target_type], 'Tipo de destino inválido');
        link('target_id', targets[row.target_type], row.target_id);
      }
      if (collection === 'applications') {
        for (const uid of row.team_user_ids)
          assert(
            this.get(scope, 'users', uid)?.company_id === row.company_id,
            'El equipo debe pertenecer a la empresa',
          );
        if (row.solution_id)
          assert(
            this.get(scope, 'solutions', row.solution_id)?.company_id === row.company_id,
            'La solución debe pertenecer a la empresa',
          );
        for (const did of row.document_ids) {
          const doc = this.get(scope, 'documents', did);
          assert(
            doc && doc.company_id === row.company_id && doc.application_id === id,
            'Documento de otra empresa o postulación',
          );
        }
        const history = this.rows(scope, 'application_events')
          .filter((e) => e.application_id === id)
          .sort((a, b) => a.at.localeCompare(b.at));
        if (history.length)
          assert(
            history.at(-1)!.state === row.state,
            'El estado y el último evento deben coincidir',
          );
      }
      if (collection === 'documents') {
        const app = this.get(scope, 'applications', row.application_id);
        assert(app?.company_id === row.company_id, 'Documento de otra empresa');
      }
      if (collection === 'solutions')
        for (const did of row.evidence_document_ids || [])
          assert(
            this.get(scope, 'documents', did)?.company_id === row.company_id,
            'La evidencia debe pertenecer a la empresa',
          );
      if (row.user_id && row.company_id)
        assert(
          this.get(scope, 'users', row.user_id)?.company_id === row.company_id,
          'Usuario de otra empresa',
        );
      if (row.target_type === 'application') {
        const owner = this.get(scope, 'users', row.user_id);
        assert(
          this.get(scope, 'applications', row.target_id)?.company_id === owner?.company_id,
          'Destino privado de otra empresa',
        );
      }
      if (collection === 'delegations') {
        const owner = this.get(scope, 'users', row.user_id);
        const team = this.rows(scope, 'users').find(
          (u) =>
            u.email === row.recipient_email &&
            u.company_id === owner?.company_id &&
            u.status === 'activo',
        );
        assert(
          team || row.scope === 'avisos_publicos',
          'Un correo alternativo solo recibe avisos públicos',
        );
      }
    }
  }
  batch(scope: string, changes: Change[], actor = 'agent', preview = false) {
    assert(this.scope(scope), 'Ámbito inexistente', 404);
    assert(changes.length > 0 && changes.length <= 1000, 'Lote inválido');
    const id = randomUUID();
    const audit: any[] = [];
    const run = () => {
      for (const c of changes) {
        assert(
          privateCollections.includes(c.collection) ? scope !== 'catalog' : scope === 'catalog',
          'Colección incompatible con el ámbito',
        );
        const old = this.get(scope, c.collection, c.id);
        assert(c.expectedRevision !== undefined, 'expectedRevision requerido (0 al crear)');
        assert(
          (old ? old._rev : 0) === c.expectedRevision,
          'El registro cambió; vuelve a leerlo',
          409,
        );
        if (c.value) {
          assert(c.id === c.value.id, 'El ID no se puede cambiar');
          this.validate(c.collection, c.value);
          this.rawPut(scope, c.collection, c.value);
        } else {
          assert(old, 'Registro inexistente', 404);
          this.db
            .prepare('DELETE FROM records WHERE scope=? AND collection=? AND id=?')
            .run(scope, c.collection, c.id);
        }
        const after = this.get(scope, c.collection, c.id);
        const clean = (v: any) => {
          if (!v) return null;
          const { _rev, ...r } = v;
          return JSON.stringify(r);
        };
        audit.push({
          collection: c.collection,
          id: c.id,
          before: old || null,
          after: after || null,
        });
        this.db
          .prepare(
            'INSERT INTO audit(batch_id,actor,at,scope,collection,record_id,before_json,after_json,after_revision) VALUES(?,?,?,?,?,?,?,?,?)',
          )
          .run(
            id,
            actor,
            new Date().toISOString(),
            scope,
            c.collection,
            c.id,
            clean(old),
            clean(after),
            after ? after._rev : 0,
          );
      }
      this.rebuildLinks(scope);
      if (scope === 'catalog')
        for (const s of this.db
          .prepare('SELECT id FROM scopes WHERE id<>?')
          .all('catalog') as any[])
          this.rebuildLinks(s.id);
      this.db.prepare('UPDATE scopes SET revision=revision+1 WHERE id=?').run(scope);
    };
    if (preview) {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        run();
      } finally {
        this.db.exec('ROLLBACK');
      }
    } else this.transaction(run);
    return { batchId: id, preview, changes: audit };
  }
  selectProfile(scope: string, userId: string) {
    const user = this.get(scope, 'users', userId);
    assert(user?.demo && user.status === 'activo', 'Perfil demo no disponible');
    this.db
      .prepare('UPDATE scopes SET active_user=?,revision=revision+1 WHERE id=?')
      .run(userId, scope);
  }
  reset(scope: string) {
    assert(this.scope(scope)?.kind === 'session', 'Solo se reinician sesiones');
    this.transaction(() => {
      const changes: Change[] = [];
      for (const collection of privateCollections) {
        const templates = this.rows('templates', collection);
        for (const r of templates)
          changes.push({
            collection,
            id: r.id,
            value: r,
            expectedRevision: this.get(scope, collection, r.id)?._rev || 0,
          });
        for (const r of this.rows(scope, collection))
          if (!templates.some((t) => t.id === r.id))
            changes.push({ collection, id: r.id, value: null, expectedRevision: r._rev });
      }
      this.batch(scope, changes, this.scope(scope).active_user || 'reset');
      this.db
        .prepare('UPDATE scopes SET active_user=?,demo_now=?,revision=revision+1 WHERE id=?')
        .run(seed.meta.default_user_id, this.scope('templates').demo_now, scope);
    });
  }
  clock(scope: string, now: string, actor = 'agent') {
    assert(this.scope(scope) && scope !== 'catalog', 'Ámbito de reloj inválido');
    assert(!Number.isNaN(Date.parse(now)), 'Fecha inválida');
    const before = this.scope(scope).demo_now;
    this.transaction(() => {
      this.db
        .prepare('UPDATE scopes SET demo_now=?,revision=revision+1 WHERE id=?')
        .run(now, scope);
      this.db
        .prepare(
          'INSERT INTO audit(batch_id,actor,at,scope,collection,record_id,before_json,after_json,after_revision) VALUES(?,?,?,?,?,?,?,?,?)',
        )
        .run(
          randomUUID(),
          actor,
          new Date().toISOString(),
          scope,
          'clock',
          scope,
          JSON.stringify(before),
          JSON.stringify(now),
          this.scope(scope).revision,
        );
    });
  }
  restoreBatch(batchId: string, actor = 'agent') {
    const entries = this.db
      .prepare('SELECT * FROM audit WHERE batch_id=? ORDER BY id DESC')
      .all(batchId) as any[];
    assert(entries.length, 'Lote inexistente', 404);
    const scope = entries[0].scope;
    assert(
      entries.every((e) => e.scope === scope && e.collection !== 'clock'),
      'Restauración de este lote no disponible',
    );
    const changes = entries.map((e) => {
      const current = this.get(scope, e.collection, e.record_id);
      assert(
        (current ? current._rev : 0) === e.after_revision,
        'Cambios posteriores impiden restaurar',
        409,
      );
      return {
        collection: e.collection,
        id: e.record_id,
        value: e.before_json ? JSON.parse(e.before_json) : null,
        expectedRevision: current ? current._rev : 0,
      };
    });
    return this.batch(scope, changes, actor);
  }
  exportSnapshot(): DatabaseSnapshot {
    return {
      migrations: this.db.prepare('SELECT * FROM migrations ORDER BY version').all(),
      scopes: this.db.prepare('SELECT * FROM scopes ORDER BY id').all(),
      records: this.db.prepare('SELECT * FROM records ORDER BY scope,collection,id').all(),
      record_links: this.db
        .prepare(
          'SELECT * FROM record_links ORDER BY scope,collection,id,field,target_scope,target_collection,target_id',
        )
        .all(),
      audit: this.db.prepare('SELECT * FROM audit ORDER BY id').all(),
      settings: this.db.prepare('SELECT * FROM settings ORDER BY key').all(),
    };
  }
  importSnapshot(snapshot: DatabaseSnapshot) {
    this.transaction(() => {
      this.db.exec(
        'PRAGMA defer_foreign_keys=ON; DELETE FROM record_links; DELETE FROM records; DELETE FROM audit; DELETE FROM scopes; DELETE FROM settings; DELETE FROM migrations;',
      );
      const insert = (sql: string, rows: any[], fields: string[]) => {
        const statement = this.db.prepare(sql);
        for (const row of rows) statement.run(...fields.map((field) => row[field] ?? null));
      };
      insert('INSERT INTO migrations(version,applied_at) VALUES(?,?)', snapshot.migrations, [
        'version',
        'applied_at',
      ]);
      insert(
        'INSERT INTO scopes(id,kind,label,active_user,demo_now,revision,created_at) VALUES(?,?,?,?,?,?,?)',
        snapshot.scopes,
        ['id', 'kind', 'label', 'active_user', 'demo_now', 'revision', 'created_at'],
      );
      insert(
        'INSERT INTO records(scope,collection,id,body,company_id,user_id,application_id,revision) VALUES(?,?,?,?,?,?,?,?)',
        snapshot.records,
        [
          'scope',
          'collection',
          'id',
          'body',
          'company_id',
          'user_id',
          'application_id',
          'revision',
        ],
      );
      insert(
        'INSERT INTO record_links(scope,collection,id,field,target_scope,target_collection,target_id) VALUES(?,?,?,?,?,?,?)',
        snapshot.record_links,
        ['scope', 'collection', 'id', 'field', 'target_scope', 'target_collection', 'target_id'],
      );
      insert(
        'INSERT INTO audit(id,batch_id,actor,at,scope,collection,record_id,before_json,after_json,after_revision) VALUES(?,?,?,?,?,?,?,?,?,?)',
        snapshot.audit,
        [
          'id',
          'batch_id',
          'actor',
          'at',
          'scope',
          'collection',
          'record_id',
          'before_json',
          'after_json',
          'after_revision',
        ],
      );
      insert('INSERT INTO settings(key,value) VALUES(?,?)', snapshot.settings, ['key', 'value']);
    });
  }
  close() {
    this.db.close();
  }
}
