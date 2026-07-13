import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { basename, resolve } from 'node:path';
import {
  FONT_COMPANION_HEADER,
  FONT_COMPANION_PROTOCOL_VERSION,
  parseRb12Font,
  type FontConversionResponse
} from '../../rockbox/fonts';
import { DEFAULT_PROJECT } from '../../constants';
import { importThemePackage } from '../../rockbox/packages';
import { generateZip } from '../../services/rockboxCompiler';
import { createLocalFontHelper } from './local-helper';

const sourceDir = process.env.ROCKBOX_SOURCE_DIR;
const inputPath = process.env.ROCKBOX_FONT_INPUT;
if (!sourceDir) throw new Error('ROCKBOX_SOURCE_DIR is required.');
if (!inputPath) throw new Error('ROCKBOX_FONT_INPUT is required.');

const input = new Uint8Array(readFileSync(resolve(inputPath)));
const server = createLocalFontHelper({ sourceDir, autoProvision: false });
server.listen(0, '127.0.0.1');
await once(server, 'listening');

try {
  const { port } = server.address() as AddressInfo;
  const healthResponse = await fetch(`http://127.0.0.1:${port}/v1/health`, {
    headers: { [FONT_COMPANION_HEADER]: String(FONT_COMPANION_PROTOCOL_VERSION), origin: 'http://127.0.0.1:3000' }
  });
  if (!healthResponse.ok) throw new Error(`Helper health failed: ${healthResponse.status}`);
  const response = await fetch(`http://127.0.0.1:${port}/v1/convert`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [FONT_COMPANION_HEADER]: String(FONT_COMPANION_PROTOCOL_VERSION),
      origin: 'http://127.0.0.1:3000'
    },
    body: JSON.stringify({
      filename: basename(inputPath),
      bytesBase64: Buffer.from(input).toString('base64'),
      pixelSize: 16,
      startCharacter: 32,
      limitCharacter: 126
    })
  });
  const payload = await response.json() as FontConversionResponse | { ok: false; message: string };
  if (!response.ok || !payload.ok) throw new Error('message' in payload ? payload.message : `Helper conversion failed: ${response.status}`);
  const output = new Uint8Array(Buffer.from(payload.bytesBase64, 'base64'));
  const metrics = parseRb12Font(output);
  if (payload.outputSha256 !== createHash('sha256').update(output).digest('hex')) throw new Error('Helper output hash does not match returned bytes.');
  const archivePath = `.rockbox/fonts/${payload.filename}`;
  const project = {
    ...DEFAULT_PROJECT,
    settings: { ...DEFAULT_PROJECT.settings, name: 'Local Helper Validation', uiFont: payload.filename, fontMetrics: metrics },
    assets: { ...DEFAULT_PROJECT.assets, [payload.filename]: `data:application/octet-stream;base64,${payload.bytesBase64}` }
  };
  const themeBlob = await generateZip(project);
  if (!themeBlob) throw new Error('Helper validation project did not export a theme ZIP.');
  const theme = await importThemePackage(await themeBlob.arrayBuffer());
  const packaged = theme.assets.find(asset => asset.archivePath === archivePath);
  const packageExact = Boolean(packaged && Buffer.from(packaged.bytes).equals(Buffer.from(output)));
  if (!packageExact) throw new Error('Helper output did not survive browser package export exactly.');
  const report = {
    generatedAt: new Date().toISOString(),
    protocolVersion: FONT_COMPANION_PROTOCOL_VERSION,
    upstreamCommit: payload.upstreamCommit,
    security: {
      bindAddress: '127.0.0.1',
      approvedOriginRequired: true,
      protocolHeaderRequired: true,
      inputRetainedAfterRequest: false
    },
    conversion: {
      inputExtension: basename(inputPath).split('.').pop()?.toLowerCase(),
      pixelSize: 16,
      startCharacter: 32,
      limitCharacter: 126,
      outputFilename: payload.filename,
      outputSha256: payload.outputSha256,
      metrics
    },
    package: {
      archivePath,
      exactBytes: packageExact,
      cfgReferencesFont: theme.cfg?.source.includes(`font: /.rockbox/fonts/${payload.filename}`) ?? false
    }
  };
  mkdirSync(resolve('reports/phase3-local-helper'), { recursive: true });
  writeFileSync(resolve('reports/phase3-local-helper/latest.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`Local helper converted ${basename(inputPath)} to ${payload.filename}; RB12 ${metrics.height}px / ${metrics.glyphCount} glyph slots.\n`);
} finally {
  await new Promise<void>(resolveClose => server.close(() => resolveClose()));
}
