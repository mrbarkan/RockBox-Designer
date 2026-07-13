#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const report = JSON.parse(readFileSync('reports/phase3-official/latest.json', 'utf8'));
const registry = JSON.parse(readFileSync('rockbox/registry/generated/rockbox-tags.json', 'utf8'));
const fail = message => { throw new Error(`Phase 3 official report verification failed: ${message}`); };
if (report.schemaVersion !== 1) fail('schemaVersion must be 1.');
if (report.upstream?.commit !== registry.upstream.commit) fail('upstream SHA differs from the tag registry.');
if (report.harness?.tool !== 'tools/checkwps' || report.harness?.binaryBundled !== false) {
  fail('CheckWPS must remain an external, unbundled harness.');
}
if (!report.workflow?.imported || !report.workflow?.exported || !report.workflow?.reimported) {
  fail('the import/edit/export/re-import workflow is incomplete.');
}
if (report.workflow?.edits?.length !== 3 || !report.workflow?.exactAfterExport || !report.workflow?.manifestMatches) {
  fail('three-screen source or package fidelity failed.');
}
for (const screen of ['wps', 'sbs', 'fms']) {
  const result = report.official?.find(candidate => candidate.screen === screen);
  if (!result?.executed || !result?.accepted) fail(`${screen.toUpperCase()} was not accepted by CheckWPS.`);
}
process.stdout.write(`Verified Phase 3 official WPS/SBS/FMS report at ${report.upstream.commit}.\n`);
