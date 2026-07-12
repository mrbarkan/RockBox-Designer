import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, delimiter, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPackageFiles,
  exportThemePackage,
  importThemePackage,
  serializeCfg,
  ThemeManifest,
  ThemePackage
} from '../../rockbox/packages';
import { KNOWN_TAG_SCHEMAS } from '../../rockbox/editing';
import { isKnownTag } from '../../rockbox/registry';
import { RockboxDocument, RockboxNode, serializeRockbox } from '../../rockbox/syntax';
import { buildCheckWps } from '../official/build-checkwps';

type Provenance = {
  name?: string;
  target?: string;
  sourceClass?: string;
  source?: string;
  license?: string;
  redistribution?: string;
};

type LocatedTheme = {
  zipPath: string;
  root: string;
  provenance: Provenance;
};

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const configuredRoots = (process.env.ROCKBOX_THEME_DIRS ?? '')
  .split(delimiter)
  .filter(Boolean)
  .map(path => resolve(path));
const roots = [
  resolve(projectRoot, 'tests/public-themes'),
  resolve(projectRoot, 'tests/private-themes'),
  ...configuredRoots
];
const renderedTags = new Set([
  'V', 'Vl', 'Vd', 'Vf', 'Vb', 'xl', 'xd', 'x', 'Cl', 'Cd', 'Fn',
  'al', 'ac', 'ar', 'pb', 's', 'id', 'it', 'pc', 'pt', 'pv', 'bl', 'mp', 'mm', 'ps'
]);

const readProvenance = (zipPath: string): Provenance => {
  try {
    return JSON.parse(readFileSync(`${zipPath}.provenance.json`, 'utf8'));
  } catch {
    return {};
  }
};

const discoverThemes = (): LocatedTheme[] => roots.flatMap(root => {
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.zip'))
      .map(entry => {
        const zipPath = join(root, entry.name);
        return { zipPath, root, provenance: readProvenance(zipPath) };
      });
  } catch {
    return [];
  }
}).sort((left, right) => left.zipPath.localeCompare(right.zipPath));

const collectTags = (document: RockboxDocument) => {
  const names: string[] = [];
  const walk = (nodes: RockboxNode[]) => nodes.forEach(node => {
    if (node.kind === 'tag') names.push(node.name);
    if (node.kind === 'conditional') {
      if (node.test.kind === 'tag') names.push(node.test.name);
      node.branches.forEach(branch => walk(branch.nodes));
    }
  });
  walk(document.nodes);
  return names;
};

const sameManifest = (left: ThemeManifest, right: ThemeManifest) =>
  JSON.stringify(left.files) === JSON.stringify(right.files);

const manifestCollisions = (manifest: ThemeManifest) => {
  const byBasename = new Map<string, string[]>();
  for (const file of manifest.files) {
    const name = basename(file.path).toLowerCase();
    byBasename.set(name, [...(byBasename.get(name) ?? []), file.path]);
  }
  return [...byBasename.entries()]
    .filter(([, paths]) => paths.length > 1)
    .map(([name, paths]) => ({ basename: name, paths }));
};

const screenEntries = (theme: ThemePackage) => (['wps', 'sbs', 'fms'] as const)
  .flatMap(screen => theme.screens[screen] && theme.screenPaths[screen]
    ? [{ screen, document: theme.screens[screen]!, path: theme.screenPaths[screen]! }]
    : []);

const officialRequested = process.env.ROCKBOX_THEMES_OFFICIAL === '1';
if (officialRequested && !process.env.ROCKBOX_SOURCE_DIR) {
  throw new Error('ROCKBOX_SOURCE_DIR is required when ROCKBOX_THEMES_OFFICIAL=1.');
}
const officialBuilds = new Map<string, ReturnType<typeof buildCheckWps>>();

