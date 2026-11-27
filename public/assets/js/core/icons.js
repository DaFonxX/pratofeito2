import { raw } from './dom.js';

export const icon = (name, className = '') =>
  raw(`<svg class="icon ${className}" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`);

const SPECKS = [[8, 13], [31, 9.5], [34.5, 24], [12, 32.5], [25.5, 35.5], [5, 22], [18, 4.5]];

export function logo(size = 34) {
  const specks = SPECKS.map(([x, y]) => `<circle class="logo-speck" cx="${x}" cy="${y}" r="0.9"/>`).join('');
  return raw(`<svg viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true" focusable="false">
    <circle class="logo-rim" cx="20" cy="20" r="18"/>${specks}
    <circle class="logo-face" cx="20" cy="20" r="12.6"/>
    <circle class="logo-well" cx="20" cy="20" r="9.2"/>
    <g transform="rotate(-18 31 29)"><rect class="logo-tag" x="24.5" y="25" width="13" height="8.2" rx="1.6"/><circle class="logo-hole" cx="27" cy="29.1" r="1.1"/></g>
  </svg>`);
}

export function plate(className = 'plate') {
  const specks = SPECKS.map(([x, y]) => `<circle class="logo-speck" cx="${x * 2.9 + 2}" cy="${y * 2.9}" r="2"/>`).join('');
  return raw(`<svg class="${className}" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
    <ellipse class="plate-shadow" cx="60" cy="113" rx="40" ry="5"/>
    <circle class="logo-rim" cx="60" cy="58" r="52"/>${specks}
    <circle class="logo-face" cx="60" cy="58" r="37"/>
    <circle class="logo-well" cx="60" cy="58" r="27"/>
  </svg>`);
}
