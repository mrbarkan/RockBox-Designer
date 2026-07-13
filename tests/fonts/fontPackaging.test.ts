import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT } from '../../constants';
import { importThemePackage } from '../../rockbox/packages';
import { generateZip } from '../../services/rockboxCompiler';

describe('Rockbox font packaging', () => {
  it('exports an imported FNT under .rockbox/fonts without changing its bytes', async () => {
    const font = new Uint8Array([0x52, 0x42, 0x31, 0x32, 1, 2, 3, 4]);
    const project = {
      ...DEFAULT_PROJECT,
      settings: { ...DEFAULT_PROJECT.settings, name: 'Font Package', uiFont: '16-Test.fnt' },
      assets: {
        ...DEFAULT_PROJECT.assets,
        '16-Test.fnt': `data:application/octet-stream;base64,${Buffer.from(font).toString('base64')}`
      }
    };

    const blob = await generateZip(project);
    expect(blob).not.toBeNull();
    const theme = await importThemePackage(await blob!.arrayBuffer());
    const asset = theme.assets.find(candidate => candidate.archivePath === '.rockbox/fonts/16-Test.fnt');
    expect(asset?.bytes).toEqual(font);
    expect(theme.cfg?.source).toContain('font: /.rockbox/fonts/16-Test.fnt');
  });
});
