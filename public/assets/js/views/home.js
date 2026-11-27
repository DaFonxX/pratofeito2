import { html, on, render } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t } from '../core/i18n.js';
import { get } from '../core/api.js';
import { kg, money, moneyShort, number } from '../core/format.js';
import { navigate } from '../core/router.js';
import { session } from '../core/store.js';
import { CATEGORIES, CATEGORY_EMOJI } from '../core/catalog.js';
import { offerCard, priceTag } from '../components/offer.js';
import { emptyState } from '../components/common.js';

function boardTag(offer, index) {
  return html`<a class="board-tag board-tag-${index}" href="/oferta/${encodeURIComponent(offer.id)}">
    <span class="board-emoji" aria-hidden="true">${offer.emoji}</span>
    <span class="board-text">
      <strong>${offer.title}</strong>
      <span>${offer.store.name}</span>
      <span class="board-time">${icon('clock')}${offer.pickupStart}–${offer.pickupEnd}</span>
    </span>
    ${priceTag(offer, 'sm')}
  </a>`;
}

function rail(offers, emptyText) {
  if (!offers.length) return html`<p class="muted">${emptyText}</p>`;
  return html`<div class="rail">${offers.map((o) => offerCard(o))}</div>`;
}

const railSkeleton = () => html`<div class="rail">${Array.from({ length: 4 }, () => html`<div class="skeleton skeleton-card"></div>`)}</div>`;

