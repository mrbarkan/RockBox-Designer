import { readFileSync } from 'node:fs';

const fail = message => { throw new Error(`Phase 4 compatibility report verification failed: ${message}`); };
const report = JSON.parse(readFileSync(new URL('../reports/phase4-compatibility/latest.json', import.meta.url), 'utf8'));
const registry = JSON.parse(readFileSync(new URL('../rockbox/registry/generated/rockbox-tags.json', import.meta.url), 'utf8'));
const profiles = JSON.parse(readFileSync(new URL('../rockbox/devices/profiles/device-profiles.json', import.meta.url), 'utf8')).profiles;

if (report.schemaVersion !== 1 || report.upstream?.commit !== registry.upstream.commit) fail('schema or upstream commit mismatch.');
if (report.supportCatalog?.registryTags !== registry.tags.length || !report.supportCatalog?.preservationIsNotSemanticSupport) fail('support catalog boundary is missing.');
if (report.rows?.length !== registry.tags.length * profiles.length) fail('tag/device row count is incomplete.');
const keys = new Set(report.rows.map(row => `${row.deviceId}:${row.tag}`));
for (const profile of profiles) for (const tag of registry.tags) if (!keys.has(`${profile.id}:${tag.name}`)) fail(`missing ${profile.id} %${tag.name}.`);
for (const profile of profiles) {
  const summary = report.summaryByDevice?.[profile.id];
  const rows = report.rows.filter(row => row.deviceId === profile.id);
  if (!summary || summary.tags !== registry.tags.length || summary.preserved !== registry.tags.length || summary.parsed !== registry.tags.length) fail(`invalid ${profile.id} summary.`);
  if (summary.interpreted >= summary.tags || summary.rendered >= summary.tags || summary.editable >= summary.rendered) fail(`semantic support for ${profile.id} is overclaimed.`);
  if (!rows.some(row => row.officiallyValidated) || !rows.some(row => !row.officiallyValidated)) fail(`official evidence for ${profile.id} is not differentiated.`);
}
const classic = profiles.find(profile => profile.rockboxTarget === 'ipod6g');
if (!classic || !report.rows.some(row => row.deviceId === classic.id && row.category === 'radio-tokens' && !row.availableOnDevice)) fail('Classic tuner limitation is missing.');
for (const profile of profiles.filter(candidate => !candidate.capabilities.touchscreen)) {
  for (const tag of ['T', 'Tl', 'Tp']) {
    if (!report.rows.some(row => row.deviceId === profile.id && row.tag === tag && !row.availableOnDevice)) fail(`${profile.id} touch limitation for %${tag} is missing.`);
  }
}
if (!report.evidence?.renderComparison?.reproducible || report.evidence.renderComparison.unclassifiedPixels !== 0) fail('render comparison evidence is incomplete.');
if (!report.rows.some(row => row.knownVisualDifferences?.length > 0)) fail('known visual differences are not exposed.');
console.log(`Phase 4 compatibility report verified: ${report.rows.length} evidence-backed tag/device rows.`);
