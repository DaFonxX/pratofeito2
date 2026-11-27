import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'img');
mkdirSync(out, { recursive: true });

const COLORS = {
  feira: [255, 212, 59],
  agata: [35, 72, 201],
  face: [255, 255, 255],
  well: [237, 240, 247],
  speck: [255, 255, 255],
  tag: [24, 33, 58],
};
const SPECKS = [[8, 13], [31, 9.5], [34.5, 24], [12, 32.5], [25.5, 35.5], [5, 22], [18, 4.5]];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const coverage = (d) => Math.max(0, Math.min(1, 0.5 - d));
const circle = (cx, cy, r) => (x, y) => Math.hypot(x - cx, y - cy) - r;
function roundedRect(size, radius) {
  return (x, y) => {
    const qx = Math.abs(x - size / 2) - (size / 2 - radius);
    const qy = Math.abs(y - size / 2) - (size / 2 - radius);
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
  };
}

function draw(size, { maskable }) {
  const pixels = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const rim = size * (maskable ? 0.3 : 0.36);
  const scale = rim / 18;
  const layers = [
    [maskable ? () => -1 : roundedRect(size, size * 0.22), COLORS.feira],
    [circle(c, c, rim), COLORS.agata],
    ...SPECKS.map(([sx, sy]) => [circle(c + (sx - 20) * scale, c + (sy - 20) * scale, Math.max(0.9 * scale, 1)), COLORS.speck]),
    [circle(c, c, 12.6 * scale), COLORS.face],
    [circle(c, c, 9.2 * scale), COLORS.well],
  ];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0; let g = 0; let b = 0; let a = 0;
      for (const [sdf, color] of layers) {
        const alpha = coverage(sdf(x + 0.5, y + 0.5));
        if (!alpha) continue;
        r = color[0] * alpha + r * (1 - alpha);
        g = color[1] * alpha + g * (1 - alpha);
        b = color[2] * alpha + b * (1 - alpha);
        a = alpha + a * (1 - alpha);
      }
      const i = (y * size + x) * 4;
      pixels[i] = a ? Math.round(r / Math.max(a, 1e-6) * (a >= 1 ? 1 : 1)) : 0;
      pixels[i + 1] = a ? Math.round(g / Math.max(a, 1e-6)) : 0;
      pixels[i + 2] = a ? Math.round(b / Math.max(a, 1e-6)) : 0;
      pixels[i + 3] = Math.round(a * 255);
    }
  }
  return png(size, pixels);
}

for (const [name, size, maskable] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['icon-maskable-512.png', 512, true], ['apple-touch-icon.png', 180, true]]) {
  writeFileSync(path.join(out, name), draw(size, { maskable }));
  console.log(`gerado ${name}`);
}

const specks = SPECKS.map(([x, y]) => `<circle cx="${x + 12}" cy="${y + 12}" r="0.9" fill="#fff"/>`).join('');
writeFileSync(path.join(out, 'icon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#ffd43b"/><circle cx="32" cy="32" r="18" fill="#2348c9"/>${specks}<circle cx="32" cy="32" r="12.6" fill="#fff"/><circle cx="32" cy="32" r="9.2" fill="#edf0f7"/></svg>\n`);
console.log('gerado icon.svg');
