import type { RockboxFontMetrics } from '../../types';

const HEADER_SIZE = 36;
const LONG_OFFSET_THRESHOLD = 0xffdb;

export type Rb12Font = {
  bytes: Uint8Array;
  metrics: RockboxFontMetrics;
  bitmapStart: number;
  bitmapEnd: number;
  offsetEntryBytes: 2 | 4;
  offsets?: number[];
  widths?: number[];
};

export type Rb12Glyph = {
  requestedCodePoint: number;
  resolvedCodePoint: number;
  width: number;
  height: number;
  ascent: number;
  depth: number;
  outsideRange: boolean;
  aliasesDefaultGlyph: boolean;
  alpha: Uint8ClampedArray;
};

export type Rb12TextMeasurement = {
  width: number;
  height: number;
  lineWidths: number[];
  outsideRange: number[];
  defaultGlyphAliases: number[];
  hasComplexShaping: boolean;
};

const align = (value: number, boundary: number) => Math.ceil(value / boundary) * boundary;

const uniqueSorted = (values: number[]) => [...new Set(values)].sort((left, right) => left - right);

const readMetrics = (bytes: Uint8Array): RockboxFontMetrics => {
  if (bytes.length < HEADER_SIZE) throw new Error('Rockbox font is shorter than the 36-byte RB12 header.');
  const magic = new TextDecoder('ascii').decode(bytes.subarray(0, 4));
  if (magic !== 'RB12') throw new Error(`Unsupported Rockbox font signature: ${JSON.stringify(magic)}.`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const metrics: RockboxFontMetrics = {
    format: 'RB12',
    maxWidth: view.getUint16(4, true),
    height: view.getUint16(6, true),
    ascent: view.getUint16(8, true),
    depth: view.getUint16(10, true),
    firstCharacter: view.getUint32(12, true),
    defaultCharacter: view.getUint32(16, true),
    glyphCount: view.getUint32(20, true),
    bitmapBytes: view.getUint32(24, true),
    offsetCount: view.getUint32(28, true),
    widthCount: view.getUint32(32, true),
    fileBytes: bytes.length
  };
  if (metrics.height === 0 || metrics.maxWidth === 0 || metrics.glyphCount === 0) {
    throw new Error('Rockbox font header has empty dimensions or glyphs.');
  }
  if (metrics.ascent > metrics.height) throw new Error('Rockbox font ascent exceeds its height.');
  if (metrics.depth > 1) throw new Error(`Unsupported Rockbox font depth: ${metrics.depth}.`);
  const lastCharacter = metrics.firstCharacter + metrics.glyphCount - 1;
  if (lastCharacter > 0x10ffff || metrics.defaultCharacter < metrics.firstCharacter || metrics.defaultCharacter > lastCharacter) {
    throw new Error('Rockbox font character range or default character is invalid.');
  }
  if (metrics.offsetCount !== 0 && metrics.offsetCount < metrics.glyphCount) {
    throw new Error('Rockbox font offset table is shorter than its character range.');
  }
  if (metrics.widthCount !== 0 && metrics.widthCount < metrics.glyphCount) {
    throw new Error('Rockbox font width table is shorter than its character range.');
  }
  return metrics;
};

export const decodeRb12Font = (bytes: Uint8Array): Rb12Font => {
  const metrics = readMetrics(bytes);
  const bitmapStart = HEADER_SIZE;
  const bitmapEnd = bitmapStart + metrics.bitmapBytes;
  if (bitmapEnd > bytes.length) throw new Error('Rockbox font bitmap data extends beyond the file.');

  const offsetEntryBytes = metrics.bitmapBytes < LONG_OFFSET_THRESHOLD ? 2 : 4;
  const offsetStart = align(bitmapEnd, offsetEntryBytes);
  const widthStart = offsetStart + metrics.offsetCount * offsetEntryBytes;
  const requiredBytes = widthStart + metrics.widthCount;
  if (requiredBytes > bytes.length) throw new Error('Rockbox font offset or width table extends beyond the file.');

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const offsets = metrics.offsetCount > 0
    ? Array.from({ length: metrics.offsetCount }, (_, index) => offsetEntryBytes === 2
      ? view.getUint16(offsetStart + index * 2, true)
      : view.getUint32(offsetStart + index * 4, true))
    : undefined;
  const widths = metrics.widthCount > 0
    ? Array.from(bytes.subarray(widthStart, widthStart + metrics.widthCount))
    : undefined;

  for (let index = 0; index < metrics.glyphCount; index += 1) {
    const width = widths?.[index] ?? metrics.maxWidth;
    if (width === 0 || width > metrics.maxWidth) throw new Error(`Rockbox font glyph ${index} has an invalid width.`);
    const glyphBytes = metrics.depth === 1
      ? Math.ceil(width * metrics.height / 2)
      : width * Math.ceil(metrics.height / 8);
    const fixedGlyphBytes = ((metrics.depth === 1
      ? Math.ceil(metrics.maxWidth * metrics.height / 2)
      : metrics.maxWidth * Math.ceil(metrics.height / 8)) + 1) & ~1;
    const offset = offsets?.[index] ?? index * fixedGlyphBytes;
    if (offset + glyphBytes > metrics.bitmapBytes) {
      throw new Error(`Rockbox font glyph ${index} extends beyond its bitmap data.`);
    }
  }

  return { bytes, metrics, bitmapStart, bitmapEnd, offsetEntryBytes, offsets, widths };
};

export const parseRb12Font = (bytes: Uint8Array): RockboxFontMetrics => decodeRb12Font(bytes).metrics;

const glyphIndex = (font: Rb12Font, requested: number) => {
  const { firstCharacter, glyphCount, defaultCharacter } = font.metrics;
  const outsideRange = requested < firstCharacter || requested >= firstCharacter + glyphCount;
  const resolvedCodePoint = outsideRange ? defaultCharacter : requested;
  return { index: resolvedCodePoint - firstCharacter, outsideRange, resolvedCodePoint };
};

export const getRb12Glyph = (font: Rb12Font, requestedCodePoint: number): Rb12Glyph => {
  const { metrics } = font;
  const resolved = glyphIndex(font, requestedCodePoint);
  const defaultIndex = metrics.defaultCharacter - metrics.firstCharacter;
  const width = font.widths?.[resolved.index] ?? metrics.maxWidth;
  const offset = font.offsets?.[resolved.index] ?? resolved.index * (((metrics.depth === 1
    ? Math.ceil(metrics.maxWidth * metrics.height / 2)
    : metrics.maxWidth * Math.ceil(metrics.height / 8)) + 1) & ~1);
  const defaultOffset = font.offsets?.[defaultIndex];
  const aliasesDefaultGlyph = resolved.outsideRange || (
    resolved.index !== defaultIndex && defaultOffset !== undefined && font.offsets?.[resolved.index] === defaultOffset
  );
  const alpha = new Uint8ClampedArray(width * metrics.height);

  if (metrics.depth === 1) {
    for (let pixel = 0; pixel < alpha.length; pixel += 1) {
      const packed = font.bytes[font.bitmapStart + offset + Math.floor(pixel / 2)] ?? 0xff;
      const level = pixel % 2 === 0 ? packed & 0x0f : packed >> 4;
      alpha[pixel] = 255 - level * 17;
    }
  } else {
    for (let x = 0; x < width; x += 1) {
      for (let y = 0; y < metrics.height; y += 1) {
        const packed = font.bytes[font.bitmapStart + offset + Math.floor(y / 8) * width + x] ?? 0;
        alpha[y * width + x] = packed & (1 << (y % 8)) ? 255 : 0;
      }
    }
  }

  return {
    requestedCodePoint,
    resolvedCodePoint: resolved.resolvedCodePoint,
    width,
    height: metrics.height,
    ascent: metrics.ascent,
    depth: metrics.depth,
    outsideRange: resolved.outsideRange,
    aliasesDefaultGlyph,
    alpha
  };
};

const combiningMark = (character: string) => /\p{Mark}/u.test(character);
const complexShaping = (character: string) => combiningMark(character) || /[\u0590-\u08ff\u200c\u200d\ufb1d-\ufeff]/u.test(character);

export const measureRb12Text = (font: Rb12Font, text: string): Rb12TextMeasurement => {
  const lines = text.split(/\r\n|\r|\n/);
  const outsideRange: number[] = [];
  const defaultGlyphAliases: number[] = [];
  let hasComplexShaping = false;
  const lineWidths = lines.map(line => {
    let width = 0;
    for (const character of line) {
      const codePoint = character.codePointAt(0)!;
      const glyph = getRb12Glyph(font, codePoint);
      if (glyph.outsideRange) outsideRange.push(codePoint);
      else if (glyph.aliasesDefaultGlyph) defaultGlyphAliases.push(codePoint);
      if (complexShaping(character)) hasComplexShaping = true;
      if (!combiningMark(character)) width += glyph.width;
    }
    return width;
  });
  return {
    width: Math.max(0, ...lineWidths),
    height: Math.max(1, lines.length) * font.metrics.height,
    lineWidths,
    outsideRange: uniqueSorted(outsideRange),
    defaultGlyphAliases: uniqueSorted(defaultGlyphAliases),
    hasComplexShaping
  };
};
