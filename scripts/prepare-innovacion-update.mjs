import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildInnovationChanges } from '../server/innovation-catalogue.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(process.argv[2] || '.local/innovacion-update.json');
const read = (collection, id) => {
  const result = execFileSync(
    process.execPath,
    [
      '--env-file-if-exists=.env',
      '--experimental-transform-types',
      'server/cli.ts',
      'get',
      '--scope',
      'catalog',
      '--collection',
      collection,
      '--id',
      id,
    ],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
  return result === 'undefined' ? undefined : JSON.parse(result);
};
const changes = buildInnovationChanges(read);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(changes, null, 2) + '\n');
console.log(JSON.stringify({ file: output, changes: changes.length }));
