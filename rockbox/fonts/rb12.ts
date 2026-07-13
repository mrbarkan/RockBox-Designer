import type { RockboxFontMetrics } from '../../types';

const HEADER_SIZE = 36;

export const parseRb12Font = (bytes: Uint8Array): RockboxFontMetrics => {
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
  if (HEADER_SIZE + metrics.bitmapBytes > bytes.length) throw new Error('Rockbox font bitmap data extends beyond the file.');
  return metrics;
};
