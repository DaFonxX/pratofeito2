import { html, render } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { emptyState } from '../components/common.js';

export default function notFound({ root }) {
  render(root, html`<div class="container page page-narrow">
    <h1 class="visually-hidden">${t('notFound.title')}</h1>
    ${emptyState({
      title: t('notFound.title'),
      text: t('notFound.text'),
      action: html`<div class="row"><a class="btn btn-primary" href="/explorar">${t('notFound.explore')}</a><a class="btn" href="/">${t('notFound.home')}</a></div>`,
    })}
  </div>`);
  return { title: t('notFound.title') };
}
