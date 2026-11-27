import { html, on, render } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { getLocale, t } from '../../core/i18n.js';
import { del, get, patch, post } from '../../core/api.js';
import { relativeDay, timeRange } from '../../core/format.js';
import { busy, confirmDialog, openDialog, toast, toastError } from '../../core/ui.js';
import { emptyState } from '../../components/common.js';
import { priceTag, unitLabel } from '../../components/offer.js';

function row(o) {
  const paused = o.status === 'paused';
  return html`<li class="manage-offer ${paused ? 'is-paused' : ''} ${o.expired ? 'is-expired' : ''}">
    <span class="manage-emoji" aria-hidden="true">${o.emoji}</span>
    <div class="manage-main">
      <a class="manage-title" href="/painel/ofertas/${encodeURIComponent(o.id)}">${o.title}</a>
      <p class="offer-meta">
        <span>${t(`categories.${o.category}`)}</span>
        <span>${icon('clock')}${timeRange(o.pickupStart, o.pickupEnd)}</span>
        <span class="${o.expired ? 'text-tomate' : ''}">${icon('calendar')}${o.expired ? t('supplier.expired') : relativeDay(o.expiresOn)}</span>
        <span>${t('supplier.sold', { count: o.sold })}</span>
      </p>
    </div>
    <div class="manage-price">${priceTag(o, 'sm')}</div>
    <div class="manage-stock">
      <span class="tiny muted">${t('supplier.stock')}</span>
      <div class="stepper" role="group" aria-label="${t('supplier.stockFor', { title: o.title })}">
        <button type="button" data-action="stock" data-delta="-1" data-id="${o.id}" ${o.quantity <= 0 ? 'disabled' : ''} aria-label="${t('offer.decrease')}">${icon('minus')}</button>
        <output>${o.quantity}</output>
        <button type="button" data-action="stock" data-delta="1" data-id="${o.id}" aria-label="${t('offer.increase')}">${icon('plus')}</button>
      </div>
      <span class="tiny muted">${unitLabel(o.unit, o.quantity)}</span>
    </div>
    <div class="manage-actions">
      <label class="switch" title="${paused ? t('supplier.paused') : t('supplier.published')}">
        <input type="checkbox" data-action="toggle" data-id="${o.id}" ${paused ? '' : 'checked'} ${o.expired ? 'disabled' : ''}>
        <span class="visually-hidden">${t('supplier.publishedToggle', { title: o.title })}</span>
      </label>
      <a class="icon-btn" href="/painel/ofertas/${encodeURIComponent(o.id)}" aria-label="${t('common.edit')} ${o.title}" title="${t('common.edit')}">${icon('edit')}</a>
      <a class="icon-btn" href="/painel/ofertas/nova?copiar=${encodeURIComponent(o.id)}" aria-label="${t('supplier.duplicate')} ${o.title}" title="${t('supplier.duplicate')}">${icon('copy')}</a>
      <button type="button" class="icon-btn" data-action="delete" data-id="${o.id}" aria-label="${t('common.delete')} ${o.title}" title="${t('common.delete')}">${icon('trash')}</button>
    </div>
  </li>`;
}

