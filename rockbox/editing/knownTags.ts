import { TagNode } from '../syntax';

export type ArgumentSlot = {
  raw: string;
  leading: string;
  value: string;
  trailing: string;
};

export type KnownTagValue = {
  name: string;
  values: Record<string, string>;
  slots: ArgumentSlot[];
};

export const KNOWN_TAG_SCHEMAS: Record<string, string[]> = {
  V: ['x', 'y', 'width', 'height', 'font'],
  Vl: ['id', 'x', 'y', 'width', 'height', 'font'],
  Vi: ['id', 'x', 'y', 'width', 'height', 'font'],
  Vf: ['color'],
  Vb: ['color'],
  Fl: ['slot', 'font', 'glyphs'],
  x: ['path', 'x', 'y'],
  xl: ['handle', 'path', 'x', 'y', 'count'],
  xd: ['handle', 'index'],
  X: ['path'],
  pb: ['x', 'y', 'width', 'height', 'path'],
  pv: ['x', 'y', 'width', 'height', 'path'],
  pR: ['x', 'y', 'width', 'height', 'path'],
  tr: ['x', 'y', 'width', 'height', 'path'],
  St: ['x', 'y', 'width', 'height', 'path'],
  Cl: ['x', 'y', 'width', 'height', 'horizontalAlign', 'verticalAlign'],
  Cd: [],
  T: ['x', 'y', 'width', 'height', 'action'],
  dr: ['x', 'y', 'width', 'height', 'color', 'outlineColor']
};

export const getKnownTagSchema = (tag: TagNode): string[] | undefined => {
  if (tag.name === 'x' && tag.invocationStyle === 'parentheses') {
    const slots = splitRawArguments(tag);
    if (slots.length >= 4) return ['handle', 'path', 'x', 'y'];
  }
  if (tag.name === 'xl') {
    const slots = splitRawArguments(tag);
    if (slots.length === 3) return ['handle', 'path', 'count'];
    if (slots.length === 4) return ['handle', 'path', 'x', 'y'];
  }
  return KNOWN_TAG_SCHEMAS[tag.name];
};

const toSlot = (raw: string): ArgumentSlot => {
  const match = raw.match(/^(\s*)([\s\S]*?)(\s*)$/);
  return {
    raw,
    leading: match?.[1] ?? '',
    value: match?.[2] ?? raw,
    trailing: match?.[3] ?? ''
  };
};

export const splitRawArguments = (tag: TagNode): ArgumentSlot[] => {
  if (tag.invocationStyle === 'none' || tag.rawArguments.length === 0) return [];
  const separator = tag.invocationStyle === 'pipe' ? '|' : ',';
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  let offset = 0;

  while (offset < tag.rawArguments.length) {
    const character = tag.rawArguments[offset];
    if (character === '%' && offset + 1 < tag.rawArguments.length) {
      offset += 2;
      continue;
    }
    if (character === '#') {
      while (offset < tag.rawArguments.length && tag.rawArguments[offset] !== '\r' && tag.rawArguments[offset] !== '\n') offset += 1;
      continue;
    }
    if (character === '(') depth += 1;
    if (character === ')' && depth > 0) depth -= 1;
    if (character === separator && depth === 0) {
      parts.push(tag.rawArguments.slice(start, offset));
      start = offset + 1;
    }
    offset += 1;
  }
  parts.push(tag.rawArguments.slice(start));
  return parts.map(toSlot);
};

export const decodeKnownTag = (tag: TagNode): KnownTagValue | null => {
  const schema = getKnownTagSchema(tag);
  if (!schema) return null;
  const slots = splitRawArguments(tag);
  const values: Record<string, string> = {};
  schema.forEach((key, index) => {
    if (slots[index]) values[key] = slots[index].value;
  });
  return { name: tag.name, values, slots };
};

export const updateKnownTagArguments = (
  tag: TagNode,
  updates: Record<string | number, string>
): TagNode | null => {
  const schema = getKnownTagSchema(tag);
  const slots = splitRawArguments(tag);
  if (!schema || tag.invocationStyle === 'none') return null;

  const nextSlots = [...slots];
  for (const [key, value] of Object.entries(updates)) {
    const numericIndex = /^\d+$/.test(key) ? Number(key) : schema.indexOf(key);
    if (numericIndex < 0 || numericIndex >= nextSlots.length) return null;
    const current = nextSlots[numericIndex];
    nextSlots[numericIndex] = {
      ...current,
      value,
      raw: `${current.leading}${value}${current.trailing}`
    };
  }

  const separator = tag.invocationStyle === 'pipe' ? '|' : ',';
  return {
    ...tag,
    rawArguments: nextSlots.map(slot => slot.raw).join(separator),
    dirty: true
  };
};
