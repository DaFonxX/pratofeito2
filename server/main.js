import http from 'node:http';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { config } from './config.js';
import { openDatabase } from './db/index.js';
import { catchUpDemo, seedDemo } from './db/seed.js';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from './db/demo-data.js';
import { createApp } from './app.js';
import { createStatic } from './http/static.js';
import { buildRouter } from './routes.js';
import { log } from './lib/log.js';
import { createAudit } from './services/audit.js';
import { createSessions } from './services/sessions.js';
import { createUsers } from './services/users.js';
import { createOffers } from './services/offers.js';
import { createOrders } from './services/orders.js';
import { createReports } from './services/reports.js';

export async function createServer({ reset = config.args.has('--reset') } = {}) {
  const db = openDatabase(config.dbFile, { reset });
  const audit = createAudit(db, config);
  const sessions = createSessions(db, config);
  const users = createUsers({ db, sessions, audit });
  const offers = createOffers({ db, audit });
  const orders = createOrders({ db, audit, config });
  const reports = createReports({ db });
  const services = { db, audit, sessions, users, offers, orders, reports };

  if (config.demo) {
    const seeded = await seedDemo({ db, offersService: offers });
    if (seeded) log.info('Dados de demonstração criados.');
    catchUpDemo({ db });
    offers.refreshDemoOffers();
  }
  if (config.adminEmail && config.adminPassword && await users.ensureAdmin(config.adminEmail, config.adminPassword)) {
    log.info('Administrador inicial criado a partir de ADMIN_EMAIL.');
  }

  const staticFiles = createStatic(config.publicDir);
  const router = buildRouter(services, { version: staticFiles.version });
  const server = http.createServer(createApp({ router, services, staticFiles }));
  server.headersTimeout = 15_000;
  server.requestTimeout = 30_000;
  server.keepAliveTimeout = 5_000;
  server.maxHeadersCount = 64;

  const housekeeping = () => {
    try {
      sessions.purgeExpired();
      audit.purgeOld();
      if (config.demo) {
        catchUpDemo({ db });
        offers.refreshDemoOffers();
      }
    } catch (err) {
      log.warn('Falha na manutenção periódica', { error: err.message });
    }
  };
  housekeeping();
  const timer = setInterval(housekeeping, 60 * 60 * 1000);
  timer.unref();

  return {
    server, services, version: staticFiles.version,
    close: () => new Promise((resolve) => {
      clearInterval(timer);
      server.close(() => { db.close(); resolve(); });
      server.closeAllConnections?.();
    }),
  };
}

function openBrowser(url) {
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true, windowsHide: true }).unref();
  } catch {
    log.info('Abra o navegador em ' + url);
  }
}

function lanAddresses() {
  return Object.values(os.networkInterfaces()).flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => n.address);
}

export async function main() {
  const app = await createServer();
  if (config.args.has('--no-listen')) {
    log.info('Banco pronto em ' + config.dbFile);
    await app.close();
    return;
  }

  app.server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n  A porta ${config.port} já está em uso. Feche a outra janela do PratoFeito ou use PORT=3001.\n`);
    } else {
      console.error(err);
    }
    process.exit(1);
  });

  app.server.listen(config.port, config.host, () => {
    const port = app.server.address().port;
    const lines = [
      '',
      '  PratoFeito está no ar!',
      `  Abra no navegador:  http://localhost:${port}`,
    ];
    if (config.host === '0.0.0.0') {
      for (const ip of lanAddresses()) lines.push(`  No celular (mesma rede Wi-Fi):  http://${ip}:${port}`);
    }
    if (config.demo) {
      lines.push('', `  Contas de demonstração (senha: ${DEMO_PASSWORD})`);
      for (const a of DEMO_ACCOUNTS) lines.push(`    ${a.role.padEnd(9)} ${a.email}`);
    }
    lines.push('', '  Para encerrar: Ctrl+C', '');
    console.log(lines.join('\n'));
    if (config.args.has('--open')) openBrowser(`http://localhost:${port}`);
  });

  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    console.log('\n  Encerrando...');
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
