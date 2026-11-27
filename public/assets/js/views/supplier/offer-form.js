import { html, on, render } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { t } from '../../core/i18n.js';
import { get, patch, post } from '../../core/api.js';
import { addDaysYmd, centsToInput, parseMoney, todayYmd } from '../../core/format.js';
import { session } from '../../core/store.js';
import { navigate } from '../../core/router.js';
import { busy, handleFormError, showFieldErrors, toast } from '../../core/ui.js';
import { formValues } from '../../core/forms.js';
import { CATEGORIES, CATEGORY_EMOJI, TAGS, UNITS } from '../../core/catalog.js';
import { offerCard } from '../../components/offer.js';
import { backLink } from '../../components/common.js';
import notFound from '../not-found.js';

const DEFAULT_WEIGHT = { meals: 450, bakery: 300, fruits: 1000, vegetables: 800, dairy: 500, groceries: 2000, drinks: 1000, sweets: 250 };

export default async function offerForm({ root, params, query }) {
  const editing = !!params.id;
  const copyId = query.get('copiar');
  const today = todayYmd();
  let store;
  let source = null;
  try {
    [store, source] = await Promise.all([
      get('/supplier/store'),
      editing || copyId ? get(`/supplier/offers/${encodeURIComponent(params.id ?? copyId)}`) : Promise.resolve(null),
    ]);
  } catch (err) {
    if (err.status === 404) return notFound({ root });
    throw err;
  }
  const emojis = session.meta?.offerEmojis ?? Object.values(CATEGORY_EMOJI);
  const o = source ?? {
    title: '', description: '', category: 'meals', emoji: CATEGORY_EMOJI.meals, unit: 'portion', weightGrams: null,
    originalPriceCents: null, priceCents: null, quantity: 5, maxPerOrder: 3, expiresOn: today,
    pickupStart: '18:00', pickupEnd: '20:00', tags: [],
  };
  if (copyId && source) o.expiresOn = source.expiresOn < today ? today : source.expiresOn;
  const free = !!source && source.priceCents === 0;
  let emojiTouched = !!source;

  render(root, html`<div class="container page">
    ${backLink('/painel/ofertas', t('supplier.offersTitle'))}
    <div class="page-head"><div>
      <h1>${editing ? t('supplier.editOffer') : t('supplier.newOffer')}</h1>
      <p>${t('supplier.formLead')}</p>
    </div></div>
    <div class="offer-form-grid">
      <form class="stack" data-form="offer" novalidate>
        <section class="panel stack">
          <h2 class="panel-title">${t('supplier.whatIsIt')}</h2>
          <div class="field">
            <label for="f-title">${t('supplier.fields.title')}</label>
            <input class="input" id="f-title" name="title" value="${o.title}" maxlength="80" required placeholder="${t('supplier.fields.titlePlaceholder')}">
          </div>
          <div class="form-grid cols-2">
            <div class="field"><label for="f-category">${t('supplier.fields.category')}</label>
              <select class="input" id="f-category" name="category">${CATEGORIES.map((c) => html`<option value="${c}" ${o.category === c ? 'selected' : ''}>${t(`categories.${c}`)}</option>`)}</select></div>
            <div class="field"><label for="f-unit">${t('supplier.fields.unit')}</label>
              <select class="input" id="f-unit" name="unit">${UNITS.map((u) => html`<option value="${u}" ${o.unit === u ? 'selected' : ''}>${t(`units.${u}`, { count: 1 })}</option>`)}</select></div>
          </div>
          <fieldset class="emoji-field">
            <legend class="label">${t('supplier.fields.emoji')}</legend>
            <div class="emoji-grid">
              ${emojis.map((e) => html`<label class="emoji-option"><input type="radio" name="emoji" value="${e}" ${o.emoji === e ? 'checked' : ''}><span aria-hidden="true">${e}</span><span class="visually-hidden">${e}</span></label>`)}
            </div>
          </fieldset>
          <div class="field">
            <label for="f-description">${t('supplier.fields.description')} <span class="muted small">(${t('common.optional')})</span></label>
            <textarea class="input" id="f-description" name="description" maxlength="400" placeholder="${t('supplier.fields.descriptionPlaceholder')}">${o.description}</textarea>
          </div>
          <fieldset><legend class="label">${t('supplier.fields.tags')}</legend>
            <div class="chips">${TAGS.map((tag) => html`<label class="chip chip-check"><input type="checkbox" data-group="tags" name="tag-${tag}" value="${tag}" ${o.tags.includes(tag) ? 'checked' : ''}>${t(`tags.${tag}`)}</label>`)}</div>
          </fieldset>
        </section>

        <section class="panel stack">
          <h2 class="panel-title">${t('supplier.priceAndStock')}</h2>
          <label class="check"><input type="checkbox" name="free" ${free ? 'checked' : ''}><span><strong>${t('supplier.fields.free')}</strong><br><span class="muted">${t('supplier.fields.freeHint', { count: session.meta?.freeItemsPerDay ?? 3 })}</span></span></label>
          <div class="form-grid cols-2">
            <div class="field"><label for="f-originalPrice">${t('supplier.fields.originalPrice')}</label>
              <div class="input-affix"><span class="affix">R$</span><input class="input" id="f-originalPrice" name="originalPriceCents" inputmode="decimal" value="${o.originalPriceCents ? centsToInput(o.originalPriceCents) : ''}" required placeholder="25,00"></div></div>
            <div class="field"><label for="f-price">${t('supplier.fields.price')}</label>
              <div class="input-affix"><span class="affix">R$</span><input class="input" id="f-price" name="priceCents" inputmode="decimal" value="${o.priceCents ? centsToInput(o.priceCents) : ''}" ${free ? 'disabled' : ''} required placeholder="10,00"></div>
              <p class="hint" data-slot="discount"></p></div>
            <div class="field"><label for="f-quantity">${t('supplier.fields.quantity')}</label>
              <input class="input" id="f-quantity" name="quantity" type="number" min="0" max="9999" value="${o.quantity}" required></div>
            <div class="field"><label for="f-max">${t('supplier.fields.maxPerOrder')}</label>
              <input class="input" id="f-max" name="maxPerOrder" type="number" min="1" max="50" value="${o.maxPerOrder}" required></div>
            <div class="field span-2"><label for="f-weight">${t('supplier.fields.weight')} <span class="muted small">(${t('common.optional')})</span></label>
              <input class="input" id="f-weight" name="weightGrams" type="number" min="10" max="50000" value="${o.weightGrams ?? ''}" placeholder="${DEFAULT_WEIGHT[o.category]}">
              <p class="hint">${t('supplier.fields.weightHint')}</p></div>
          </div>
        </section>

        <section class="panel stack">
          <h2 class="panel-title">${t('supplier.whenToPickup')}</h2>
          <div class="form-grid cols-3">
            <div class="field"><label for="f-expires">${t('supplier.fields.expiresOn')}</label>
              <input class="input" id="f-expires" name="expiresOn" type="date" min="${today}" max="${addDaysYmd(today, 30)}" value="${o.expiresOn}" required></div>
            <div class="field"><label for="f-start">${t('supplier.fields.pickupStart')}</label>
              <input class="input" id="f-start" name="pickupStart" type="time" value="${o.pickupStart}" required></div>
            <div class="field"><label for="f-end">${t('supplier.fields.pickupEnd')}</label>
              <input class="input" id="f-end" name="pickupEnd" type="time" value="${o.pickupEnd}" required></div>
          </div>
        </section>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary btn-lg">${icon('check')}${editing ? t('common.saveChanges') : t('supplier.publish')}</button>
          <a class="btn btn-lg btn-ghost" href="/painel/ofertas">${t('common.cancel')}</a>
        </div>
      </form>
      <aside class="offer-preview" aria-label="${t('supplier.preview')}">
        <p class="label">${t('supplier.preview')}</p>
        <div data-slot="preview"></div>
        <p class="tiny muted">${t('supplier.previewHint')}</p>
      </aside>
    </div>
  </div>`);

  const form = root.querySelector('[data-form="offer"]');
  const slot = (n) => root.querySelector(`[data-slot="${n}"]`);

  const read = () => {
    const v = formValues(form);
    const isFree = v.free === true;
    const original = parseMoney(v.originalPriceCents);
    const price = isFree ? 0 : parseMoney(v.priceCents);
    return {
      title: v.title.trim(),
      description: v.description.trim(),
      category: v.category,
      emoji: v.emoji,
      unit: v.unit,
      weightGrams: v.weightGrams ? Number(v.weightGrams) : undefined,
      originalPriceCents: original,
      priceCents: price,
      quantity: Number(v.quantity),
      maxPerOrder: Number(v.maxPerOrder),
      expiresOn: v.expiresOn,
      pickupStart: v.pickupStart,
      pickupEnd: v.pickupEnd,
      tags: v.tags ?? [],
      free: isFree,
    };
  };

  const preview = () => {
    const d = read();
    const original = Number.isFinite(d.originalPriceCents) && d.originalPriceCents > 0 ? d.originalPriceCents : 2500;
    const price = Number.isFinite(d.priceCents) ? Math.min(d.priceCents, original) : Math.round(original * 0.4);
    render(slot('preview'), offerCard({
      id: params.id ?? 'preview', title: d.title || t('supplier.fields.titlePlaceholder'), emoji: d.emoji, category: d.category,
      unit: d.unit, originalPriceCents: original, priceCents: price, quantity: d.quantity || 0, maxPerOrder: d.maxPerOrder || 1,
      expiresOn: d.expiresOn || today, pickupStart: d.pickupStart || '18:00', pickupEnd: d.pickupEnd || '20:00',
      store: { id: store.id, name: store.name, emoji: store.emoji, neighborhood: store.neighborhood, delivery: store.delivery },
    }));
    slot('preview').querySelector('a').addEventListener('click', (e) => e.preventDefault());
    slot('preview').querySelector('a').setAttribute('tabindex', '-1');
    const off = price === 0 ? 100 : Math.round(100 - (price * 100) / original);
    slot('discount').textContent = d.free ? t('supplier.freeDiscount') : (Number.isFinite(d.priceCents) && d.originalPriceCents > 0 ? t('supplier.discountHint', { off }) : '');
  };
  preview();

  on(root, 'input', 'input, textarea, select', preview);
  on(root, 'change', 'input, select', (e, el) => {
    if (el.name === 'free') {
      const price = form.priceCents;
      price.disabled = el.checked;
      if (el.checked) price.value = '';
    }
    if (el.name === 'emoji') emojiTouched = true;
    if (el.name === 'category') {
      form.weightGrams.placeholder = String(DEFAULT_WEIGHT[el.value]);
      if (!emojiTouched) {
        const match = form.querySelector(`input[name="emoji"][value="${CSS.escape(CATEGORY_EMOJI[el.value])}"]`);
        if (match) match.checked = true;
      }
    }
    preview();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = read();
    const errors = {};
    if (d.title.length < 3) errors.title = d.title ? 'too_short' : 'required';
    if (!Number.isFinite(d.originalPriceCents) || d.originalPriceCents < 100) errors.originalPriceCents = 'price_min';
    if (!d.free && (!Number.isFinite(d.priceCents) || d.priceCents <= 0)) errors.priceCents = 'required';
    if (Number.isFinite(d.priceCents) && d.priceCents > d.originalPriceCents) errors.priceCents = 'price_above_original';
    if (!Number.isInteger(d.quantity) || d.quantity < 0) errors.quantity = 'invalid';
    if (!Number.isInteger(d.maxPerOrder) || d.maxPerOrder < 1) errors.maxPerOrder = 'invalid';
    if (!d.expiresOn || d.expiresOn < today) errors.expiresOn = 'date_in_past';
    if (d.pickupEnd <= d.pickupStart) errors.pickupEnd = 'pickup_end_before_start';
    if (Object.keys(errors).length) { showFieldErrors(form, errors); return; }

    const { free: _free, ...body } = d;
    if (body.weightGrams === undefined) delete body.weightGrams;
    await busy(form.querySelector('button[type="submit"]'), async () => {
      try {
        if (editing) await patch(`/supplier/offers/${encodeURIComponent(params.id)}`, body);
        else await post('/supplier/offers', body);
        toast(editing ? t('supplier.offerSaved') : t('supplier.offerPublished'));
        navigate('/painel/ofertas');
      } catch (err) {
        handleFormError(form, err);
      }
    });
  });

  return { title: editing ? t('supplier.editOffer') : t('supplier.newOffer') };
}
