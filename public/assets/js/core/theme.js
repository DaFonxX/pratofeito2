const listeners = new Set();
const media = window.matchMedia('(prefers-color-scheme: dark)');

export function getThemePreference() {
  try { return localStorage.getItem('pf.theme') || 'system'; } catch { return 'system'; }
}

export const resolvedTheme = () => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';

function apply() {
  const pref = getThemePreference();
  const theme = pref === 'system' ? (media.matches ? 'dark' : 'light') : pref;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#141b2e' : '#ffffff');
  for (const fn of listeners) fn(theme, pref);
}

export function setThemePreference(pref) {
  try { localStorage.setItem('pf.theme', pref); } catch {}
  apply();
}

export function toggleTheme() {
  setThemePreference(resolvedTheme() === 'dark' ? 'light' : 'dark');
}

export function onThemeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function initTheme() {
  apply();
  media.addEventListener('change', () => { if (getThemePreference() === 'system') apply(); });
  window.addEventListener('storage', (e) => { if (e.key === 'pf.theme') apply(); });
}
