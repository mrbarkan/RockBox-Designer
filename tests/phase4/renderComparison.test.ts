import { describe, expect, it } from 'vitest';
import { decodeBmp, differenceImage } from '../../scripts/phase4/pixelImages';
import { buildPhase4BrowserReference } from '../fixtures/phase4/reference';

const buildTwoByTwoBmp = () => {
  const bytes = Buffer.alloc(70);
  bytes.write('BM', 0, 'ascii');
  bytes.writeUInt32LE(bytes.length, 2);
  bytes.writeUInt32LE(54, 10);
  bytes.writeUInt32LE(40, 14);
  bytes.writeInt32LE(2, 18);
  bytes.writeInt32LE(2, 22);
  bytes.writeUInt16LE(1, 26);
  bytes.writeUInt16LE(24, 28);
  bytes.writeUInt32LE(16, 34);
  // Bottom row: blue, white. Top row: red, green. Rows are BGR + padding.
  bytes.set([255, 0, 0, 255, 255, 255], 54);
  bytes.set([0, 0, 255, 0, 255, 0], 62);
  return bytes;
};

describe('Phase 4 render comparison primitives', () => {
  it('decodes bottom-up 24-bit simulator BMP pixels', () => {
    expect([...decodeBmp(buildTwoByTwoBmp()).pixels]).toEqual([
      255, 0, 0, 0, 255, 0,
      0, 0, 255, 255, 255, 255
    ]);
  });

  it('creates a deterministic visible diff image', () => {
    const left = { width: 1, height: 1, pixels: new Uint8Array([10, 20, 30]) };
    const same = differenceImage(left, left);
    const changed = differenceImage(left, { width: 1, height: 1, pixels: new Uint8Array([10, 20, 130]) });
    expect([...same.pixels]).toEqual([18, 18, 18]);
    expect([...changed.pixels]).toEqual([255, 60, 0]);
  });

  it('builds the authored 320x240 SBS browser reference from semantic operations', () => {
    const reference = buildPhase4BrowserReference();
    expect(reference.image).toMatchObject({ width: 320, height: 240 });
    expect(reference.semantic.operations.some(operation => operation.type === 'drawText' && operation.text === 'Files')).toBe(true);
    expect(reference.semantic.operations.some(operation => operation.type === 'drawRect')).toBe(true);
  });
});
