import { composeVerticalBitmapStrip, encodeRockboxBitmap, type RgbaRaster } from './bitmap';

export type RockboxAssetPreset = {
  id: 'battery-10' | 'playback-5' | 'rounded-bar';
  name: string;
  description: string;
  filename: string;
  frameCount: number;
  width: number;
  frameHeight: number;
};

export const ROCKBOX_ASSET_PRESETS: RockboxAssetPreset[] = [
  {
    id: 'battery-10',
    name: 'Battery · 10 states',
    description: 'Ten equal vertical frames from empty to full.',
    filename: 'battery-10-strip.bmp',
    frameCount: 10,
    width: 22,
    frameHeight: 12
  },
  {
    id: 'playback-5',
    name: 'Playback · 5 states',
    description: 'Stop, play, pause, forward, and rewind frames.',
    filename: 'playback-5-strip.bmp',
    frameCount: 5,
    width: 16,
    frameHeight: 16
  },
  {
    id: 'rounded-bar',
    name: 'Rounded progress fill',
    description: 'A compact opaque bar bitmap for progress tags.',
    filename: 'rounded-progress.bmp',
    frameCount: 1,
    width: 120,
    frameHeight: 8
  }
];

const raster = (width: number, height: number): RgbaRaster => ({
  width,
  height,
  rgba: new Uint8ClampedArray(width * height * 4)
});

const pixel = (image: RgbaRaster, x: number, y: number, color: [number, number, number, number]) => {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
  const offset = (y * image.width + x) * 4;
  image.rgba.set(color, offset);
};

const rect = (image: RgbaRaster, x: number, y: number, width: number, height: number, color: [number, number, number, number]) => {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) pixel(image, column, row, color);
  }
};

const line = (image: RgbaRaster, x0: number, y0: number, x1: number, y1: number, color: [number, number, number, number]) => {
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  let x = x0;
  let y = y0;
  while (true) {
    pixel(image, x, y, color);
    if (x === x1 && y === y1) break;
    const doubled = 2 * error;
    if (doubled >= dy) { error += dy; x += sx; }
    if (doubled <= dx) { error += dx; y += sy; }
  }
};

const batteryFrame = (level: number) => {
  const image = raster(22, 12);
  const ink: [number, number, number, number] = [22, 24, 27, 255];
  const fill: [number, number, number, number] = level < 3 ? [216, 66, 47, 255] : level < 6 ? [245, 176, 34, 255] : [32, 189, 139, 255];
  rect(image, 1, 2, 18, 8, ink);
  rect(image, 3, 4, 14, 4, [236, 234, 228, 255]);
  rect(image, 19, 4, 2, 4, ink);
  rect(image, 3, 4, Math.round(14 * (level / 9)), 4, fill);
  return image;
};

const playbackFrame = (state: number) => {
  const image = raster(16, 16);
  const ink: [number, number, number, number] = [245, 245, 240, 255];
  if (state === 0) rect(image, 5, 5, 6, 6, ink);
  if (state === 1) {
    for (let x = 4; x <= 11; x += 1) line(image, 4, 3 + (x - 4), x, 7, ink);
    for (let x = 4; x <= 11; x += 1) line(image, 4, 12 - (x - 4), x, 8, ink);
  }
  if (state === 2) { rect(image, 4, 3, 3, 10, ink); rect(image, 9, 3, 3, 10, ink); }
  if (state === 3 || state === 4) {
    const direction = state === 3 ? 1 : -1;
    const origin = state === 3 ? 2 : 13;
    line(image, origin, 4, origin + direction * 5, 8, ink);
    line(image, origin, 12, origin + direction * 5, 8, ink);
    line(image, origin + direction * 5, 4, origin + direction * 10, 8, ink);
    line(image, origin + direction * 5, 12, origin + direction * 10, 8, ink);
  }
  return image;
};

const roundedBar = () => {
  const image = raster(120, 8);
  const fill: [number, number, number, number] = [32, 189, 139, 255];
  rect(image, 3, 0, 114, 8, fill);
  rect(image, 1, 2, 118, 4, fill);
  rect(image, 2, 1, 116, 6, fill);
  return image;
};

export const createRockboxAssetPreset = (id: RockboxAssetPreset['id']) => {
  if (id === 'battery-10') {
    return encodeRockboxBitmap(composeVerticalBitmapStrip(Array.from({ length: 10 }, (_, level) => batteryFrame(level))));
  }
  if (id === 'playback-5') {
    return encodeRockboxBitmap(composeVerticalBitmapStrip(Array.from({ length: 5 }, (_, state) => playbackFrame(state))));
  }
  return encodeRockboxBitmap(roundedBar(), { preserveAlpha: false });
};