const runOfficial = (
  target: string,
  theme: ThemePackage,
  screens: ReturnType<typeof screenEntries>
) => {
  if (!officialRequested) return { status: 'not-run', files: [] };
  let build = officialBuilds.get(target);
  if (!build) {
    build = buildCheckWps({
      sourceDir: process.env.ROCKBOX_SOURCE_DIR!,
      target,
      buildRoot: process.env.ROCKBOX_OFFICIAL_BUILD_DIR
    });
    officialBuilds.set(target, build);
  }

  const directory = mkdtempSync(join(tmpdir(), 'rockbox-theme-official-'));
  try {
    for (const [path, bytes] of buildPackageFiles(theme)) {
      const archivePath = join(directory, path);
      mkdirSync(dirname(archivePath), { recursive: true });
      writeFileSync(archivePath, bytes);
    }
    const files = screens.map(({ screen, document, path }) => {
      const fixturePath = join(directory, path);
      mkdirSync(dirname(fixturePath), { recursive: true });
      writeFileSync(fixturePath, serializeRockbox(document));
      const execution = spawnSync(build!.binaryPath, [fixturePath], {
        cwd: directory,
        encoding: 'utf8'
      });
      return {
        screen,
        path,
        executed: !execution.error,
        accepted: !execution.error && execution.status === 0,
        exitCode: execution.status,
        output: `${execution.stdout ?? ''}${execution.stderr ?? ''}`
          .replaceAll(fixturePath, '<screen-file>')
          .replaceAll(directory, '<theme-root>')
          .trim()
      };
    });
    return {
      status: files.every(file => file.executed && file.accepted) ? 'accepted' :
        files.every(file => file.executed) ? 'rejected' : 'unavailable',
      files
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

const analyzeTheme = async (located: LocatedTheme) => {
  const input = new Uint8Array(readFileSync(located.zipPath));
  const imported = await importThemePackage(input);
  const screens = screenEntries(imported);
  const cfgRoundTrip = !imported.cfg || serializeCfg(imported.cfg) === imported.cfg.source;
  const screenRoundTrips = Object.fromEntries(screens.map(({ screen, document }) => [
    screen,
    serializeRockbox(document) === document.source
  ]));
  const exactRoundTrip = cfgRoundTrip && Object.values(screenRoundTrips).every(Boolean);
  const exported = await exportThemePackage(imported);
  const reimported = await importThemePackage(exported);
  const exportManifestMatches = sameManifest(imported.manifest, reimported.manifest);
  const tagNames = [...new Set(screens.flatMap(({ document }) => collectTags(document)))].sort();
  const unknownTags = tagNames.filter(name => !isKnownTag(name));
  const knownTags = tagNames.filter(isKnownTag);
  const syntaxDiagnostics = screens.flatMap(({ screen, path, document }) =>
    document.diagnostics.map(diagnostic => ({
      source: `${screen}:${path}`,
      severity: diagnostic.severity,
      code: diagnostic.code,
      message: diagnostic.message,
      span: diagnostic.span
    }))
  );
  const packageDiagnostics = imported.diagnostics.map(diagnostic => ({
    source: diagnostic.path ?? imported.cfgPath ?? basename(located.zipPath),
    ...diagnostic
  }));
  const target = located.provenance.target ?? process.env.ROCKBOX_THEME_DEFAULT_TARGET ?? 'ipodvideo';
  const official = runOfficial(target, imported, screens);
  const label = relative(located.root, located.zipPath);

  return {
    name: located.provenance.name ?? basename(located.zipPath, '.zip'),
    fixture: label,
    sourceClass: located.provenance.sourceClass ??
      (located.root.includes('private-themes') ? 'private-local' : 'unclassified-local'),
    provenance: {
      source: located.provenance.source ?? 'not-recorded',
      license: located.provenance.license ?? 'not-recorded',
      redistribution: located.provenance.redistribution ?? 'not-recorded'
    },
    target,
    sourceFilesFound: [imported.cfgPath, ...screens.map(screen => screen.path)].filter(Boolean),
    preservation: {
      exactRoundTrip,
      cfg: cfgRoundTrip,
      screens: screenRoundTrips
    },
    parsing: {
      unknownTags,
      diagnostics: [...packageDiagnostics, ...syntaxDiagnostics],
      missingAssets: packageDiagnostics.filter(diagnostic => diagnostic.code === 'missing-asset'),
      pathCollisions: manifestCollisions(imported.manifest)
    },
    packageExport: {
      manifestMatches: exportManifestMatches,
      sourceFileCount: imported.manifest.files.length,
      exportedFileCount: reimported.manifest.files.length,
      assetHashesPreserved: exportManifestMatches
    },
    support: {
      interpretedTags: knownTags.filter(name => name in KNOWN_TAG_SCHEMAS),
      unsupportedSemanticTags: knownTags.filter(name => !(name in KNOWN_TAG_SCHEMAS)),
      renderedTags: knownTags.filter(name => renderedTags.has(name)),
      unsupportedRenderTags: knownTags.filter(name => !renderedTags.has(name)),
      editableTags: knownTags.filter(name => name in KNOWN_TAG_SCHEMAS),
      unsupportedEditTags: knownTags.filter(name => !(name in KNOWN_TAG_SCHEMAS))
    },
    official
  };
};

const themes = discoverThemes();
if (themes.length === 0) throw new Error(`No theme ZIPs found in: ${roots.join(', ')}`);
const results = [];
for (const theme of themes) results.push(await analyzeTheme(theme));

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  scope: {
    syntaxPreservationIsNotVisualSupport: true,
    officialValidationRequested: officialRequested,
    roots: roots.map(root => root.includes('private-themes') ? 'tests/private-themes' :
      root.includes('public-themes') ? 'tests/public-themes' : '<configured-local-directory>')
  },
  summary: {
    themes: results.length,
    publicThemes: results.filter(theme => theme.sourceClass === 'public-authored').length,
    privateThemes: results.filter(theme => theme.sourceClass === 'private-local').length,
    exactRoundTrips: results.filter(theme => theme.preservation.exactRoundTrip).length,
    manifestMatches: results.filter(theme => theme.packageExport.manifestMatches).length,
    officialAccepted: results.filter(theme => theme.official.status === 'accepted').length,
    officialRejected: results.filter(theme => theme.official.status === 'rejected').length
  },
  themes: results
};

const reportDir = resolve(projectRoot, 'reports/themes');
mkdirSync(reportDir, { recursive: true });
writeFileSync(join(reportDir, 'latest.json'), `${JSON.stringify(report, null, 2)}\n`);
const markdown = [
  '# Theme Compatibility Report',
  '',
  `Generated: ${report.generatedAt}`,
  '',
  '> Exact preservation and package fidelity are independent from semantic, rendering, editing, and official-parser support.',
  '',
  '| Theme | Class | Target | Source files | Exact round trip | Manifest | Diagnostics | Unknown tags | Official | Unsupported render tags |',
  '| --- | --- | --- | ---: | --- | --- | ---: | ---: | --- | ---: |',
  ...results.map(theme =>
    `| ${theme.name.replaceAll('|', '\\|')} | ${theme.sourceClass} | ${theme.target} | ${theme.sourceFilesFound.length} | ${theme.preservation.exactRoundTrip ? 'PASS' : 'FAIL'} | ${theme.packageExport.manifestMatches ? 'PASS' : 'FAIL'} | ${theme.parsing.diagnostics.length} | ${theme.parsing.unknownTags.length} | ${theme.official.status} | ${theme.support.unsupportedRenderTags.length} |`
  ),
  '',
  '## Failure links',
  '',
  ...results.flatMap(theme => {
    const shown = theme.parsing.diagnostics.slice(0, 20);
    const hidden = theme.parsing.diagnostics.length - shown.length;
    return [
      ...shown.map(diagnostic =>
        `- **${theme.name}** — \`${diagnostic.source}\` — \`${diagnostic.code}\`: ${diagnostic.message}`
      ),
      ...(hidden > 0 ? [`- **${theme.name}** — ${hidden} additional diagnostics are retained in \`latest.json\`.`] : [])
    ];
  }),
  ...(results.every(theme => theme.parsing.diagnostics.length === 0) ? ['- None.'] : []),
  ''
].join('\n');
writeFileSync(join(reportDir, 'latest.md'), markdown);
process.stdout.write(
  `Theme compatibility report: ${results.length} themes, ` +
  `${report.summary.exactRoundTrips} exact round trips, ` +
  `${report.summary.manifestMatches} manifest matches.\n` +
  `Report: ${join(reportDir, 'latest.md')}\n`
);

if (results.some(theme =>
  !theme.preservation.exactRoundTrip ||
  !theme.packageExport.manifestMatches ||
  theme.official.status === 'unavailable'
)) process.exitCode = 1;
