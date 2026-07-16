import type { RenderOperation } from '../semantics';

const transparentBitmapCache = new WeakMap<HTMLImageElement, CanvasImageSource>();

export const applyRockboxTransparency = (pixels: Uint8ClampedArray) => {
  let changed = false;
  for (let offset = 0; offset < pixels.length; offset += 4) {
    if (pixels[offset] === 255 && pixels[offset + 1] === 0 && pixels[offset + 2] === 255) {
      pixels[offset + 3] = 0;
      changed = true;
    }
  }
  return changed;
};

const rockboxBitmap = (image: HTMLImageElement): CanvasImageSource => {
  const cached = transparentBitmapCache.get(image);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return image;
  context.drawImage(image, 0, 0);
  try {
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const changed = applyRockboxTransparency(pixels.data);
    if (changed) context.putImageData(pixels, 0, 0);
    const result: CanvasImageSource = changed ? canvas : image;
    transparentBitmapCache.set(image, result);
    return result;
  } catch {
    transparentBitmapCache.set(image, image);
    return image;
  }
};

const assetForPath = (assets: Record<string, HTMLImageElement>, path: string) => {
  if (assets[path]) return assets[path];
  const basename = path.replace(/\\/g, '/').split('/').pop()?.toLowerCase();
  if (!basename) return undefined;
  const key = Object.keys(assets).find(candidate =>
    candidate.toLowerCase() === basename || candidate.toLowerCase().endsWith(`/${basename}`)
  );
  return key ? assets[key] : undefined;
};

const resetClip = (ctx: CanvasRenderingContext2D) => {
  ctx.restore();
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.textBaseline = 'top';
};

export const renderSemanticToCanvas = (
  ctx: CanvasRenderingContext2D,
  operations: RenderOperation[],
  assets: Record<string, HTMLImageElement>,
  background: string
) => {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.textBaseline = 'top';

  for (const operation of operations) {
    if (operation.type === 'setViewport' || operation.type === 'setClip') {
      resetClip(ctx);
      const rect = operation.rect;
      ctx.beginPath();
      ctx.rect(Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height));
      ctx.clip();
      continue;
    }

    ctx.save();
    const rect = operation.rect;
    if (operation.type === 'drawRect') {
      ctx.fillStyle = operation.color;
      ctx.fillRect(Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height));
    } else if (operation.type === 'drawProgress') {
      const backdrop = operation.backdrop ? assetForPath(assets, operation.backdrop) : undefined;
      const fillImage = operation.image ? assetForPath(assets, operation.image) : undefined;
      const slider = operation.slider ? assetForPath(assets, operation.slider) : undefined;
      if (backdrop) {
        ctx.drawImage(rockboxBitmap(backdrop), Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height));
      } else {
        ctx.fillStyle = operation.background;
        ctx.fillRect(Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height));
      }
      const filledWidth = Math.round(rect.width * operation.value);
      if (fillImage) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(Math.round(rect.x), Math.round(rect.y), filledWidth, Math.round(rect.height));
        ctx.clip();
        ctx.drawImage(rockboxBitmap(fillImage), Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height));
        ctx.restore();
      } else {
        ctx.fillStyle = operation.foreground;
        ctx.fillRect(Math.round(rect.x), Math.round(rect.y), filledWidth, Math.round(rect.height));
      }
      if (slider) {
        const sliderX = rect.x + Math.max(0, rect.width - slider.naturalWidth) * operation.value;
        const sliderY = rect.y + (rect.height - slider.naturalHeight) / 2;
        ctx.drawImage(rockboxBitmap(slider), Math.round(sliderX), Math.round(sliderY));
      }
    } else if (operation.type === 'drawText') {
      ctx.beginPath();
      ctx.rect(Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height));
      ctx.clip();
      ctx.font = `${operation.fontWeight} ${Math.max(6, Math.round(operation.fontSize))}px "Cantarell", "Noto Sans", sans-serif`;
      ctx.fillStyle = operation.color;
      ctx.textAlign = operation.align;
      ctx.direction = operation.direction;
      const anchor = operation.align === 'left' ? rect.x : operation.align === 'center' ? rect.x + rect.width / 2 : rect.x + rect.width;
      const measured = ctx.measureText(operation.text).width;
      let x = anchor;
      if (operation.scroll && measured > rect.width) x -= operation.scrollOffset % (measured + 32);
      ctx.fillText(operation.text, Math.round(x), Math.round(rect.y));
      if (operation.scroll && measured > rect.width && x + measured < rect.x + rect.width) {
        ctx.fillText(operation.text, Math.round(x + measured + 32), Math.round(rect.y));
      }
    } else if (operation.type === 'drawBitmap') {
      const image = assetForPath(assets, operation.assetPath);
      if (image) {
        const verticalFrames = operation.frameCount > 1 && image.naturalHeight % operation.frameCount === 0;
        const sourceWidth = verticalFrames ? image.naturalWidth : image.naturalWidth / operation.frameCount;
        const sourceHeight = verticalFrames ? image.naturalHeight / operation.frameCount : image.naturalHeight;
        const sourceX = verticalFrames ? 0 : sourceWidth * operation.frame;
        const sourceY = verticalFrames ? sourceHeight * operation.frame : 0;
        ctx.drawImage(
          rockboxBitmap(image),
          Math.round(sourceX), Math.round(sourceY), Math.round(sourceWidth), Math.round(sourceHeight),
          Math.round(rect.x), Math.round(rect.y), Math.round(sourceWidth), Math.round(sourceHeight)
        );
      }
    } else if (operation.type === 'drawAlbumArt') {
      const image = assets.ALBUM_ART;
      if (image) ctx.drawImage(image, Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height));
      else {
        ctx.fillStyle = '#202020';
        ctx.fillRect(Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height));
        ctx.strokeStyle = '#686868';
        ctx.strokeRect(Math.round(rect.x) + 0.5, Math.round(rect.y) + 0.5, Math.max(0, Math.round(rect.width) - 1), Math.max(0, Math.round(rect.height) - 1));
      }
    } else if (operation.type === 'debugOverlay') {
      ctx.strokeStyle = '#ff5800';
      ctx.setLineDash([2, 2]);
      ctx.strokeRect(Math.round(rect.x) + 0.5, Math.round(rect.y) + 0.5, Math.max(0, Math.round(rect.width) - 1), Math.max(0, Math.round(rect.height) - 1));
    }
    ctx.restore();
  }
  ctx.restore();
};
