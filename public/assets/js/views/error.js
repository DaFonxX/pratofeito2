import { html, render } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t } from '../core/i18n.js';
import { errorMessage } from '../core/ui.js';
import { emptyState } from '../components/common.js';

export default function errorView({ root, error }) {
  const offline = error?.code === 'OFFLINE' || error?.code === 'NETWORK' || navigator.onLine === false;
  render(root, html`<div class="container page page-narrow">
    <h1 class="visually-hidden">${t('errors.loadTitle')}</h1>
    ${emptyState({
      title: offline ? t('errors.offlineTitle') : t('errors.loadTitle'),
      text: offline ? t('errors.offlineText') : errorMessage(error),
      action: html`<button type="button" class="btn btn-primary" data-reload>${icon('refresh')}${t('common.retry')}</button>`,
    })}
  </div>`);
  root.querySelector('[data-reload]').addEventListener('click', () => location.reload());
  return { title: t('errors.loadTitle') };
}
