import { createApp } from './app.ts';
const app = await createApp();
await app.listen({ port: Number(process.env.PORT || 3001), host: process.env.HOST || '127.0.0.1' });
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
