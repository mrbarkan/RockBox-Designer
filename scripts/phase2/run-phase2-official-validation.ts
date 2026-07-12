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

const projectRoot = resolve('.');
const sourceDir = process.env.ROCKBOX_SOURCE_DIR;
if (!sourceDir) throw new Error('ROCKBOX_SOURCE_DIR is required for Phase 2 official validation.');
const target = process.env.ROCKBOX_OFFICIAL_TARGET ?? 'ipodvideo';
const registry = JSON.parse(readFileSync(resolve('rockbox/registry/generated/rockbox-tags.json'), 'utf8'));
const commit = execFileSync('git', ['-C', resolve(sourceDir), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (commit !== registry.upstream.commit) {
  throw new Error(`Rockbox checkout SHA ${commit} does not match ${registry.upstream.commit}.`);
}

const theme = await importThemePackage(new Uint8Array(readFileSync('tests/public-themes/authored-full.zip')));
const document = theme.screens.wps;
if (!document) throw new Error('Authored Full has no WPS.');
const viewport = listSyntaxViewports(document)[0];
if (!viewport) throw new Error('Authored Full has no editable viewport.');
const edit = updateViewport(document, viewport.id, { x: 8, y: 0, width: 312, height: 240 });
if (!edit.changed) throw new Error('The Phase 2 viewport edit did not change source.');
theme.screens.wps = edit.document;

const expectedManifest = await manifestFromFiles(buildPackageFiles(theme));
const reimported = await importThemePackage(await exportThemePackage(theme));
const manifestMatches = JSON.stringify(reimported.manifest.files) === JSON.stringify(expectedManifest.files);
const editedSource = serializeRockbox(reimported.screens.wps!);
const exactAfterExport = editedSource === serializeRockbox(edit.document);
const build = buildCheckWps({ sourceDir, target, buildRoot: process.env.ROCKBOX_OFFICIAL_BUILD_DIR });
const directory = mkdtempSync(join(tmpdir(), 'rockbox-phase2-official-'));

try {
  for (const [path, bytes] of buildPackageFiles(reimported)) {
    const output = join(directory, path);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, bytes);
  }
  const screenPath = join(directory, reimported.screenPaths.wps!);
  const execution = spawnSync(build.binaryPath, [screenPath], { cwd: directory, encoding: 'utf8' });
  const output = `${execution.stdout ?? ''}${execution.stderr ?? ''}`
    .replaceAll(screenPath, '<screen-file>')
    .replaceAll(directory, '<theme-root>')
    .replaceAll(resolve(sourceDir), '<ROCKBOX_SOURCE_DIR>')
    .replaceAll(build.buildDir, '<OFFICIAL_BUILD_DIR>')
    .trim();
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    upstream: { repository: registry.upstream.repository, commit },
    harness: { tool: 'tools/checkwps', target, binaryBundled: false },
    workflow: {
      fixture: 'Authored Full',
      imported: true,
      edit: {
        nodeId: viewport.id,
        properties: {
          x: { before: 0, after: 8 },
          width: { before: 320, after: 312 }
        }
      },
      exported: true,
      reimported: true,
      exactAfterExport,
      manifestMatches,
      sourceSha256: createHash('sha256').update(editedSource).digest('hex')
    },
    official: {
      executed: !execution.error,
      accepted: !execution.error && execution.status === 0,
      exitCode: execution.status,
      output
    }
  };
  const reportPath = resolve('reports/phase2-official/latest.json');
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`Phase 2 official edit/export validation: ${report.official.accepted ? 'accepted' : 'rejected'}.\nReport: ${reportPath}\n`);
  if (!manifestMatches || !exactAfterExport || !report.official.accepted) process.exitCode = 1;
} finally {
  rmSync(directory, { recursive: true, force: true });
}
