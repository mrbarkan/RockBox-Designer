import { RockboxAstDocument, RockboxAstNode, RockboxConditionalNode, RockboxTagNode, RockboxTextNode } from '../types';

type Cursor = {
  index: number;
  line: number;
  column: number;
};

const advance = (cursor: Cursor, value: string) => {
  for (const ch of value) {
    cursor.index += 1;
    if (ch === '\n') {
      cursor.line += 1;
      cursor.column = 1;
    } else {
      cursor.column += 1;
    }
  }
};

const sliceWithCursor = (source: string, start: number, end: number) => source.slice(start, end);

const readUntil = (source: string, cursor: Cursor, stopChar: string) => {
  const start = cursor.index;
  while (cursor.index < source.length && source[cursor.index] !== stopChar) {
    advance(cursor, source[cursor.index]);
  }
  return sliceWithCursor(source, start, cursor.index);
};

const readTagName = (source: string, cursor: Cursor) => {
  const start = cursor.index;
  while (cursor.index < source.length) {
    const ch = source[cursor.index];
    if (!/[a-zA-Z0-9]/.test(ch)) break;
    advance(cursor, ch);
  }
  return sliceWithCursor(source, start, cursor.index);
};

const readArgs = (source: string, cursor: Cursor) => {
  const opener = source[cursor.index];
  if (opener !== '(' && opener !== '|') return { args: [], raw: '', opener: '' };
  const closer = opener === '(' ? ')' : '|';
  advance(cursor, opener);
  const start = cursor.index;
  let depth = 1;
  while (cursor.index < source.length) {
    const ch = source[cursor.index];
    if (ch === opener) depth += 1;
    if (ch === closer) depth -= 1;
    if (depth === 0) break;
    advance(cursor, ch);
  }
  const raw = sliceWithCursor(source, start, cursor.index);
  const args = raw.split(',').map(arg => arg.trim()).filter(arg => arg.length > 0);
  if (source[cursor.index] === closer) advance(cursor, closer);
  return { args, raw, opener };
};

const parseConditional = (source: string, cursor: Cursor, line: number, column: number): RockboxConditionalNode => {
  const start = cursor.index - 2;
  const tag = readUntil(source, cursor, '<');
  if (source[cursor.index] === '<') advance(cursor, '<');
  const branches: RockboxAstDocument[] = [];
  let branchStart = cursor.index;
  let depth = 0;
  while (cursor.index < source.length) {
    const ch = source[cursor.index];
    if (ch === '<') {
      depth += 1;
    } else if (ch === '>') {
      if (depth === 0) {
        const branchRaw = source.slice(branchStart, cursor.index);
        branches.push(parseWpsToAst(branchRaw));
        advance(cursor, ch);
        break;
      }
      depth -= 1;
    } else if (ch === '|' && depth === 0) {
      const branchRaw = source.slice(branchStart, cursor.index);
      branches.push(parseWpsToAst(branchRaw));
      advance(cursor, ch);
      branchStart = cursor.index;
      continue;
    }
    advance(cursor, ch);
  }
  const raw = source.slice(start, cursor.index);
  return {
    type: 'conditional',
    tag: tag.trim(),
    branches,
    raw,
    line,
    column
  };
};

export const parseWpsToAst = (source: string): RockboxAstDocument => {
  const cursor: Cursor = { index: 0, line: 1, column: 1 };
  const nodes: RockboxAstNode[] = [];
  while (cursor.index < source.length) {
    const ch = source[cursor.index];
    if (ch !== '%') {
      const startLine = cursor.line;
      const startColumn = cursor.column;
      const startIndex = cursor.index;
      readUntil(source, cursor, '%');
      const value = source.slice(startIndex, cursor.index);
      if (value) {
        const textNode: RockboxTextNode = {
          type: 'text',
          value,
          line: startLine,
          column: startColumn
        };
        nodes.push(textNode);
      }
      continue;
    }

    const tagLine = cursor.line;
    const tagColumn = cursor.column;
    advance(cursor, '%');
    const next = source[cursor.index];
    if (next === '%') {
      const textNode: RockboxTextNode = {
        type: 'text',
        value: '%',
        line: tagLine,
        column: tagColumn
      };
      advance(cursor, next);
      nodes.push(textNode);
      continue;
    }
    if (next === '?') {
      advance(cursor, next);
      nodes.push(parseConditional(source, cursor, tagLine, tagColumn));
      continue;
    }

    const tag = readTagName(source, cursor);
    const args = source[cursor.index] === '(' || source[cursor.index] === '|' ? readArgs(source, cursor) : { args: [], raw: '', opener: '' };
    const raw = `%${tag}${args.raw ? `${args.opener}${args.raw}${args.opener === '(' ? ')' : '|'}` : ''}`;
    const tagNode: RockboxTagNode = {
      type: 'tag',
      tag,
      args: args.args,
      raw: raw || `%${tag}${args.raw ? `(${args.raw})` : ''}`,
      line: tagLine,
      column: tagColumn
    };
    nodes.push(tagNode);
  }

  return { type: 'document', raw: source, nodes };
};
