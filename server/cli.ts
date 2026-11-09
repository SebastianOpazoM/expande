import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Store, assert, type Change } from './store.ts';
import { schema, seed } from './seed.ts';
import { action } from './actions.ts';
import { privateCollections } from '../shared/model.ts';
const args = process.argv.slice(2);
if (args[0] === 'data') args.shift();
const command = args.shift() || 'help';
const opt = (name: string) => {
  const p = args.indexOf('--' + name);
  return p < 0 ? undefined : args[p + 1];
};
const file = () => {
  const p = opt('file');
  assert(p, '--file requerido');
  return JSON.parse(readFileSync(resolve(p), 'utf8'));
};
const out = (v: any) => console.log(JSON.stringify(v, null, 2));
const store = new Store();
try {
  if (command === 'help')
    out({
      usage: 'npm run data -- <command> [--scope catalog|templates|SESSION_ID] [options]',
      commands: {
        collections: 'Lista colecciones y ámbitos',
        schema: '--collection challenges',
        sessions: 'Lista IDs y perfiles activos',
        list: '--scope ... --collection ... [--search texto]',
        get: '--scope ... --collection ... --id ...',
        preview: '--scope ... --file cambios.json',
        apply: '--scope ... --file cambios.json [--actor nombre]',
        action: '--scope SESSION_ID --file accion.json',
        history: '[--scope ...]',
        restore: '--batch ID [--actor nombre]',
        export: '--scope ... --output archivo.json',
        backup: '--output backups/copia.sqlite',
        'restore-backup': '--file copia.sqlite --confirm (detener servidor antes)',
        clock: '--scope SESSION_ID|templates --now ISO',
        reset: '--scope SESSION_ID --confirm',
        'restore-catalog': '--confirm (restaura contenido original; conserva sesiones)',
        init: 'Inicializa esquema y semilla',
      },
    });
  else if (command === 'init') out({ ok: true, database: resolve(store.path) });
  else if (command === 'collections')
    out(
      Object.keys(schema.properties)
        .filter((k) => schema.properties[k].items)
        .concat('activity')
        .map((collection) => ({
          collection,
          scope: privateCollections.includes(collection) ? 'templates/session' : 'catalog',
        })),
    );
  else if (command === 'schema') {
    assert(opt('collection'), '--collection requerido');
    out(store.validators[opt('collection')!]?.schema || { type: 'object' });
  } else if (command === 'sessions')
    out(
      store.db.prepare("SELECT * FROM scopes WHERE kind='session' ORDER BY created_at DESC").all(),
    );
  else if (command === 'history')
    out(
      opt('scope')
        ? store.db
            .prepare('SELECT * FROM audit WHERE scope=? ORDER BY id DESC LIMIT 200')
            .all(opt('scope')!)
        : store.db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT 200').all(),
    );
  else if (command === 'restore') out(store.restoreBatch(opt('batch') || '', opt('actor')));
  else if (command === 'backup') {
    const p = opt('output');
    assert(p, '--output requerido');
    assert(!existsSync(p), 'El destino ya existe');
    store.db.exec(`VACUUM INTO '${resolve(p).replaceAll("'", "''")}'`);
    out({ ok: true, path: resolve(p) });
  } else if (command === 'restore-backup') {
    assert(args.includes('--confirm'), 'Requiere --confirm y servidor detenido');
    const p = opt('file');
    assert(p && existsSync(p), 'Copia no encontrada');
    assert(resolve(p) !== resolve(store.path), 'Usa un archivo de copia distinto');
    store.db.exec(`ATTACH DATABASE '${resolve(p).replaceAll("'", "''")}' AS snapshot`);
    assert(
      (store.db.prepare('PRAGMA snapshot.integrity_check').get() as any).integrity_check === 'ok',
      'Copia corrupta',
    );
    assert(
      (store.db.prepare('SELECT max(version) v FROM snapshot.migrations').get() as any).v === 1,
      'Versión incompatible',
    );
    store.transaction(() => {
      store.db.exec(
        'PRAGMA defer_foreign_keys=ON; DELETE FROM record_links; DELETE FROM records; DELETE FROM scopes; DELETE FROM audit; DELETE FROM settings; INSERT INTO scopes SELECT * FROM snapshot.scopes; INSERT INTO records SELECT * FROM snapshot.records; INSERT INTO record_links SELECT * FROM snapshot.record_links; INSERT INTO audit SELECT * FROM snapshot.audit; INSERT INTO settings SELECT * FROM snapshot.settings; UPDATE scopes SET revision=revision+1;',
      );
    });
    out({ ok: true });
  } else if (command === 'restore-catalog') {
    assert(args.includes('--confirm'), 'Requiere --confirm');
    const changes: Change[] = [];
    for (const [collection, rows] of Object.entries(seed))
      if (Array.isArray(rows) && !privateCollections.includes(collection)) {
        for (const row of rows)
          changes.push({
            collection,
            id: row.id,
            value: row,
            expectedRevision: store.get('catalog', collection, row.id)?._rev || 0,
          });
        for (const row of store.rows('catalog', collection))
          if (!rows.some((r) => r.id === row.id))
            changes.push({ collection, id: row.id, value: null, expectedRevision: row._rev });
      }
    out(store.batch('catalog', changes, opt('actor')));
  } else {
    const scope = opt('scope');
    assert(
      scope && store.scope(scope),
      '--scope explícito requerido: catalog, templates o ID de sesión',
    );
    const collection = opt('collection') || '';
    if (command === 'list')
      out(
        store
          .rows(scope, collection)
          .filter(
            (r) =>
              !opt('search') ||
              JSON.stringify(r).toLowerCase().includes(opt('search')!.toLowerCase()),
          ),
      );
    else if (command === 'get') out(store.get(scope, collection, opt('id') || ''));
    else if (command === 'preview' || command === 'apply')
      out(store.batch(scope, file(), opt('actor') || 'agent', command === 'preview'));
    else if (command === 'action') {
      assert(store.scope(scope).kind === 'session', 'Las acciones requieren una sesión');
      out(action(store, scope, file(), opt('actor') || 'agent'));
    } else if (command === 'clock') {
      store.clock(scope, opt('now') || '', opt('actor'));
      out({ ok: true });
    } else if (command === 'reset') {
      assert(args.includes('--confirm'), 'Requiere --confirm');
      store.reset(scope);
      out({ ok: true });
    } else if (command === 'export') {
      const value =
        scope === 'catalog'
          ? Object.fromEntries(
              Object.keys(schema.properties)
                .filter((k) => schema.properties[k].items)
                .map((k) => [k, store.rows(scope, k)]),
            )
          : store.data(scope);
      assert(opt('output'), '--output requerido');
      writeFileSync(opt('output')!, JSON.stringify(value, null, 2));
      out({ ok: true });
    } else throw new Error('Comando desconocido; usa help');
  }
} catch (e: any) {
  console.error(JSON.stringify({ error: e.message, code: e.code || 'ERROR' }));
  process.exitCode = 1;
} finally {
  store.close();
}
