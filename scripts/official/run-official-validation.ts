import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRockbox, serializeRockbox } from '../../rockbox/syntax';
import { classifyParserComparison } from '../../rockbox/validation';
import { buildCheckWps } from './build-checkwps';

type Fixture = {
  id: string;
  screen: 'wps' | 'sbs' | 'fms';
  source: string;
  targetDependent?: boolean;
};

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sourceDir = process.env.ROCKBOX_SOURCE_DIR;
if (!sourceDir) {
  if (process.env.ROCKBOX_OFFICIAL_SKIP === '1') {
    process.stdout.write('Official Rockbox parser validation skipped explicitly.\n');
    process.exit(0);
  }
  throw new Error(
    'ROCKBOX_SOURCE_DIR is required. Set it to a local Rockbox checkout, or set ROCKBOX_OFFICIAL_SKIP=1 to skip explicitly.'
  );
}

const target = process.env.ROCKBOX_OFFICIAL_TARGET ?? 'ipodvideo';
const registry = JSON.parse(readFileSync(
  resolve(projectRoot, 'rockbox/registry/generated/rockbox-tags.json'),
  'utf8'
));
const checkoutCommit = execFileSync('git', ['-C', resolve(sourceDir), 'rev-parse', 'HEAD'], {
  encoding: 'utf8'
}).trim();
if (checkoutCommit !== registry.upstream.commit) {
  throw new Error(
    `Rockbox checkout SHA ${checkoutCommit} does not match the documented registry SHA ${registry.upstream.commit}.`
  );
}

const providedBinary = process.env.ROCKBOX_CHECKWPS_BIN;
const build = providedBinary
  ? { binaryPath: resolve(providedBinary), buildDir: dirname(resolve(providedBinary)), commit: checkoutCommit, reused: true }
  : buildCheckWps({ sourceDir, target, buildRoot: process.env.ROCKBOX_OFFICIAL_BUILD_DIR });
const fixtures = JSON.parse(readFileSync(
  resolve(projectRoot, 'tests/fixtures/official/parser-fixtures.json'),
  'utf8'
)) as Fixture[];
const fixtureDir = mkdtempSync(join(tmpdir(), 'rockbox-designer-fixtures-'));

const normalizeOutput = (value: string, fixturePath: string) => value
  .replaceAll(fixturePath, '<fixture>')
  .replaceAll(resolve(sourceDir), '<ROCKBOX_SOURCE_DIR>')
  .replaceAll(build.buildDir, '<OFFICIAL_BUILD_DIR>')
  .trim();

try {
  const results = fixtures.map(fixture => {
    const fixturePath = join(fixtureDir, `${fixture.id}.${fixture.screen}`);
    writeFileSync(fixturePath, fixture.source);
    const browserDocument = parseRockbox(fixture.source);
    const browser = {
      preserved: serializeRockbox(browserDocument) === fixture.source,
      accepted: !browserDocument.diagnostics.some(diagnostic => diagnostic.severity === 'error'),
      diagnostics: browserDocument.diagnostics.map(({ severity, code, message }) => ({
        severity,
        code,
        message
      }))
    };

    const execution = spawnSync(build.binaryPath, [fixturePath], {
      cwd: fixtureDir,
      encoding: 'utf8'
    });
    const official = {
      executed: !execution.error,
      accepted: !execution.error && execution.status === 0,
      exitCode: execution.status,
      stdout: normalizeOutput(execution.stdout ?? '', fixturePath),
      stderr: normalizeOutput(execution.stderr ?? '', fixturePath)
    };
    const category = classifyParserComparison({
      browser,
      official,
      targetDependent: fixture.targetDependent
    });

    return {
      id: fixture.id,
      screen: fixture.screen,
      targetDependent: fixture.targetDependent ?? false,
      sourceSha256: createHash('sha256').update(fixture.source).digest('hex'),
      category,
      browser,
      official
    };
  });

  const counts = Object.fromEntries(
    [...new Set(results.map(result => result.category))]
      .sort()
      .map(category => [category, results.filter(result => result.category === category).length])
  );
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    upstream: {
      repository: registry.upstream.repository,
      commit: checkoutCommit
    },
    harness: {
      tool: 'tools/checkwps',
      target,
      binaryBundled: false,
      buildReused: build.reused
    },
    summary: {
      fixtures: results.length,
      categories: counts
    },
    fixtures: results
  };
  const reportPath = resolve(
    process.env.ROCKBOX_OFFICIAL_REPORT ??
    join(projectRoot, 'reports/official-parser/latest.json')
  );
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(
    `Official parser comparison completed for ${results.length} fixtures at ${checkoutCommit}.\n` +
    `Report: ${reportPath}\n` +
    `Categories: ${JSON.stringify(counts)}\n`
  );

  if (results.some(result =>
    result.category === 'browser-preservation-failure' ||
    result.category === 'official-parser-unavailable'
  )) {
    process.exitCode = 1;
  }
} finally {
  rmSync(fixtureDir, { recursive: true, force: true });
}
