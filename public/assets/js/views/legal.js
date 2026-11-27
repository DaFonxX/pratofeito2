import { html, render } from '../core/dom.js';
import { t } from '../core/i18n.js';

const SECTIONS = {
  privacy: ['collect', 'use', 'security', 'cookies', 'rights', 'retention', 'contact'],
  terms: ['service', 'accounts', 'orders', 'free', 'stores', 'conduct', 'changes'],
};

export default function legal({ root }) {
  const kind = location.pathname.startsWith('/privacidade') ? 'privacy' : 'terms';
  render(root, html`<div class="container page page-narrow legal">
    <h1>${t(`legal.${kind}.title`)}</h1>
    <p class="muted">${t('legal.updated')}</p>
    <p class="lead">${t(`legal.${kind}.intro`)}</p>
    ${SECTIONS[kind].map((s) => html`<section><h2>${t(`legal.${kind}.${s}.title`)}</h2><p>${t(`legal.${kind}.${s}.text`)}</p></section>`)}
  </div>`);
  return { title: t(`legal.${kind}.title`) };
}
