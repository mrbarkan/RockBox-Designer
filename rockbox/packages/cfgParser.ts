import { detectNewline } from '../syntax';
import { CfgDocument, CfgLine } from './types';

const splitLines = (source: string) => source.match(/[^\r\n]*(?:\r\n|\r|\n)|[^\r\n]+$/g) ?? [];

const separateNewline = (raw: string) => {
  const match = raw.match(/(\r\n|\r|\n)$/);
  const newline = match?.[0] ?? '';
  return { content: newline ? raw.slice(0, -newline.length) : raw, newline };
};

const parseLine = (raw: string): CfgLine => {
  const { content, newline } = separateNewline(raw);
  if (content.trim().length === 0) return { kind: 'blank', raw: content, newline, dirty: false };
  if (content.trimStart().startsWith('#')) return { kind: 'comment', raw: content, newline, dirty: false };
  const colon = content.indexOf(':');
  if (colon < 0) return { kind: 'invalid', raw: content, newline, dirty: false };
  const keyRaw = content.slice(0, colon);
  const valueRaw = content.slice(colon + 1);
  return {
    kind: 'setting',
    raw: content,
    newline,
    dirty: false,
    key: keyRaw.trim(),
    value: valueRaw.trim(),
    keyRaw,
    valueRaw
  };
};

export const parseCfg = (source: string): CfgDocument => ({
  source,
  newline: detectNewline(source),
  lines: splitLines(source).map(parseLine),
  dirty: false
});

export const serializeCfg = (document: CfgDocument) => {
  if (!document.dirty) return document.source;
  return document.lines.map(line => {
    if (!line.dirty || line.kind !== 'setting') return `${line.raw}${line.newline}`;
    return `${line.keyRaw ?? line.key}:${line.valueRaw ?? line.value ?? ''}${line.newline}`;
  }).join('');
};

export const getCfgValues = (document: CfgDocument, key: string) =>
  document.lines
    .filter(line => line.kind === 'setting' && line.key?.toLowerCase() === key.toLowerCase())
    .map(line => line.value ?? '');

const preserveOuterWhitespace = (raw: string, value: string) => {
  const match = raw.match(/^(\s*)([\s\S]*?)(\s*)$/);
  return `${match?.[1] ?? ''}${value}${match?.[3] ?? ''}`;
};

export const updateCfgSetting = (document: CfgDocument, key: string, value: string): CfgDocument => {
  const matches = document.lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.kind === 'setting' && line.key?.toLowerCase() === key.toLowerCase());
  if (matches.length === 0) {
    const needsLeadingNewline = document.lines.length > 0 && document.lines.at(-1)?.newline === '';
    const lines = [...document.lines];
    if (needsLeadingNewline) lines[lines.length - 1] = { ...lines.at(-1)!, newline: document.newline };
    lines.push({
      kind: 'setting',
      raw: `${key}: ${value}`,
      newline: '',
      dirty: true,
      key,
      value,
      keyRaw: key,
      valueRaw: ` ${value}`
    });
    return { ...document, lines, dirty: true };
  }

  const target = matches.at(-1)!.index;
  return {
    ...document,
    dirty: true,
    lines: document.lines.map((line, index) => index === target ? {
      ...line,
      value,
      valueRaw: preserveOuterWhitespace(line.valueRaw ?? '', value),
      dirty: true
    } : line)
  };
};
