/**
 * Renders the Playground Life brand mark into every raster icon the app
 * ships.
 *
 * `public/favicon.svg` is the source of truth for the mark: a rounded square
 * with a sky-to-mint diagonal gradient, two white eyes and a white smile.
 * This script reads that file and draws the same geometry in raster form, so
 * the PNGs can never drift away from the SVG the browser renders.
 *
 * Run with no arguments to regenerate `public/`. Pass directories to write the
 * same set elsewhere (the Capacitor web assets, for example).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { deflateSync } from "node:zlib";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SVG_FILE = join(ROOT, "public", "favicon.svg");

/**
 * The maskable icon is masked by the platform, so the face is drawn smaller
 * and the background bleeds to the edges. The safe zone is a circle of 80%
 * of the icon, and 64% leaves the face comfortably inside it.
 */
const MASKABLE_FACE_SCALE = 0.64;

/** Supersampling per axis. 4 gives 16 samples per pixel. */
const SAMPLES = 4;

// --- SVG reading ---------------------------------------------------------

const attr = (tag, name) => {
  // The name must be a whole attribute, so `x` never matches `rx`.
  const match = tag.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`));
  return match ? match[1] : null;
};

const attrNumber = (tag, name) => {
  const value = attr(tag, name);
  return value === null ? null : Number(value);
};

/** SVG lengths: `0`, `64`, `50%`. Percentages are object-bounding-box units. */
const length = (tag, name, fallback) => {
  const value = attr(tag, name);
  if (value === null) return fallback;
  if (value.endsWith("%")) return Number(value.slice(0, -1)) / 100;
  return Number(value);
};

const hexToRgb = (hex) => {
  const value = hex.trim().replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
};

function parseSVG(source) {
  const viewBox = (source.match(/viewBox="([^"]*)"/) || [])[1];
  if (!viewBox) throw new Error("favicon.svg has no viewBox");
  const [, , width, height] = viewBox.split(/\s+/).map(Number);

  const gradientTag = (source.match(/<linearGradient[^>]*>[\s\S]*?<\/linearGradient>/) || [])[0];
  if (!gradientTag) throw new Error("favicon.svg has no linearGradient");
  const gradientHead = gradientTag.match(/<linearGradient[^>]*>/)[0];
  const stops = [...gradientTag.matchAll(/<stop[^>]*\/>/g)].map((match) => {
    const stop = match[0];
    return {
      offset: length(stop, "offset", 0),
      colour: hexToRgb(attr(stop, "stop-color")),
    };
  });
  if (stops.length === 0) throw new Error("favicon.svg gradient has no stops");

  const gradient = {
    x1: length(gradientHead, "x1", 0),
    y1: length(gradientHead, "y1", 0),
    x2: length(gradientHead, "x2", 1),
    y2: length(gradientHead, "y2", 0),
    stops,
  };

  const rectTag = (source.match(/<rect[^>]*\/?>/) || [])[0];
  if (!rectTag) throw new Error("favicon.svg has no rect");
  const rect = {
    x: length(rectTag, "x", 0),
    y: length(rectTag, "y", 0),
    width: length(rectTag, "width", width),
    height: length(rectTag, "height", height),
    rx: length(rectTag, "rx", 0),
  };

  const circles = [...source.matchAll(/<circle[^>]*\/>/g)].map((match) => {
    const circle = match[0];
    return {
      cx: attrNumber(circle, "cx"),
      cy: attrNumber(circle, "cy"),
      r: attrNumber(circle, "r"),
      fill: hexToRgb(attr(circle, "fill")),
      opacity: attr(circle, "fill-opacity") === null ? 1 : Number(attr(circle, "fill-opacity")),
    };
  });

  const paths = [...source.matchAll(/<path[^>]*\/>/g)].map((match) => {
    const path = match[0];
    const segments = parsePathData(attr(path, "d"));
    const points = sampleSegments(segments, 96);
    return {
      points,
      stroke: hexToRgb(attr(path, "stroke")),
      strokeWidth: attrNumber(path, "stroke-width") ?? 0,
      bounds: boundsOf(points),
    };
  });

  return { viewBox: { width, height }, gradient, rect, circles, paths };
}

// --- Path data -----------------------------------------------------------

/**
 * Reads the subset of SVG path data the brand mark uses: moveto, lineto,
 * cubic and smooth cubic. Anything else throws, so a changed mark fails
 * loudly instead of rendering as a blank square.
 */
function parsePathData(d) {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const segments = [];
  let index = 0;
  let command = null;
  let point = { x: 0, y: 0 };
  let lastControl = null;

  const number = () => {
    if (index >= tokens.length) throw new Error(`path data ended early: "${d}"`);
    return Number(tokens[index++]);
  };

  while (index < tokens.length) {
    const token = tokens[index];
    if (/[a-zA-Z]/.test(token)) {
      command = token;
      index += 1;
    }
    if (command === null) throw new Error(`path data has no command: "${d}"`);

    switch (command) {
      case "M": {
        point = { x: number(), y: number() };
        command = "L";
        break;
      }
      case "m": {
        point = { x: point.x + number(), y: point.y + number() };
        command = "l";
        break;
      }
      case "L": {
        const end = { x: number(), y: number() };
        segments.push({ type: "line", x0: point.x, y0: point.y, x1: end.x, y1: end.y });
        point = end;
        lastControl = null;
        break;
      }
      case "l": {
        const end = { x: point.x + number(), y: point.y + number() };
        segments.push({ type: "line", x0: point.x, y0: point.y, x1: end.x, y1: end.y });
        point = end;
        lastControl = null;
        break;
      }
      case "C": {
        const x1 = number();
        const y1 = number();
        const x2 = number();
        const y2 = number();
        const end = { x: number(), y: number() };
        segments.push({ type: "cubic", x0: point.x, y0: point.y, x1, y1, x2, y2, x: end.x, y: end.y });
        point = end;
        lastControl = { x: x2, y: y2 };
        break;
      }
      case "c": {
        const x1 = point.x + number();
        const y1 = point.y + number();
        const x2 = point.x + number();
        const y2 = point.y + number();
        const end = { x: point.x + number(), y: point.y + number() };
        segments.push({ type: "cubic", x0: point.x, y0: point.y, x1, y1, x2, y2, x: end.x, y: end.y });
        point = end;
        lastControl = { x: x2, y: y2 };
        break;
      }
      case "S": {
        const x2 = number();
        const y2 = number();
        const end = { x: number(), y: number() };
        const x1 = lastControl ? 2 * point.x - lastControl.x : point.x;
        const y1 = lastControl ? 2 * point.y - lastControl.y : point.y;
        segments.push({ type: "cubic", x0: point.x, y0: point.y, x1, y1, x2, y2, x: end.x, y: end.y });
        point = end;
        lastControl = { x: x2, y: y2 };
        break;
      }
      case "s": {
        const x2 = point.x + number();
        const y2 = point.y + number();
        const end = { x: point.x + number(), y: point.y + number() };
        const x1 = lastControl ? 2 * point.x - lastControl.x : point.x;
        const y1 = lastControl ? 2 * point.y - lastControl.y : point.y;
        segments.push({ type: "cubic", x0: point.x, y0: point.y, x1, y1, x2, y2, x: end.x, y: end.y });
        point = end;
        lastControl = { x: x2, y: y2 };
        break;
      }
      case "Z":
      case "z":
        break;
      default:
        throw new Error(`unsupported path command "${command}" in "${d}"`);
    }
  }

  return segments;
}

const cubicAt = (segment, t) => {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return {
    x: a * segment.x0 + b * segment.x1 + c * segment.x2 + d * segment.x,
    y: a * segment.y0 + b * segment.y1 + c * segment.y2 + d * segment.y,
  };
};

/** Turns the path segments into a polyline, which is what gets stroked. */
function sampleSegments(segments, perSegment) {
  const points = [];
  for (const segment of segments) {
    if (segment.type === "line") {
      points.push({ x: segment.x0, y: segment.y0 });
      points.push({ x: segment.x1, y: segment.y1 });
      continue;
    }
    for (let i = 0; i <= perSegment; i += 1) {
      points.push(cubicAt(segment, i / perSegment));
    }
  }
  return points;
}

const boundsOf = (points) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  return { minX, minY, maxX, maxY };
};

// --- Drawing -------------------------------------------------------------

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const lerp = (a, b, t) => a + (b - a) * t;

const blend = (base, over, alpha) => [
  Math.round(lerp(base[0], over[0], alpha)),
  Math.round(lerp(base[1], over[1], alpha)),
  Math.round(lerp(base[2], over[2], alpha)),
];

const distanceToSegment = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : clamp01(((px - ax) * dx + (py - ay) * dy) / lengthSquared);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

const distanceToPolyline = (px, py, points) => {
  let best = Infinity;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const distance = distanceToSegment(px, py, a.x, a.y, b.x, b.y);
    if (distance < best) best = distance;
  }
  return best;
};

/** The gradient colour at a point in the icon's 0..1 box. */
function gradientColour(mark, u, v) {
  const { x1, y1, x2, y2, stops } = mark.gradient;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const span = dx * dx + dy * dy;
  const t = span === 0 ? 0 : clamp01(((u - x1) * dx + (v - y1) * dy) / span);

  if (stops.length === 1) return stops[0].colour;

  let lower = stops[0];
  let upper = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i += 1) {
    if (t >= stops[i].offset && t <= stops[i + 1].offset) {
      lower = stops[i];
      upper = stops[i + 1];
      break;
    }
  }
  const spanInStops = upper.offset - lower.offset;
  const local = spanInStops === 0 ? 0 : (t - lower.offset) / spanInStops;
  return blend(lower.colour, upper.colour, clamp01(local));
}

/** Inside the rounded square? The maskable variant bleeds to the edges. */
function insideBackground(mark, u, v, maskable) {
  if (maskable) return true;

  const { x, y, width, height, rx } = mark.rect;
  const boxWidth = width / mark.viewBox.width;
  const boxHeight = height / mark.viewBox.height;

  const px = u * mark.viewBox.width;
  const py = v * mark.viewBox.height;
  const innerLeft = x + rx;
  const innerRight = x + width - rx;
  const innerTop = y + rx;
  const innerBottom = y + height - rx;

  const dx = px - Math.min(Math.max(px, innerLeft), innerRight);
  const dy = py - Math.min(Math.max(py, innerTop), innerBottom);

  // The rounded square has to fill the whole icon, so a smaller box is a
  // mistake rather than a smaller mark.
  if (boxWidth < 1 || boxHeight < 1) return false;

  return Math.hypot(dx, dy) <= rx;
}

/** The full pixel colour at a normalised coordinate, or null for transparent. */
function paint(mark, u, v, maskable) {
  if (!insideBackground(mark, u, v, maskable)) return null;

  const base = gradientColour(mark, u, v);

  // The face is drawn in the SVG's own coordinate system. For the maskable
  // variant the face is scaled down about the centre, so the point is mapped
  // back into the mark's coordinates before anything is tested against it.
  const zoom = maskable ? 1 / MASKABLE_FACE_SCALE : 1;
  const fx = (0.5 + (u - 0.5) * zoom) * mark.viewBox.width;
  const fy = (0.5 + (v - 0.5) * zoom) * mark.viewBox.height;

  let colour = base;

  for (const circle of mark.circles) {
    if (Math.hypot(fx - circle.cx, fy - circle.cy) <= circle.r) {
      colour = blend(colour, circle.fill, circle.opacity);
    }
  }

  for (const path of mark.paths) {
    if (path.strokeWidth <= 0) continue;
    const half = path.strokeWidth / 2;
    const { minX, minY, maxX, maxY } = path.bounds;
    if (fx < minX - half || fx > maxX + half || fy < minY - half || fy > maxY + half) continue;
    if (distanceToPolyline(fx, fy, path.points) <= half) {
      colour = blend(colour, path.stroke, 1);
    }
  }

  return colour;
}

/** Renders the mark into an RGBA pixel buffer of `size` x `size`. */
function renderRGBA(mark, size, maskable) {
  const rgba = Buffer.alloc(size * size * 4);

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let hits = 0;

      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const u = (px + (sx + 0.5) / SAMPLES) / size;
          const v = (py + (sy + 0.5) / SAMPLES) / size;
          const colour = paint(mark, u, v, maskable);
          if (!colour) continue;
          r += colour[0];
          g += colour[1];
          b += colour[2];
          a += 255;
          hits += 1;
        }
      }

      const offset = (py * size + px) * 4;
      if (hits === 0) {
        rgba[offset] = 0;
        rgba[offset + 1] = 0;
        rgba[offset + 2] = 0;
        rgba[offset + 3] = 0;
        continue;
      }

      rgba[offset] = Math.round(r / hits);
      rgba[offset + 1] = Math.round(g / hits);
      rgba[offset + 2] = Math.round(b / hits);
      rgba[offset + 3] = Math.round(a / hits);
    }
  }

  return rgba;
}

// --- PNG and ICO encoding ------------------------------------------------

const crcTable = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) c = crcTable[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuffer = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePNG(mark, size, maskable) {
  const stride = size * 4;
  const rgba = renderRGBA(mark, size, maskable);

  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

/**
 * Wraps a PNG in an ICO container. Windows Vista and later accept a PNG
 * payload directly, which keeps the file small and lets the same renderer
 * produce both the .png and the .ico.
 */
function encodeIco(mark, size) {
  const png = encodePNG(mark, size, false);

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size;
  entry[1] = size >= 256 ? 0 : size;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);

  return Buffer.concat([header, entry, png]);
}

// --- Entry point ---------------------------------------------------------

const TARGETS = [
  { name: "pwa-192.png", size: 192, maskable: false },
  { name: "pwa-512.png", size: 512, maskable: false },
  { name: "pwa-maskable-512.png", size: 512, maskable: true },
  { name: "apple-touch-icon-180.png", size: 180, maskable: false },
  { name: "favicon.ico", size: 256, maskable: false },
];

const mark = parseSVG(readFileSync(SVG_FILE, "utf-8"));

const outDirs = process.argv.slice(2);
if (outDirs.length === 0) outDirs.push(join(ROOT, "public"));

for (const dir of outDirs) {
  mkdirSync(dir, { recursive: true });
  for (const target of TARGETS) {
    const file = join(dir, target.name);
    const bytes = target.name.endsWith(".ico")
      ? encodeIco(mark, target.size)
      : encodePNG(mark, target.size, target.maskable);
    writeFileSync(file, bytes);
    console.log(`wrote ${file} (${target.size}x${target.size}${target.maskable ? " maskable" : ""})`);
  }
}
