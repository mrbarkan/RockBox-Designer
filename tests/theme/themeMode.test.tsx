import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT } from '../../constants';
import { ThemeMode } from '../../components/ThemeMode';
import { generateZip } from '../../services/rockboxCompiler';
import { parseProjectData, stringifyProjectData } from '../../services/projectSerialization';
import {
  commitThemeWorkspace,
  createThemeWorkspaceDraft,
  inventoryThemeCfg
} from '../../rockbox/theme';
import { importThemePackage, parseCfg, serializeCfg } from '../../rockbox/packages';
import { parseRockbox } from '../../rockbox/syntax';
import { collectProjectAssetReferences } from '../../rockbox/assets';
import { setProjectUiFont } from '../../rockbox/fonts';
import type { ProjectState } from '../../types';

const cfgSource = [
  '# title stays source-only',
  'wps: /.rockbox/wps/theme.wps',
  'foreground color: 101010',
  'future setting: exact:value',
  'foreground color : 202020  ',
  'raw line without colon',
  ''
].join('\r\n');

const projectWithPackage = (): ProjectState => {
  const wps = parseRockbox('# screen comment\r\n%V(0,0,-,-,-)Hello\r\n');
  return {
    ...DEFAULT_PROJECT,
    settings: { ...DEFAULT_PROJECT.settings, name: 'Theme Test', foregroundColor: '#202020' },
    elements: [],
    wpsDocument: wps,
    themePackage: {
      cfg: parseCfg(cfgSource),
      cfgPath: '.rockbox/themes/theme.cfg',
      screens: { wps },
      screenPaths: { wps: '.rockbox/wps/theme.wps' },
      assets: [],
      manifest: { files: [] },
      diagnostics: []
    }
  };
};

