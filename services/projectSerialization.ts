import { resolveDeviceProfileId } from '../rockbox/devices';

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

const migrateProjectValues = (value: unknown): unknown => {
  if (value instanceof Uint8Array || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(migrateProjectValues);

  const migrated = Object.fromEntries(
    Object.entries(value).map(([key, current]) => [key, migrateProjectValues(current)])
  ) as Record<string, unknown>;
  const settings = migrated.settings;
  if (settings && typeof settings === 'object' && Array.isArray(migrated.elements)) {
    migrated.settings = {
      ...(settings as Record<string, unknown>),
      target: resolveDeviceProfileId((settings as Record<string, unknown>).target)
    };
  }
  return migrated;
};

export const parseProjectData = <T>(value: string): T => migrateProjectValues(JSON.parse(
  value,
  (_key, current) => current?.__rockboxType === 'Uint8Array' && typeof current.base64 === 'string'
    ? base64ToBytes(current.base64)
    : current
)) as T;
