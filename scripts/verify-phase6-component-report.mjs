import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const report = JSON.parse(readFileSync('reports/phase6-components/latest.json', 'utf8'));
const catalogSha256 = createHash('sha256').update(readFileSync(report.catalog.path)).digest('hex');
const expectedCommit = JSON.parse(
  readFileSync('rockbox/registry/generated/rockbox-tags.json', 'utf8')
).upstream.commit;

if (report.schemaVersion !== 1) throw new Error('Unsupported Phase 6 component report schema.');
if (report.upstream.commit !== expectedCommit) throw new Error('Phase 6 component report uses the wrong Rockbox SHA.');
if (report.harness.binaryBundled !== false) throw new Error('The CheckWPS binary must remain external.');
if (report.catalog.sha256 !== catalogSha256) throw new Error('Phase 6 component catalog changed; regenerate official evidence.');
for (const file of report.implementation) {
  const sha256 = createHash('sha256').update(readFileSync(file.path)).digest('hex');
  if (sha256 !== file.sha256) throw new Error(`Phase 6 component implementation changed at ${file.path}; regenerate official evidence.`);
}
if (report.summary.fixtures !== report.fixtures.length) throw new Error('Phase 6 fixture count is inconsistent.');
if (report.summary.accepted !== report.fixtures.length || report.summary.rejected !== 0) {
  throw new Error('Phase 6 component report contains an official rejection.');
}
const coveredDefinitions = new Set([
  ...report.fixtures.map(fixture => fixture.definitionId),
  ...report.targetGated.map(definition => definition.definitionId)
]);
if (coveredDefinitions.size !== report.catalog.definitions) {
  throw new Error('Phase 6 report does not cover every component definition.');
}
if (report.targetGated.some(definition => definition.reasons.length === 0)) {
  throw new Error('Every target-gated definition must include an explicit reason.');
}
if (!report.harness.targets.includes('ipodvideo') || !report.harness.targets.includes('ipod6g')) {
  throw new Error('Phase 6 report must cover both current Rockbox targets.');
}

process.stdout.write(
  `Phase 6 component report verified: ${report.summary.accepted} target/screen fixtures at ${report.upstream.commit}.\n`
);
