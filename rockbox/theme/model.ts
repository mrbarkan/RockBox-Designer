import { getDeviceProfile, type DeviceProfileId } from '../devices';
import {
  getCfgValues,
  normalizeArchivePath,
  parseCfg,
  serializeCfg,
  updateCfgSetting,
  type CfgDocument,
  type PackageDiagnostic
} from '../packages';
import type { ProjectSettings, ProjectState } from '../../types';
import { settingsFromRockboxCfg } from '../../services/rockboxProjectSettings';

export const ROCKBOX_THEME_SOURCE_SHA = '078a506dfd0deb18165a3ed80c7fcbdb3afb0d31';

export const EDITABLE_CFG_KEYS = [
  'background color',
  'foreground color',
  'line selector start color',
  'line selector end color',
  'line selector text color',
  'selector type',
  'statusbar',
  'scrollbar',
  'scrollbar width',
  'volume display',
  'battery display',
  'show icons',
  'scroll speed',
  'scroll delay',
  'scroll step',
  'backlight on button hold',
  'font',
  'backdrop',
  'iconset',
  'viewers iconset',
  'qs top',
  'qs left',
  'qs right',
  'qs bottom'
] as const;

const PROJECTED_CFG_KEYS = new Set<string>([
  ...EDITABLE_CFG_KEYS,
  'selector color',
  'wps',
  'sbs',
  'fms'
]);

export type ThemeCfgInventory = {
  totalLines: number;
  settings: number;
  knownSettings: number;
  unknownSettings: number;
  comments: number;
  blanks: number;
  invalid: number;
  duplicates: Array<{ key: string; count: number }>;
};

export const inventoryThemeCfg = (document: CfgDocument): ThemeCfgInventory => {
  const counts = new Map<string, number>();
  let settings = 0;
  let knownSettings = 0;
  let comments = 0;
  let blanks = 0;
  let invalid = 0;
  for (const line of document.lines) {
    if (line.kind === 'comment') comments += 1;
    else if (line.kind === 'blank') blanks += 1;
    else if (line.kind === 'invalid') invalid += 1;
    else if (line.kind === 'setting') {
      settings += 1;
      const key = line.key?.toLowerCase() ?? '';
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (PROJECTED_CFG_KEYS.has(key)) knownSettings += 1;
    }
  }
  return {
    totalLines: document.lines.length,
    settings,
    knownSettings,
    unknownSettings: settings - knownSettings,
    comments,
    blanks,
    invalid,
    duplicates: [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([key, count]) => ({ key, count }))
      .sort((left, right) => left.key.localeCompare(right.key))
  };
};

export type ProjectThemeConfig = {
  cfg: CfgDocument;
  cfgPath: string;
  origin: 'imported-package' | 'editor-project' | 'generated-preview';
};

export const getProjectThemeConfig = (project: ProjectState, generatedSource: string): ProjectThemeConfig => {
  if (project.themePackage?.cfg) {
    return {
      cfg: project.themePackage.cfg,
      cfgPath: project.themePackage.cfgPath ?? `.rockbox/themes/${safeThemeName(project.settings.name)}.cfg`,
      origin: 'imported-package'
    };
  }
  if (project.standaloneThemeConfig) {
    return { ...project.standaloneThemeConfig, origin: 'editor-project' };
  }
  return {
    cfg: parseCfg(generatedSource),
    cfgPath: `.rockbox/themes/${safeThemeName(project.settings.name)}.cfg`,
    origin: 'generated-preview'
  };
};

