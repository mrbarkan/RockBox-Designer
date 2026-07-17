export type RockboxBitmapInspection = {
  valid: boolean;
  width: number;
  height: number;
  topDown: boolean;
  bitDepth: number;
  compression: number;
  compressionLabel: 'BI_RGB' | 'BI_BITFIELDS' | 'unsupported';
  dataOffset: number;
  hasAlpha: boolean;
  error?: string;
  warnings: string[];
};

export type RgbaRaster = {
  width: number;
  height: number;
  rgba: Uint8ClampedArray | Uint8Array;
};

const SUPPORTED_DEPTHS = new Set([1, 4, 8, 16, 24, 32]);
const RGB555 = [0x7c00, 0x03e0, 0x001f];
const RGB565 = [0xf800, 0x07e0, 0x001f];
const BGRA8888 = [0x00ff0000, 0x0000ff00, 0x000000ff, 0xff000000];
const ABGR8888 = [0xff000000, 0x00ff0000, 0x0000ff00, 0x000000ff];

const equalPrefix = (left: number[], right: number[]) =>
  right.every((value, index) => left[index] === value);

export const inspectRockboxBitmap = (bytes: Uint8Array): RockboxBitmapInspection => {
  const empty = {
    valid: false,
    width: 0,
    height: 0,
    topDown: false,
    bitDepth: 0,
    compression: -1,
    compressionLabel: 'unsupported' as const,
    dataOffset: 0,
    hasAlpha: false,
    warnings: [] as string[]
  };
  if (bytes.length < 54) return { ...empty, error: 'The file is shorter than the Windows BMP header.' };
  if (bytes[0] !== 0x42 || bytes[1] !== 0x4d) return { ...empty, error: 'Rockbox skin images must use the BMP file format.' };

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dataOffset = view.getUint32(10, true);
  const dibSize = view.getUint32(14, true);
  const width = view.getInt32(18, true);
  const signedHeight = view.getInt32(22, true);
  const height = Math.abs(signedHeight);
  const planes = view.getUint16(26, true);
  const bitDepth = view.getUint16(28, true);
  const compression = view.getUint32(30, true);
  const topDown = signedHeight < 0;
  const warnings: string[] = [];

  const base = {
    ...empty,
    width,
    height,
    topDown,
    bitDepth,
    compression,
    compressionLabel: compression === 0 ? 'BI_RGB' as const : compression === 3 ? 'BI_BITFIELDS' as const : 'unsupported' as const,
    dataOffset,
    warnings
  };
  if (dibSize < 40) return { ...base, error: `Unsupported ${dibSize}-byte BMP information header.` };
  if (width <= 0 || height <= 0) return { ...base, error: 'The BMP has empty or invalid pixel dimensions.' };
  if (planes !== 1) return { ...base, error: `The BMP declares ${planes} color planes; Rockbox requires one.` };
  if (!SUPPORTED_DEPTHS.has(bitDepth)) return { ...base, error: `Rockbox does not accept ${bitDepth}-bit skin BMP files.` };
  if (dataOffset < 54 || dataOffset >= bytes.length) return { ...base, error: 'The BMP pixel-data offset is outside the file.' };
  if (compression !== 0 && compression !== 3) {
    return { ...base, error: `Rockbox does not accept BMP compression type ${compression}.` };
  }
  if (compression === 3) {
    if (![16, 32].includes(bitDepth)) {
      return { ...base, error: `BI_BITFIELDS is unsupported for ${bitDepth}-bit Rockbox skin BMP files.` };
    }
    const maskCount = dibSize >= 56 ? 4 : dibSize >= 52 ? 3 : 0;
    if (maskCount === 0 || bytes.length < 54 + maskCount * 4) {
      return { ...base, error: 'The BI_BITFIELDS BMP does not contain a complete supported mask table.' };
    }
    const masks = Array.from({ length: maskCount }, (_, index) => view.getUint32(54 + index * 4, true));
    const supported = bitDepth === 16
      ? equalPrefix(masks, RGB555) || equalPrefix(masks, RGB565)
      : equalPrefix(masks, BGRA8888) || equalPrefix(masks, ABGR8888);
    if (!supported) return { ...base, error: 'The BMP color masks do not match a Rockbox-supported 16/32-bit layout.' };
  }

  if (compression === 0 || compression === 3) {
    const rowBytes = Math.ceil((width * bitDepth) / 32) * 4;
    const expectedEnd = dataOffset + rowBytes * height;
    if (expectedEnd > bytes.length) return { ...base, error: 'The BMP pixel rows extend beyond the file.' };
  }
  if (width > 320 || height > 240) warnings.push('This bitmap exceeds the 320 × 240 main LCD; verify viewport clipping or sprite-strip intent.');
  if (bitDepth > 16) warnings.push('The iPod target converts this source bitmap to its 16-bit RGB565 display format at load time.');

  return {
    ...base,
    valid: true,
    hasAlpha: bitDepth === 32
  };
};

