import { randomBytes, randomInt, createHash } from 'node:crypto';

export const newId = () => randomBytes(9).toString('base64url');

const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export function newOrderCode() {
  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `PF-${code}`;
}

export const newPickupCode = () => String(randomInt(1000, 10000));

export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
