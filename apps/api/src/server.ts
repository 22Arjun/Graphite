import { buildApp } from './app.js';
import { env } from './config/env.js';

// ============================================================
// Server Entry Point
// ============================================================

async function main() {
  const app = await buildApp();

  try {
    const address = await app.listen({
      port: env.PORT,
      host: env.HOST,
    });

    app.log.info(`\n  🔷 Graphite API running at ${address}`);
    app.log.info(`  📊 Environment: ${env.NODE_ENV}`);
    app.log.info(`  🔗 Health check: ${address}/health\n`);
  } catch (err) {
    app.log.fatal(err, 'Failed to start server');
    process.exit(1);
  }

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down gracefully...`);
      await app.close();
      process.exit(0);
    });
  }
}

main();
