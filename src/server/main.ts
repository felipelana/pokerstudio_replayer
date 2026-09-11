import { loadConfig } from './shared/config.js';
import { createContainer } from './main-container.js';
import { buildServer } from './interface/http/server.js';
import { recordError } from './application/observability/RecordError.js';

const DAY = 24 * 60 * 60 * 1000;

/** Entry point: read config, wire the container, start the HTTP server. */
async function main() {
  const config = loadConfig();
  const container = await createContainer(config);
  const app = await buildServer(container);

  const observe = {
    errors: container.errors,
    env: config.APP_ENV,
    release: config.APP_VERSION,
    onFailure: (err: unknown) => console.error('could not store an error:', err),
  };

  // Access logs are kept for 180 days (decision B9); errors for as long as the
  // environment says, which is shorter on staging than in production.
  const purge = setInterval(() => {
    void container.log.purgeOlderThan(new Date(Date.now() - 180 * DAY));
    void container.errors.purgeOlderThan(
      new Date(Date.now() - config.ERROR_LOG_RETENTION_DAYS * DAY),
    );
  }, DAY);

  /**
   * A failure nobody caught. It is written down before the process is allowed
   * to end, because this is the one class of error that leaves no response
   * behind to explain itself — and then the process does end: a Node left
   * running after an uncaught exception is in a state nobody has reasoned about.
   */
  const fatal = (kind: string) => async (err: unknown) => {
    console.error(`${kind}:`, err);
    await recordError(observe, {
      source: 'SERVER',
      level: 'FATAL',
      message: String((err as Error)?.message ?? err),
      stack: (err as Error)?.stack,
      context: { kind },
    });
    clearInterval(purge);
    await app.close().catch(() => undefined);
    await container.prisma.$disconnect().catch(() => undefined);
    process.exit(1);
  };
  process.on('uncaughtException', (err) => void fatal('uncaughtException')(err));
  process.on('unhandledRejection', (err) => void fatal('unhandledRejection')(err));

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
