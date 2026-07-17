import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { AssetsMode } from '../../components/AssetsMode';
import { DEFAULT_PROJECT } from '../../constants';
import {
  addProjectAsset,
  collectProjectAssetReferences,
  composeVerticalBitmapStrip,
  createRockboxAssetPreset,
  deleteProjectAsset,
  encodeRockboxBitmap,
  inspectRockboxBitmap,
  listProjectAssets,
  renameProjectAsset,
  replaceProjectAsset
} from '../../rockbox/assets';
import { createThemeAsset, exportThemePackage, importThemePackage } from '../../rockbox/packages';
import { serializeCfg } from '../../rockbox/packages/cfgParser';
import { parseRockbox, serializeRockbox } from '../../rockbox/syntax';
import { generateZip } from '../../services/rockboxCompiler';
import { parseProjectData } from '../../services/projectSerialization';

const rgba = (width: number, height: number, alpha = 255) => {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    pixels[index * 4] = index * 17;
    pixels[index * 4 + 1] = 80;
    pixels[index * 4 + 2] = 190;
    pixels[index * 4 + 3] = index === 0 ? alpha : 255;
  }
  return pixels;
};

const bitmap = (width = 4, height = 4, alpha = 255) =>
  encodeRockboxBitmap({ width, height, rgba: rgba(width, height, alpha) });

const packageFixture = async () => {
  const zip = new JSZip();
  zip.file('.rockbox/themes/theme.cfg', [
    'wps: /.rockbox/wps/theme.wps',
    'sbs: /.rockbox/wps/other.sbs',
    'iconset: /.rockbox/icons/menu.bmp',
    ''
  ].join('\n'));
  zip.file('.rockbox/wps/theme.wps', '%xl(A,icon.bmp,0,0,2)\n%xd(A,1)\n');
  zip.file('.rockbox/wps/other.sbs', '%x(B,icon.bmp,0,0)\n');
  zip.file('.rockbox/wps/theme/icon.bmp', bitmap(4, 8));
  zip.file('.rockbox/wps/other/icon.bmp', bitmap(3, 3));
  zip.file('.rockbox/wps/theme/unused.bmp', bitmap(2, 2));
  zip.file('.rockbox/icons/menu.bmp', bitmap(16, 16));
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  const themePackage = await importThemePackage(bytes);
  return {
    ...DEFAULT_PROJECT,
    settings: { ...DEFAULT_PROJECT.settings, iconset: '/.rockbox/icons/menu.bmp' },
    assets: {},
    elements: [],
    themePackage,
    wpsDocument: themePackage.screens.wps,
    sbsDocument: themePackage.screens.sbs
  };
};

