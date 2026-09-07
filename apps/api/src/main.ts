import { loadConfig } from './shared/config.js';
import { createContainer } from './main-container.js';
import { buildServer } from './interface/http/server.js';

/** Entry point: read config, wire the container, start the HTTP server. */
async function main() {
  const config = loadConfig();
  const container = await createContainer(config);
  const app = await buildServer(container);

  // Access logs are kept for 180 days (decision B9).
  const purge = setInterval(
    () => {
      void container.log.purgeOlderThan(new Date(Date.now() - 180 * 24 * 60 * 60 * 1000));
    },
    24 * 60 * 60 * 1000,
  );

  const close = async () => {
    clearInterval(purge);
    await app.close();
    await container.prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', close);
  process.on('SIGTERM', close);

  await app.listen({ port: config.PORT, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error('API failed to start:', err);
  process.exit(1);
});
