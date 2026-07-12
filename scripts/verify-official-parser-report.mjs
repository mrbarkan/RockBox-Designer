#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const report = JSON.parse(readFileSync(
  resolve(projectRoot, 'reports/official-parser/latest.json'),
  'utf8'
));
const registry = JSON.parse(readFileSync(
  resolve(projectRoot, 'rockbox/registry/generated/rockbox-tags.json'),
  'utf8'
));
const fixtures = JSON.parse(readFileSync(
  resolve(projectRoot, 'tests/fixtures/official/parser-fixtures.json'),
  'utf8'
));

const fail = message => {
  throw new Error(`Official parser report verification failed: ${message}`);
};

const categories = new Set([
  'accepted-by-both',
  'browser-preserved-official-rejected',
  'browser-diagnostic-differs',
  'browser-preservation-failure',
  'official-parser-unavailable',
  'target-dependent'
]);

if (report.schemaVersion !== 1) fail('schemaVersion must be 1.');
if (report.upstream?.commit !== registry.upstream.commit) fail('upstream SHA differs from the registry.');
if (report.harness?.tool !== 'tools/checkwps') fail('harness must be tools/checkwps.');
if (report.harness?.binaryBundled !== false) fail('report must state that the binary is not bundled.');
if (!Array.isArray(report.fixtures) || report.fixtures.length !== fixtures.length) {
  fail('fixture count differs from the checked-in corpus.');
}

const resultsById = new Map(report.fixtures.map(result => [result.id, result]));
for (const fixture of fixtures) {
  const result = resultsById.get(fixture.id);
  if (!result) fail(`missing fixture result ${fixture.id}.`);
  const expectedHash = createHash('sha256').update(fixture.source).digest('hex');
  if (result.sourceSha256 !== expectedHash) fail(`${fixture.id} source hash differs.`);
  if (!categories.has(result.category)) fail(`${fixture.id} has unknown category ${result.category}.`);
  if (!result.browser?.preserved) fail(`${fixture.id} did not round-trip in the browser parser.`);
  if (!result.official?.executed) fail(`${fixture.id} did not execute the official parser.`);
}

process.stdout.write(
  `Verified official parser report for ${report.fixtures.length} fixtures at ${report.upstream.commit}.\n`
);