describe('Rockbox bitmap preparation', () => {
  it('encodes deterministic uncompressed 24-bit BMP rows for opaque images', () => {
    const first = bitmap(2, 2);
    const second = bitmap(2, 2);
    expect(first).toEqual(second);
    expect(inspectRockboxBitmap(first)).toMatchObject({
      valid: true,
      width: 2,
      height: 2,
      bitDepth: 24,
      compressionLabel: 'BI_RGB',
      hasAlpha: false
    });
  });

  it('uses Rockbox-supported 32-bit bitfields when source alpha must survive', () => {
    const bytes = bitmap(2, 1, 64);
    expect(inspectRockboxBitmap(bytes)).toMatchObject({
      valid: true,
      bitDepth: 32,
      compressionLabel: 'BI_BITFIELDS',
      hasAlpha: true
    });
  });

  it('builds equal-height frames into one vertical strip and rejects mismatches', () => {
    const strip = composeVerticalBitmapStrip([
      { width: 2, height: 3, rgba: rgba(2, 3) },
      { width: 2, height: 3, rgba: rgba(2, 3, 100) }
    ]);
    expect(strip).toMatchObject({ width: 2, height: 6 });
    expect(inspectRockboxBitmap(encodeRockboxBitmap(strip))).toMatchObject({ valid: true, width: 2, height: 6 });
    expect(() => composeVerticalBitmapStrip([
      { width: 2, height: 3, rgba: rgba(2, 3) },
      { width: 3, height: 3, rgba: rgba(3, 3) }
    ])).toThrow('identical pixel dimensions');
  });

  it('rejects a compressed BMP header instead of silently accepting web metadata', () => {
    const bytes = bitmap(2, 2);
    new DataView(bytes.buffer).setUint32(30, 1, true);
    expect(inspectRockboxBitmap(bytes)).toMatchObject({ valid: false, compression: 1 });
  });

  it('rejects truncated bitfield pixel rows', () => {
    const bytes = bitmap(2, 2, 64);
    expect(inspectRockboxBitmap(bytes.slice(0, -1))).toMatchObject({ valid: false });
  });

  it('ships license-clean starter BMPs with honest strip dimensions', () => {
    expect(inspectRockboxBitmap(createRockboxAssetPreset('battery-10'))).toMatchObject({ valid: true, width: 22, height: 120 });
    expect(inspectRockboxBitmap(createRockboxAssetPreset('playback-5'))).toMatchObject({ valid: true, width: 16, height: 80 });
    expect(inspectRockboxBitmap(createRockboxAssetPreset('rounded-bar'))).toMatchObject({ valid: true, width: 120, height: 8, bitDepth: 24 });
  });
});

