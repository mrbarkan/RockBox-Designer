#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const report = JSON.parse(readFileSync('reports/phase3-font/latest.json', 'utf8'));
const registry = JSON.parse(readFileSync('rockbox/registry/generated/rockbox-tags.json', 'utf8'));
const fail = message => { throw new Error(`Phase 3 font report verification failed: ${message}`); };
if (report.schemaVersion !== 1) fail('schemaVersion must be 1.');
if (report.upstream?.commit !== registry.upstream.commit) fail('upstream SHA differs from the tag registry.');
if (report.tool?.source !== 'tools/convttf.c' || report.tool?.binaryBundled !== false || report.tool?.sourceBundled !== false) {
  fail('convttf must remain an external, unbundled helper.');
}
if (report.tool?.generatedFontCommitted !== false || report.input?.bytesCommitted !== false || report.input?.pathRecorded !== false) {
  fail('input and generated font artifacts must remain private and uncommitted.');
}
if (report.output?.metrics?.format !== 'RB12' || report.output?.bytes <= 36 || !report.output?.sha256 || !report.output?.packageRoundTripVerified) {
  fail('generated RB12 or exact package evidence is incomplete.');
}
if (!report.simulator?.verified || !report.simulator?.loadedName || report.simulator?.fontLoadError) fail('Rockbox simulator did not load the font.');
if (report.simulator.loadedHeight !== report.output.metrics.height ||
    report.simulator.loadedFirstCharacter !== report.output.metrics.firstCharacter ||
    report.simulator.loadedGlyphCount !== report.output.metrics.glyphCount) fail('simulator metrics differ from the generated header.');
process.stdout.write(`Verified Phase 3 native font report at ${report.upstream.commit}.\n`);
