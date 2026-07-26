// @ts-check
/**
 * מייצר את אריח הגרעיניות של assets/grain.png.
 *
 * באתר הרקע הגרעיני נוצר מ־feTurbulence של SVG. ב־React Native אין
 * פילטרים של SVG, ולכן אותו אפקט מגיע כאריח PNG שחוזר על עצמו.
 * ה־seed קבוע, כך שהרצה חוזרת מייצרת בית־בבית את אותו קובץ.
 *
 * הרצה: node scripts/generate-grain.mjs
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SIZE = 128;
const SEED = 20260726;

/** mulberry32 — דטרמיניסטי, ובלי תלות בספרייה חיצונית */
function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

const random = createRandom(SEED);

// גריי־סקייל עם אלפא (color type 4): הרעש עצמו בערוץ הבהירות,
// והשקיפות היא מה שמאפשר לשים אותו מעל צבע הנייר.
const raw = Buffer.alloc(SIZE * (1 + SIZE * 2));
for (let y = 0; y < SIZE; y += 1) {
  const rowStart = y * (1 + SIZE * 2);
  raw[rowStart] = 0; // filter type: none
  for (let x = 0; x < SIZE; x += 1) {
    const value = Math.round(random() * 255);
    raw[rowStart + 1 + x * 2] = value;
    raw[rowStart + 2 + x * 2] = 255;
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 4; // grayscale + alpha
ihdr[10] = 0; // deflate
ihdr[11] = 0; // adaptive filtering
ihdr[12] = 0; // no interlace

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'grain.png');
writeFileSync(target, png);
console.log(`grain.png: ${SIZE}x${SIZE}, ${png.length} bytes`);