export const safeThemeName = (name: string) => name.trim().replace(/[^a-z0-9._-]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'theme';

type EditableSettingKey = typeof EDITABLE_CFG_KEYS[number];
type SettingBinding = {
  property: keyof ProjectSettings;
  key: EditableSettingKey;
  serialize: (settings: ProjectSettings) => string;
};

const hex = (value: string | undefined) => (value ?? '').replace(/^#/, '');
const fontPath = (filename: string) => `/.rockbox/fonts/${filename.replace(/^.*[\\/]/, '')}`;

const SETTING_BINDINGS: SettingBinding[] = [
  { property: 'backgroundColor', key: 'background color', serialize: settings => hex(settings.backgroundColor) },
  { property: 'foregroundColor', key: 'foreground color', serialize: settings => hex(settings.foregroundColor) },
  { property: 'selectorColor', key: 'line selector start color', serialize: settings => hex(settings.selectorColor) },
  { property: 'lineSelectorEndColor', key: 'line selector end color', serialize: settings => hex(settings.lineSelectorEndColor ?? settings.selectorColor) },
  { property: 'selectorTextColor', key: 'line selector text color', serialize: settings => hex(settings.selectorTextColor) },
  { property: 'lineSelectorType', key: 'selector type', serialize: settings => settings.lineSelectorType === 'bar_gradient' ? 'bar (gradient)' : settings.lineSelectorType === 'bar_inverse' ? 'bar (inverse)' : settings.lineSelectorType === 'pointer' ? 'pointer' : 'bar (color)' },
  { property: 'statusBarPosition', key: 'statusbar', serialize: settings => settings.statusBarPosition ?? (settings.statusBarTop ? 'top' : 'off') },
  { property: 'scrollbar', key: 'scrollbar', serialize: settings => settings.scrollbar },
  { property: 'scrollbarWidth', key: 'scrollbar width', serialize: settings => String(settings.scrollbarWidth) },
  { property: 'volumeDisplay', key: 'volume display', serialize: settings => settings.volumeDisplay },
  { property: 'batteryDisplay', key: 'battery display', serialize: settings => settings.batteryDisplay },
  { property: 'showIcons', key: 'show icons', serialize: settings => settings.showIcons ? 'on' : 'off' },
  { property: 'scrollSpeed', key: 'scroll speed', serialize: settings => String(settings.scrollSpeed ?? 9) },
  { property: 'scrollDelay', key: 'scroll delay', serialize: settings => String(settings.scrollDelay ?? 1000) },
  { property: 'scrollStep', key: 'scroll step', serialize: settings => String(settings.scrollStep ?? 6) },
  { property: 'backlightOnHold', key: 'backlight on button hold', serialize: settings => settings.backlightOnHold ?? 'normal' },
  { property: 'uiFont', key: 'font', serialize: settings => fontPath(settings.uiFont) },
  { property: 'backdrop', key: 'backdrop', serialize: settings => settings.backdrop || '-' },
  { property: 'iconset', key: 'iconset', serialize: settings => settings.iconset || '-' },
  { property: 'viewersIconset', key: 'viewers iconset', serialize: settings => settings.viewersIconset || '-' },
  { property: 'qsTop', key: 'qs top', serialize: settings => settings.qsTop || '-' },
  { property: 'qsLeft', key: 'qs left', serialize: settings => settings.qsLeft || '-' },
  { property: 'qsRight', key: 'qs right', serialize: settings => settings.qsRight || '-' },
  { property: 'qsBottom', key: 'qs bottom', serialize: settings => settings.qsBottom || '-' }
];

const settingsEqual = (left: ProjectSettings, right: ProjectSettings) => {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)] as Array<keyof ProjectSettings>);
  return [...keys].every(key => {
    const leftValue = left[key];
    const rightValue = right[key];
    return Array.isArray(leftValue) && Array.isArray(rightValue)
      ? leftValue.length === rightValue.length && leftValue.every((value, index) => value === rightValue[index])
      : leftValue === rightValue;
  });
};

const screenArchivePath = (value: string, screen: 'wps' | 'sbs' | 'fms') => {
  if (!value || value === '-') return { path: undefined };
  const path = normalizeArchivePath(value);
  if (!path) return { error: `The ${screen.toUpperCase()} path is unsafe: ${value}` };
  if (!path.toLowerCase().endsWith(`.${screen}`)) return { error: `The ${screen.toUpperCase()} path must end in .${screen}.` };
  return { path };
};

export type ThemeWorkspaceDraft = {
  name: string;
  author: string;
  description: string;
  target: DeviceProfileId;
  cfgPath: string;
  rawCfg: string;
  settings: ProjectSettings;
};

export const createThemeWorkspaceDraft = (project: ProjectState, generatedSource: string): ThemeWorkspaceDraft => {
  const config = getProjectThemeConfig(project, generatedSource);
  return {
    name: project.settings.name,
    author: project.metadata?.author ?? '',
    description: project.metadata?.description ?? '',
    target: project.settings.target,
    cfgPath: config.cfgPath,
    rawCfg: serializeCfg(config.cfg),
    settings: { ...project.settings, palette: [...project.settings.palette] }
  };
};

export type ThemeCommitResult = {
  ok: boolean;
  project: ProjectState;
  changed: boolean;
  previewChanged: boolean;
  diagnostics: PackageDiagnostic[];
};

const PREVIEW_SETTING_KEYS: Array<keyof ProjectSettings> = [
  'target', 'backgroundColor', 'foregroundColor', 'selectorColor', 'selectorTextColor',
  'uiFont', 'fontMetrics', 'statusBarTop', 'statusBarPosition', 'backdrop', 'showIcons', 'scrollbar',
  'scrollbarWidth', 'volumeDisplay', 'batteryDisplay', 'lineSelectorType',
  'lineSelectorEndColor', 'iconset', 'viewersIconset', 'backlightOnHold',
  'qsTop', 'qsBottom', 'qsLeft', 'qsRight'
];

export const projectPreviewSettingsChanged = (before: ProjectSettings, after: ProjectSettings) =>
  PREVIEW_SETTING_KEYS.some(key => before[key] !== after[key]);

