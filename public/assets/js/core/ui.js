import { html, render, $, $$ } from './dom.js';
import { icon } from './icons.js';
import { t, tMaybe } from './i18n.js';

export function toast(message, { type = 'ok', action = null, duration = 4200 } = {}) {
  const root = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  render(el, html`${icon(type === 'error' ? 'alert' : type === 'info' ? 'info' : 'check')}<span>${message}</span>
    ${action ? html`<button type="button" class="toast-action">${action.label}</button>` : ''}`);
  if (action) el.querySelector('.toast-action').addEventListener('click', () => { action.onClick(); dismiss(); });
  root.append(el);
  let timer = setTimeout(dismiss, duration);
  el.addEventListener('mouseenter', () => clearTimeout(timer));
  el.addEventListener('mouseleave', () => { timer = setTimeout(dismiss, 1500); });
  function dismiss() {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 220);
  }
  return dismiss;
}

export function errorMessage(err) {
  if (!err) return t('errors.GENERIC');
  const code = err.code ?? 'GENERIC';
  const d = err.details ?? {};
  const params = {
    ...d,
    minutes: d.retryAfter ? Math.max(1, Math.ceil(d.retryAfter / 60)) : undefined,
    title: d.title ?? '',
  };
  return tMaybe(`errors.${code}`, params) ?? t('errors.GENERIC');
}

export const toastError = (err) => toast(errorMessage(err), { type: 'error', duration: 6000 });

export function showFieldErrors(form, fields = {}) {
  clearFieldErrors(form);
  let first = null;
  for (const [name, code] of Object.entries(fields)) {
    const input = form.querySelector(`[name="${CSS.escape(name)}"]`);
    if (!input) continue;
    const message = tMaybe(`validation.${code}`) ?? t('validation.invalid');
    input.setAttribute('aria-invalid', 'true');
    const holder = input.closest('.field') ?? input.parentElement;
    const id = `${input.id || name}-error`;
    const p = document.createElement('p');
    p.className = 'error-text';
    p.id = id;
    p.textContent = message;
    holder.append(p);
    input.setAttribute('aria-describedby', [input.getAttribute('aria-describedby'), id].filter(Boolean).join(' '));
    first ??= input;
  }
  first?.focus();
  return !!first;
}

export function clearFieldErrors(form) {
  for (const el of $$('.error-text', form)) el.remove();
  for (const input of $$('[aria-invalid="true"]', form)) {
    input.removeAttribute('aria-invalid');
    const ids = (input.getAttribute('aria-describedby') || '').split(' ').filter((id) => id && !id.endsWith('-error'));
    if (ids.length) input.setAttribute('aria-describedby', ids.join(' ')); else input.removeAttribute('aria-describedby');
  }
}

export function handleFormError(form, err) {
  if (err?.code === 'VALIDATION_ERROR' || err?.details?.fields) {
    if (showFieldErrors(form, err.fields)) {
      toast(t('errors.CHECK_FIELDS'), { type: 'error' });
      return;
    }
  }
  toastError(err);
}

export async function busy(button, task) {
  if (!button) return task();
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  try { return await task(); } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}

export function openDialog(content, { className = '', onMount } = {}) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = className;
    render(dialog, content);
    document.body.append(dialog);
    let result;
    const close = (value) => { result = value; dialog.close(); };
    dialog.addEventListener('close', () => { dialog.remove(); resolve(result); });
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) close(undefined);
      const btn = e.target.closest('[data-close]');
      if (btn) close(btn.dataset.close === 'true' ? true : btn.dataset.close === 'false' ? false : undefined);
    });
    dialog.showModal();
    onMount?.(dialog, close);
  });
}

export function confirmDialog({ title, message, confirm = t('common.confirm'), cancel = t('common.cancel'), danger = false }) {
  return openDialog(html`
    <div class="dialog-body">
      <div class="dialog-head"><h2>${title}</h2></div>
      ${message ? html`<p class="muted">${message}</p>` : ''}
    </div>
    <div class="dialog-actions">
      <button type="button" class="btn btn-ghost" data-close="false">${cancel}</button>
      <button type="button" class="btn ${danger ? 'btn-danger-solid' : 'btn-primary'}" data-close="true" autofocus>${confirm}</button>
    </div>`).then((v) => v === true);
}

export function formDialog({ title, description = '', fields, submit, cancel = t('common.cancel'), danger = false, validate }) {
  return openDialog(html`
    <form class="dialog-form" novalidate>
      <div class="dialog-body">
        <div class="dialog-head"><h2>${title}</h2></div>
        ${description ? html`<p class="muted">${description}</p>` : ''}
        ${fields}
      </div>
      <div class="dialog-actions">
        <button type="button" class="btn btn-ghost" data-close="false">${cancel}</button>
        <button type="submit" class="btn ${danger ? 'btn-danger-solid' : 'btn-primary'}">${submit}</button>
      </div>
    </form>`, {
    onMount(dialog, close) {
      const form = $('form', dialog);
      $('input, textarea, select', form)?.focus();
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const values = Object.fromEntries(new FormData(form));
        if (validate) {
          const fieldsErr = await validate(values, form);
          if (fieldsErr && Object.keys(fieldsErr).length) { showFieldErrors(form, fieldsErr); return; }
        }
        close(values);
      });
    },
  }).then((v) => (v && typeof v === 'object' ? v : null));
}

let progressTimer;
export function progressStart() {
  const bar = document.getElementById('route-progress');
  clearTimeout(progressTimer);
  bar.style.opacity = '1';
  bar.style.width = '0';
  requestAnimationFrame(() => { bar.style.width = '70%'; });
}
export function progressDone() {
  const bar = document.getElementById('route-progress');
  bar.style.width = '100%';
  progressTimer = setTimeout(() => { bar.style.opacity = '0'; bar.style.width = '0'; }, 250);
}

export function announce(message) {
  const el = document.getElementById('route-announcer');
  el.textContent = '';
  setTimeout(() => { el.textContent = message; }, 50);
}
