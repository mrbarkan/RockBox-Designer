import {
  FONT_COMPANION_DEFAULT_URL,
  FONT_COMPANION_HEADER,
  FONT_COMPANION_PROTOCOL_VERSION,
  FONT_COMPANION_SERVICE,
  MAX_FONT_INPUT_BYTES,
  type FontCompanionErrorResponse,
  type FontCompanionHealth,
  type FontConversionRequest,
  type FontConversionResponse
} from '../rockbox/fonts';

const companionUrl = (baseUrl: string, path: string) => `${baseUrl.replace(/\/$/, '')}${path}`;

const fileToBase64 = (file: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
  reader.onerror = () => reject(reader.error ?? new Error('Unable to read the selected font.'));
  reader.readAsDataURL(file);
});

const base64ToBytes = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

const parseError = async (response: Response) => {
  const fallback = `Font helper request failed (${response.status}).`;
  try {
    const payload = await response.json() as FontCompanionErrorResponse;
    return new Error(payload.message || fallback);
  } catch {
    return new Error(fallback);
  }
};

export const checkFontCompanion = async (
  baseUrl = FONT_COMPANION_DEFAULT_URL,
  timeoutMs = 1500
): Promise<FontCompanionHealth> => {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(companionUrl(baseUrl, '/v1/health'), {
      headers: { [FONT_COMPANION_HEADER]: String(FONT_COMPANION_PROTOCOL_VERSION) },
      cache: 'no-store',
      signal: controller.signal
    });
    if (!response.ok) throw await parseError(response);
    const payload = await response.json() as FontCompanionHealth;
    if (
      payload.service !== FONT_COMPANION_SERVICE ||
      payload.protocolVersion !== FONT_COMPANION_PROTOCOL_VERSION
    ) throw new Error('The running font helper uses an incompatible protocol.');
    return payload;
  } finally {
    globalThis.clearTimeout(timer);
  }
};

export const convertFontWithCompanion = async ({
  file,
  pixelSize,
  startCharacter,
  limitCharacter,
  baseUrl = FONT_COMPANION_DEFAULT_URL
}: {
  file: File;
  pixelSize: number;
  startCharacter: number;
  limitCharacter: number;
  baseUrl?: string;
}) => {
  if (file.size > MAX_FONT_INPUT_BYTES) throw new Error('Font input exceeds the 24 MB local-helper limit.');
  const request: FontConversionRequest = {
    filename: file.name,
    bytesBase64: await fileToBase64(file),
    pixelSize,
    startCharacter,
    limitCharacter
  };
  const response = await fetch(companionUrl(baseUrl, '/v1/convert'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [FONT_COMPANION_HEADER]: String(FONT_COMPANION_PROTOCOL_VERSION)
    },
    body: JSON.stringify(request)
  });
  if (!response.ok) throw await parseError(response);
  const payload = await response.json() as FontConversionResponse;
  return { ...payload, bytes: base64ToBytes(payload.bytesBase64) };
};
