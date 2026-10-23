import { inflateSync } from "node:zlib";

export interface RasterImage {
  width: number;
  height: number;
  data: Uint8Array;
}

/**
 * Reads a PNG into raw RGBA pixels. Only what the icon generator writes is
 * supported: 8-bit RGBA, no interlacing.
 */
export function decodePNG(buffer: Buffer): RasterImage {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buffer.subarray(0, 8).equals(signature)) throw new Error("not a PNG");

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colourType = 0;
  const idat: Buffer[] = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colourType = data[9];
      if (data[12] !== 0) throw new Error("interlaced PNG is not supported");
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }

    offset += 12 + length;
  }

  if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth}`);
  if (colourType !== 6) throw new Error(`unsupported colour type ${colourType}`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const data = new Uint8Array(stride * height);
  let position = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = raw[position];
    position += 1;
    const line = raw.subarray(position, position + stride);
    position += stride;

    for (let x = 0; x < stride; x += 1) {
      const left = x >= 4 ? data[y * stride + x - 4] : 0;
      const up = y > 0 ? data[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= 4 ? data[(y - 1) * stride + x - 4] : 0;

      let value = line[x];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += Math.floor((left + up) / 2);
      else if (filter === 4) {
        const estimate = left + up - upLeft;
        const distanceLeft = Math.abs(estimate - left);
        const distanceUp = Math.abs(estimate - up);
        const distanceUpLeft = Math.abs(estimate - upLeft);
        value +=
          distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft
            ? left
            : distanceUp <= distanceUpLeft
              ? up
              : upLeft;
      }
      data[y * stride + x] = value & 0xff;
    }
  }

  return { width, height, data };
}

export function pixelAt(image: RasterImage, x: number, y: number): number[] {
  const offset = (y * image.width + x) * 4;
  return [...image.data.subarray(offset, offset + 4)];
}

/** A pixel that belongs to the white face marks. */
export function isFaceMark(image: RasterImage, x: number, y: number): boolean {
  const [r, g, b, a] = pixelAt(image, x, y);
  return a > 200 && r >= 235 && g >= 235 && b >= 235;
}

/** The pixel of the given colour, addressed as a fraction of the image. */
export function pixelAtFraction(image: RasterImage, u: number, v: number): number[] {
  return pixelAt(image, Math.min(image.width - 1, Math.round(u * image.width)), Math.min(image.height - 1, Math.round(v * image.height)));
}
