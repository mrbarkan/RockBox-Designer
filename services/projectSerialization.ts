const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary);
};

const base64ToBytes = (base64: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

export const stringifyProjectData = (value: unknown, space?: number) => JSON.stringify(
  value,
  (_key, current) => current instanceof Uint8Array
    ? { __rockboxType: 'Uint8Array', base64: bytesToBase64(current) }
    : current,
  space
);

export const parseProjectData = <T>(value: string): T => JSON.parse(
  value,
  (_key, current) => current?.__rockboxType === 'Uint8Array' && typeof current.base64 === 'string'
    ? base64ToBytes(current.base64)
    : current
) as T;
