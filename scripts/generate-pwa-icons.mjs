import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { deflateSync } from "node:zlib";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SKY = [59, 160, 206];
const MINT = [105, 191, 136];
const WHITE = 255;

function lerp3(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

const dist = (x, y, cx, cy) => Math.hypot(x - cx, y - cy);

function paint(u, v, maskable) {
  let colour;
  if (maskable) {
    colour = [SKY[0], SKY[1], SKY[2], 255];
  } else {
    const t = Math.max(0, Math.min(1, (u + v) / 2));
    colour = [...lerp3(SKY, MINT, t), 255];
  }

  let x = u;
  let y = v;
  if (maskable) {
    x = 0.5 + (u - 0.5) * 0.64;
    y = 0.5 + (v - 0.5) * 0.64;
  }

  if (dist(x, y, 0.30, 0.28) <= 0.24) colour = [255, 255, 255, 240];
  if (dist(x, y, 0.63, 0.68) <= 0.16) colour = [255, 255, 255, 228];
  if (dist(x, y, 0.82, 0.24) <= 0.085) colour = [255, 255, 255, 215];
  const ring = dist(x, y, 0.56, 0.30);
  if (ring <= 0.075 && ring >= 0.045) colour = [255, 255, 255, 205];
  if (dist(x, y, 0.45, 0.80) <= 0.045) colour = [255, 255, 255, 210];
  return colour;
}

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(size, maskable) {
  const stride = size * 4;
  const rgba = Buffer.alloc(stride * size);
  const ss = 4;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const u = (px + (sx + 0.5) / ss) / size;
          const v = (py + (sy + 0.5) / ss) / size;
          const c = paint(u, v, maskable);
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const n = ss * ss;
      const off = (py * size + px) * 4;
      rgba[off] = Math.round(r / n);
      rgba[off + 1] = Math.round(g / n);
      rgba[off + 2] = Math.round(b / n);
      rgba[off + 3] = 255;
    }
  }

  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

const targets = [
  { name: "pwa-192.png", size: 192, maskable: false },
  { name: "pwa-512.png", size: 512, maskable: false },
  { name: "pwa-maskable-512.png", size: 512, maskable: true },
  { name: "apple-touch-icon-180.png", size: 180, maskable: false },
];

const outDirs = process.argv.slice(2);
if (outDirs.length === 0) outDirs.push(ROOT);

for (const dir of outDirs) {
  mkdirSync(dir, { recursive: true });
  for (const t of targets) {
    const file = join(dir, t.name);
    writeFileSync(file, encodePNG(t.size, t.maskable));
    console.log(`wrote ${file} (${t.size}x${t.size}${t.maskable ? " maskable" : ""})`);
  }
}