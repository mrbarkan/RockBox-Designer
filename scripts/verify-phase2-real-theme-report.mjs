#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const report = JSON.parse(readFileSync('reports/phase2-real-theme/latest.json', 'utf8'));
const fail = message => { throw new Error(`Phase 2 real-theme report verification failed: ${message}`); };
if (report.schemaVersion !== 1) fail('schemaVersion must be 1.');
if (report.scope?.privateFixturesCommitted !== false || report.scope?.sourceIncluded !== false) {
  fail('private theme files or source must not be committed.');
}
if (report.scope?.preservationIsNotVisualSupport !== true) fail('preservation and visual support must remain separate.');
for (const name of ['AMusicPod', 'Adwaitapod']) {
  const theme = report.themes?.find(candidate => candidate.name === name);
  if (!theme) fail(`missing ${name}.`);
  if (!theme.semanticProjectionUpdated || !theme.minimumChange || !theme.exactAfterExport || !theme.assetsPreserved) {
    fail(`${name} did not pass the visual edit/export preservation workflow.`);
  }
  if (theme.packageDiagnostics !== 0) fail(`${name} has package diagnostics.`);
}
process.stdout.write(`Verified Phase 2 real-theme edit report for ${report.themes.length} themes.\n`);
