#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const report = JSON.parse(readFileSync('reports/phase2-official/latest.json', 'utf8'));
const registry = JSON.parse(readFileSync('rockbox/registry/generated/rockbox-tags.json', 'utf8'));
const fail = message => { throw new Error(`Phase 2 official report verification failed: ${message}`); };

if (report.schemaVersion !== 1) fail('schemaVersion must be 1.');
if (report.upstream?.commit !== registry.upstream.commit) fail('upstream SHA differs from the tag registry.');
if (report.harness?.tool !== 'tools/checkwps' || report.harness?.binaryBundled !== false) {
  fail('CheckWPS must remain an external, unbundled harness.');
}
if (!report.workflow?.imported || !report.workflow?.exported || !report.workflow?.reimported) {
  fail('the import/edit/export/re-import workflow is incomplete.');
}
if (!report.workflow?.exactAfterExport || !report.workflow?.manifestMatches) {
  fail('source or package fidelity failed.');
}
if (!report.official?.executed || !report.official?.accepted) fail('the exported WPS was not accepted by CheckWPS.');

process.stdout.write(`Verified Phase 2 official edit/export report at ${report.upstream.commit}.\n`);
