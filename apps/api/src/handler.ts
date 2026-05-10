import type { IncomingMessage, ServerResponse } from 'http';
import { buildApp } from './app.js';

// Cached app instance — reused across warm invocations
let appReady: ReturnType<typeof buildApp> | null = null;

async function getApp() {
  if (!appReady) {
    appReady = buildApp().then(async (app) => {
      await app.ready();
      return app;
    });
  }
  return appReady;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await getApp();
  app.server.emit('request', req, res);
}
