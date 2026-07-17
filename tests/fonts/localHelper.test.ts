import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FONT_COMPANION_HEADER,
  FONT_COMPANION_PROTOCOL_VERSION,
  FONT_COMPANION_SERVICE,
  parseRb12Font
} from '../../rockbox/fonts';
import { createLocalFontHelper } from '../../scripts/fonts/local-helper';
import { rb12Fixture } from './rb12Fixture';

const servers: ReturnType<typeof createLocalFontHelper>[] = [];

const start = async (convertFont = vi.fn(async () => {
  const bytes = rb12Fixture();
  return { bytes, metrics: parseRb12Font(bytes), commit: '078a506dfd0deb18165a3ed80c7fcbdb3afb0d31' };
})) => {
  const server = createLocalFontHelper({ autoProvision: false, convertFont });
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${port}`, convertFont };
};

const protocolHeaders = {
  'content-type': 'application/json',
  [FONT_COMPANION_HEADER]: String(FONT_COMPANION_PROTOCOL_VERSION)
};

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
});

describe('local Rockbox font helper', () => {
  it('reports its pinned protocol without requiring conversion tooling', async () => {
    const { baseUrl } = await start();
    const response = await fetch(`${baseUrl}/v1/health`, { headers: protocolHeaders });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      service: FONT_COMPANION_SERVICE,
      protocolVersion: FONT_COMPANION_PROTOCOL_VERSION,
      sourceConfigured: false,
      autoProvision: false
    });
  });

  it('converts only in-memory font bytes and returns validated RB12 data', async () => {
    const { baseUrl, convertFont } = await start();
    const input = new Uint8Array([0, 1, 2, 3]);
    const response = await fetch(`${baseUrl}/v1/convert`, {
      method: 'POST',
      headers: protocolHeaders,
      body: JSON.stringify({
        filename: 'My Face.ttf',
        bytesBase64: Buffer.from(input).toString('base64'),
        pixelSize: 16,
        startCharacter: 32,
        limitCharacter: 126
      })
    });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      ok: true,
      filename: '16-My-Face.fnt',
      metrics: { format: 'RB12', height: 16, glyphCount: 95 },
      upstreamCommit: '078a506dfd0deb18165a3ed80c7fcbdb3afb0d31'
    });
    expect(new Uint8Array(Buffer.from(payload.bytesBase64, 'base64'))).toEqual(rb12Fixture());
    expect(convertFont).toHaveBeenCalledWith(expect.objectContaining({
      filename: 'My Face.ttf', pixelSize: 16, startCharacter: 32, limitCharacter: 126, bytes: input
    }));
  });

  it('rejects unapproved web origins before conversion', async () => {
    const { baseUrl, convertFont } = await start();
    const response = await fetch(`${baseUrl}/v1/convert`, {
      method: 'POST',
      headers: { ...protocolHeaders, origin: 'https://attacker.example' },
      body: '{}'
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ ok: false, code: 'origin_forbidden' });
    expect(convertFont).not.toHaveBeenCalled();
  });

  it('accepts only the known local app origin unless explicitly configured', async () => {
    const { baseUrl } = await start();
    const approved = await fetch(`${baseUrl}/v1/health`, {
      headers: { ...protocolHeaders, origin: 'http://127.0.0.1:3000' }
    });
    const otherLoopbackPort = await fetch(`${baseUrl}/v1/health`, {
      headers: { ...protocolHeaders, origin: 'http://127.0.0.1:9999' }
    });
    expect(approved.status).toBe(200);
    expect(otherLoopbackPort.status).toBe(403);
  });

  it('requires protocol and safe filename/range inputs', async () => {
    const { baseUrl, convertFont } = await start();
    const missingProtocol = await fetch(`${baseUrl}/v1/health`);
    expect(missingProtocol.status).toBe(426);

    const unsafe = await fetch(`${baseUrl}/v1/convert`, {
      method: 'POST',
      headers: protocolHeaders,
      body: JSON.stringify({
        filename: '../font.ttf', bytesBase64: 'AA==', pixelSize: 16, startCharacter: 126, limitCharacter: 32
      })
    });
    expect(unsafe.status).toBe(400);
    expect(await unsafe.json()).toMatchObject({ ok: false, code: 'invalid_filename' });
    expect(convertFont).not.toHaveBeenCalled();
  });
});