export default async function supplierOffers({ root }) {
  let offers = await get('/supplier/offers');
  let filter = 'all';

  const draw = () => {
    const counts = {
      all: offers.length,
      active: offers.filter((o) => o.status === 'active' && !o.expired && o.quantity > 0).length,
      paused: offers.filter((o) => o.status === 'paused').length,
      attention: offers.filter((o) => o.expired || o.quantity === 0).length,
    };
    const visible = offers.filter((o) => filter === 'all'
      || (filter === 'active' && o.status === 'active' && !o.expired && o.quantity > 0)
      || (filter === 'paused' && o.status === 'paused')
      || (filter === 'attention' && (o.expired || o.quantity === 0)));
    render(root, html`<div class="container page">
      <div class="page-head">
        <div><h1>${t('supplier.offersTitle')}</h1><p>${t('supplier.offersLead')}</p></div>
        <div class="row">
          <a class="btn" href="/api/supplier/offers.csv?lang=${getLocale()}" download>${icon('download')}${t('supplier.exportCsv')}</a>
          <button type="button" class="btn" data-action="import">${icon('upload')}${t('supplier.importCsv')}</button>
          <a class="btn btn-primary" href="/painel/ofertas/nova">${icon('plus')}${t('supplier.newOffer')}</a>
        </div>
      </div>
      <div class="segmented" role="group" aria-label="${t('supplier.filter')}">
        ${['all', 'active', 'paused', 'attention'].map((f) => html`<button type="button" data-action="filter" data-filter="${f}" aria-pressed="${String(filter === f)}">${t(`supplier.filters.${f}`)} <span class="muted">${counts[f]}</span></button>`)}
      </div>
      ${visible.length ? html`<ul class="manage-list">${visible.map(row)}</ul>` : emptyState({
        title: offers.length ? t('supplier.noneInFilter') : t('supplier.noOffersTitle'),
        text: offers.length ? '' : t('supplier.noOffersText'),
        action: html`<a class="btn btn-primary" href="/painel/ofertas/nova">${icon('plus')}${t('supplier.newOffer')}</a>`,
      })}
    </div>`);
  };
  draw();

  const replace = (updated) => { offers = offers.map((o) => (o.id === updated.id ? { ...o, ...updated, expired: o.expired && updated.expiresOn === o.expiresOn } : o)); };

  on(root, 'click', '[data-action]', async (e, el) => {
    const { action, id } = el.dataset;
    if (action === 'filter') { filter = el.dataset.filter; draw(); return; }
    if (action === 'stock') {
      const offer = offers.find((o) => o.id === id);
      const quantity = Math.max(0, offer.quantity + Number(el.dataset.delta));
      try {
        replace(await patch(`/supplier/offers/${encodeURIComponent(id)}`, { quantity }));
        draw();
        root.querySelector(`[data-action="stock"][data-id="${CSS.escape(id)}"][data-delta="${el.dataset.delta}"]`)?.focus();
      } catch (err) { toastError(err); }
      return;
    }
    if (action === 'delete') {
      const offer = offers.find((o) => o.id === id);
      const ok = await confirmDialog({ title: t('supplier.deleteTitle'), message: t('supplier.deleteText', { title: offer.title }), confirm: t('common.delete'), danger: true });
      if (!ok) return;
      try {
        const r = await del(`/supplier/offers/${encodeURIComponent(id)}`);
        offers = offers.filter((o) => o.id !== id);
        draw();
        toast(r.archived ? t('supplier.archived') : t('supplier.deleted'));
      } catch (err) { toastError(err); }
      return;
    }
    if (action === 'import') openImport();
  });

  on(root, 'change', '[data-action="toggle"]', async (e, input) => {
    try {
      replace(await patch(`/supplier/offers/${encodeURIComponent(input.dataset.id)}`, { status: input.checked ? 'active' : 'paused' }));
      toast(input.checked ? t('supplier.publishedNow') : t('supplier.pausedNow'));
      draw();
    } catch (err) {
      input.checked = !input.checked;
      toastError(err);
    }
  });

  function openImport() {
    openDialog(html`<form class="dialog-form" data-form="import">
      <div class="dialog-body">
        <div class="dialog-head"><h2>${t('supplier.importTitle')}</h2></div>
        <p class="small muted">${t('supplier.importText')}</p>
        <pre class="code-sample">title;category;unit;original_price;price;quantity;expires_on;pickup_start;pickup_end
Marmita do dia;meals;portion;25,00;10,00;8;2026-12-01;14:00;16:00</pre>
        <div class="field"><label for="f-csv">${t('supplier.csvFile')}</label>
          <input class="input" id="f-csv" name="file" type="file" accept=".csv,text/csv" required></div>
        <div data-slot="import-errors"></div>
      </div>
      <div class="dialog-actions">
        <button type="button" class="btn btn-ghost" data-close="false">${t('common.cancel')}</button>
        <button type="submit" class="btn btn-primary">${icon('upload')}${t('supplier.importButton')}</button>
      </div>
    </form>`, {
      onMount(dialog, close) {
        const form = dialog.querySelector('form');
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const file = form.file.files[0];
          if (!file) return;
          if (file.size > 200_000) { toast(t('supplier.csvTooBig'), { type: 'error' }); return; }
          const csv = await file.text();
          await busy(form.querySelector('button[type="submit"]'), async () => {
            try {
              const result = await post('/supplier/offers/import', { csv });
              if (result.errors.length) {
                render(form.querySelector('[data-slot="import-errors"]'), html`<div class="notice notice-tomate">${icon('alert')}<div>
                  <strong>${t('supplier.importFailed')}</strong>
                  <ul>${result.errors.slice(0, 8).map((er) => html`<li>${t('supplier.importRowError', { row: er.row, field: er.field, problem: t(`validation.${er.code}`) })}</li>`)}</ul>
                </div></div>`);
                return;
              }
              toast(t('supplier.imported', { count: result.created }));
              close();
              offers = await get('/supplier/offers');
              draw();
            } catch (err) { toastError(err); }
          });
        });
      },
    });
  }

  return { title: t('supplier.offersTitle') };
}

