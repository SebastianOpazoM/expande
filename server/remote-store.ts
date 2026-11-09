import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createClient, type Client, type InStatement, type Transaction } from '@libsql/client';
import { Store, DomainError, type DatabaseSnapshot } from './store.ts';

const tableQueries: Record<keyof DatabaseSnapshot, string> = {
  migrations: 'SELECT * FROM migrations ORDER BY version',
  scopes: 'SELECT * FROM scopes ORDER BY id',
  records: 'SELECT * FROM records ORDER BY scope,collection,id',
  record_links:
    'SELECT * FROM record_links ORDER BY scope,collection,id,field,target_scope,target_collection,target_id',
  audit: 'SELECT * FROM audit ORDER BY id',
  settings: 'SELECT * FROM settings ORDER BY key',
};

const insertPlans: Array<{
  table: keyof DatabaseSnapshot;
  sql: string;
  fields: string[];
}> = [
  {
    table: 'migrations',
    sql: 'INSERT INTO migrations(version,applied_at) VALUES(?,?)',
    fields: ['version', 'applied_at'],
  },
  {
    table: 'scopes',
    sql: 'INSERT INTO scopes(id,kind,label,active_user,demo_now,revision,created_at) VALUES(?,?,?,?,?,?,?)',
    fields: ['id', 'kind', 'label', 'active_user', 'demo_now', 'revision', 'created_at'],
  },
  {
    table: 'records',
    sql: 'INSERT INTO records(scope,collection,id,body,company_id,user_id,application_id,revision) VALUES(?,?,?,?,?,?,?,?)',
    fields: [
      'scope',
      'collection',
      'id',
      'body',
      'company_id',
      'user_id',
      'application_id',
      'revision',
    ],
  },
  {
    table: 'record_links',
    sql: 'INSERT INTO record_links(scope,collection,id,field,target_scope,target_collection,target_id) VALUES(?,?,?,?,?,?,?)',
    fields: [
      'scope',
      'collection',
      'id',
      'field',
      'target_scope',
      'target_collection',
      'target_id',
    ],
  },
  {
    table: 'audit',
    sql: 'INSERT INTO audit(id,batch_id,actor,at,scope,collection,record_id,before_json,after_json,after_revision) VALUES(?,?,?,?,?,?,?,?,?,?)',
    fields: [
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
  },
  {
    table: 'settings',
    sql: 'INSERT INTO settings(key,value) VALUES(?,?)',
    fields: ['key', 'value'],
  },
];

function plainRows(rows: Iterable<any>): any[] {
  return Array.from(rows, (row) => Object.fromEntries(Object.entries(row)));
}

export class RemoteStore {
  private initialized?: Promise<void>;
  constructor(private client: Client) {}

  static fromEnvironment() {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url || !authToken)
      throw new DomainError(503, 'La base de datos remota no está configurada', 'DATABASE');
    return new RemoteStore(createClient({ url, authToken }));
  }

  private initialize() {
    return (this.initialized ??= this.client.executeMultiple(
      readFileSync(new URL('./migration.sql', import.meta.url), 'utf8'),
    ));
  }

  async ready() {
    await this.initialize();
    const result = await this.client.execute(
      "SELECT COUNT(*) ready FROM scopes WHERE id IN ('catalog','templates')",
    );
    return Number(result.rows[0]?.ready || 0) === 2;
  }

  private async snapshot(transaction: Transaction): Promise<DatabaseSnapshot> {
    const snapshot = {} as DatabaseSnapshot;
    for (const [table, sql] of Object.entries(tableQueries) as [keyof DatabaseSnapshot, string][]) {
      const result = await transaction.execute(sql);
      snapshot[table] = plainRows(result.rows);
    }
    return snapshot;
  }

  private statements(snapshot: DatabaseSnapshot): InStatement[] {
    const statements: InStatement[] = [];
    for (const plan of insertPlans)
      for (const row of snapshot[plan.table])
        statements.push({
          sql: plan.sql,
          args: plan.fields.map((field) => row[field] ?? null),
        });
    return statements;
  }

  private async replace(transaction: Transaction, snapshot: DatabaseSnapshot) {
    await transaction.executeMultiple(
      'PRAGMA defer_foreign_keys=ON; DELETE FROM record_links; DELETE FROM records; DELETE FROM audit; DELETE FROM scopes; DELETE FROM settings; DELETE FROM migrations;',
    );
    const statements = this.statements(snapshot);
    for (let index = 0; index < statements.length; index += 100)
      await transaction.batch(statements.slice(index, index + 100));
  }

  async use<T>(write: boolean, callback: (store: Store) => T | Promise<T>): Promise<T> {
    await this.initialize();
    const transaction = await this.client.transaction(write ? 'write' : 'read');
    let local: Store | undefined;
    try {
      const before = await this.snapshot(transaction);
      if (!['catalog', 'templates'].every((id) => before.scopes.some((scope) => scope.id === id)))
        throw new DomainError(
          503,
          'La base de datos de la demostración aún no ha sido importada',
          'DATABASE_NOT_INITIALIZED',
        );
      local = new Store(':memory:');
      local.importSnapshot(before);
      const value = await callback(local);
      if (write) {
        const after = local.exportSnapshot();
        if (JSON.stringify(after) !== JSON.stringify(before))
          await this.replace(transaction, after);
        await transaction.commit();
      } else await transaction.rollback();
      return value;
    } catch (error) {
      if (!transaction.closed) await transaction.rollback();
      throw error;
    } finally {
      local?.close();
      transaction.close();
    }
  }

  async importSnapshot(sourcePath: string) {
    await this.initialize();
    const directory = mkdtempSync(join(tmpdir(), 'expande-import-'));
    const copy = join(directory, 'snapshot.sqlite');
    copyFileSync(sourcePath, copy);
    let snapshot: DatabaseSnapshot;
    let source: Store | undefined;
    try {
      let inspection: DatabaseSync | undefined;
      try {
        inspection = new DatabaseSync(copy, { readOnly: true });
        const baseScopes = inspection
          .prepare("SELECT COUNT(*) count FROM scopes WHERE id IN ('catalog','templates')")
          .get() as any;
        if (Number(baseScopes?.count || 0) !== 2)
          throw new Error('faltan los ámbitos catalog/templates');
      } catch (error: any) {
        throw new DomainError(
          400,
          `El archivo no es una instantánea EXPANDE válida: ${error.message}`,
          'INVALID_SNAPSHOT',
        );
      } finally {
        inspection?.close();
      }
      source = new Store(copy);
      snapshot = source.exportSnapshot();
    } finally {
      source?.close();
      rmSync(directory, { recursive: true, force: true });
    }
    const transaction = await this.client.transaction('write');
    try {
      const existing = await transaction.execute('SELECT COUNT(*) count FROM scopes');
      if (Number(existing.rows[0]?.count || 0) > 0)
        throw new DomainError(
          409,
          'La base de datos remota no está vacía; se rechazó la importación',
          'REMOTE_NOT_EMPTY',
        );
      await this.replace(transaction, snapshot);
      await transaction.commit();
      return {
        scopes: snapshot.scopes.length,
        records: snapshot.records.length,
        audit: snapshot.audit.length,
      };
    } catch (error) {
      if (!transaction.closed) await transaction.rollback();
      throw error;
    } finally {
      transaction.close();
    }
  }

  close() {
    this.client.close();
  }
}
