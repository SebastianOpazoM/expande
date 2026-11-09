import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
test('CLI: preview/apply/history/restore, consistent backup/restore and export', () => {
  const dir = mkdtempSync(join(tmpdir(), 'expande-cli-')),
    database = join(dir, 'test.sqlite');
  const cli = (...args: string[]) =>
    JSON.parse(
      execFileSync(process.execPath, ['--experimental-transform-types', 'server/cli.ts', ...args], {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_PATH: database },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    );
  try {
    cli('init');
    const r = cli('get', '--scope', 'catalog', '--collection', 'challenges', '--id', 'CH-D01');
    const edits = join(dir, 'edit.json');
    writeFileSync(
      edits,
      JSON.stringify([
        {
          collection: 'challenges',
          id: r.id,
          expectedRevision: r._rev,
          value: { ...r, title: 'CLI edit test' },
        },
      ]),
    );
    assert.equal(cli('preview', '--scope', 'catalog', '--file', edits).preview, true);
    assert.equal(
      cli('get', '--scope', 'catalog', '--collection', 'challenges', '--id', r.id).title,
      r.title,
    );
    const applied = cli('apply', '--scope', 'catalog', '--file', edits);
    assert.equal(
      cli('get', '--scope', 'catalog', '--collection', 'challenges', '--id', r.id).title,
      'CLI edit test',
    );
    assert.ok(
      cli('history', '--scope', 'catalog').some((a: any) => a.batch_id === applied.batchId),
    );
    cli('restore', '--batch', applied.batchId);
    const original = cli('get', '--scope', 'catalog', '--collection', 'challenges', '--id', r.id);
    const backup = join(dir, 'before.sqlite');
    cli('backup', '--output', backup);
    writeFileSync(
      edits,
      JSON.stringify([
        {
          collection: 'challenges',
          id: r.id,
          expectedRevision: original._rev,
          value: { ...original, title: 'After backup' },
        },
      ]),
    );
    cli('apply', '--scope', 'catalog', '--file', edits);
    cli('restore-backup', '--file', backup, '--confirm');
    assert.equal(
      cli('get', '--scope', 'catalog', '--collection', 'challenges', '--id', r.id).title,
      r.title,
    );
    const exported = join(dir, 'catalog.json');
    cli('export', '--scope', 'catalog', '--output', exported);
    assert.equal(JSON.parse(readFileSync(exported, 'utf8')).challenges.length, 12);
    assert.ok(
      cli('collections')
        .find((c: any) => c.collection === 'activity')
        .scope.includes('session'),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
