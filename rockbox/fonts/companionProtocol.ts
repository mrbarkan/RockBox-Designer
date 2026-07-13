import type { RockboxFontMetrics } from '../../types';

export const FONT_COMPANION_PROTOCOL_VERSION = 1;
export const FONT_COMPANION_DEFAULT_URL = 'http://127.0.0.1:43821';
export const FONT_COMPANION_SERVICE = 'rockbox-designer-font-helper';
export const FONT_COMPANION_HEADER = 'x-rockbox-designer-protocol';
export const MAX_FONT_INPUT_BYTES = 24 * 1024 * 1024;

export type FontCompanionHealth = {
  ok: true;
  service: typeof FONT_COMPANION_SERVICE;
  protocolVersion: typeof FONT_COMPANION_PROTOCOL_VERSION;
  upstreamCommit: string;
  sourceConfigured: boolean;
  autoProvision: boolean;
};

export type FontConversionRequest = {
  filename: string;
  bytesBase64: string;
  pixelSize: number;
  startCharacter: number;
  limitCharacter: number;
};

export type FontConversionResponse = {
  ok: true;
  filename: string;
  bytesBase64: string;
  metrics: RockboxFontMetrics;
  upstreamCommit: string;
  inputSha256: string;
  outputSha256: string;
  licensingWarning: string;
};

export type FontCompanionErrorResponse = {
  ok: false;
  code: string;
  message: string;
};
