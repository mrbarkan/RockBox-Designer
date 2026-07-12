import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { listSyntaxViewports, updateViewport } from '../../rockbox/editing';
import { exportThemePackage, importThemePackage } from '../../rockbox/packages';
import { interpretWps } from '../../rockbox/semantics';
import { serializeRockbox } from '../../rockbox/syntax';
import { DEFAULT_SIMULATION, DEFAULT_SONG } from '../../constants';

describe('real package WPS editing workflow', () => {
  it('imports, visually projects, source-edits, exports, and re-imports a WPS without losing unsupported source', async () => {
    const theme = await importThemePackage(new Uint8Array(readFileSync('tests/public-themes/authored-full.zip')));
    const document = theme.screens.wps!;
    const viewport = listSyntaxViewports(document)[0];
    const edited = updateViewport(document, viewport.id, { x: 8, y: 0, width: 312, height: 240 });
    theme.screens.wps = edited.document;

    const semantic = interpretWps(edited.document, {
      width: 320, height: 240, defaultFont: '14-Nimbus.fnt', foreground: '#ffffff', background: '#000000',
      sim: DEFAULT_SIMULATION, song: DEFAULT_SONG
    });
    expect(semantic.operations.some(operation => operation.type === 'setViewport' && operation.rect.x === 8)).toBe(true);

    const reimported = await importThemePackage(await exportThemePackage(theme));
    expect(serializeRockbox(reimported.screens.wps!)).toContain('%V(8,0,312,240,-)');
    expect(reimported.manifest.files.filter(file => !file.path.endsWith('.wps')))
      .toEqual(theme.manifest.files.filter(file => !file.path.endsWith('.wps')));
    expect(reimported.manifest.files.find(file => file.path.endsWith('.wps'))?.hash)
      .not.toBe(theme.manifest.files.find(file => file.path.endsWith('.wps'))?.hash);
  });
});
