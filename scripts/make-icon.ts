/**
 * Generates a source app icon (PNG) with no native deps, so `tauri icon` can
 * derive all platform icon sizes. Run via `npm run make:icon`.
 *
 * Draws a simple mind-map motif: a central node with two child nodes on a
 * brand-blue rounded background. Encodes a valid RGBA PNG using fflate's zlib.
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { zlibSync } from "fflate";

const SIZE = 1024;

// --- tiny PNG encoder ------------------------------------------------------
function crc32(buf: Uint8Array): number {
  let c = ~0 >>> 0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]!;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  out.set(typeBytes, 4);
  out.set(data, 8);
  const crcRegion = out.subarray(4, 8 + data.length);
  dv.setUint32(8 + data.length, crc32(crcRegion));
  return out;
}

function encodePng(rgba: Uint8Array, size: number): Uint8Array {
  // Prepend a filter byte (0 = none) to each scanline.
  const stride = size * 4;
  const raw = new Uint8Array((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    raw.set(rgba.subarray(y * stride, y * stride + stride), y * (stride + 1) + 1);
  }
  const idat = zlibSync(raw, { level: 6 });

  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, size);
  dv.setUint32(4, size);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // remaining bytes (compression, filter, interlace) are 0

  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", new Uint8Array(0))];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

// --- draw the motif --------------------------------------------------------
function setPx(buf: Uint8Array, x: number, y: number, r: number, g: number, b: number, a = 255) {
  const i = (y * SIZE + x) * 4;
  buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
}

function disc(buf: Uint8Array, cxf: number, cyf: number, radf: number, col: [number, number, number]) {
  const cx = Math.round(cxf), cy = Math.round(cyf), rad = Math.round(radf);
  const r2 = rad * rad;
  const y0 = Math.max(0, cy - rad), y1 = Math.min(SIZE, cy + rad);
  const x0 = Math.max(0, cx - rad), x1 = Math.min(SIZE, cx + rad);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r2) setPx(buf, x, y, col[0], col[1], col[2]);
    }
  }
}

function line(buf: Uint8Array, x1: number, y1: number, x2: number, y2: number, w: number, col: [number, number, number]) {
  const steps = Math.hypot(x2 - x1, y2 - y1);
  for (let t = 0; t <= steps; t++) {
    const x = Math.round(x1 + ((x2 - x1) * t) / steps);
    const y = Math.round(y1 + ((y2 - y1) * t) / steps);
    disc(buf, x, y, w, col);
  }
}

const rgba = new Uint8Array(SIZE * SIZE * 4);
// Rounded brand-blue background.
const BG: [number, number, number] = [0x3f, 0x7f, 0xd0];
const radius = SIZE * 0.18;
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const inX = x >= radius && x < SIZE - radius;
    const inY = y >= radius && y < SIZE - radius;
    let inside = inX || inY;
    if (!inside) {
      const cx = x < radius ? radius : SIZE - radius;
      const cy = y < radius ? radius : SIZE - radius;
      inside = Math.hypot(x - cx, y - cy) <= radius;
    }
    if (inside) setPx(rgba, x, y, BG[0], BG[1], BG[2]);
  }
}

// Mind-map nodes: central + two children, connected.
const WHITE: [number, number, number] = [255, 255, 255];
const cx = SIZE * 0.38, cy = SIZE * 0.5;
const c1x = SIZE * 0.68, c1y = SIZE * 0.34;
const c2x = SIZE * 0.68, c2y = SIZE * 0.66;
line(rgba, cx, cy, c1x, c1y, SIZE * 0.012, WHITE);
line(rgba, cx, cy, c2x, c2y, SIZE * 0.012, WHITE);
disc(rgba, cx, cy, SIZE * 0.1, WHITE);
disc(rgba, c1x, c1y, SIZE * 0.07, WHITE);
disc(rgba, c2x, c2y, SIZE * 0.07, WHITE);

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "app-icon.png");
writeFileSync(out, encodePng(rgba, SIZE));
console.log(`wrote ${out} (${SIZE}x${SIZE})`);
