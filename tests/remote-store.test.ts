import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { createClient } from '@libsql/client';
import { RemoteStore } from '../server/remote-store.ts';
import { Store } from '../server/store.ts';
import { createApp } from '../server/app.ts';

test('remote store imports once and persists isolated sessions and revision conflicts', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'expande-remote-'));
  const remotePath = join(directory, 'remote.sqlite');
  const sourcePath = join(directory, 'source.sqlite');
  const source = new Store(sourcePath);
  source.close();
  const remote = new RemoteStore(createClient({ url: `file:${remotePath}` }));

  assert.equal(await remote.ready(), false);
  const invalidPath = join(directory, 'invalid.sqlite');
  new DatabaseSync(invalidPath).close();
  await assert.rejects(() => remote.importSnapshot(invalidPath), /no es una instantánea EXPANDE/);
  const imported = await remote.importSnapshot(sourcePath);
  assert(imported.records > 0);
  assert.equal(await remote.ready(), true);
  await assert.rejects(() => remote.importSnapshot(sourcePath), /no está vacía/);

  const first = await remote.use(true, (store) => store.createSession('Primera'));
  const second = await remote.use(true, (store) => store.createSession('Segunda'));
  assert.notEqual(first, second);
  await remote.use(false, (store) => {
    assert.equal(store.scope(first).label, 'Primera');
    assert.equal(store.scope(second).label, 'Segunda');
  });

  const row = await remote.use(false, (store) => store.get(first, 'companies', 'EMP-D01')!);
  await remote.use(true, (store) =>
    store.batch(first, [
      {
        collection: 'companies',
        id: row.id,
        expectedRevision: row._rev,
        value: { ...row, description: 'Persistencia remota' },
      },
    ]),
  );
  await assert.rejects(
    () =>
      remote.use(true, (store) =>
        store.batch(first, [
          {
            collection: 'companies',
            id: row.id,
            expectedRevision: row._rev,
            value: { ...row, description: 'Escritura obsoleta' },
          },
        ]),
      ),
    (error: any) => error.status === 409,
  );
  const persisted = await remote.use(false, (store) => store.get(first, 'companies', 'EMP-D01'));
  assert.equal(persisted?.description, 'Persistencia remota');
  remote.close();
});

test('remote Fastify API keeps a visitor session across application instances', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'expande-remote-api-'));
  const remotePath = join(directory, 'remote.sqlite');
  const sourcePath = join(directory, 'source.sqlite');
  new Store(sourcePath).close();
  const secret = 'remote-test-cookie-secret-at-least-32-characters';
  const firstRemote = new RemoteStore(createClient({ url: `file:${remotePath}` }));
  const emptyApp = await createApp(firstRemote, { secret, secure: false, serveStatic: false });
  const unavailable = await emptyApp.inject({ method: 'GET', url: '/api/v1/bootstrap' });
  assert.equal(unavailable.statusCode, 503);
  assert.deepEqual(unavailable.json(), {
    error: {
      code: 'DATABASE_NOT_INITIALIZED',
      message: 'La base de datos de la demostración aún no ha sido importada',
    },
  });
  await emptyApp.close();
  await firstRemote.importSnapshot(sourcePath);
  const firstApp = await createApp(firstRemote, { secret, secure: false, serveStatic: false });
  const first = await firstApp.inject({ method: 'GET', url: '/api/v1/bootstrap' });
  assert.equal(first.statusCode, 200);
  const sessionId = first.json().context.sessionId;
  const setCookie = first.headers['set-cookie'];
  const rawCookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  assert(rawCookie);
  const cookie = rawCookie.split(';', 1)[0];
  await firstApp.close();
  firstRemote.close();

  const secondRemote = new RemoteStore(createClient({ url: `file:${remotePath}` }));
  const secondApp = await createApp(secondRemote, { secret, secure: false, serveStatic: false });
  const health = await secondApp.inject({ method: 'GET', url: '/api/health' });
  assert.deepEqual(health.json(), { ok: true, databaseReady: true });
  const returning = await secondApp.inject({
    method: 'GET',
    url: '/api/v1/bootstrap',
    headers: { cookie },
  });
  assert.equal(returning.statusCode, 200);
  assert.equal(returning.json().context.sessionId, sessionId);
  await secondApp.close();
  secondRemote.close();
});
