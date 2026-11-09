import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RemoteStore } from './remote-store.ts';
import { assert } from './store.ts';
import { action } from './actions.ts';

const args = process.argv.slice(2);
const command = args.shift() || 'help';
const opt = (name: string) => {
  const index = args.indexOf('--' + name);
  return index < 0 ? undefined : args[index + 1];
};
const file = () => {
  const path = opt('file');
  assert(path, '--file requerido');
  return JSON.parse(readFileSync(resolve(path), 'utf8'));
};
const out = (value: any) => console.log(JSON.stringify(value, null, 2));
const help = {
  usage: 'npm run data:remote -- <command> [--scope catalog|templates|SESSION_ID] [options]',
  commands: {
    status: 'Comprueba conexión e importación',
    import: '--file demo/expande.sqlite --confirm-empty',
    sessions: 'Lista IDs y perfiles activos',
    history: '[--scope ...]',
    list: '--scope ... --collection ... [--search texto]',
    get: '--scope ... --collection ... --id ...',
    preview: '--scope ... --file cambios.json',
    apply: '--scope ... --file cambios.json [--actor nombre]',
    action: '--scope SESSION_ID --file accion.json [--actor nombre]',
    restore: '--batch ID [--actor nombre]',
  },
};
const commands = new Set(['status', 'import', ...Object.keys(help.commands)]);

try {
  if (command === 'help') out(help);
  else if (!commands.has(command)) throw new Error('Comando desconocido; usa help');
  else {
    const remote = RemoteStore.fromEnvironment();
    try {
      if (command === 'status') out({ ok: true, databaseReady: await remote.ready() });
      else if (command === 'import') {
        assert(args.includes('--confirm-empty'), 'Requiere --confirm-empty');
        const path = opt('file');
        assert(path, '--file requerido');
        out({ ok: true, ...(await remote.importSnapshot(resolve(path))) });
      } else {
        const writes = ['apply', 'action', 'restore'].includes(command);
        out(
          await remote.use(writes, (store) => {
            const scope = opt('scope');
            if (command === 'sessions')
              return store.db
                .prepare("SELECT * FROM scopes WHERE kind='session' ORDER BY created_at DESC")
                .all();
            if (command === 'history')
              return scope
                ? store.db
                    .prepare('SELECT * FROM audit WHERE scope=? ORDER BY id DESC LIMIT 200')
                    .all(scope)
                : store.db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT 200').all();
            if (command === 'restore') return store.restoreBatch(opt('batch') || '', opt('actor'));
            assert(
              scope && store.scope(scope),
              '--scope explícito requerido: catalog, templates o ID de sesión',
            );
            const collection = opt('collection') || '';
            if (command === 'list')
              return store
                .rows(scope, collection)
                .filter(
                  (row) =>
                    !opt('search') ||
                    JSON.stringify(row).toLowerCase().includes(opt('search')!.toLowerCase()),
                );
            if (command === 'get') return store.get(scope, collection, opt('id') || '');
            if (command === 'preview' || command === 'apply')
              return store.batch(scope, file(), opt('actor') || 'agent', command === 'preview');
            if (command === 'action') {
              assert(store.scope(scope).kind === 'session', 'Las acciones requieren una sesión');
              return action(store, scope, file(), opt('actor') || 'agent');
            }
            throw new Error('Comando desconocido; usa help');
          }),
        );
      }
    } finally {
      remote.close();
    }
  }
} catch (error: any) {
  console.error(JSON.stringify({ error: error.message, code: error.code || 'ERROR' }));
  process.exitCode = 1;
}
