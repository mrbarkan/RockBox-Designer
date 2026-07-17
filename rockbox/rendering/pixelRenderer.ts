import type { RenderOperation } from '../semantics';

export type PixelImage = { width: number; height: number; pixels: Uint8Array };
type Rgb = [number, number, number];

const color = (value: string, fallback: Rgb = [255, 255, 255]): Rgb => {
  const match = value.match(/^#([0-9a-f]{6})$/i);
  if (!match) return fallback;
  return [0, 2, 4].map(offset => Number.parseInt(match[1].slice(offset, offset + 2), 16)) as Rgb;
};

const put = (image: PixelImage, x: number, y: number, rgb: Rgb) => {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
  const offset = (y * image.width + x) * 3;
  image.pixels[offset] = rgb[0];
  image.pixels[offset + 1] = rgb[1];
  image.pixels[offset + 2] = rgb[2];
};

const fill = (image: PixelImage, rect: { x: number; y: number; width: number; height: number }, rgb: Rgb) => {
  const left = Math.max(0, Math.round(rect.x));
  const top = Math.max(0, Math.round(rect.y));
  const right = Math.min(image.width, Math.round(rect.x + rect.width));
  const bottom = Math.min(image.height, Math.round(rect.y + rect.height));
  for (let y = top; y < bottom; y += 1) for (let x = left; x < right; x += 1) put(image, x, y, rgb);
};

const outline = (image: PixelImage, rect: { x: number; y: number; width: number; height: number }, rgb: Rgb) => {
  const left = Math.round(rect.x), top = Math.round(rect.y);
  const right = Math.round(rect.x + rect.width - 1), bottom = Math.round(rect.y + rect.height - 1);
  for (let x = left; x <= right; x += 1) { put(image, x, top, rgb); put(image, x, bottom, rgb); }
  for (let y = top; y <= bottom; y += 1) { put(image, left, y, rgb); put(image, right, y, rgb); }
};

const drawDeterministicText = (image: PixelImage, text: string, x: number, y: number, rgb: Rgb, maxWidth: number) => {
  let cursor = x;
  for (const character of text) {
    if (cursor + 4 > x + maxWidth) break;
    const bits = character.charCodeAt(0) * 2654435761;
    for (let row = 0; row < 5; row += 1) for (let column = 0; column < 3; column += 1) {
      const edge = row === 0 || row === 4 || column === 0 || column === 2;
      if (edge && ((bits >>> ((row * 3 + column) % 24)) & 1)) put(image, cursor + column, y + row, rgb);
    }
    cursor += 4;
  }
};

export const renderToPixelImage = (
  width: number,
  height: number,
  operations: RenderOperation[],
  background = '#000000'
): PixelImage => {
  const image = { width, height, pixels: new Uint8Array(width * height * 3) };
  fill(image, { x: 0, y: 0, width, height }, color(background, [0, 0, 0]));
  for (const operation of operations) {
    if (operation.type === 'drawRect') fill(image, operation.rect, color(operation.color));
    if (operation.type === 'drawProgress') {
      fill(image, operation.rect, color(operation.background, [32, 32, 32]));
      fill(image, { ...operation.rect, width: operation.rect.width * operation.value }, color(operation.foreground));
    }
    if (operation.type === 'drawText') {
      const text = operation.direction === 'rtl'
        ? Array.from(operation.text).reverse().join('')
        : operation.text;
      const estimatedWidth = text.length * 4;
      const x = operation.align === 'center'
        ? operation.rect.x + Math.max(0, (operation.rect.width - estimatedWidth) / 2)
        : operation.align === 'right'
          ? operation.rect.x + Math.max(0, operation.rect.width - estimatedWidth)
          : operation.rect.x;
      drawDeterministicText(image, text, Math.round(x), Math.round(operation.rect.y), color(operation.color), operation.rect.width);
    }
    if (operation.type === 'drawAlbumArt') {
      fill(image, operation.rect, [24, 24, 24]);
      outline(image, operation.rect, [96, 96, 96]);
    }
    if (operation.type === 'drawFirmwareFallback' && operation.rect.width > 1 && operation.rect.height > 1) {
      fill(image, operation.rect, [42, 42, 42]);
      outline(image, operation.rect, [96, 96, 96]);
    }
    if (operation.type === 'drawBitmap') {
      fill(image, { ...operation.rect, width: Math.min(12, operation.rect.width), height: Math.min(12, operation.rect.height) }, [72, 96, 112]);
    }
    if (operation.type === 'debugOverlay') outline(image, operation.rect, [255, 88, 0]);
  }
  return image;
};

export const encodePpm = (image: PixelImage) => {
  const header = new TextEncoder().encode(`P6\n${image.width} ${image.height}\n255\n`);
  const output = new Uint8Array(header.length + image.pixels.length);
  output.set(header);
  output.set(image.pixels, header.length);
  return output;
};
