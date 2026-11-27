import { initI18n, onLocaleChange, setLocale } from './core/i18n.js';
import { initTheme } from './core/theme.js';
import { session } from './core/store.js';
import { defineRoutes, refresh, startRouter } from './core/router.js';
import { renderShell } from './components/shell.js';
import { initPwa } from './core/pwa.js';
import { routes } from './routes.js';

const view = (path) => () => import(path);

async function boot() {
  initTheme();
  await initI18n();
  try {
    await session.load();
    let saved = null;
    try { saved = localStorage.getItem('pf.lang'); } catch { saved = null; }
    if (session.user?.locale && !saved) await setLocale(session.user.locale);
  } catch {
    session.meta = null;
  }
  renderShell();
  defineRoutes(routes(view));
  await startRouter();
  onLocaleChange(() => refresh());
  initPwa();
}

boot();
