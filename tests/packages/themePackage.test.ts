import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import {
  exportThemePackage,
  importThemePackage,
  manifestFromFiles,
  buildPackageFiles
} from '../../rockbox/packages';
import { DEFAULT_PROJECT } from '../../constants';
import { generateZip } from '../../services/rockboxCompiler';
import { ElementType } from '../../types';

const zipFiles = async (files: Record<string, string | Uint8Array>) => {
  const zip = new JSZip();
  Object.entries(files).forEach(([path, value]) => zip.file(path, value));
  return zip.generateAsync({ type: 'uint8array' });
};

const baseCfg = (screens: Array<'wps' | 'sbs' | 'fms'>) => [
  '# preserved',
  ...screens.map(screen => `${screen}: /.rockbox/wps/theme.${screen}`),
  'unknown setting: keep:all',
  ''
].join('\r\n');

describe('theme package import', () => {
  it.each([
    [['wps']],
    [['wps', 'sbs']],
    [['wps', 'sbs', 'fms']]
  ] as Array<[Array<'wps' | 'sbs' | 'fms'>]>)('loads the declared screen set %j', async screens => {
    const files: Record<string, string> = { '.rockbox/themes/theme.cfg': baseCfg(screens) };
    screens.forEach(screen => { files[`.rockbox/wps/theme.${screen}`] = `%V(0,0,320,240,-)\n${screen}`; });
    const theme = await importThemePackage(await zipFiles(files));

    screens.forEach(screen => expect(theme.screens[screen]).toBeDefined());
    expect(theme.diagnostics.filter(diagnostic => diagnostic.severity === 'error')).toEqual([]);
  });

  it('reports a missing CFG without rejecting retained files', async () => {
    const theme = await importThemePackage(await zipFiles({ '.rockbox/wps/theme.wps': '%it' }));
    expect(theme.diagnostics.some(diagnostic => diagnostic.code === 'missing-cfg')).toBe(true);
    expect(theme.assets.some(asset => asset.archivePath === '.rockbox/wps/theme.wps')).toBe(true);
  });

  it('reports missing screens, missing assets, and case mismatches without basename fallback', async () => {
    const files = {
      '.rockbox/themes/theme.cfg': 'wps: /.rockbox/wps/Theme.wps\nsbs: /.rockbox/wps/missing.sbs\n',
      '.rockbox/wps/theme.wps': '%x|theme_img/missing.bmp|'
    };
    const theme = await importThemePackage(await zipFiles(files));
    expect(theme.diagnostics.filter(diagnostic => diagnostic.code === 'missing-screen')).toHaveLength(2);
  });

  it('retains duplicate basenames, fonts, unknown binary assets, and nested paths independently', async () => {
    const files = {
      '.rockbox/themes/theme.cfg': baseCfg(['wps']),
      '.rockbox/wps/theme.wps': '%it',
      '.rockbox/wps/dark/icon.bmp': new Uint8Array([1, 2]),
      '.rockbox/wps/light/icon.bmp': new Uint8Array([3, 4]),
      '.rockbox/fonts/custom.fnt': new Uint8Array([5, 6]),
      '.rockbox/extra/data.bin': new Uint8Array([7, 8])
    };
    const theme = await importThemePackage(await zipFiles(files));

    expect(theme.assets.filter(asset => asset.basename === 'icon.bmp')).toHaveLength(2);
    expect(theme.assets.find(asset => asset.archivePath.endsWith('custom.fnt'))?.kind).toBe('font');
    expect(theme.assets.find(asset => asset.archivePath.endsWith('data.bin'))?.kind).toBe('unknown');
  });

  it('reports a missing referenced bitmap relative to the screen directory', async () => {
    const files = {
      '.rockbox/themes/theme.cfg': baseCfg(['wps']),
      '.rockbox/wps/theme.wps': '%x|theme_img/missing.bmp|'
    };
    const theme = await importThemePackage(await zipFiles(files));
    expect(theme.diagnostics.some(diagnostic => diagnostic.code === 'missing-asset')).toBe(true);
  });
});

describe('deterministic theme package export', () => {
  it('preserves CRLF source, logical manifests, assets, and absent optional screens', async () => {
    const original = await importThemePackage(await zipFiles({
      '.rockbox/themes/theme.cfg': baseCfg(['wps']),
      '.rockbox/wps/theme.wps': '%V(0,0,320,240,-)\r\nBjörk\r\n',
      '.rockbox/wps/theme_img/icon.bmp': new Uint8Array([0, 1, 2, 3])
    }));
    const first = await exportThemePackage(original);
    const second = await exportThemePackage(original);
    const roundTripped = await importThemePackage(first);
    const exportedZip = await JSZip.loadAsync(first);

    expect(first).toEqual(second);
    expect(roundTripped.manifest).toEqual(original.manifest);
    expect(roundTripped.screens.wps?.source.slice(roundTripped.screens.wps.span.start, roundTripped.screens.wps.span.end))
      .toBe('%V(0,0,320,240,-)\r\nBjörk\r\n');
    expect(exportedZip.file('.rockbox/wps/theme.fms')).toBeNull();
  });

  it('builds a sorted logical manifest from package contents', async () => {
    const theme = await importThemePackage(await zipFiles({
      '.rockbox/themes/theme.cfg': baseCfg(['wps', 'sbs']),
      '.rockbox/wps/theme.wps': '%it',
      '.rockbox/wps/theme.sbs': '%ia'
    }));
    expect(await manifestFromFiles(buildPackageFiles(theme))).toEqual(theme.manifest);
  });
});

describe('product ZIP integration', () => {
  it('does not create empty SBS or FMS files for a WPS-only project', async () => {
    const project = {
      ...DEFAULT_PROJECT,
      assets: {},
      elements: [{
        id: 'text', name: 'Text', type: ElementType.TEXT, screen: 'wps' as const,
        x: 0, y: 0, width: 100, height: 16, visible: true, locked: false,
        content: 'Hello', fontId: '14-Nimbus.fnt', align: 'left' as const, color: '#ffffff'
      }]
    };
    const blob = await generateZip(project);
    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    expect(zip.file('.rockbox/wps/modern_dark.wps')).not.toBeNull();
    expect(zip.file('.rockbox/wps/modern_dark.sbs')).toBeNull();
    expect(zip.file('.rockbox/wps/modern_dark.fms')).toBeNull();
    const cfg = await zip.file('.rockbox/themes/modern_dark.cfg')!.async('string');
    expect(cfg).not.toContain('\nsbs:');
    expect(cfg).not.toContain('\nfms:');
  });

  it('preserves imported unknown CFG lines during product export', async () => {
    const cfg = '# exact\r\nwps: /.rockbox/wps/theme.wps\r\nunknown: keep:me\r\n';
    const themePackage = await importThemePackage(await zipFiles({
      '.rockbox/themes/theme.cfg': cfg,
      '.rockbox/wps/theme.wps': '%it\r\n'
    }));
    const project = {
      ...DEFAULT_PROJECT,
      assets: {},
      elements: [],
      themePackage,
      wpsDocument: themePackage.screens.wps
    };
    const blob = await generateZip(project);
    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    expect(await zip.file('.rockbox/themes/theme.cfg')!.async('string')).toBe(cfg);
  });
});
