import { createApp } from '../server/app.ts';

const appPromise = createApp(undefined, { serveStatic: false }).then(async (app) => {
  await app.ready();
  return app;
});

export default async function handler(request: any, response: any) {
  try {
    const app = await appPromise;
    await new Promise<void>((resolve, reject) => {
      response.once('finish', resolve);
      response.once('close', resolve);
      response.once('error', reject);
      app.server.emit('request', request, response);
    });
  } catch {
    if (!response.headersSent) {
      response.statusCode = 500;
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.setHeader('Cache-Control', 'no-store');
      response.end(
        JSON.stringify({
          error: { code: 'INTERNAL', message: 'No se pudo iniciar el servidor de la demostración' },
        }),
      );
    } else if (!response.writableEnded) response.end();
  }
}