describe('Theme workspace', () => {
  it('inventories comments, raw lines, duplicates, and unknown settings without turning them into elements', () => {
    const project = projectWithPackage();
    const inventory = inventoryThemeCfg(project.themePackage!.cfg!);
    expect(inventory).toMatchObject({ settings: 4, knownSettings: 3, unknownSettings: 1, comments: 1, invalid: 1 });
    expect(inventory.duplicates).toEqual([{ key: 'foreground color', count: 2 }]);
    expect(project.elements).toEqual([]);
    expect(serializeCfg(project.themePackage!.cfg!)).toBe(cfgSource);
  });

  it('commits one typed setting with minimum change and preserves CRLF, comments, duplicates, unknown, and malformed lines', () => {
    const project = projectWithPackage();
    const draft = createThemeWorkspaceDraft(project, 'unused');
    draft.settings = { ...draft.settings, foregroundColor: '#abcdef' };
    const result = commitThemeWorkspace(project, 'unused', draft);

    expect(result.ok).toBe(true);
    expect(result.previewChanged).toBe(true);
    expect(serializeCfg(result.project.themePackage!.cfg!)).toBe(cfgSource.replace('foreground color : 202020  ', 'foreground color : abcdef  '));
    expect(serializeCfg(project.themePackage!.cfg!)).toBe(cfgSource);
    expect(result.project.settings.foregroundColor).toBe('#abcdef');
  });

  it('commits metadata and unknown-only CFG edits without marking the preview dirty', () => {
    const project = projectWithPackage();
    const draft = createThemeWorkspaceDraft(project, 'unused');
    draft.author = 'Theme Author';
    draft.description = 'A project description';
    draft.rawCfg = draft.rawCfg.replace('future setting: exact:value', 'future setting: exact:value:updated');
    const result = commitThemeWorkspace(project, 'unused', draft);

    expect(result.ok).toBe(true);
    expect(result.changed).toBe(true);
    expect(result.previewChanged).toBe(false);
    expect(result.project.settings).toBe(project.settings);
    expect(result.project.themePackage?.assets).toBe(project.themePackage?.assets);
    expect(result.project.themePackage?.screenPaths).toBe(project.themePackage?.screenPaths);
    expect(result.project.wpsDocument).toBe(project.wpsDocument);
    expect(result.project.metadata).toEqual({ author: 'Theme Author', description: 'A project description' });
    expect(serializeCfg(result.project.themePackage!.cfg!)).toContain('future setting: exact:value:updated');
  });

  it('projects known raw CFG changes into visual settings and safely relocates a referenced screen', async () => {
    const project = projectWithPackage();
    const draft = createThemeWorkspaceDraft(project, 'unused');
    draft.rawCfg = draft.rawCfg
      .replace('foreground color : 202020  ', 'foreground color : 334455  ')
      .replace('/.rockbox/wps/theme.wps', '/.rockbox/wps/renamed.wps');
    const result = commitThemeWorkspace(project, 'unused', draft);

    expect(result.ok).toBe(true);
    expect(result.previewChanged).toBe(true);
    expect(result.project.settings.foregroundColor).toBe('#334455');
    expect(result.project.themePackage!.screenPaths.wps).toBe('.rockbox/wps/renamed.wps');
    const exported = await generateZip(result.project);
    const reimported = await importThemePackage(new Uint8Array(await exported!.arrayBuffer()));
    expect(reimported.screenPaths.wps).toBe('.rockbox/wps/renamed.wps');
    expect(reimported.screens.wps && serializeCfg(result.project.themePackage!.cfg!)).toContain('renamed.wps');
  });

  it('creates one canonical standalone CFG for editor-created projects and exports its chosen paths', async () => {
    const project: ProjectState = { ...DEFAULT_PROJECT, settings: { ...DEFAULT_PROJECT.settings, name: 'Standalone' }, elements: [], wpsDocument: parseRockbox('%V(0,0,-,-,-)Standalone\n') };
    const generated = '# generated\nwps: /.rockbox/wps/standalone.wps\nunknown: keep\n';
    const draft = createThemeWorkspaceDraft(project, generated);
    draft.cfgPath = '.rockbox/themes/custom-name.cfg';
    draft.rawCfg = draft.rawCfg.replace('standalone.wps', 'custom-screen.wps');
    const result = commitThemeWorkspace(project, generated, draft);

    expect(result.ok).toBe(true);
    expect(result.project.themePackage).toBeUndefined();
    expect(result.project.standaloneThemeConfig?.cfgPath).toBe('.rockbox/themes/custom-name.cfg');
    const exported = await generateZip(result.project);
    const imported = await importThemePackage(new Uint8Array(await exported!.arrayBuffer()));
    expect(imported.cfgPath).toBe('.rockbox/themes/custom-name.cfg');
    expect(imported.screenPaths.wps).toBe('.rockbox/wps/custom-screen.wps');
    expect(serializeCfg(imported.cfg!)).toContain('unknown: keep');

    const restored = parseProjectData<ProjectState>(stringifyProjectData(result.project));
    expect(restored.standaloneThemeConfig?.cfgPath).toBe('.rockbox/themes/custom-name.cfg');
    expect(serializeCfg(restored.standaloneThemeConfig!.cfg)).toBe(serializeCfg(result.project.standaloneThemeConfig!.cfg));
  });

  it('rejects unsafe package and screen paths without mutating the canonical project', () => {
    const project = projectWithPackage();
    const draft = createThemeWorkspaceDraft(project, 'unused');
    draft.cfgPath = '../../escape.cfg';
    draft.rawCfg = draft.rawCfg.replace('/.rockbox/wps/theme.wps', '../../escape.wps');
    const result = commitThemeWorkspace(project, 'unused', draft);
    expect(result.ok).toBe(false);
    expect(result.project).toBe(project);
    expect(result.diagnostics.map(diagnostic => diagnostic.code)).toEqual(['invalid-cfg-path', 'invalid-screen-path']);
  });

  it('requires a project name instead of silently discarding a blank staged value', () => {
    const project = projectWithPackage();
    const draft = createThemeWorkspaceDraft(project, 'unused');
    draft.name = '   ';
    const result = commitThemeWorkspace(project, 'unused', draft);
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0].code).toBe('missing-theme-name');
    expect(result.project).toBe(project);
  });

  it('keeps Assets and Fonts attached to the standalone CFG authority', () => {
    const project: ProjectState = {
      ...DEFAULT_PROJECT,
      standaloneThemeConfig: {
        cfg: parseCfg('font: /.rockbox/fonts/14-Nimbus.fnt\nbackdrop: /.rockbox/backdrops/art.bmp\n'),
        cfgPath: '.rockbox/themes/standalone.cfg'
      }
    };
    expect(collectProjectAssetReferences(project).filter(reference => reference.scope === 'cfg').map(reference => reference.cfgKey)).toEqual(['font', 'backdrop']);
    const result = setProjectUiFont(project, '14-Terminus.fnt');
    expect(result.ok).toBe(true);
    expect(serializeCfg(result.project.standaloneThemeConfig!.cfg)).toContain('font: /.rockbox/fonts/14-Terminus.fnt');
    expect(result.project.themePackage).toBeUndefined();
  });

  it('distinguishes Rockbox bottom status bars from off and commits the exact standard value', () => {
    const project = projectWithPackage();
    const draft = createThemeWorkspaceDraft(project, 'unused');
    draft.settings = { ...draft.settings, statusBarTop: false, statusBarPosition: 'bottom' };
    const result = commitThemeWorkspace(project, 'unused', draft);
    expect(result.ok).toBe(true);
    expect(result.previewChanged).toBe(true);
    expect(result.project.settings.statusBarPosition).toBe('bottom');
    expect(serializeCfg(result.project.themePackage!.cfg!)).toContain('statusbar: bottom');
  });

  it('marks quick-screen and hold changes as preview-relevant shared simulator settings', () => {
    const project = projectWithPackage();
    const draft = createThemeWorkspaceDraft(project, 'unused');
    draft.settings = { ...draft.settings, qsTop: 'brightness', backlightOnHold: 'off' };
    const result = commitThemeWorkspace(project, 'unused', draft);
    expect(result.ok).toBe(true);
    expect(result.previewChanged).toBe(true);
    expect(serializeCfg(result.project.themePackage!.cfg!)).toContain('qs top: brightness');
    expect(serializeCfg(result.project.themePackage!.cfg!)).toContain('backlight on button hold: off');
  });

  it('renders the dedicated project, capability, package, behavior, and lossless-source surface', () => {
    const html = renderToStaticMarkup(<ThemeMode
      project={projectWithPackage()}
      onProjectChange={() => undefined}
      onOpenAssets={() => undefined}
      onOpenFonts={() => undefined}
      onOpenPlay={() => undefined}
      onClose={() => undefined}
    />);
    expect(html).toContain('Pulp workspace · lossless project CFG');
    expect(html).toContain('Commit project');
    expect(html).toContain('Theme metadata');
    expect(html).toContain('Package files');
    expect(html).toContain('Compatibility summary');
    expect(html).toContain('Source CFG');
  });
});
