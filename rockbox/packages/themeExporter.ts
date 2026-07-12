import JSZip from 'jszip';
import { serializeRockbox } from '../syntax';
import { hashBytes } from './assetStore';
import { serializeCfg } from './cfgParser';
import { normalizeArchivePath } from './paths';
import { ThemeManifest, ThemePackage } from './types';

const FIXED_ZIP_DATE = new Date('2000-01-01T00:00:00.000Z');
const encoder = new TextEncoder();

export const buildPackageFiles = (theme: ThemePackage) => {
  const files = new Map<string, Uint8Array>();
  if (theme.cfg && theme.cfgPath) files.set(theme.cfgPath, encoder.encode(serializeCfg(theme.cfg)));
  for (const screen of ['wps', 'sbs', 'fms'] as const) {
    const document = theme.screens[screen];
    const path = theme.screenPaths[screen];
    if (document && path) files.set(path, encoder.encode(serializeRockbox(document)));
  }
  theme.assets.forEach(asset => {
    const path = normalizeArchivePath(asset.archivePath);
    if (path) files.set(path, asset.bytes);
  });
  return new Map([...files.entries()].sort(([left], [right]) => left.localeCompare(right)));
};

export const manifestFromFiles = async (files: Map<string, Uint8Array>): Promise<ThemeManifest> => {
  const manifest = [];
  for (const [path, bytes] of files) manifest.push({ path, size: bytes.length, hash: await hashBytes(bytes) });
  return { files: manifest.sort((left, right) => left.path.localeCompare(right.path)) };
};

export const exportThemePackage = async (theme: ThemePackage) => {
  const zip = new JSZip();
  for (const [path, bytes] of buildPackageFiles(theme)) {
    zip.file(path, bytes, { date: FIXED_ZIP_DATE, createFolders: true });
  }
  return zip.generateAsync({
    type: 'uint8array',
    compression: 'STORE',
    platform: 'DOS',
    streamFiles: false
  });
};
