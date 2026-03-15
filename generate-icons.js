/**
 * Generates PNG icons for the extension using the 'canvas' npm package.
 * Run: node generate-icons.js
 *
 * If canvas is unavailable, falls back to writing minimal valid PNGs.
 */

const fs   = require('fs');
const path = require('path');

const SIZES = [16, 32, 48, 128];
const OUT   = path.join(__dirname, 'icons');

// Minimal 1×1 transparent PNG (base for scaling reference) – we'll draw our own.
// We embed a tiny hand-crafted PNG if canvas isn't available.

function makePng(size) {
  // Try canvas
  try {
    const { createCanvas } = require('canvas');
    const canvas = createCanvas(size, size);
    const ctx    = canvas.getContext('2d');

    // Background circle – dark navy
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    // Moon crescent
    const r   = size * 0.32;
    const cx  = size / 2;
    const cy  = size / 2;
    ctx.fillStyle = '#f0c040';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Mask with slightly offset dark circle to create crescent
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(cx + r * 0.45, cy - r * 0.1, r * 0.78, 0, Math.PI * 2);
    ctx.fill();

    return canvas.toBuffer('image/png');
  } catch {
    // Canvas not available – return a minimal valid solid-colour PNG
    return minimalPng(size);
  }
}

/**
 * Produce a minimal valid PNG of a solid dark colour at `size`×`size`.
 * Uses raw deflate-compressed IDAT chunks.
 */
function minimalPng(size) {
  const zlib = require('zlib');

  const width  = size;
  const height = size;

  // Raw image data: RGBA rows prefixed with filter byte 0x00
  const rowBytes = width * 4;
  const raw      = Buffer.alloc((rowBytes + 1) * height);
  for (let y = 0; y < height; y++) {
    const base = y * (rowBytes + 1);
    raw[base] = 0; // filter type None
    for (let x = 0; x < width; x++) {
      const i = base + 1 + x * 4;
      raw[i]     = 0x1a; // R
      raw[i + 1] = 0x1a; // G
      raw[i + 2] = 0x2e; // B
      raw[i + 3] = 0xff; // A
    }
  }

  const compressed = zlib.deflateSync(raw);

  function u32(n) {
    const b = Buffer.alloc(4);
    b.writeUInt32BE(n, 0);
    return b;
  }

  function crc32(buf) {
    let c = 0xffffffff;
    for (const byte of buf) {
      c ^= byte;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf  = Buffer.concat([typeBuf, data]);
    return Buffer.concat([u32(data.length), typeBuf, data, u32(crc32(crcBuf))]);
  }

  const sig  = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = chunk('IHDR', Buffer.concat([u32(width), u32(height), Buffer.from([8, 2, 0, 0, 0])]));
  // Re-encode as RGBA (bit depth 8, color type 6)
  const ihdr2Data = Buffer.alloc(13);
  ihdr2Data.writeUInt32BE(width,  0);
  ihdr2Data.writeUInt32BE(height, 4);
  ihdr2Data[8]  = 8; // bit depth
  ihdr2Data[9]  = 6; // color type RGBA
  ihdr2Data[10] = 0; // compression
  ihdr2Data[11] = 0; // filter
  ihdr2Data[12] = 0; // interlace
  const ihdr2   = chunk('IHDR', ihdr2Data);
  const idat    = chunk('IDAT', compressed);
  const iend    = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr2, idat, iend]);
}

for (const size of SIZES) {
  const buf  = makePng(size);
  const dest = path.join(OUT, `icon${size}.png`);
  fs.writeFileSync(dest, buf);
  console.log(`Written ${dest}`);
}
