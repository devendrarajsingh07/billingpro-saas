'use strict';

const path = require('path');
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const { combine, timestamp, errors, json, colorize, simple, printf } = winston.format;

const isDev = process.env.NODE_ENV !== 'production';

// ============================================================
// Log Levels
// ============================================================
const LOG_LEVELS = {
  error: 0,
  warn:  1,
  info:  2,
  http:  3,
  debug: 4,
};

const LOG_COLORS = {
  error: 'red',
  warn:  'yellow',
  info:  'green',
  http:  'magenta',
  debug: 'white',
};

winston.addColors(LOG_COLORS);

// ============================================================
// Formats
// ============================================================

const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    if (stack) log += `\n${stack}`;
    return log;
  })
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

// ============================================================
// Transports
// ============================================================

const consoleTransport = new winston.transports.Console({
  format: isDev ? devFormat : prodFormat,
});

const errorRotateTransport = new DailyRotateFile({
  filename: path.join('logs', 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  level: 'error',
  format: prodFormat,
});

const combinedRotateTransport = new DailyRotateFile({
  filename: path.join('logs', 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  format: prodFormat,
});

// ============================================================
// Logger Instance
// ============================================================

const logger = winston.createLogger({
  level: isDev ? 'debug' : 'info',
  levels: LOG_LEVELS,
  defaultMeta: { service: 'saas-billing-api' },
  transports: [
    consoleTransport,
    errorRotateTransport,
    combinedRotateTransport,
  ],
  // Don't crash on unhandled errors within logger
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join('logs', 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
    }),
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join('logs', 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
    }),
  ],
});

// ============================================================
// Morgan HTTP Logger Stream
// ============================================================

const httpLogger = {
  stream: {
    write: (message) => {
      logger.http(message.trim());
    },
  },
};

module.exports = { logger, httpLogger };
