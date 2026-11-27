import { debounce, html, on, render, withQuery } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t } from '../core/i18n.js';
import { get } from '../core/api.js';
import { number } from '../core/format.js';
import { updateQuery } from '../core/router.js';
import { CATEGORIES, CATEGORY_EMOJI, PRICE_FILTERS, SORTS, TAGS } from '../core/catalog.js';
import { offerGrid } from '../components/offer.js';
import { emptyState, pager, skeletonGrid } from '../components/common.js';

const PAGE_SIZE = 24;

function readState(query) {
  const pick = (v, list) => (list.includes(v) ? v : '');
  return {
    q: (query.get('q') ?? '').slice(0, 60),
    category: pick(query.get('category'), CATEGORIES),
    price: pick(query.get('price'), PRICE_FILTERS),
    expiring: pick(query.get('expiring'), ['today', 'tomorrow']),
    delivery: query.get('delivery') === '1',
    tag: pick(query.get('tag'), TAGS),
    sort: pick(query.get('sort'), SORTS) || 'relevance',
    page: Math.max(1, Number.parseInt(query.get('page') ?? '1', 10) || 1),
  };
}

const activeCount = (s) => [s.q, s.category, s.price, s.expiring, s.delivery, s.tag].filter(Boolean).length;

export default async function explore({ root, query }) {
  const state = readState(query);
  let controller = null;

  const chip = (key, value, label, extra = '') => html`<button type="button" class="chip" data-action="filter" data-key="${key}" data-value="${value}" aria-pressed="${String(state[key] === value || (value === true && state[key] === true))}">${extra}${label}</button>`;

  function filtersHtml(counts = {}) {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return html`
      <div class="chips chips-scroll" role="group" aria-label="${t('filters.categories')}">
        <button type="button" class="chip" data-action="category" data-value="" aria-pressed="${String(!state.category)}">${t('filters.all')}${total ? html`<span class="chip-count">${number(total)}</span>` : ''}</button>
        ${CATEGORIES.map((c) => html`<button type="button" class="chip" data-action="category" data-value="${c}" aria-pressed="${String(state.category === c)}">
          <span class="emoji" aria-hidden="true">${CATEGORY_EMOJI[c]}</span>${t(`categories.${c}`)}<span class="chip-count">${number(counts[c] ?? 0)}</span></button>`)}
      </div>
      <div class="chips chips-scroll filter-row" role="group" aria-label="${t('filters.more')}">
        ${chip('price', 'free', t('filters.free'), icon('gift'))}
        ${chip('price', 'upto5', t('filters.upto5'))}
        ${chip('price', 'upto10', t('filters.upto10'))}
        ${chip('price', 'upto20', t('filters.upto20'))}
        <span class="chip-sep" aria-hidden="true"></span>
        ${chip('expiring', 'today', t('filters.expiresToday'))}
        ${chip('expiring', 'tomorrow', t('filters.untilTomorrow'))}
        ${chip('delivery', true, t('filters.delivery'), icon('truck'))}
        <span class="chip-sep" aria-hidden="true"></span>
        ${TAGS.map((tag) => chip('tag', tag, t(`tags.${tag}`)))}
      </div>`;
  }

  render(root, html`
    <div class="container page">
      <div class="page-head">
        <div>
          <h1>${state.q ? t('explore.titleSearch', { q: state.q }) : t('explore.title')}</h1>
          <p data-slot="summary" aria-live="polite">${t('common.loading')}</p>
        </div>
      </div>
      <div class="explore-toolbar">
        <form class="explore-search" role="search" data-form="search">
          <label class="visually-hidden" for="explore-q">${t('search.label')}</label>
          <div class="input-affix">${icon('search')}<input class="input" id="explore-q" name="q" type="search" value="${state.q}" placeholder="${t('search.placeholder')}" maxlength="60" autocomplete="off"></div>
        </form>
        <div class="field sort-field">
          <label class="visually-hidden" for="explore-sort">${t('explore.sortBy')}</label>
          <select class="input" id="explore-sort" data-action="sort">
            ${SORTS.map((s) => html`<option value="${s}" ${state.sort === s ? 'selected' : ''}>${t(`sort.${s}`)}</option>`)}
          </select>
        </div>
      </div>
      <div class="explore-filters" data-slot="filters">${filtersHtml()}</div>
      <div class="active-filters" data-slot="active"></div>
      <div data-slot="results">${skeletonGrid(8)}</div>
    </div>`);

  const slot = (n) => root.querySelector(`[data-slot="${n}"]`);

  async function load({ focusResults = false } = {}) {
    controller?.abort();
    controller = new AbortController();
    updateQuery({ ...state, sort: state.sort === 'relevance' ? '' : state.sort, page: state.page > 1 ? state.page : '' });
    render(slot('results'), skeletonGrid(8));
    try {
      const data = await get(withQuery('/offers', { ...state, pageSize: PAGE_SIZE }), { signal: controller.signal });
      render(slot('filters'), filtersHtml(data.counts));
      root.querySelector('h1').textContent = state.q ? t('explore.titleSearch', { q: state.q }) : t('explore.title');
      slot('summary').textContent = t('explore.count', { count: data.total });
      const n = activeCount(state);
      render(slot('active'), n ? html`<button type="button" class="btn btn-ghost btn-sm" data-action="clear">${icon('x')}${t('filters.clear', { count: n })}</button>` : '');
      if (!data.items.length) {
        render(slot('results'), emptyState({
          title: t('explore.emptyTitle'),
          text: t('explore.emptyText'),
          action: n ? html`<button type="button" class="btn btn-primary" data-action="clear">${t('filters.clearAll')}</button>` : '',
        }));
      } else {
        render(slot('results'), html`${offerGrid(data.items)}${pager({ page: data.page, pageSize: data.pageSize, total: data.total })}`);
      }
      if (focusResults) slot('results').scrollIntoView({ block: 'start' });
    } catch (err) {
      if (err?.name === 'AbortError') return;
      render(slot('results'), emptyState({ title: t('errors.loadTitle'), text: t('errors.loadText'), action: html`<button type="button" class="btn" data-action="retry">${icon('refresh')}${t('common.retry')}</button>` }));
    }
  }

  const searchNow = debounce((value) => {
    state.q = value.trim();
    state.page = 1;
    load();
  }, 350);

  on(root, 'input', '#explore-q', (e, input) => searchNow(input.value));
  on(root, 'submit', '[data-form="search"]', (e, form) => { e.preventDefault(); searchNow(form.q.value); });
  on(root, 'change', '[data-action="sort"]', (e, select) => { state.sort = select.value; state.page = 1; load(); });
  on(root, 'click', '[data-action]', (e, el) => {
    const action = el.dataset.action;
    if (action === 'category') { state.category = el.dataset.value; state.page = 1; load(); }
    if (action === 'filter') {
      const key = el.dataset.key;
      const value = key === 'delivery' ? true : el.dataset.value;
      state[key] = state[key] === value ? (key === 'delivery' ? false : '') : value;
      state.page = 1;
      load();
    }
    if (action === 'clear') {
      Object.assign(state, { q: '', category: '', price: '', expiring: '', delivery: false, tag: '', page: 1 });
      root.querySelector('#explore-q').value = '';
      load();
    }
    if (action === 'page') { state.page = Number(el.dataset.page); load({ focusResults: true }); }
    if (action === 'retry') load();
  });

  load();
  return { title: t('explore.title'), cleanup: () => controller?.abort() };
}
