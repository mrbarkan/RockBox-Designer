import { readFileSync } from 'node:fs';

const fail = message => { throw new Error(`Phase 4 render report verification failed: ${message}`); };
const report = JSON.parse(readFileSync(new URL('../reports/phase4-render/latest.json', import.meta.url), 'utf8'));
const registry = JSON.parse(readFileSync(new URL('../rockbox/registry/generated/rockbox-tags.json', import.meta.url), 'utf8'));

if (report.schemaVersion !== 1) fail('unsupported schema version.');
if (report.upstream?.commit !== registry.upstream.commit) fail('upstream commit differs from the tag registry.');
if (report.harness?.target !== 'ipodvideo' || report.harness?.sourceBundled || report.harness?.binaryBundled || report.harness?.screenshotsCommitted) fail('external simulator boundary is not recorded.');
if (report.harness?.cleanCapturePasses < 2 || !report.captures?.reproducible) fail('two reproducible clean captures are required.');
if (report.fixture?.width !== 320 || report.fixture?.height !== 240 || report.fixture?.screen !== 'sbs') fail('canonical device/screen geometry differs.');
for (const capture of [report.captures?.browser, report.captures?.official, report.captures?.diff]) {
  if (!/^[0-9a-f]{64}$/.test(capture?.sha256 ?? '')) fail('capture hash is missing.');
}
if (report.captures?.artifactsCommitted) fail('generated screenshots must remain local.');
const comparison = report.comparison;
if (comparison?.totalPixels !== 320 * 240 || comparison.differingPixels <= 0 || comparison.differingPixels >= comparison.totalPixels) fail('pixel totals are not credible.');
if (comparison.classifiedPixels !== comparison.differingPixels || comparison.unclassifiedPixels !== 0) fail('every differing pixel must be classified.');
const classificationIds = new Set((comparison.classifications ?? []).filter(entry => entry.pixels > 0).map(entry => entry.id));
for (const required of ['native-font-and-text-layout', 'selector-style']) if (!classificationIds.has(required)) fail(`missing non-zero ${required} classification.`);
console.log(`Phase 4 render report verified: ${comparison.differingPixels} classified differences from two repeatable captures.`);
