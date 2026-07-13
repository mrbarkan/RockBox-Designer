import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { listSyntaxViewports, updateViewport } from '../../rockbox/editing';
import {
  buildPackageFiles,
  exportThemePackage,
  importThemePackage,
  manifestFromFiles
} from '../../rockbox/packages';
import { serializeRockbox } from '../../rockbox/syntax';
import { buildCheckWps } from '../official/build-checkwps';

const sourceDir = process.env.ROCKBOX_SOURCE_DIR;
if (!sourceDir) throw new Error('ROCKBOX_SOURCE_DIR is required for Phase 3 official validation.');
const target = process.env.ROCKBOX_OFFICIAL_TARGET ?? 'ipodvideo';
const registry = JSON.parse(readFileSync(resolve('rockbox/registry/generated/rockbox-tags.json'), 'utf8'));
const commit = execFileSync('git', ['-C', resolve(sourceDir), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (commit !== registry.upstream.commit) {
  throw new Error(`Rockbox checkout SHA ${commit} does not match ${registry.upstream.commit}.`);
}

const theme = await importThemePackage(new Uint8Array(readFileSync('tests/public-themes/authored-full.zip')));
const edits = [];
for (const screen of ['wps', 'sbs', 'fms'] as const) {
  const document = theme.screens[screen];
  if (!document) throw new Error(`Authored Full has no ${screen.toUpperCase()}.`);
  const viewport = listSyntaxViewports(document)[0];
  if (!viewport) throw new Error(`Authored Full ${screen.toUpperCase()} has no editable viewport.`);
  const edit = updateViewport(document, viewport.id, { x: 8, y: 0, width: 312, height: 240 });
  if (!edit.changed) throw new Error(`The Phase 3 ${screen.toUpperCase()} viewport edit did not change source.`);
  theme.screens[screen] = edit.document;
  edits.push({ screen, nodeId: viewport.id, x: { before: viewport.x, after: 8 }, width: { before: viewport.width, after: 312 } });
}

const expectedManifest = await manifestFromFiles(buildPackageFiles(theme));
const reimported = await importThemePackage(await exportThemePackage(theme));
const manifestMatches = JSON.stringify(reimported.manifest.files) === JSON.stringify(expectedManifest.files);
const exactAfterExport = ['wps', 'sbs', 'fms'].every(screen =>
  serializeRockbox(reimported.screens[screen as 'wps' | 'sbs' | 'fms']!) ===
  serializeRockbox(theme.screens[screen as 'wps' | 'sbs' | 'fms']!)
);
const build = buildCheckWps({ sourceDir, target, buildRoot: process.env.ROCKBOX_OFFICIAL_BUILD_DIR });
const directory = mkdtempSync(join(tmpdir(), 'rockbox-phase3-official-'));

try {
  for (const [path, bytes] of buildPackageFiles(reimported)) {
    const output = join(directory, path);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, bytes);
  }
  const official = [];
  for (const screen of ['wps', 'sbs', 'fms'] as const) {
    const screenPath = join(directory, reimported.screenPaths[screen]!);
    const execution = spawnSync(build.binaryPath, [screenPath], { cwd: directory, encoding: 'utf8' });
    const output = `${execution.stdout ?? ''}${execution.stderr ?? ''}`
      .replaceAll(screenPath, '<screen-file>')
      .replaceAll(directory, '<theme-root>')
      .replaceAll(resolve(sourceDir), '<ROCKBOX_SOURCE_DIR>')
      .replaceAll(build.buildDir, '<OFFICIAL_BUILD_DIR>')
      .trim();
    official.push({
      screen,
      executed: !execution.error,
      accepted: !execution.error && execution.status === 0,
      exitCode: execution.status,
      output
    });
  }
  const editedSource = ['wps', 'sbs', 'fms']
    .map(screen => serializeRockbox(reimported.screens[screen as 'wps' | 'sbs' | 'fms']!))
    .join('\n--screen--\n');
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    upstream: { repository: registry.upstream.repository, commit },
    harness: { tool: 'tools/checkwps', target, binaryBundled: false },
    workflow: {
      fixture: 'Authored Full',
      imported: true,
      edits,
      exported: true,
      reimported: true,
      exactAfterExport,
      manifestMatches,
      sourceSha256: createHash('sha256').update(editedSource).digest('hex')
    },
    official
  };
  const reportPath = resolve('reports/phase3-official/latest.json');
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`Phase 3 official screen validation: ${official.filter(screen => screen.accepted).length}/${official.length} accepted.\nReport: ${reportPath}\n`);
  if (!manifestMatches || !exactAfterExport || official.some(screen => !screen.accepted)) {
    throw new Error('Phase 3 official screen acceptance failed. Inspect the generated report.');
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
