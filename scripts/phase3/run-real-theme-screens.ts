import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DEFAULT_PROJECT, DEFAULT_SIMULATION, DEFAULT_SONG } from '../../constants';
import { listSyntaxViewports, updateViewport } from '../../rockbox/editing';
import { exportThemePackage, importThemePackage } from '../../rockbox/packages';
import { interpretSkin, type SkinScreen } from '../../rockbox/semantics';
import { serializeNode, serializeRockbox } from '../../rockbox/syntax';
import { settingsFromRockboxCfg } from '../../services/rockboxProjectSettings';

const path = resolve('tests/private-themes/Adwaitapod.zip');
if (!existsSync(path)) throw new Error(`Missing private fixture ${path}. Run themes:prepare-private first.`);
const theme = await importThemePackage(new Uint8Array(readFileSync(path)));
if (!theme.cfg) throw new Error('Adwaitapod has no CFG.');
const settings = settingsFromRockboxCfg(theme.cfg.source, DEFAULT_PROJECT.settings, 'Adwaitapod');
const interpreterSettings = {
  'battery display': settings.batteryDisplay,
  'volume display': settings.volumeDisplay,
  statusbar: settings.statusBarTop ? 'top' : 'off',
  'backlight on button hold': settings.backlightOnHold,
  lang: 'english-us',
  'selector color': settings.selectorColor,
  'selector text color': settings.selectorTextColor,
  'line selector': settings.lineSelectorType,
  scrollbar: settings.scrollbar,
  'scrollbar width': settings.scrollbarWidth,
  'show icons': settings.showIcons,
  iconset: settings.iconset,
  'qs top': settings.qsTop,
  'qs bottom': settings.qsBottom,
  'qs left': settings.qsLeft,
  'qs right': settings.qsRight
};
const options = {
  width: 320,
  height: 240,
  defaultFont: settings.uiFont,
  foreground: settings.foregroundColor,
  background: settings.backgroundColor,
  sim: DEFAULT_SIMULATION,
  song: DEFAULT_SONG,
  settings: interpreterSettings
};

const screens = [];
for (const screen of ['wps', 'sbs', 'fms'] as const satisfies readonly SkinScreen[]) {
  const document = theme.screens[screen];
  if (!document) throw new Error(`Adwaitapod has no ${screen.toUpperCase()}.`);
  const originalSource = serializeRockbox(document);
  if (originalSource !== document.source) throw new Error(`${screen.toUpperCase()} failed untouched round-trip.`);
  const viewport = listSyntaxViewports(document).find(candidate => candidate.x >= 0);
  if (!viewport) throw new Error(`${screen.toUpperCase()} has no editable viewport.`);
  const originalTag = document.nodes.find(node => node.id === viewport.id)?.raw;
  const edit = updateViewport(document, viewport.id, {
    x: viewport.x + 1,
    y: viewport.y,
    width: viewport.width,
    height: viewport.height
  });
  const editedTag = edit.document.nodes.find(node => node.id === viewport.id);
  if (!edit.changed || !originalTag || !editedTag) throw new Error(`${screen.toUpperCase()} viewport edit failed.`);
  const editedSource = serializeRockbox(edit.document);
  theme.screens[screen] = edit.document;
  const screenSimulation = {
    ...DEFAULT_SIMULATION,
    currentActivity: screen === 'wps' ? 2 : screen === 'fms' ? 4 : 1
  };
  const semantic = interpretSkin(edit.document, { ...options, screen, sim: screenSimulation });
  const quickScreen = screen === 'sbs'
    ? interpretSkin(edit.document, { ...options, screen, sim: { ...DEFAULT_SIMULATION, currentActivity: 10 } })
    : undefined;
  const renderedText = semantic.operations
    .filter(operation => operation.type === 'drawText')
    .map(operation => operation.text)
    .join(' ');
  screens.push({
    screen,
    exactUntouchedRoundTrip: originalSource === document.source,
    sourceSha256Before: createHash('sha256').update(originalSource).digest('hex'),
    sourceSha256After: createHash('sha256').update(editedSource).digest('hex'),
    minimumChange: originalSource.replace(originalTag, serializeNode(editedTag)) === editedSource,
    viewportProjectionUpdated: semantic.operations.some(operation =>
      operation.type === 'setViewport' && operation.source.nodeId === viewport.id && operation.rect.x === viewport.x + 1
    ),
    commentsExcludedFromElements: !semantic.layers.some(layer => layer.label.toLowerCase().includes('comment')),
    valid: semantic.valid,
    operationCount: semantic.operations.length,
    unsupportedNodesRetained: semantic.layers.filter(layer => layer.kind === 'unsupported').length,
    menuPreview: screen === 'sbs' && semantic.layers.some(layer => layer.label.includes('Rockbox menu list')),
    quickScreenPreview: screen === 'sbs' && Boolean(quickScreen?.layers.some(layer => layer.label.includes('firmware controlled'))),
    fmStatePreview: screen === 'fms' &&
      renderedText.includes(DEFAULT_SIMULATION.fmFrequency.toFixed(1)) &&
      renderedText.includes(DEFAULT_SIMULATION.fmStereo ? 'Stereo' : 'Mono')
  });
}

const exported = await exportThemePackage(theme);
const reimported = await importThemePackage(exported);
for (const screen of ['wps', 'sbs', 'fms'] as const) {
  const result = screens.find(candidate => candidate.screen === screen)!;
  result.exactAfterExport = serializeRockbox(reimported.screens[screen]!) === serializeRockbox(theme.screens[screen]!);
  result.pathRetained = reimported.screenPaths[screen] === theme.screenPaths[screen];
}
const assetsPreserved = theme.assets.every(asset =>
  reimported.assets.some(candidate => candidate.archivePath === asset.archivePath && candidate.hash === asset.hash)
);

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  scope: {
    fixture: 'Adwaitapod',
    privateFixtureCommitted: false,
    sourceIncluded: false,
    preservationIsNotVisualSupport: true
  },
  package: {
    assetsPreserved,
    diagnostics: reimported.diagnostics.length,
    screenCount: Object.keys(reimported.screens).length
  },
  screens
};
const reportPath = resolve('reports/phase3-real-theme/latest.json');
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`Phase 3 real-theme screen report: ${screens.length} screens.\nReport: ${reportPath}\n`);
if (
  !assetsPreserved || reimported.diagnostics.length > 0 || screens.some(result =>
    !result.exactUntouchedRoundTrip || !result.minimumChange || !result.viewportProjectionUpdated ||
    !result.commentsExcludedFromElements || !result.valid || !result.exactAfterExport || !result.pathRetained
  ) || !screens.find(result => result.screen === 'sbs')?.menuPreview ||
  !screens.find(result => result.screen === 'sbs')?.quickScreenPreview ||
  !screens.find(result => result.screen === 'fms')?.fmStatePreview
) throw new Error('Phase 3 real-theme screen acceptance failed. Inspect the generated report.');
