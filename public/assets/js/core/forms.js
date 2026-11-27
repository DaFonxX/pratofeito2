import { $$, on } from './dom.js';
import { t } from './i18n.js';

export function formValues(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') {
      if (el.dataset.group) {
        out[el.dataset.group] ??= [];
        if (el.checked) out[el.dataset.group].push(el.value);
      } else {
        out[el.name] = el.checked;
      }
    } else if (el.type === 'radio') {
      if (el.checked) out[el.name] = el.value;
    } else {
      out[el.name] = el.value;
    }
  }
  return out;
}

export function scorePassword(value) {
  if (!value) return 0;
  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  if (new Set(value).size < 4) score = Math.min(score, 1);
  return Math.min(4, score);
}

export function enhanceForms(root) {
  on(root, 'click', '[data-action="toggle-password"]', (e, btn) => {
    const input = btn.parentElement.querySelector('input');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.setAttribute('aria-pressed', String(show));
    btn.setAttribute('aria-label', show ? t('auth.hidePassword') : t('auth.showPassword'));
    btn.querySelector('use').setAttribute('href', show ? '#i-eye-off' : '#i-eye');
  });
  for (const input of $$('input[data-strength]', root)) {
    const meter = root.querySelector(`#${input.dataset.strength}`);
    const update = () => {
      const score = scorePassword(input.value);
      meter.dataset.score = String(score);
      meter.querySelector('.strength-label').textContent = input.value ? t(`auth.strength.${score}`) : '';
    };
    input.addEventListener('input', update);
    update();
  }
  on(root, 'input', '[aria-invalid="true"]', (e, input) => {
    input.removeAttribute('aria-invalid');
    input.closest('.field')?.querySelector('.error-text')?.remove();
  });
}
