import { readFileSync } from 'node:fs';
import type { PixelImage } from '../../rockbox/rendering/pixelRenderer';

const scaleMask = (value: number, mask: number) => {
  if (mask === 0) return 0;
  let shift = 0;
  while (((mask >>> shift) & 1) === 0) shift += 1;
  const maximum = mask >>> shift;
  return Math.round((((value & mask) >>> shift) * 255) / maximum);
};

export const decodeBmp = (input: Uint8Array): PixelImage => {
  const bytes = Buffer.from(input);
  if (bytes.length < 54 || bytes.toString('ascii', 0, 2) !== 'BM') {
    throw new Error('The simulator screenshot is not a supported BMP file.');
  }
  const pixelOffset = bytes.readUInt32LE(10);
  const width = bytes.readInt32LE(18);
  const signedHeight = bytes.readInt32LE(22);
  const height = Math.abs(signedHeight);
  const bottomUp = signedHeight > 0;
  const bitsPerPixel = bytes.readUInt16LE(28);
  const compression = bytes.readUInt32LE(30);
  if (width <= 0 || height <= 0 || ![16, 24, 32].includes(bitsPerPixel)) {
    throw new Error(`Unsupported simulator BMP geometry or depth: ${width}x${height} @ ${bitsPerPixel}.`);
  }
  if (![0, 3].includes(compression)) {
    throw new Error(`Unsupported simulator BMP compression: ${compression}.`);
  }

  const rowBytes = Math.ceil((width * bitsPerPixel) / 32) * 4;
  const pixels = new Uint8Array(width * height * 3);
  const masks = compression === 3
    ? [bytes.readUInt32LE(54), bytes.readUInt32LE(58), bytes.readUInt32LE(62)] as const
    : bitsPerPixel === 16
      ? [0x7c00, 0x03e0, 0x001f] as const
      : [0x00ff0000, 0x0000ff00, 0x000000ff] as const;

  for (let y = 0; y < height; y += 1) {
    const sourceY = bottomUp ? height - 1 - y : y;
    const row = pixelOffset + sourceY * rowBytes;
    for (let x = 0; x < width; x += 1) {
      const output = (y * width + x) * 3;
      if (bitsPerPixel === 16) {
        const value = bytes.readUInt16LE(row + x * 2);
        pixels[output] = scaleMask(value, masks[0]);
        pixels[output + 1] = scaleMask(value, masks[1]);
        pixels[output + 2] = scaleMask(value, masks[2]);
      } else {
        const stride = bitsPerPixel / 8;
        const value = bitsPerPixel === 24
          ? bytes[row + x * stride + 2] << 16 | bytes[row + x * stride + 1] << 8 | bytes[row + x * stride]
          : bytes.readUInt32LE(row + x * stride);
        pixels[output] = scaleMask(value, masks[0]);
        pixels[output + 1] = scaleMask(value, masks[1]);
        pixels[output + 2] = scaleMask(value, masks[2]);
      }
    }
  }
  return { width, height, pixels };
};

export const readBmp = (path: string) => decodeBmp(new Uint8Array(readFileSync(path)));

export const differenceImage = (left: PixelImage, right: PixelImage): PixelImage => {
  if (left.width !== right.width || left.height !== right.height) {
    throw new Error(`Cannot diff ${left.width}x${left.height} and ${right.width}x${right.height} images.`);
  }
  const pixels = new Uint8Array(left.pixels.length);
  for (let offset = 0; offset < pixels.length; offset += 3) {
    const delta = Math.max(
      Math.abs(left.pixels[offset] - right.pixels[offset]),
      Math.abs(left.pixels[offset + 1] - right.pixels[offset + 1]),
      Math.abs(left.pixels[offset + 2] - right.pixels[offset + 2])
    );
    if (delta === 0) {
      pixels[offset] = 18;
      pixels[offset + 1] = 18;
      pixels[offset + 2] = 18;
    } else {
      pixels[offset] = 255;
      pixels[offset + 1] = Math.max(0, 160 - delta);
      pixels[offset + 2] = 0;
    }
  }
  return { width: left.width, height: left.height, pixels };
};