export default async function home({ root }) {
  const user = session.user;
  render(root, html`
    <section class="hero">
      <div class="container hero-grid">
        <div class="hero-copy">
          <h1>${t('home.title')}</h1>
          <p class="lead">${t('home.lead')}</p>
          <form class="hero-search" role="search" data-form="hero-search">
            <label class="visually-hidden" for="hero-q">${t('search.label')}</label>
            <div class="input-affix">${icon('search')}<input class="input" id="hero-q" name="q" type="search" placeholder="${t('home.searchPlaceholder')}" maxlength="60" autocomplete="off"></div>
            <button class="btn btn-primary btn-lg" type="submit">${t('home.searchButton')}</button>
          </form>
          <div class="chips hero-chips" data-slot="quick"></div>
        </div>
        <div class="board" data-slot="board" aria-label="${t('home.boardTitle')}">
          <div class="board-head">
            <span class="live-dot" aria-hidden="true"></span>
            <h2>${t('home.boardTitle')}</h2>
          </div>
          <div class="board-tags">${Array.from({ length: 4 }, () => html`<div class="skeleton board-skeleton"></div>`)}</div>
        </div>
      </div>
    </section>

    <div class="container">
      <section class="section" aria-labelledby="cat-title">
        <div class="section-head"><h2 id="cat-title">${t('home.categoriesTitle')}</h2></div>
        <div class="category-row" data-slot="categories">
          ${CATEGORIES.map((c) => html`<a class="category" href="/explorar?category=${c}">
            <span class="category-emoji" aria-hidden="true">${CATEGORY_EMOJI[c]}</span>
            <span class="category-name">${t(`categories.${c}`)}</span>
            <span class="category-count" data-count="${c}"></span>
          </a>`)}
        </div>
      </section>

      <section class="section" aria-labelledby="today-title">
        <div class="section-head">
          <div><h2 id="today-title">${t('home.todayTitle')}</h2><p>${t('home.todayText')}</p></div>
          <a class="see-all" href="/explorar?expiring=today&sort=discount">${t('common.seeAll')}${icon('chevron-right')}</a>
        </div>
        <div data-slot="today">${railSkeleton()}</div>
      </section>

      <section class="section" aria-labelledby="free-title">
        <div class="section-head">
          <div><h2 id="free-title">${t('home.freeTitle')}</h2><p>${t('home.freeText', { count: session.meta?.freeItemsPerDay ?? 3 })}</p></div>
          <a class="see-all" href="/explorar?price=free">${t('common.seeAll')}${icon('chevron-right')}</a>
        </div>
        <div data-slot="free">${railSkeleton()}</div>
      </section>

      <section class="section how" aria-labelledby="how-title">
        <h2 id="how-title">${t('home.howTitle')}</h2>
        <ol class="steps">
          <li><span class="step-n" aria-hidden="true">1</span><h3>${t('how.step1Title')}</h3><p>${t('how.step1Text')}</p></li>
          <li><span class="step-n" aria-hidden="true">2</span><h3>${t('how.step2Title')}</h3><p>${t('how.step2Text')}</p></li>
          <li><span class="step-n" aria-hidden="true">3</span><h3>${t('how.step3Title')}</h3><p>${t('how.step3Text')}</p></li>
        </ol>
      </section>

      <section class="section impact-band">
        <div class="receipt" data-slot="impact" aria-labelledby="impact-title">
          <h2 id="impact-title">${t('home.impactTitle')}</h2>
          <div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div>
        </div>
        <div class="business-cta">
          <span class="business-emoji" aria-hidden="true">🥖🍱🥬</span>
          <h2>${t('home.businessTitle')}</h2>
          <p>${t('home.businessText')}</p>
          ${user?.role === 'supplier'
            ? html`<a class="btn btn-primary btn-lg" href="/painel/ofertas/nova">${icon('plus')}${t('supplier.newOffer')}</a>`
            : html`<a class="btn btn-primary btn-lg" href="/cadastro?tipo=loja">${t('home.businessCta')}</a>`}
        </div>
      </section>
    </div>`);

  on(root, 'submit', '[data-form="hero-search"]', (e, form) => {
    e.preventDefault();
    const q = form.q.value.trim();
    navigate(q ? `/explorar?q=${encodeURIComponent(q)}` : '/explorar');
  });

  const slot = (name) => root.querySelector(`[data-slot="${name}"]`);

  try {
    const [all, today, free, impact] = await Promise.all([
      get('/offers?sort=discount&pageSize=12'),
      get('/offers?expiring=today&price=paid&sort=discount&pageSize=10'),
      get('/offers?price=free&sort=expiring&pageSize=10'),
      get('/impact'),
    ]);

    const counts = all.counts;
    for (const el of root.querySelectorAll('[data-count]')) {
      const n = counts[el.dataset.count] ?? 0;
      el.textContent = t('home.categoryCount', { count: n });
      el.closest('.category').classList.toggle('is-empty', n === 0);
    }

    render(slot('quick'), html`
      <a class="chip" href="/explorar?price=free">${icon('gift')}${t('filters.freeNow')}<span class="chip-count">${number(impact.liveFreeOffers)}</span></a>
      <a class="chip" href="/explorar?price=upto10">${t('filters.upto10')}</a>
      <a class="chip" href="/explorar?expiring=today">${t('filters.expiresToday')}</a>
      <a class="chip" href="/explorar?delivery=1">${icon('truck')}${t('filters.delivery')}</a>`);

    const picks = [...all.items.filter((o) => o.priceCents > 0).slice(0, 3), ...free.items.slice(0, 1)];
    const board = slot('board');
    render(board.querySelector('.board-tags'), picks.length
      ? html`${picks.map((o, i) => boardTag(o, i))}`
      : html`<p class="board-empty">${t('home.boardEmpty')}</p>`);
    const foot = document.createElement('p');
    foot.className = 'board-foot';
    foot.textContent = t('home.boardFoot', { offers: number(impact.liveOffers), stores: number(impact.liveStores) });
    board.append(foot);
    board.classList.add('is-ready');

    render(slot('today'), rail(today.items, t('home.todayEmpty')));
    render(slot('free'), rail(free.items, t('home.freeEmpty')));

    render(slot('impact'), html`
      <h2 id="impact-title">${t('home.impactTitle')}</h2>
      <dl class="receipt-lines">
        <div><dt>${t('impact.meals')}</dt><dd>${number(impact.meals)}</dd></div>
        <div><dt>${t('impact.food')}</dt><dd>${kg(impact.foodKg)}</dd></div>
        <div><dt>${t('impact.co2')}</dt><dd>${kg(impact.co2Kg)}</dd></div>
        <div><dt>${t('impact.donations')}</dt><dd>${number(impact.donations)}</dd></div>
        <div class="receipt-total"><dt>${t('impact.savings')}</dt><dd>${moneyShort(impact.savingsCents)}</dd></div>
      </dl>
      <p class="tiny muted">${t('impact.footnote')}</p>`);
    slot('impact').setAttribute('title', money(impact.savingsCents));
  } catch (err) {
    render(slot('today'), emptyState({ title: t('errors.loadTitle'), text: t('errors.loadText'), illustration: false }));
    render(slot('free'), '');
  }

  return { title: t('app.tagline') };
}
