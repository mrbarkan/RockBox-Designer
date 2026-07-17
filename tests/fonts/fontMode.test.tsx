import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT } from '../../constants';
import { FontMode } from '../../components/FontMode';
import { addProjectAsset, renameProjectAsset } from '../../rockbox/assets';
import {
  ROCKBOX_FONT_CATALOG,
  ROCKBOX_FONT_SOURCE_SHA,
  defaultFontArchivePath,
  listProjectFonts,
  setProjectUiFont
} from '../../rockbox/fonts';
import { createThemeAsset, parseCfg, serializeCfg } from '../../rockbox/packages';
import { parseRockbox, serializeRockbox } from '../../rockbox/syntax';
import { rb12Fixture } from './rb12Fixture';

const projectWithFont = async () => {
  const asset = await createThemeAsset('.rockbox/fonts/12-Test.fnt', rb12Fixture());
  const wpsDocument = parseRockbox('%Fl(2,12-Test.fnt,100)\n%V(0,0,-,-,2)Hello\n');
  return {
    ...DEFAULT_PROJECT,
    settings: { ...DEFAULT_PROJECT.settings, name: 'Font Test', uiFont: '12-Test.fnt' },
    wpsDocument,
    themePackage: {
      cfg: parseCfg('# keep\nfont: /.rockbox/fonts/12-Test.fnt\nunknown: exact\n'),
      cfgPath: '.rockbox/themes/font-test.cfg',
      screens: { wps: wpsDocument },
      screenPaths: { wps: '.rockbox/wps/font-test.wps' },
      assets: [asset],
      manifest: { files: [] },
      diagnostics: []
    }
  };
};

describe('Font workspace', () => {
  it('checks the complete pinned Rockbox font-package catalog without bundling bytes', () => {
    expect(ROCKBOX_FONT_CATALOG).toHaveLength(88);
    expect(ROCKBOX_FONT_CATALOG[0]).toMatchObject({ filename: '05-Tiny.fnt', height: 5, delivery: 'rockbox-fonts-package' });
    expect(ROCKBOX_FONT_CATALOG.at(-1)?.filename).toBe('35-Nimbus.fnt');
    expect(ROCKBOX_FONT_SOURCE_SHA).toBe('078a506dfd0deb18165a3ed80c7fcbdb3afb0d31');
  });

  it('inventories exact RB12 bytes and every resolved CFG/%Fl reference', async () => {
    const project = await projectWithFont();
    const [font] = listProjectFonts(project);
    expect(font).toMatchObject({ current: true, owner: 'theme' });
    expect(font.error).toBeUndefined();
    expect(font.font?.metrics).toMatchObject({ height: 16, glyphCount: 95 });
    expect(font.references.map(reference => reference.scope).sort()).toEqual(['cfg', 'wps']);
  });

  it('sets a packaged or external UI font through minimum-change CFG editing', async () => {
    const project = await projectWithFont();
    const result = setProjectUiFont(project, '14-Terminus.fnt');
    expect(result.ok).toBe(true);
    expect(result.project.settings.uiFont).toBe('14-Terminus.fnt');
    expect(result.project.settings.fontMetrics).toBeUndefined();
    expect(serializeCfg(result.project.themePackage!.cfg!)).toBe('# keep\nfont: /.rockbox/fonts/14-Terminus.fnt\nunknown: exact\n');
    expect(result.message).toMatch(/external dependency/);
  });

  it('adds only valid FNT bytes and safely rewrites exact font references on rename', async () => {
    const project = await projectWithFont();
    const invalid = await addProjectAsset(project, defaultFontArchivePath(project, 'Bad.fnt'), new Uint8Array([1, 2, 3]));
    expect(invalid.ok).toBe(false);
    expect(invalid.conflicts.join(' ')).toMatch(/36-byte/);

    const renamed = await renameProjectAsset(project, '.rockbox/fonts/12-Test.fnt', '.rockbox/fonts/12-Renamed.fnt');
    expect(renamed.ok).toBe(true);
    expect(renamed.project.settings.uiFont).toBe('12-Renamed.fnt');
    expect(renamed.project.wpsDocument?.source).toContain('%Fl(2,12-Test.fnt,100)');
    expect(serializeRockbox(renamed.project.wpsDocument!)).toContain('%Fl(2,12-Renamed.fnt,100)');
    expect(renamed.project.wpsDocument?.dirty).toBe(true);
    expect(renamed.project.wpsDocument && renamed.project.wpsDocument.nodes.some(node => node.dirty)).toBe(true);
    expect(serializeCfg(renamed.project.themePackage!.cfg!)).toContain('font: /.rockbox/fonts/12-Renamed.fnt');
  });

  it('renders the dedicated lazy-workspace surface with package and font-pack boundaries', async () => {
    const project = await projectWithFont();
    const html = renderToStaticMarkup(<FontMode project={project} onProjectChange={() => undefined} onClose={() => undefined} onOpenPlay={() => undefined} />);
    expect(html).toContain('Pulp workspace · canonical RB12');
    expect(html).toContain('Theme · 1');
    expect(html).toContain('Font pack · 88');
    expect(html).toContain('Exact package bytes');
    expect(html).toContain('Strings found in this project');
    expect(html).toContain('Source references · 2');
  });
});
