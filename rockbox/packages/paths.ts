export const normalizeArchivePath = (input: string) => {
  const normalized = input.replace(/\\/g, '/').replace(/^\/+/, '');
  const output: string[] = [];
  for (const part of normalized.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (output.length === 0) return null;
      output.pop();
    } else {
      output.push(part);
    }
  }
  return output.join('/');
};

export const archiveBasename = (path: string) => path.split('/').pop() ?? path;

export const archiveDirname = (path: string) => {
  const parts = path.split('/');
  parts.pop();
  return parts.join('/');
};

export const joinArchivePath = (base: string, relative: string) =>
  normalizeArchivePath(`${base}/${relative}`);
