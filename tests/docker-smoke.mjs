import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const suffix = randomBytes(5).toString('hex'),
  name = 'expande-qa-' + suffix,
  volume = name + '-data';
const password = randomBytes(24).toString('hex'),
  secret = randomBytes(32).toString('hex');
mkdirSync('.local', { recursive: true });
const envFile = resolve('.local', name + '.env'),
  changeFile = resolve('.local', name + '.json');
writeFileSync(
  envFile,
  `NODE_ENV=production\nDEMO_ACCESS_PASSWORD=${password}\nCOOKIE_SECRET=${secret}\nCOOKIE_SECURE=false\n`,
);
const docker = (...args) =>
  execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const json = (s) => JSON.parse(s.slice(s.indexOf('{')));
try {
  docker('volume', 'create', '--label', 'expande.test=true', volume);
  docker(
    'run',
    '--detach',
    '--rm',
    '--name',
    name,
    '--env-file',
    envFile,
    '--publish',
    '127.0.0.1::3001',
    '--mount',
    `type=volume,src=${volume},dst=/app/data`,
    'expande-demo:local',
  );
  let base = `http://127.0.0.1:${docker('port', name, '3001/tcp').split(':').at(-1)}`;
  const ready = async () => {
    for (let i = 0; i < 30; i++) {
      try {
        if ((await fetch(base + '/api/health')).ok) return;
      } catch {}
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error('Container did not become ready');
  };
  await ready();
  assert.equal((await fetch(base + '/api/v1/bootstrap')).status, 401);
  const gate = await fetch(base + '/api/v1/access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  assert.equal(gate.status, 200);
  let cookie = gate.headers
    .getSetCookie()
    .map((v) => v.split(';')[0])
    .join('; ');
  const bootstrap = async () => {
    const r = await fetch(base + '/api/v1/bootstrap', { headers: { Cookie: cookie } });
    assert.equal(r.status, 200);
    return r.json();
  };
  const initial = await fetch(base + '/api/v1/bootstrap', { headers: { Cookie: cookie } });
  cookie +=
    '; ' +
    initial.headers
      .getSetCookie()
      .map((v) => v.split(';')[0])
      .join('; ');
  const data = await initial.json();
  const save = await fetch(base + '/api/v1/actions', {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'saved', target_type: 'challenge', target_id: 'CH-D03' }),
  });
  assert.equal(save.status, 200);
  assert.equal((await save.json()).saved_items.length, 5);
  docker('restart', name);
  base = `http://127.0.0.1:${docker('port', name, '3001/tcp').split(':').at(-1)}`;
  await ready();
  assert.equal((await bootstrap()).saved_items.length, 5);
  assert.equal((await bootstrap()).context.sessionId, data.context.sessionId);
  const r = data.challenges.find((v) => v.id === 'CH-D01');
  writeFileSync(
    changeFile,
    JSON.stringify([
      {
        collection: 'challenges',
        id: r.id,
        expectedRevision: r._rev,
        value: { ...r, title: 'Docker agent test' },
      },
    ]),
  );
  docker('cp', changeFile, name + ':/app/data/changes.json');
  const cli = (...args) => docker('exec', name, 'npm', 'run', 'data', '--', ...args);
  assert.equal(
    json(cli('preview', '--scope', 'catalog', '--file', '/app/data/changes.json')).preview,
    true,
  );
  const applied = json(
    cli(
      'apply',
      '--scope',
      'catalog',
      '--file',
      '/app/data/changes.json',
      '--actor',
      'docker-test',
    ),
  );
  assert.equal(
    (await bootstrap()).challenges.find((v) => v.id === r.id).title,
    'Docker agent test',
  );
  cli('restore', '--batch', applied.batchId);
  assert.equal((await bootstrap()).challenges.find((v) => v.id === r.id).title, r.title);
  cli('backup', '--output', '/app/backups/verified.sqlite');
  console.log(
    'Docker verification passed: password gate, session persistence after restart, CLI preview/apply/restore, consistent backup.',
  );
} catch (e) {
  try {
    console.error(docker('logs', '--tail', '30', name));
  } catch {}
  throw e;
} finally {
  try {
    docker('stop', '--time', '3', name);
  } catch {}
  try {
    if (JSON.parse(docker('volume', 'inspect', volume))[0].Labels?.['expande.test'] === 'true')
      docker('volume', 'rm', volume);
  } catch {}
  try {
    unlinkSync(envFile);
  } catch {}
  try {
    unlinkSync(changeFile);
  } catch {}
}
