import { html, raw } from '../core/dom.js';
import { icon, plate } from '../core/icons.js';
import { t } from '../core/i18n.js';
import { number } from '../core/format.js';

export function emptyState({ title, text = '', action = null, illustration = true }) {
  return html`<div class="empty">
    ${illustration ? plate('plate') : ''}
    <h2>${title}</h2>
    ${text ? html`<p>${text}</p>` : ''}
    ${action ?? ''}
  </div>`;
}

export const skeletonGrid = (count = 8) => html`<div class="offer-grid" aria-busy="true" aria-label="${t('common.loading')}">
  ${Array.from({ length: count }, () => html`<div class="skeleton skeleton-card"></div>`)}
</div>`;

export const statusBadge = (status) => html`<span class="badge badge-dot status-${status}">${t(`status.${status}`)}</span>`;

export function stars(rating, count) {
  if (!rating) return html`<span class="stars muted">${t('store.noRatings')}</span>`;
  return html`<span class="stars" aria-label="${t('store.ratingAria', { rating: number(rating, 1), count })}">
    ${icon('star')}<span>${number(rating, 1)}</span>${count ? html`<span class="muted">(${number(count)})</span>` : ''}
  </span>`;
}

export function pager({ page, pageSize, total, action = 'page' }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return '';
  return html`<nav class="pager" aria-label="${t('common.pagination')}">
    <button type="button" class="btn btn-sm" data-action="${action}" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>
      ${icon('chevron-left')}<span>${t('common.previous')}</span>
    </button>
    <span class="small muted">${t('common.pageOf', { page, pages })}</span>
    <button type="button" class="btn btn-sm" data-action="${action}" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>
      <span>${t('common.next')}</span>${icon('chevron-right')}
    </button>
  </nav>`;
}

export function passwordField({ name, label, autocomplete = 'current-password', strength = false, hint = '' }) {
  const id = `f-${name}`;
  return html`<div class="field">
    <label for="${id}">${label}</label>
    <div class="password-wrap">
      <input class="input" id="${id}" name="${name}" type="password" autocomplete="${autocomplete}" required maxlength="128"
        ${strength ? html`data-strength="${id}-meter"` : ''} ${hint ? html`aria-describedby="${id}-hint"` : ''}>
      <button type="button" class="icon-btn" data-action="toggle-password" aria-pressed="false" aria-label="${t('auth.showPassword')}">
        ${icon('eye')}
      </button>
    </div>
    ${hint ? html`<p class="hint" id="${id}-hint">${hint}</p>` : ''}
    ${strength ? html`<div class="strength" id="${id}-meter" data-score="0" aria-live="polite">
      <span class="strength-bar"><span></span><span></span><span></span><span></span></span>
      <span class="strength-label small"></span>
    </div>` : ''}
  </div>`;
}

export function field({ name, label, type = 'text', value = '', required = false, autocomplete = 'off', hint = '', attrs = '', inputmode = '' }) {
  const id = `f-${name}`;
  return html`<div class="field">
    <label for="${id}">${label}${required ? '' : html` <span class="muted small">(${t('common.optional')})</span>`}</label>
    <input class="input" id="${id}" name="${name}" type="${type}" value="${value ?? ''}" autocomplete="${autocomplete}"
      ${required ? 'required' : ''} ${inputmode ? html`inputmode="${inputmode}"` : ''} ${hint ? html`aria-describedby="${id}-hint"` : ''} ${typeof attrs === 'string' ? raw(attrs) : attrs}>
    ${hint ? html`<p class="hint" id="${id}-hint">${hint}</p>` : ''}
  </div>`;
}

export const backLink = (href, label) => html`<a class="back-link" href="${href}">${icon('arrow-left')}<span>${label}</span></a>`;
