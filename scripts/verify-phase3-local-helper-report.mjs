import { readFileSync } from 'node:fs';

const report = JSON.parse(readFileSync(new URL('../reports/phase3-local-helper/latest.json', import.meta.url), 'utf8'));
const fail = message => { throw new Error(`Phase 3 local-helper report: ${message}`); };

if (report.protocolVersion !== 1) fail('unexpected protocol version');
if (!/^[0-9a-f]{40}$/.test(report.upstreamCommit)) fail('missing pinned upstream commit');
if (report.security?.bindAddress !== '127.0.0.1') fail('helper is not loopback-bound');
if (!report.security?.approvedOriginRequired || !report.security?.protocolHeaderRequired) fail('security handshake evidence is incomplete');
if (report.security?.inputRetainedAfterRequest !== false) fail('input retention boundary is unclear');
if (report.conversion?.metrics?.format !== 'RB12' || report.conversion.metrics.height <= 0 || report.conversion.metrics.glyphCount <= 0) fail('validated RB12 metrics are missing');
if (!/^[0-9a-f]{64}$/.test(report.conversion?.outputSha256 ?? '')) fail('output hash is missing');
if (!report.package?.exactBytes || !report.package?.cfgReferencesFont || !String(report.package?.archivePath).startsWith('.rockbox/fonts/')) fail('exact package integration evidence is missing');

process.stdout.write(`Phase 3 local-helper report verified: ${report.conversion.outputFilename} · ${report.conversion.metrics.height}px · ${report.conversion.metrics.glyphCount} glyphs.\n`);
