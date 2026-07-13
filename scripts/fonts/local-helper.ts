import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { homedir, tmpdir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  FONT_COMPANION_HEADER,
  FONT_COMPANION_PROTOCOL_VERSION,
  FONT_COMPANION_SERVICE,
  MAX_FONT_INPUT_BYTES,
  parseRb12Font,
  type FontConversionRequest
} from '../../rockbox/fonts';
import type { RockboxFontMetrics } from '../../types';
import { convertWithConvttf, readPinnedRockboxCommit } from './convttf';

const MAX_BODY_BYTES = Math.ceil(MAX_FONT_INPUT_BYTES * 4 / 3) + 16 * 1024;
const OFFICIAL_ROCKBOX_REPOSITORY = 'https://github.com/Rockbox/rockbox.git';
const LICENSING_WARNING = 'Confirm that the input font license allows conversion and redistribution before sharing the generated FNT.';

class HelperError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

type ConversionResult = {
  bytes: Uint8Array;
  metrics: RockboxFontMetrics;
  commit: string;
};

type LocalConversionInput = Omit<FontConversionRequest, 'bytesBase64'> & { bytes: Uint8Array };

export type LocalFontHelperOptions = {
  sourceDir?: string;
  autoProvision?: boolean;
  cacheDir?: string;
  allowedOrigins?: string[];
  convertFont?: (input: LocalConversionInput) => Promise<ConversionResult> | ConversionResult;
};

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

const run = (command: string, args: string[], cwd?: string) => {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', env: process.env, maxBuffer: 32 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed.\n${`${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim()}`);
  }
};

