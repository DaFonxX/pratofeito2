import { config } from '../config.js';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 };
const threshold = config.isTest ? LEVELS.silent : (LEVELS[config.logLevel] ?? LEVELS.info);

function write(level, message, extra) {
  if (LEVELS[level] < threshold) return;
  const time = new Date().toISOString();
  if (config.isProd) {
    process.stdout.write(JSON.stringify({ time, level, message, ...extra }) + '\n');
    return;
  }
  const details = extra && Object.keys(extra).length ? ' ' + JSON.stringify(extra) : '';
  const out = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  out.write(`${time.slice(11, 19)} ${level.toUpperCase().padEnd(5)} ${message}${details}\n`);
}

export const log = {
  debug: (m, e) => write('debug', m, e),
  info: (m, e) => write('info', m, e),
  warn: (m, e) => write('warn', m, e),
  error: (m, e) => write('error', m, e),
};