describe('source-safe project asset mutations', () => {
  it('resolves duplicate basenames per skin bitmap directory and reports strip usage', async () => {
    const project = await packageFixture();
    const references = collectProjectAssetReferences(project);
    expect(references.find(reference => reference.scope === 'wps' && reference.raw === 'icon.bmp')).toMatchObject({
      resolvedPath: '.rockbox/wps/theme/icon.bmp',
      frameCount: 2
    });
    expect(references.find(reference => reference.scope === 'sbs' && reference.raw === 'icon.bmp')).toMatchObject({
      resolvedPath: '.rockbox/wps/other/icon.bmp'
    });
  });

  it('reports the compact Rockbox xl frame-count form used by Adwaitapod', async () => {
    const project = await packageFixture();
    const compactDocument = parseRockbox('%xl(BatteryIcon,BatteryStatus.bmp,12)\n%xd(BatteryIcon,%bl)\n');
    const compactProject = {
      ...project,
      wpsDocument: compactDocument,
      themePackage: {
        ...project.themePackage!,
        screenPaths: { ...project.themePackage!.screenPaths, wps: '.rockbox/wps/theme.wps' },
        assets: [
          ...project.themePackage!.assets,
          await createThemeAsset('.rockbox/wps/theme/BatteryStatus.bmp', bitmap(14, 192))
        ]
      }
    };

    expect(collectProjectAssetReferences(compactProject).find(reference => reference.raw === 'BatteryStatus.bmp')).toMatchObject({
      resolvedPath: '.rockbox/wps/theme/BatteryStatus.bmp',
      frameCount: 12
    });
  });

  it('renames one duplicate path and updates only its resolved lossless source references', async () => {
    const project = await packageFixture();
    const result = await renameProjectAsset(
      project,
      '.rockbox/wps/theme/icon.bmp',
      '.rockbox/wps/theme/battery-strip.bmp'
    );
    expect(result.ok).toBe(true);
    expect(serializeRockbox(result.project.wpsDocument!)).toBe('%xl(A,battery-strip.bmp,0,0,2)\n%xd(A,1)\n');
    expect(serializeRockbox(result.project.sbsDocument!)).toBe('%x(B,icon.bmp,0,0)\n');
    expect(listProjectAssets(result.project).some(record => record.asset.archivePath === '.rockbox/wps/theme/battery-strip.bmp')).toBe(true);
    expect(listProjectAssets(result.project).some(record => record.asset.archivePath === '.rockbox/wps/theme/icon.bmp')).toBe(false);
  });

  it('renames CFG assets without normalizing unrelated CFG source', async () => {
    const project = await packageFixture();
    const result = await renameProjectAsset(project, '.rockbox/icons/menu.bmp', '.rockbox/icons/adwaita-menu.bmp');
    expect(result.ok).toBe(true);
    expect(serializeCfg(result.project.themePackage!.cfg!)).toContain('iconset: /.rockbox/icons/adwaita-menu.bmp');
    expect(result.project.settings.iconset).toBe('/.rockbox/icons/adwaita-menu.bmp');
  });

  it('replaces canonical bytes in place and blocks referenced deletion', async () => {
    const project = await packageFixture();
    const original = listProjectAssets(project).find(record => record.asset.archivePath === '.rockbox/wps/theme/icon.bmp')!;
    const replacement = await replaceProjectAsset(project, original.asset.archivePath, bitmap(4, 10));
    const replaced = listProjectAssets(replacement.project).find(record => record.asset.archivePath === original.asset.archivePath)!;
    expect(replacement.ok).toBe(true);
    expect(replaced.asset.hash).not.toBe(original.asset.hash);
    expect(serializeRockbox(replacement.project.wpsDocument!)).toBe(serializeRockbox(project.wpsDocument!));
    expect(deleteProjectAsset(replacement.project, original.asset.archivePath)).toMatchObject({ ok: false });
  });

  it('deletes unreferenced bytes and exports newly added canonical assets', async () => {
    const project = await packageFixture();
    const removed = deleteProjectAsset(project, '.rockbox/wps/theme/unused.bmp');
    expect(removed.ok).toBe(true);
    const added = await addProjectAsset(removed.project, '.rockbox/wps/theme/new.bmp', bitmap(5, 5));
    expect(added.ok).toBe(true);
    const blob = await generateZip(added.project);
    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    expect(zip.file('.rockbox/wps/theme/unused.bmp')).toBeNull();
    expect(zip.file('.rockbox/wps/theme/new.bmp')).not.toBeNull();
    const savedProject = parseProjectData<typeof added.project>(await zip.file('rockbox_designer_project.json')!.async('string'));
    expect(savedProject.projectAssets?.find(asset => asset.archivePath === '.rockbox/wps/theme/new.bmp')?.bytes).toEqual(bitmap(5, 5));
  });

  it('rejects invalid added BMP bytes and kind-changing renames', async () => {
    const project = await packageFixture();
    expect(await addProjectAsset(project, '.rockbox/wps/theme/broken.bmp', new Uint8Array([0x42, 0x4d]))).toMatchObject({ ok: false });
    expect(await renameProjectAsset(project, '.rockbox/wps/theme/icon.bmp', '.rockbox/wps/theme/icon.txt')).toMatchObject({ ok: false });
  });

  it('keeps package export deterministic after path-aware mutations', async () => {
    const project = await packageFixture();
    const renamed = await renameProjectAsset(project, '.rockbox/wps/theme/icon.bmp', '.rockbox/wps/theme/renamed.bmp');
    const first = await exportThemePackage(renamed.project.themePackage!);
    const second = await exportThemePackage(renamed.project.themePackage!);
    expect(first).toEqual(second);
  });
});

describe('Assets workspace', () => {
  it('presents canonical package safety, conversion, strip, and reference controls', async () => {
    const project = await packageFixture();
    const html = renderToStaticMarkup(
      <AssetsMode project={project} activeScreen="wps" onProjectChange={() => undefined} onClose={() => undefined} onOpenPlay={() => undefined} />
    );
    expect(html).toContain('Assets · Real Rockbox bytes');
    expect(html).toContain('Build strip');
    expect(html).toContain('Starter shelf');
    expect(html).toContain('Asset safety console');
    expect(html).toContain('Rename + update references');
    expect(html).toContain('Preview as vertical strip');
    expect(html).toContain('Exact archive path');
  });
});
