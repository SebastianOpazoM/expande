import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('Vercel Function includes only the required EXPANDE runtime files', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const includeFiles = config.functions?.['api/index.ts']?.includeFiles;

  assert.equal(
    includeFiles,
    '{server/**/*,shared/**/*,source-package/Expande_paquete_para_Figma/{03_datos_mockup,04_esquema_datos}.json}',
  );

  for (const path of [
    'server/app.ts',
    'server/actions.ts',
    'server/store.ts',
    'server/seed.ts',
    'server/remote-store.ts',
    'server/migration.sql',
    'shared/model.ts',
    'shared/funding.ts',
    'source-package/Expande_paquete_para_Figma/03_datos_mockup.json',
    'source-package/Expande_paquete_para_Figma/04_esquema_datos.json',
  ])
    assert(existsSync(path), `Falta el archivo de runtime ${path}`);

  for (const excluded of ['public', 'dist', 'tests', '.env', '.local'])
    assert(!includeFiles.includes(excluded), `${excluded} no debe entrar en la Function`);
});