const setBitmapHeader = (
  output: Uint8Array,
  width: number,
  height: number,
  bitDepth: 24 | 32,
  dataOffset: number,
  imageSize: number
) => {
  const view = new DataView(output.buffer);
  output[0] = 0x42;
  output[1] = 0x4d;
  view.setUint32(2, output.length, true);
  view.setUint32(10, dataOffset, true);
  view.setUint32(14, bitDepth === 32 ? 56 : 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, bitDepth, true);
  view.setUint32(30, bitDepth === 32 ? 3 : 0, true);
  view.setUint32(34, imageSize, true);
  view.setInt32(38, 2835, true);
  view.setInt32(42, 2835, true);
  if (bitDepth === 32) {
    BGRA8888.forEach((mask, index) => view.setUint32(54 + index * 4, mask, true));
  }
};

export const encodeRockboxBitmap = (
  raster: RgbaRaster,
  options: { preserveAlpha?: boolean } = {}
) => {
  const { width, height, rgba } = raster;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error('Bitmap dimensions must be positive whole pixels.');
  }
  if (rgba.length !== width * height * 4) throw new Error('RGBA bytes do not match the bitmap dimensions.');
  let containsAlpha = false;
  for (let offset = 3; offset < rgba.length; offset += 4) {
    if (rgba[offset] < 255) {
      containsAlpha = true;
      break;
    }
  }
  const preserveAlpha = options.preserveAlpha ?? containsAlpha;
  const bitDepth = preserveAlpha ? 32 : 24;
  const dataOffset = preserveAlpha ? 70 : 54;
  const rowBytes = preserveAlpha ? width * 4 : Math.ceil((width * 3) / 4) * 4;
  const imageSize = rowBytes * height;
  const output = new Uint8Array(dataOffset + imageSize);
  setBitmapHeader(output, width, height, bitDepth, dataOffset, imageSize);

  for (let targetRow = 0; targetRow < height; targetRow += 1) {
    const sourceRow = height - 1 - targetRow;
    const targetStart = dataOffset + targetRow * rowBytes;
    for (let x = 0; x < width; x += 1) {
      const source = (sourceRow * width + x) * 4;
      const target = targetStart + x * (preserveAlpha ? 4 : 3);
      output[target] = rgba[source + 2];
      output[target + 1] = rgba[source + 1];
      output[target + 2] = rgba[source];
      if (preserveAlpha) output[target + 3] = rgba[source + 3];
    }
  }
  return output;
};

export const composeVerticalBitmapStrip = (frames: RgbaRaster[]): RgbaRaster => {
  if (frames.length < 2) throw new Error('A sprite strip needs at least two frames.');
  const width = frames[0].width;
  const frameHeight = frames[0].height;
  if (frames.some(frame => frame.width !== width || frame.height !== frameHeight)) {
    throw new Error('Every sprite-strip frame must have identical pixel dimensions.');
  }
  const rgba = new Uint8ClampedArray(width * frameHeight * frames.length * 4);
  frames.forEach((frame, index) => rgba.set(frame.rgba, index * width * frameHeight * 4));
  return { width, height: frameHeight * frames.length, rgba };
};
