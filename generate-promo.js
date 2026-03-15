/**
 * Generates the Chrome Web Store promo tile (440×280) as promo-tile.png.
 * Run: node generate-promo.js
 *
 * Uses the 'canvas' npm package if available, otherwise writes a solid PNG.
 */

const fs   = require('fs');
const path = require('path');

const W = 440;
const H = 280;

function makePromo() {
  try {
    const { createCanvas } = require('canvas');
    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext('2d');

    // Background gradient – deep dark
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0d0d1a');
    bg.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle star dots
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    const stars = [
      [30, 20], [80, 60], [150, 15], [220, 50], [300, 25], [380, 55],
      [420, 20], [60, 120], [340, 100], [410, 140], [20, 200], [400, 220],
    ];
    for (const [sx, sy] of stars) {
      ctx.beginPath();
      ctx.arc(sx, sy, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Moon icon (same style as extension icon, large)
    const mx = W / 2 - 60;
    const my = H / 2;
    const mr = 48;

    ctx.fillStyle = '#f0c040';
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(mx + mr * 0.45, my - mr * 0.1, mr * 0.78, 0, Math.PI * 2);
    ctx.fill();

    // Title text
    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 32px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('Universal Dark Mode', mx + mr + 20, my - 18);

    // Subtitle
    ctx.fillStyle = '#aaaacc';
    ctx.font      = '18px sans-serif';
    ctx.fillText('Dark mode for every website', mx + mr + 20, my + 18);

    // Bottom tagline
    ctx.fillStyle = '#555577';
    ctx.font      = '13px sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Global toggle · Per-site control · No tracking', W / 2 - 160, H - 16);

    return canvas.toBuffer('image/png');
  } catch {
    return solidPng(W, H);
  }
}

function solidPng(width, height) {
  const zlib = require('zlib');

  const rowBytes = width * 4;
  const raw      = Buffer.alloc((rowBytes + 1) * height);
  for (let y = 0; y < height; y++) {
    const base = y * (rowBytes + 1);
    raw[base] = 0;
    for (let x = 0; x < width; x++) {
      const i = base + 1 + x * 4;
      raw[i]     = 0x0d;
      raw[i + 1] = 0x0d;
      raw[i + 2] = 0x1a;
      raw[i + 3] = 0xff;
    }
  }

  const compressed = zlib.deflateSync(raw);

  function u32(n) { const b = Buffer.alloc(4); b.writeUInt32BE(n, 0); return b; }
  function crc32(buf) {
    let c = 0xffffffff;
    for (const byte of buf) { c ^= byte; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); }
    return (c ^ 0xffffffff) >>> 0;
  }
  function chunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    return Buffer.concat([u32(data.length), typeBuf, data, u32(crc32(Buffer.concat([typeBuf, data])))]);
  }

  const sig      = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0); ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; ihdrData[9] = 6;
  return Buffer.concat([sig, chunk('IHDR', ihdrData), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

const buf = makePromo();
const out = path.join(__dirname, 'promo-tile.png');
fs.writeFileSync(out, buf);
console.log(`Written ${out} (${W}×${H})`);
