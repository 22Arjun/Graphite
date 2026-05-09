import pino from 'pino';
import { env } from '../config/env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      hostname: req.hostname,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});

export type Logger = typeof logger;
