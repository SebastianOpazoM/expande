import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    assert.notEqual(specifier, '@fastify/static', 'Vercel API startup loaded @fastify/static');
    return nextResolve(specifier, context);
  },
});

const [{ createApp }, { Store }] = await Promise.all([
  import('../../server/app.ts'),
  import('../../server/store.ts'),
]);
const originalDirectory = process.cwd();
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'expande-vercel-startup-'));
mkdirSync(join(temporaryDirectory, 'dist'));
writeFileSync(join(temporaryDirectory, 'dist/index.html'), '<!doctype html>');
process.chdir(temporaryDirectory);
const store = new Store(':memory:');
let app;
try {
  app = await createApp(store, { serveStatic: false, password: '' });
  await app.ready();
  assert.equal((await app.inject('/api/health')).statusCode, 200);
} finally {
  await app?.close();
  store.close();
  process.chdir(originalDirectory);
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
