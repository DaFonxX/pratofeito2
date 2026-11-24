import { api, API, esc, toast, download } from './utils.js';
import { t, locale } from './i18n.js';
const KEY = 'pf_admin';
const headers = () => { const k = sessionStorage.getItem(KEY); return k ? { 'X-Admin-Token': k } : {}; };
export async function renderLogs(el) {
  el.innerHTML = `<h1>${t('l.title')}</h1><p class="muted">${t('l.intro')}</p><div id="box" aria-live="polite">${t('p.loading')}</div>`;
  const box = el.querySelector('#box');
  try {
    const d = await api('/logs', { headers: headers() }), s = d.summary, site = d.site;
    box.innerHTML = `<div class="stats"><div><b>${s.total}</b>${t('l.total')}</div><div><b>${s.today}</b>${t('l.today')}</div><div><b>${s.errors}</b>${t('l.errors')}</div><div><b>${s.avg_ms}</b>${t('l.avg')}</div></div>
    <div class="stats"><div><b>${site.users}</b>${t('l.users')}</div><div><b>${site.products}</b>${t('l.products')}</div><div><b>${site.orders}</b>${t('l.orders')}</div></div>
    <p class="muted">${t('l.langs')}: ${d.langs.map((l) => `${esc(l.lang)} (${l.n})`).join(', ') || '–'}</p>
    <p><button class="btn" id="csv">${t('l.csv')}</button></p><h2>${t('l.recent')}</h2>
    <div class="tablewrap"><table><thead><tr><th>${t('l.time')}</th><th>${t('l.method')}</th><th>${t('l.path')}</th><th>HTTP</th><th>${t('l.ms')}</th><th>${t('l.lang')}</th></tr></thead><tbody>${d.recent.map((r) => `<tr>
    <td>${new Date(r.created_at).toLocaleString(locale())}</td><td>${esc(r.method)}</td><td>${esc(r.path)}</td><td>${r.status}</td><td>${r.duration_ms}</td><td>${esc(r.lang || '–')}</td></tr>`).join('')}</tbody></table></div>`;
    box.querySelector('#csv').addEventListener('click', async () => {
      try {
        const res = await fetch(API + '/logs/export.csv', { headers: headers() });
        if (!res.ok) throw new Error(t('err.unknown'));
        download(await res.blob(), 'pratofeito-acessos.csv');
      } catch (e) { toast(e.message); }
    });
  } catch (e) {
    box.innerHTML = `<p>${e.status === 403 ? t('l.denied') : esc(e.message)}</p>` + (e.status === 403 ? `<form class="stack" id="tk"><label>${t('l.token')}<input name="token" type="password" required autocomplete="off"></label><button class="btn primary">${t('l.enter')}</button></form>` : '');
    box.querySelector('#tk')?.addEventListener('submit', (ev) => { ev.preventDefault(); sessionStorage.setItem(KEY, new FormData(ev.target).get('token')); renderLogs(el); });
  }
}