export const commitThemeWorkspace = (
  project: ProjectState,
  generatedSource: string,
  draft: ThemeWorkspaceDraft
): ThemeCommitResult => {
  const current = getProjectThemeConfig(project, generatedSource);
  const currentSource = serializeCfg(current.cfg);
  let cfg = draft.rawCfg === currentSource ? current.cfg : parseCfg(draft.rawCfg);

  for (const binding of SETTING_BINDINGS) {
    if (project.settings[binding.property] !== draft.settings[binding.property]) {
      cfg = updateCfgSetting(cfg, binding.key, binding.serialize(draft.settings));
    }
  }

  const cfgPath = normalizeArchivePath(draft.cfgPath);
  const diagnostics: PackageDiagnostic[] = [];
  if (!draft.name.trim()) {
    diagnostics.push({ severity: 'error', code: 'missing-theme-name', message: 'Theme name is required.' });
  }
  const typedChanged = (key: keyof ProjectSettings) => project.settings[key] !== draft.settings[key];
  for (const key of ['backgroundColor', 'foregroundColor', 'selectorColor', 'lineSelectorEndColor', 'selectorTextColor'] as const) {
    const value = draft.settings[key];
    if (typedChanged(key) && (!value || !/^#[0-9a-f]{6}$/i.test(value))) {
      diagnostics.push({ severity: 'error', code: 'invalid-color', message: `${key} must be a six-digit color such as #334455.` });
    }
  }
  if (typedChanged('uiFont') && !draft.settings.uiFont.toLowerCase().endsWith('.fnt')) {
    diagnostics.push({ severity: 'error', code: 'invalid-font-reference', message: 'The global Rockbox font must end in .fnt.' });
  }
  const profile = getDeviceProfile(draft.target);
  const ranges: Array<{ key: 'scrollbarWidth' | 'scrollSpeed' | 'scrollDelay' | 'scrollStep'; min: number; max: number; label: string }> = [
    { key: 'scrollbarWidth', min: 3, max: Math.max(25, Math.floor(profile.mainScreen.width / 10)), label: 'Scrollbar width' },
    { key: 'scrollSpeed', min: 0, max: 17, label: 'Scroll speed' },
    { key: 'scrollDelay', min: 0, max: 3000, label: 'Scroll delay' },
    { key: 'scrollStep', min: 1, max: profile.mainScreen.width, label: 'Scroll step' }
  ];
  for (const range of ranges) {
    const value = draft.settings[range.key];
    if (typedChanged(range.key) && (typeof value !== 'number' || !Number.isInteger(value) || value < range.min || value > range.max)) {
      diagnostics.push({ severity: 'error', code: 'invalid-setting-range', message: `${range.label} must be an integer from ${range.min} to ${range.max}.` });
    }
  }
  if (!cfgPath || !cfgPath.toLowerCase().endsWith('.cfg')) {
    diagnostics.push({ severity: 'error', code: 'invalid-cfg-path', message: 'The theme CFG path must be a safe archive path ending in .cfg.', path: draft.cfgPath });
  }

  const currentScreenPaths = project.themePackage?.screenPaths ?? {};
  let screenPaths = currentScreenPaths;
  for (const screen of ['wps', 'sbs', 'fms'] as const) {
    const reference = getCfgValues(cfg, screen).at(-1);
    if (!reference) continue;
    const resolved = screenArchivePath(reference, screen);
    if (resolved.error) {
      diagnostics.push({ severity: 'error', code: 'invalid-screen-path', message: resolved.error, path: reference });
      continue;
    }
    if (resolved.path && project.themePackage?.screens[screen] && currentScreenPaths[screen] !== resolved.path) {
      screenPaths = { ...screenPaths, [screen]: resolved.path };
    }
    else if (resolved.path && !project.themePackage?.screens[screen] && !project[`${screen}Document` as 'wpsDocument' | 'sbsDocument' | 'fmsDocument']) {
      diagnostics.push({ severity: 'warning', code: 'missing-screen-document', message: `CFG references ${reference}, but this project has no ${screen.toUpperCase()} source document.`, path: reference });
    }
  }

  if (diagnostics.some(diagnostic => diagnostic.severity === 'error')) {
    return { ok: false, project, changed: false, previewChanged: false, diagnostics };
  }

  const name = draft.name.trim() || project.settings.name;
  const projected = settingsFromRockboxCfg(serializeCfg(cfg), project.settings, name);
  projected.target = draft.target;
  const settings = settingsEqual(project.settings, projected) ? project.settings : projected;
  const metadata = {
    author: draft.author.trim(),
    description: draft.description.trim()
  };
  const oldMetadata = project.metadata ?? { author: '', description: '' };
  const metadataChanged = oldMetadata.author !== metadata.author || oldMetadata.description !== metadata.description;
  const configChanged = currentSource !== serializeCfg(cfg) || current.cfgPath !== cfgPath;

  let next: ProjectState = {
    ...project,
    settings,
    metadata: metadataChanged || project.metadata ? metadata : project.metadata
  };
  if (project.themePackage?.cfg) {
    next = {
      ...next,
      standaloneThemeConfig: undefined,
      themePackage: {
        ...project.themePackage,
        cfg,
        cfgPath: cfgPath!,
        screenPaths
      }
    };
  } else {
    next = {
      ...next,
      standaloneThemeConfig: { cfg, cfgPath: cfgPath! }
    };
  }

  const changed = configChanged || metadataChanged || settings !== project.settings;
  return {
    ok: true,
    project: changed ? next : project,
    changed,
    previewChanged: projectPreviewSettingsChanged(project.settings, settings),
    diagnostics
  };
};
