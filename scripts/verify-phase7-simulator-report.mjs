import { readFileSync } from 'node:fs';

const fail = message => {
  process.stderr.write(`Phase 7 simulator report verification failed: ${message}\n`);
  process.exit(1);
};
const report = JSON.parse(readFileSync(new URL('../reports/phase7-simulator/latest.json', import.meta.url), 'utf8'));
const expectedCommit = JSON.parse(
  readFileSync(new URL('../rockbox/registry/generated/rockbox-tags.json', import.meta.url), 'utf8')
).upstream.commit;

if (report.schemaVersion !== 1) fail('unsupported schema version.');
if (report.upstream?.commit !== expectedCommit || report.upstream?.target !== 'ipodvideo') {
  fail('upstream target or SHA does not match the generated registry.');
}
if (report.upstream.sourceBundled || report.upstream.binaryBundled || report.upstream.simulatorAssetsBundled) {
  fail('GPL simulator artifacts must remain external.');
}
if (
  report.nativePrototype?.status !== 'passed-external-development-only' ||
  report.nativePrototype?.target !== 'ipodvideo' ||
  report.nativePrototype?.binary?.bytes <= 0 ||
  !/^[a-f0-9]{64}$/.test(report.nativePrototype?.binary?.sha256 ?? '')
) {
  fail('native target evidence is incomplete.');
}
if (
  !report.officialCaptureEvidence?.reproducible ||
  report.officialCaptureEvidence?.cleanCapturePasses < 2 ||
  report.officialCaptureEvidence?.screenshotPathCommitted
) {
  fail('official generated-theme capture evidence is incomplete.');
}
const expectedStages = new Map([
  [1, 'passed-external-development-only'],
  [2, 'passed'],
  [3, 'passed'],
  [4, 'blocked-by-decision'],
  [5, 'blocked-by-stage-4'],
  [6, 'deferred']
]);
for (const [stage, status] of expectedStages) {
  if (report.prototypeStages?.find(entry => entry.stage === stage)?.status !== status) {
    fail(`prototype stage ${stage} does not record ${status}.`);
  }
}
const requiredConstraints = [
  'license-distribution',
  'target-build-generation',
  'threads-and-main-loop',
  'dynamic-code',
  'filesystem-and-persistence',
  'audio-and-timing',
  'bundle-performance-maintenance'
];
for (const id of requiredConstraints) {
  const constraint = report.browserPortConstraints?.find(entry => entry.id === id);
  if (!constraint?.status || !constraint?.finding || !constraint?.resolution || !constraint?.sourceEvidence?.length) {
    fail(`missing blocker evidence for ${id}.`);
  }
}
if (
  report.productBoundary?.phase7Acceptance !== 'passed-with-documented-blockers' ||
  report.productBoundary?.levelC !== 'not-shipped' ||
  !report.productBoundary?.editorIndependent ||
  report.productBoundary?.browserClientChanged ||
  report.productBoundary?.browserBundleDeltaBytes !== 0
) {
  fail('product independence or Level C boundary is missing.');
}
const serialized = JSON.stringify(report);
if (/\/Users\/|\/private\/tmp\/|\/tmp\//.test(serialized)) fail('report contains a local absolute path.');
process.stdout.write('Phase 7 simulator feasibility report verified.\n');
