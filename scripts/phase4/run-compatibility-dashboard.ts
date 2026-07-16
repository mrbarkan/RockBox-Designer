import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { deviceProfiles } from '../../rockbox/devices';
import { rockboxTagRegistry } from '../../rockbox/registry';
import { semanticTagSupport } from '../../rockbox/semantics/interpreter';
import { parseRockbox, type RockboxNode } from '../../rockbox/syntax';
import { buildPackageFiles, importThemePackage } from '../../rockbox/packages';
import { PHASE4_REFERENCE_SOURCE } from '../../tests/fixtures/phase4/reference';
import { buildCheckWps } from '../official/build-checkwps';

const sourceDir = process.env.ROCKBOX_SOURCE_DIR;
if (!sourceDir) throw new Error('ROCKBOX_SOURCE_DIR is required for the Phase 4 compatibility dashboard.');
const commit = execFileSync('git', ['-C', resolve(sourceDir), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (commit !== rockboxTagRegistry.upstream.commit) {
  throw new Error(`Rockbox checkout SHA ${commit} does not match ${rockboxTagRegistry.upstream.commit}.`);
}

type OfficialFixture = { id: string; screen: 'wps' | 'sbs' | 'fms'; source: string; files?: Map<string, Uint8Array> };
const parserFixtures = JSON.parse(readFileSync(resolve('tests/fixtures/official/parser-fixtures.json'), 'utf8')) as OfficialFixture[];
const authored = await importThemePackage(new Uint8Array(readFileSync(resolve('tests/public-themes/authored-full.zip'))));
const authoredFiles = buildPackageFiles(authored);
const fixtures: OfficialFixture[] = [
  ...parserFixtures,
  ...(['wps', 'sbs', 'fms'] as const).flatMap(screen => authored.screens[screen] && authored.screenPaths[screen]
    ? [{
        id: `authored-full-${screen}`,
        screen,
        source: authored.screens[screen]!.source,
        files: authoredFiles
      }]
    : []),
  { id: 'phase4-authored-sbs-menu', screen: 'sbs', source: PHASE4_REFERENCE_SOURCE }
];

const collectTags = (nodes: RockboxNode[], names = new Set<string>()) => {
  for (const node of nodes) {
    if (node.kind === 'tag') names.add(node.name);
    if (node.kind === 'conditional') {
      if (node.test.kind === 'tag') names.add(node.test.name);
      node.branches.forEach(branch => collectTags(branch.nodes, names));
    }
  }
  return [...names].sort();
};

const buildRoot = process.env.ROCKBOX_PHASE4_CHECKWPS_BUILD_ROOT;
const officialRuns = [];
const validatedByDevice = new Map<string, Map<string, Set<string>>>();
for (const profile of deviceProfiles) {
  const build = buildCheckWps({ sourceDir, target: profile.rockboxTarget, buildRoot });
  const directory = mkdtempSync(join(tmpdir(), `rockbox-phase4-${profile.rockboxTarget}-`));
  const evidence = new Map<string, Set<string>>();
  validatedByDevice.set(profile.id, evidence);
  try {
    for (const fixture of fixtures) {
      const availableOnDevice = profile.supportedScreenFiles.includes(fixture.screen);
      if (!availableOnDevice) {
        officialRuns.push({ deviceId: profile.id, target: profile.rockboxTarget, fixture: fixture.id, screen: fixture.screen, availableOnDevice, executed: false, accepted: false, tags: collectTags(parseRockbox(fixture.source).nodes) });
        continue;
      }
      if (fixture.files) {
        for (const [path, bytes] of fixture.files) {
          const output = resolve(directory, path);
          mkdirSync(dirname(output), { recursive: true });
          writeFileSync(output, bytes);
        }
      }
      const filename = fixture.files && authored.screenPaths[fixture.screen]
        ? resolve(directory, authored.screenPaths[fixture.screen]!)
        : resolve(directory, `${fixture.id}.${fixture.screen}`);
      if (!fixture.files) writeFileSync(filename, fixture.source);
      const execution = spawnSync(build.binaryPath, [filename], { cwd: directory, encoding: 'utf8' });
      const accepted = !execution.error && execution.status === 0;
      const tags = collectTags(parseRockbox(fixture.source).nodes);
      if (accepted) {
        for (const tag of tags) {
          const entries = evidence.get(tag) ?? new Set<string>();
          entries.add(fixture.id);
          evidence.set(tag, entries);
        }
      }
      officialRuns.push({
        deviceId: profile.id,
        target: profile.rockboxTarget,
        fixture: fixture.id,
        screen: fixture.screen,
        availableOnDevice,
        executed: !execution.error,
        accepted,
        exitCode: execution.status,
        tags
      });
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const renderReport = JSON.parse(readFileSync(resolve('reports/phase4-render/latest.json'), 'utf8'));
if (renderReport.upstream?.commit !== commit || !renderReport.captures?.reproducible) {
  throw new Error('The Phase 4 render report is missing, stale, or not reproducible.');
}
const editableTags = semanticTagSupport.editable;
const radioCategories = new Set(['radio-tokens']);
const recordingCategories = new Set(['recording-tokens']);
const touchTags = new Set(['T', 'Tl', 'Tp']);
const visualEvidence = new Map<string, string[]>();
for (const classification of renderReport.comparison.classifications as Array<{ id: string; pixels: number; tags: string[] }>) {
  if (classification.pixels <= 0) continue;
  for (const tag of classification.tags) visualEvidence.set(tag, [...(visualEvidence.get(tag) ?? []), classification.id]);
}
const visualTags = new Set(renderReport.fixture.sourceTags as string[]);

const rows = deviceProfiles.flatMap(profile => rockboxTagRegistry.tags.map(tag => {
  const parserEvidence = [...(validatedByDevice.get(profile.id)?.get(tag.name) ?? [])].sort();
  const visualValidation = profile.id === renderReport.fixture.device && visualTags.has(tag.name);
  const knownVisualDifferences = profile.id === renderReport.fixture.device ? visualEvidence.get(tag.name) ?? [] : [];
  return {
    tag: tag.name,
    token: tag.token,
    category: tag.category,
    deviceId: profile.id,
    target: profile.rockboxTarget,
    availableOnDevice:
      !(radioCategories.has(tag.category) && !profile.capabilities.fmRadio) &&
      !(recordingCategories.has(tag.category) && !profile.capabilities.recording) &&
      !(touchTags.has(tag.name) && !profile.capabilities.touchscreen),
    preserved: true,
    parsed: true,
    interpreted: semanticTagSupport.interpreted.has(tag.name),
    rendered: semanticTagSupport.rendered.has(tag.name),
    editable: editableTags.has(tag.name),
    officiallyValidated: parserEvidence.length > 0 || visualValidation,
    officialEvidence: [
      ...parserEvidence.map(fixture => `checkwps:${fixture}`),
      ...(visualValidation ? ['simulator-pixel:phase4-authored-sbs-menu'] : [])
    ],
    knownVisualDifferences
  };
}));

const summaryByDevice = Object.fromEntries(deviceProfiles.map(profile => {
  const deviceRows = rows.filter(row => row.deviceId === profile.id);
  const count = (field: keyof typeof deviceRows[number]) => deviceRows.filter(row => Boolean(row[field])).length;
  return [profile.id, {
    tags: deviceRows.length,
    available: count('availableOnDevice'),
    preserved: count('preserved'),
    parsed: count('parsed'),
    interpreted: count('interpreted'),
    rendered: count('rendered'),
    editable: count('editable'),
    officiallyValidated: count('officiallyValidated'),
    knownVisualDifference: deviceRows.filter(row => row.knownVisualDifferences.length > 0).length
  }];
}));

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  upstream: { repository: rockboxTagRegistry.upstream.repository, commit },
  supportCatalog: {
    registryTags: rockboxTagRegistry.tags.length,
    interpretedTags: semanticTagSupport.interpreted.size,
    renderedTags: semanticTagSupport.rendered.size,
    editableTags: editableTags.size,
    preservationIsNotSemanticSupport: true
  },
  devices: deviceProfiles.map(profile => ({
    id: profile.id,
    label: profile.model,
    target: profile.rockboxTarget,
    supportedScreenFiles: profile.supportedScreenFiles
  })),
  summaryByDevice,
  evidence: {
    officialRuns,
    renderComparison: {
      fixture: renderReport.fixture.id,
      reproducible: renderReport.captures.reproducible,
      differingPixels: renderReport.comparison.differingPixels,
      unclassifiedPixels: renderReport.comparison.unclassifiedPixels
    }
  },
  rows
};
const reportPath = resolve('reports/phase4-compatibility/latest.json');
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`Phase 4 compatibility dashboard: ${rows.length} tag/device rows across ${deviceProfiles.length} devices.\nReport: ${reportPath}\n`);
if (rows.length !== rockboxTagRegistry.tags.length * deviceProfiles.length ||
    deviceProfiles.some(profile => !officialRuns.some(run => run.deviceId === profile.id && run.accepted)) ||
    renderReport.comparison.unclassifiedPixels !== 0) {
  throw new Error('Phase 4 compatibility dashboard evidence is incomplete.');
}
