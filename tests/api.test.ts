import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.ts';
import { Store } from '../server/store.ts';
test('API: la cookie de visitante sobrevive al reinicio sin secreto de entorno', async () => {
  const s = new Store(':memory:');
  let app = await createApp(s);
  const first = await app.inject('/api/v1/bootstrap');
  const cookie = first.cookies.map((c) => c.name + '=' + c.value).join('; '),
    sid = first.json().context.sessionId;
  await app.close();
  app = await createApp(s);
  const after = await app.inject({ url: '/api/v1/bootstrap', headers: { cookie } });
  assert.equal(after.json().context.sessionId, sid);
  await app.close();
  s.close();
});
test('API: contraseña, cookie, aislamiento, CSRF y validación', async () => {
  const s = new Store(':memory:');
  const app = await createApp(s, {
    password: 'demo-test-password',
    secret: 'test-secret-32-characters-at-least-123',
  });
  assert.equal((await app.inject('/api/v1/bootstrap')).statusCode, 401);
  assert.equal(
    (await app.inject({ method: 'POST', url: '/api/v1/access', payload: { password: 'wrong' } }))
      .statusCode,
    401,
  );
  const gate = await app.inject({
    method: 'POST',
    url: '/api/v1/access',
    payload: { password: 'demo-test-password' },
  });
  const access = gate.cookies.map((c) => c.name + '=' + c.value).join('; ');
  const one = await app.inject({ url: '/api/v1/bootstrap', headers: { cookie: access } });
  assert.equal(one.statusCode, 200);
  const cookie = access + '; ' + one.cookies.map((c) => c.name + '=' + c.value).join('; ');
  const two = await app.inject({ url: '/api/v1/bootstrap', headers: { cookie: access } });
  assert.notEqual(one.json().context.sessionId, two.json().context.sessionId);
  assert.equal(
    (await app.inject({ url: '/api/v1/bootstrap', headers: { cookie } })).json().context.sessionId,
    one.json().context.sessionId,
  );
  const csrf = await app.inject({
    method: 'POST',
    url: '/api/v1/actions',
    headers: { cookie, origin: 'https://evil.example' },
    payload: { type: 'reset', confirm: true },
  });
  assert.equal(csrf.statusCode, 403);
  const good = await app.inject({
    method: 'POST',
    url: '/api/v1/actions',
    headers: { cookie },
    payload: { type: 'saved', target_type: 'challenge', target_id: 'CH-D03' },
  });
  assert.equal(good.statusCode, 200);
  assert.equal(good.json().saved_items.length, 5);
  const other = await app.inject({
    url: '/api/v1/bootstrap',
    headers: { cookie: access + '; ' + two.cookies.map((c) => c.name + '=' + c.value).join('; ') },
  });
  assert.equal(other.json().saved_items.length, 4);
  await app.close();
  s.close();
});
