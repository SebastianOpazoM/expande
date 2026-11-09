import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFormacionChanges } from '../server/training-catalogue.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(
  readFileSync(new URL('../content/formacion-library.json', import.meta.url), 'utf8'),
);
const output = resolve(process.argv[2] || '.local/formacion-update.json');
const cli = (...args) => {
  const text = execFileSync(
    process.execPath,
    ['--env-file-if-exists=.env', '--experimental-transform-types', 'server/cli.ts', ...args],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
  return text === 'undefined' ? undefined : JSON.parse(text);
};
const read = (collection, id) =>
  cli('get', '--scope', 'catalog', '--collection', collection, '--id', id);
const changes = buildFormacionChanges(read);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(changes, null, 2) + '\n');
console.log(
  JSON.stringify({
    file: output,
    sources: manifest.sources.length,
    lessons: manifest.lessons.length,
  }),
);
