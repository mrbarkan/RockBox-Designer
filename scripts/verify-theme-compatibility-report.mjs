#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const report = JSON.parse(readFileSync(resolve(projectRoot, 'reports/themes/latest.json'), 'utf8'));
const fail = message => { throw new Error(`Theme report verification failed: ${message}`); };

if (report.schemaVersion !== 1) fail('schemaVersion must be 1.');
if (report.scope?.syntaxPreservationIsNotVisualSupport !== true) {
  fail('report must separate preservation from visual support.');
}
if (!Array.isArray(report.themes) || report.themes.length < 2) fail('at least two themes are required.');
for (const requiredName of ['Authored Basic', 'Authored Full']) {
  if (!report.themes.some(theme => theme.name === requiredName)) fail(`missing public fixture ${requiredName}.`);
}
for (const theme of report.themes) {
  if (!theme.preservation?.exactRoundTrip) fail(`${theme.name} does not round-trip exactly.`);
  if (!theme.packageExport?.manifestMatches || !theme.packageExport?.assetHashesPreserved) {
    fail(`${theme.name} package manifest or asset hashes changed.`);
  }
  if (!Array.isArray(theme.support?.unsupportedRenderTags)) {
    fail(`${theme.name} does not separate visual support evidence.`);
  }
}

process.stdout.write(`Verified compatibility report for ${report.themes.length} themes.\n`);
