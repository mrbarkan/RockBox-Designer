import { createSourceText, SourceText } from './sourceText';
import { SyntaxToken } from './types';

const ESCAPABLE_CHARACTERS = new Set(['%', '<', '>', '|', ';', '#', '(', ')', ',']);
const DELIMITERS = new Set(['(', ')', '<', '>', '|']);

export const isEscapeSequence = (source: string, offset: number) =>
  source[offset] === '%' && ESCAPABLE_CHARACTERS.has(source[offset + 1]);

export const isCommentStart = (source: string, offset: number) => source[offset] === '#';

// Kept as a compatibility alias for callers created during the Phase 1A migration.
export const isLineCommentStart = isCommentStart;

const pushToken = (
  tokens: SyntaxToken[],
  sourceText: SourceText,
  kind: SyntaxToken['kind'],
  start: number,
  end: number
) => {
  tokens.push({
    kind,
    raw: sourceText.value.slice(start, end),
    span: sourceText.span(start, end)
  });
};

export const tokenizeRockbox = (source: string): SyntaxToken[] => {
  const sourceText = createSourceText(source);
  const tokens: SyntaxToken[] = [];
  let offset = 0;

  while (offset < source.length) {
    const start = offset;
    const character = source[offset];

    if (character === '\r' || character === '\n') {
      offset += character === '\r' && source[offset + 1] === '\n' ? 2 : 1;
      pushToken(tokens, sourceText, 'newline', start, offset);
      continue;
    }

    if (isCommentStart(source, offset)) {
      while (offset < source.length && source[offset] !== '\r' && source[offset] !== '\n') offset += 1;
      pushToken(tokens, sourceText, 'comment', start, offset);
      continue;
    }

    if (source.startsWith('%?', offset)) {
      offset += 2;
      pushToken(tokens, sourceText, 'conditional-introducer', start, offset);
      continue;
    }

    if (isEscapeSequence(source, offset)) {
      offset += 2;
      pushToken(tokens, sourceText, 'escape', start, offset);
      continue;
    }

    if (character === '%') {
      offset += 1;
      pushToken(tokens, sourceText, 'percent', start, offset);
      continue;
    }

    if (DELIMITERS.has(character)) {
      offset += 1;
      pushToken(tokens, sourceText, 'delimiter', start, offset);
      continue;
    }

    while (
      offset < source.length &&
      source[offset] !== '\r' &&
      source[offset] !== '\n' &&
      source[offset] !== '%' &&
      !DELIMITERS.has(source[offset]) &&
      !isCommentStart(source, offset)
    ) {
      offset += 1;
    }
    pushToken(tokens, sourceText, 'text', start, offset);
  }

  return tokens;
};
