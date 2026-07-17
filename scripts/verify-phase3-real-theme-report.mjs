#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const report = JSON.parse(readFileSync('reports/phase3-real-theme/latest.json', 'utf8'));
const fail = message => { throw new Error(`Phase 3 real-theme report verification failed: ${message}`); };
if (report.schemaVersion !== 1) fail('schemaVersion must be 1.');
if (report.scope?.privateFixtureCommitted !== false || report.scope?.sourceIncluded !== false) {
  fail('private theme files or source must not be committed.');
}
if (report.scope?.preservationIsNotVisualSupport !== true) fail('preservation and visual support must remain separate.');
if (!report.package?.assetsPreserved || report.package?.diagnostics !== 0 || report.package?.screenCount !== 3) {
  fail('the three-screen package did not survive export and re-import.');
}
for (const screen of ['wps', 'sbs', 'fms']) {
  const result = report.screens?.find(candidate => candidate.screen === screen);
  if (!result) fail(`missing ${screen.toUpperCase()}.`);
  if (!result.exactUntouchedRoundTrip || !result.minimumChange || !result.viewportProjectionUpdated ||
      !result.commentsExcludedFromElements || !result.valid || !result.exactAfterExport || !result.pathRetained) {
    fail(`${screen.toUpperCase()} did not pass import, projection, edit, export, and preservation.`);
  }
}
const sbs = report.screens.find(screen => screen.screen === 'sbs');
if (!sbs?.menuPreview || !sbs?.quickScreenPreview || !sbs?.usbSbsPreview) {
  fail('SBS menu, quick-screen, or theme-authored USB preview is missing.');
}
if (JSON.stringify(sbs.usbFallbackViewport) !== JSON.stringify({ x: 0, y: 0, width: 1, height: 1 })) {
  fail('Adwaitapod no longer clips the compiled USB fallback through its 1 x 1 UI viewport.');
}
if (!report.screens.find(screen => screen.screen === 'fms')?.fmStatePreview) fail('FMS state preview is missing.');
process.stdout.write('Verified Phase 3 real-theme WPS/SBS/FMS report.\n');