const exactCommit = (directory: string, pinnedCommit: string) => {
  if (!existsSync(resolve(directory, 'tools/convttf.c'))) return false;
  try {
    return execFileSync('git', ['-C', directory, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() === pinnedCommit;
  } catch {
    return false;
  }
};

const defaultCacheDir = () => resolve(
  process.env.ROCKBOX_DESIGNER_CACHE_DIR ??
  join(process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), 'rockbox-designer')
);

const provisionRockboxSource = (directory: string, pinnedCommit: string) => {
  if (exactCommit(directory, pinnedCommit)) return directory;
  mkdirSync(resolve(directory, '..'), { recursive: true });
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
  try {
    run('git', ['init', '--quiet'], directory);
    run('git', ['remote', 'add', 'origin', OFFICIAL_ROCKBOX_REPOSITORY], directory);
    run('git', ['fetch', '--quiet', '--depth', '1', 'origin', pinnedCommit], directory);
    run('git', ['checkout', '--quiet', '--detach', 'FETCH_HEAD'], directory);
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
  if (!exactCommit(directory, pinnedCommit)) throw new Error('Provisioned Rockbox checkout does not match the pinned commit.');
  return directory;
};

const DEFAULT_ALLOWED_ORIGINS = [
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'http://127.0.0.1:4173',
  'http://localhost:4173'
];

const safeFilename = (filename: string) => {
  if (filename !== basename(filename) || !/\.(ttf|otf|ttc)$/i.test(filename)) {
    throw new HelperError(400, 'invalid_filename', 'Input must be a TTF, OTF, or TTC file with no path components.');
  }
  return filename;
};

const validateRequest = (payload: unknown): LocalConversionInput => {
  if (!payload || typeof payload !== 'object') throw new HelperError(400, 'invalid_request', 'Conversion request must be a JSON object.');
  const request = payload as Partial<FontConversionRequest>;
  const filename = safeFilename(String(request.filename ?? ''));
  if (typeof request.bytesBase64 !== 'string') throw new HelperError(400, 'invalid_font', 'Font bytes are required.');
  const bytes = new Uint8Array(Buffer.from(request.bytesBase64, 'base64'));
  if (bytes.length === 0 || bytes.length > MAX_FONT_INPUT_BYTES) throw new HelperError(413, 'font_size', 'Font input must be between 1 byte and 24 MB.');
  const pixelSize = Number(request.pixelSize);
  const startCharacter = Number(request.startCharacter);
  const limitCharacter = Number(request.limitCharacter);
  if (!Number.isInteger(pixelSize) || pixelSize < 4 || pixelSize > 200) throw new HelperError(400, 'pixel_size', 'Pixel size must be an integer from 4 to 200.');
  if (!Number.isInteger(startCharacter) || !Number.isInteger(limitCharacter) || startCharacter < 0 || limitCharacter > 0x10ffff || startCharacter > limitCharacter) {
    throw new HelperError(400, 'glyph_range', 'Glyph range must be a valid ascending Unicode code-point range.');
  }
  return { filename, bytes, pixelSize, startCharacter, limitCharacter };
};

const readBody = async (request: IncomingMessage) => {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new HelperError(413, 'request_size', 'Font helper request is too large.');
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new HelperError(400, 'invalid_json', 'Font helper request must contain valid JSON.');
  }
};

const writeJson = (response: ServerResponse, status: number, payload: unknown, origin?: string) => {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.setHeader('x-content-type-options', 'nosniff');
  if (origin) {
    response.setHeader('access-control-allow-origin', origin);
    response.setHeader('vary', 'Origin');
  }
  response.end(JSON.stringify(payload));
};

export const createLocalFontHelper = (options: LocalFontHelperOptions = {}) => {
  const pinnedCommit = readPinnedRockboxCommit();
  const autoProvision = options.autoProvision ?? true;
  const configuredSource = options.sourceDir ?? process.env.ROCKBOX_SOURCE_DIR;
  const cachedSource = join(options.cacheDir ?? defaultCacheDir(), 'rockbox', pinnedCommit);
  const allowedOrigins = new Set([...DEFAULT_ALLOWED_ORIGINS, ...(options.allowedOrigins ?? [])]);

  const resolveSource = () => {
    if (configuredSource) {
      if (!exactCommit(configuredSource, pinnedCommit)) throw new Error(`Configured Rockbox source must be checked out at ${pinnedCommit}.`);
      return resolve(configuredSource);
    }
    if (exactCommit(cachedSource, pinnedCommit)) return cachedSource;
    if (!autoProvision) throw new Error('Rockbox source is not configured. Set ROCKBOX_SOURCE_DIR or enable local provisioning.');
    return provisionRockboxSource(cachedSource, pinnedCommit);
  };

  const convertFont = options.convertFont ?? (async (input: LocalConversionInput) => {
    const work = mkdtempSync(join(tmpdir(), 'rockbox-designer-font-'));
    try {
      const inputPath = join(work, input.filename);
      const stem = basename(input.filename, extname(input.filename)).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'font';
      const outputPath = join(work, `${input.pixelSize}-${stem}.fnt`);
      writeFileSync(inputPath, input.bytes);
      const converted = convertWithConvttf({
        sourceDir: resolveSource(),
        input: inputPath,
        output: outputPath,
        pixelSize: input.pixelSize,
        startCharacter: input.startCharacter,
        limitCharacter: input.limitCharacter
      });
      return { bytes: converted.bytes, metrics: converted.metrics, commit: converted.commit };
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });

  return createServer(async (request, response) => {
    const origin = typeof request.headers.origin === 'string' ? request.headers.origin : undefined;
    const originAllowed = !origin || allowedOrigins.has(origin);
    if (!originAllowed) {
      writeJson(response, 403, { ok: false, code: 'origin_forbidden', message: 'This local helper only accepts approved Rockbox Designer origins.' });
      return;
    }
    if (request.method === 'OPTIONS') {
      response.statusCode = 204;
      if (origin) {
        response.setHeader('access-control-allow-origin', origin);
        response.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
        response.setHeader('access-control-allow-headers', `content-type, ${FONT_COMPANION_HEADER}`);
        response.setHeader('vary', 'Origin');
      }
      response.end();
      return;
    }
    if (request.headers[FONT_COMPANION_HEADER] !== String(FONT_COMPANION_PROTOCOL_VERSION)) {
      writeJson(response, 426, { ok: false, code: 'protocol_version', message: 'Rockbox Designer font-helper protocol mismatch.' }, origin);
      return;
    }
    try {
      if (request.method === 'GET' && request.url === '/v1/health') {
        writeJson(response, 200, {
          ok: true,
          service: FONT_COMPANION_SERVICE,
          protocolVersion: FONT_COMPANION_PROTOCOL_VERSION,
          upstreamCommit: pinnedCommit,
          sourceConfigured: Boolean(configuredSource ? exactCommit(configuredSource, pinnedCommit) : exactCommit(cachedSource, pinnedCommit)),
          autoProvision
        }, origin);
        return;
      }
      if (request.method === 'POST' && request.url === '/v1/convert') {
        if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
          throw new HelperError(415, 'content_type', 'Font conversion requires application/json.');
        }
        const input = validateRequest(await readBody(request));
        const converted = await convertFont(input);
        const metrics = parseRb12Font(converted.bytes);
        const stem = basename(input.filename, extname(input.filename)).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'font';
        writeJson(response, 200, {
          ok: true,
          filename: `${input.pixelSize}-${stem}.fnt`,
          bytesBase64: Buffer.from(converted.bytes).toString('base64'),
          metrics,
          upstreamCommit: converted.commit,
          inputSha256: sha256(input.bytes),
          outputSha256: sha256(converted.bytes),
          licensingWarning: LICENSING_WARNING
        }, origin);
        return;
      }
      throw new HelperError(404, 'not_found', 'Unknown local font-helper endpoint.');
    } catch (error) {
      const status = error instanceof HelperError ? error.status : 500;
      const code = error instanceof HelperError ? error.code : 'conversion_failed';
      const message = error instanceof Error ? error.message : 'Font conversion failed.';
      writeJson(response, status, { ok: false, code, message }, origin);
    }
  });
};

const argument = (name: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(argument('--port') ?? process.env.ROCKBOX_FONT_HELPER_PORT ?? 43821);
  const sourceDir = argument('--rockbox-source') ?? process.env.ROCKBOX_SOURCE_DIR;
  const allowedOrigins = process.argv.flatMap((entry, index) => entry === '--allow-origin' && process.argv[index + 1] ? [process.argv[index + 1]] : []);
  const autoProvision = !process.argv.includes('--no-provision');
  const server = createLocalFontHelper({ sourceDir, allowedOrigins, autoProvision });
  server.listen(port, '127.0.0.1', () => {
    process.stdout.write([
      `Rockbox Designer font helper listening at http://127.0.0.1:${port}`,
      `Pinned Rockbox source: ${readPinnedRockboxCommit()}`,
      sourceDir ? `Using configured Rockbox checkout: ${resolve(sourceDir)}` : 'Rockbox source will be fetched into the user cache on first conversion.',
      'Keep this window open while converting fonts. Press Ctrl+C to stop.'
    ].join('\n') + '\n');
  });
}
