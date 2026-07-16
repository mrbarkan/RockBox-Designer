import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { DEFAULT_PROJECT } from '../../constants';
import {
  getComponentAvailability,
  insertRockboxComponent,
  ROCKBOX_COMPONENT_CATALOG
} from '../../rockbox/components';
import { deviceProfiles } from '../../rockbox/devices';
import { serializeRockbox } from '../../rockbox/syntax';
import type { ProjectState } from '../../types';
import { buildCheckWps } from '../official/build-checkwps';

const sourceDir = process.env.ROCKBOX_SOURCE_DIR;
if (!sourceDir) throw new Error('ROCKBOX_SOURCE_DIR is required for Phase 6 component validation.');
const registry = JSON.parse(readFileSync(resolve('rockbox/registry/generated/rockbox-tags.json'), 'utf8'));
const commit = execFileSync('git', ['-C', resolve(sourceDir), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (commit !== registry.upstream.commit) {
  throw new Error(`Rockbox checkout SHA ${commit} does not match ${registry.upstream.commit}.`);
}

const catalogPath = resolve('rockbox/components/catalog.ts');
const catalogSha256 = createHash('sha256').update(readFileSync(catalogPath)).digest('hex');
const implementationPaths = [
  'rockbox/components/catalog.ts',
  'rockbox/components/engine.ts',
  'rockbox/components/types.ts'
];
const builds = new Map<string, ReturnType<typeof buildCheckWps>>();
const temporaryRoot = mkdtempSync(join(tmpdir(), 'rockbox-phase6-components-'));
const fixtures: Array<{
  definitionId: string;
  definitionVersion: number;
  target: string;
  screen: string;
  sourceSha256: string;
  assets: Array<{ path: string; sha256: string; bytes: number }>;
  accepted: boolean;
  exitCode: number | null;
  output: string;
}> = [];

try {
  for (const profile of deviceProfiles) {
    let build = builds.get(profile.rockboxTarget);
    if (!build) {
      build = buildCheckWps({
        sourceDir,
        target: profile.rockboxTarget,
        buildRoot: process.env.ROCKBOX_OFFICIAL_BUILD_DIR
      });
      builds.set(profile.rockboxTarget, build);
    }

    for (const definition of ROCKBOX_COMPONENT_CATALOG) {
      for (const screen of definition.supportedScreens) {
        if (!getComponentAvailability(definition, screen, profile).available) continue;
        const project: ProjectState = {
          ...DEFAULT_PROJECT,
          settings: { ...DEFAULT_PROJECT.settings, target: profile.id as ProjectState['settings']['target'] },
          elements: [],
          assets: {},
          selectedElementIds: []
        };
        const inserted = await insertRockboxComponent({
          project,
          definitionId: definition.id,
          screen,
          profile,
          fallbackSource: '',
          properties: {}
        });
        if (!inserted.ok) {
          throw new Error(`${definition.id}/${profile.rockboxTarget}/${screen}: ${inserted.conflicts.join(' ')}`);
        }
        const fixtureRoot = join(temporaryRoot, `${profile.rockboxTarget}-${definition.id}-${screen}`);
        const screenPath = join(fixtureRoot, `.rockbox/wps/modern_dark.${screen}`);
        mkdirSync(dirname(screenPath), { recursive: true });
        const document = screen === 'wps'
          ? inserted.project.wpsDocument
          : screen === 'sbs'
            ? inserted.project.sbsDocument
            : inserted.project.fmsDocument;
        const source = serializeRockbox(document!);
        writeFileSync(screenPath, source);
        for (const asset of inserted.project.componentAssets ?? []) {
          const assetPath = join(fixtureRoot, asset.archivePath);
          mkdirSync(dirname(assetPath), { recursive: true });
          writeFileSync(assetPath, asset.bytes);
        }

        const execution = spawnSync(build.binaryPath, [screenPath], {
          cwd: fixtureRoot,
          encoding: 'utf8'
        });
        const output = `${execution.stdout ?? ''}${execution.stderr ?? ''}`
          .replaceAll(screenPath, '<screen-file>')
          .replaceAll(fixtureRoot, '<fixture-root>')
          .replaceAll(resolve(sourceDir), '<ROCKBOX_SOURCE_DIR>')
          .replaceAll(build.buildDir, '<OFFICIAL_BUILD_DIR>')
          .trim();
        fixtures.push({
          definitionId: definition.id,
          definitionVersion: definition.version,
          target: profile.rockboxTarget,
          screen,
          sourceSha256: createHash('sha256').update(source).digest('hex'),
          assets: (inserted.project.componentAssets ?? []).map(asset => ({
            path: asset.archivePath,
            sha256: asset.hash,
            bytes: asset.bytes.length
          })),
          accepted: !execution.error && execution.status === 0,
          exitCode: execution.status,
          output
        });
      }
    }
  }

  const rejected = fixtures.filter(fixture => !fixture.accepted);
  const coveredDefinitionIds = new Set(fixtures.map(fixture => fixture.definitionId));
  const targetGated = ROCKBOX_COMPONENT_CATALOG
    .filter(definition => !coveredDefinitionIds.has(definition.id))
    .map(definition => ({
      definitionId: definition.id,
      reasons: Array.from(new Set(deviceProfiles.flatMap(profile =>
        definition.supportedScreens.flatMap(screen =>
          getComponentAvailability(definition, screen, profile).conflicts
        )
      )))
    }));
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    upstream: {
      repository: registry.upstream.repository,
      commit
    },
    harness: {
      tool: 'tools/checkwps',
      targets: [...builds.keys()].sort(),
      binaryBundled: false
    },
    catalog: {
      path: 'rockbox/components/catalog.ts',
      sha256: catalogSha256,
      definitions: ROCKBOX_COMPONENT_CATALOG.length
    },
    implementation: implementationPaths.map(path => ({
      path,
      sha256: createHash('sha256').update(readFileSync(resolve(path))).digest('hex')
    })),
    summary: {
      fixtures: fixtures.length,
      accepted: fixtures.length - rejected.length,
      rejected: rejected.length,
      targetGatedDefinitions: targetGated.length
    },
    fixtures,
    targetGated
  };
  const reportPath = resolve('reports/phase6-components/latest.json');
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(
    `Phase 6 official component validation: ${report.summary.accepted}/${report.summary.fixtures} accepted.\n` +
    `Report: ${reportPath}\n`
  );
  if (rejected.length > 0) {
    process.stderr.write(`${rejected.map(fixture =>
      `${fixture.definitionId}/${fixture.target}/${fixture.screen}: ${fixture.output || `exit ${fixture.exitCode}`}`
    ).join('\n')}\n`);
    process.exitCode = 1;
  }
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
