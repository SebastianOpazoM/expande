import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import staticFiles from '@fastify/static';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Store, DomainError, assert } from './store.ts';
import { action } from './actions.ts';
export async function createApp(
  store = new Store(),
  options: { password?: string; secret?: string; secure?: boolean } = {},
) {
  const password = options.password ?? process.env.DEMO_ACCESS_PASSWORD;
  let persisted = (
    store.db.prepare("SELECT value FROM settings WHERE key='local_cookie_secret'").get() as any
  )?.value;
  if (!persisted) {
    store.db
      .prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)')
      .run('local_cookie_secret', randomBytes(32).toString('hex'));
    persisted = (
      store.db.prepare("SELECT value FROM settings WHERE key='local_cookie_secret'").get() as any
    ).value;
  }
  const secret = options.secret ?? process.env.COOKIE_SECRET ?? persisted;
  if (process.env.NODE_ENV === 'production')
    assert(
      password && secret.length >= 32 && process.env.COOKIE_SECRET,
      'Configura DEMO_ACCESS_PASSWORD y COOKIE_SECRET (32+ caracteres)',
    );
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
    bodyLimit: 1024 * 1024,
    trustProxy: process.env.TRUST_PROXY === 'true',
  });
  await app.register(cookie, { secret });
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: options.secure ?? process.env.COOKIE_SECURE === 'true',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    signed: true,
  };
  const gateToken = createHmac('sha256', secret)
    .update(password || 'local')
    .digest('hex');
  const gate = (req: any) =>
    !password || req.unsignCookie(req.cookies.expande_access || '').value === gateToken;
  app.setErrorHandler((err: any, _req, reply) => {
    reply.status(err instanceof DomainError ? err.status : err.statusCode || 500).send({
      error: {
        code: err.code || 'INTERNAL',
        message:
          err instanceof DomainError || err.statusCode === 400
            ? err.message
            : 'No se pudo completar la operación',
      },
    });
  });
  app.addHook('onRequest', async (req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff').header('Referrer-Policy', 'same-origin');
    if (!req.url.startsWith('/api/')) return;
    reply.header('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.headers.origin;
      if (origin) {
        let host = '';
        try {
          host = new URL(origin).host;
        } catch {}
        assert(host === req.headers.host, 'Origen no permitido', 403);
      }
      assert(req.headers['content-type']?.startsWith('application/json'), 'Se requiere JSON', 415);
    }
    if (req.url.startsWith('/api/v1/access') || req.url === '/api/health') return;
    assert(gate(req), 'Ingresa la contraseña de acceso', 401);
    let sid = req.unsignCookie(req.cookies.expande_session || '').value;
    if (!sid || store.scope(sid)?.kind !== 'session') {
      sid = store.createSession();
      reply.setCookie('expande_session', sid, cookieOptions);
    }
    (req as any).sessionId = sid;
  });
  const attempts = new Map<string, { count: number; since: number }>();
  app.get('/api/health', async () => ({ ok: true }));
  app.get('/api/v1/access', async (req) => ({ allowed: gate(req), required: !!password }));
  app.post('/api/v1/access', async (req, reply) => {
    const ip = req.ip,
      entry = attempts.get(ip),
      now = Date.now();
    if (entry && now - entry.since < 60000)
      assert(entry.count < 10, 'Demasiados intentos. Espera un minuto.', 429);
    if (attempts.size > 1000)
      for (const [k, v] of attempts) if (now - v.since > 60000) attempts.delete(k);
    const supplied = String((req.body as any)?.password || '');
    const expected = String(password || '');
    const s = Buffer.from(createHmac('sha256', secret).update(supplied).digest('hex')),
      e = Buffer.from(createHmac('sha256', secret).update(expected).digest('hex'));
    if (!timingSafeEqual(s, e)) {
      attempts.set(ip, {
        count: (entry && now - entry.since < 60000 ? entry.count : 0) + 1,
        since: entry && now - entry.since < 60000 ? entry.since : now,
      });
      throw new DomainError(401, 'Contraseña incorrecta', 'ACCESS');
    }
    attempts.delete(ip);
    reply.setCookie('expande_access', gateToken, cookieOptions);
    return { ok: true };
  });
  app.get('/api/v1/bootstrap', async (req) => store.visible((req as any).sessionId));
  app.get('/api/v1/revision', async (req) => ({
    revision: store.revision((req as any).sessionId),
  }));
  app.post('/api/v1/actions', async (req) => {
    assert(req.body && typeof req.body === 'object', 'Acción inválida');
    action(store, (req as any).sessionId, req.body);
    return store.visible((req as any).sessionId);
  });
  if (existsSync(resolve('dist/index.html'))) {
    await app.register(staticFiles, { root: resolve('dist') });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith('/api/')
        ? reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Ruta no encontrada' } })
        : reply.sendFile('index.html'),
    );
  }
  return app;
}
