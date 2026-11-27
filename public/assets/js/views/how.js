import { html, render } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t } from '../core/i18n.js';
import { session } from '../core/store.js';

export default function how({ root }) {
  const faq = ['safe', 'why', 'free', 'pay', 'cancel', 'data'];
  render(root, html`<div class="container page page-narrow how-page">
    <div class="page-head"><div><h1>${t('how.title')}</h1><p class="lead">${t('how.lead')}</p></div></div>

    <section class="section-sm" aria-labelledby="h-buyers">
      <h2 id="h-buyers">${t('how.forBuyers')}</h2>
      <ol class="steps">
        <li><span class="step-n" aria-hidden="true">1</span><h3>${t('how.step1Title')}</h3><p>${t('how.step1Text')}</p></li>
        <li><span class="step-n" aria-hidden="true">2</span><h3>${t('how.step2Title')}</h3><p>${t('how.step2Text')}</p></li>
        <li><span class="step-n" aria-hidden="true">3</span><h3>${t('how.step3Title')}</h3><p>${t('how.step3Text')}</p></li>
      </ol>
      <a class="btn btn-primary" href="/explorar">${t('home.searchButton')}</a>
    </section>

    <section class="section" id="lojas" aria-labelledby="h-stores">
      <h2 id="h-stores">${t('how.forStores')}</h2>
      <ol class="steps">
        <li><span class="step-n" aria-hidden="true">1</span><h3>${t('how.store1Title')}</h3><p>${t('how.store1Text')}</p></li>
        <li><span class="step-n" aria-hidden="true">2</span><h3>${t('how.store2Title')}</h3><p>${t('how.store2Text')}</p></li>
        <li><span class="step-n" aria-hidden="true">3</span><h3>${t('how.store3Title')}</h3><p>${t('how.store3Text')}</p></li>
      </ol>
      ${session.user?.role === 'supplier' ? '' : html`<a class="btn" href="/cadastro?tipo=loja">${icon('store')}${t('home.businessCta')}</a>`}
    </section>

    <section class="section" aria-labelledby="h-faq">
      <h2 id="h-faq">${t('how.faqTitle')}</h2>
      <div class="faq">
        ${faq.map((q) => html`<details><summary>${t(`how.faq.${q}.q`)}</summary><p>${t(`how.faq.${q}.a`, { count: session.meta?.freeItemsPerDay ?? 3 })}</p></details>`)}
      </div>
    </section>
  </div>`);
  return { title: t('how.title') };
}
