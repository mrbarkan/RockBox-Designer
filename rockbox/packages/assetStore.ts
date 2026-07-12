import { archiveBasename } from './paths';
import { ThemeAsset, ThemeAssetKind } from './types';

export const hashBytes = async (bytes: Uint8Array) => {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
};

const classify = (path: string): { kind: ThemeAssetKind; mimeType?: string } => {
  const extension = path.split('.').pop()?.toLowerCase();
  if (extension === 'bmp') return { kind: 'bitmap', mimeType: 'image/bmp' };
  if (extension === 'png') return { kind: 'bitmap', mimeType: 'image/png' };
  if (extension === 'jpg' || extension === 'jpeg') return { kind: 'bitmap', mimeType: 'image/jpeg' };
  if (extension === 'fnt') return { kind: 'font', mimeType: 'application/octet-stream' };
  if (extension === 'icons') return { kind: 'iconset', mimeType: 'application/octet-stream' };
  if (['cfg', 'wps', 'sbs', 'fms', 'txt'].includes(extension ?? '')) return { kind: 'text', mimeType: 'text/plain' };
  return { kind: 'unknown', mimeType: 'application/octet-stream' };
};

export const createThemeAsset = async (archivePath: string, bytes: Uint8Array): Promise<ThemeAsset> => {
  const metadata = classify(archivePath);
  return {
    id: await hashBytes(new TextEncoder().encode(`${archivePath}\0${await hashBytes(bytes)}`)),
    archivePath,
    basename: archiveBasename(archivePath),
    bytes,
    hash: await hashBytes(bytes),
    ...metadata
  };
};
