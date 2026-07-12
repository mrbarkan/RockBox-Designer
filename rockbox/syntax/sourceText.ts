import { NewlineStyle, SourceSpan } from './types';

export type SourceText = {
  value: string;
  lineStarts: number[];
  newline: NewlineStyle;
  positionAt(offset: number): { line: number; column: number };
  span(start: number, end: number): SourceSpan;
};

const findLineIndex = (lineStarts: number[], offset: number) => {
  let low = 0;
  let high = lineStarts.length - 1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (lineStarts[middle] <= offset) {
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return Math.max(0, high);
};

export const detectNewline = (source: string): NewlineStyle => {
  const match = source.match(/\r\n|\r|\n/);
  return (match?.[0] as NewlineStyle | undefined) ?? '\n';
};

export const createSourceText = (value: string): SourceText => {
  const lineStarts = [0];

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === '\r') {
      if (value[index + 1] === '\n') index += 1;
      lineStarts.push(index + 1);
    } else if (character === '\n') {
      lineStarts.push(index + 1);
    }
  }

  const positionAt = (requestedOffset: number) => {
    const offset = Math.max(0, Math.min(value.length, requestedOffset));
    const lineIndex = findLineIndex(lineStarts, offset);
    return {
      line: lineIndex + 1,
      column: offset - lineStarts[lineIndex] + 1
    };
  };

  return {
    value,
    lineStarts,
    newline: detectNewline(value),
    positionAt,
    span(start, end) {
      const safeStart = Math.max(0, Math.min(value.length, start));
      const safeEnd = Math.max(safeStart, Math.min(value.length, end));
      const startPosition = positionAt(safeStart);
      const endPosition = positionAt(safeEnd);
      return {
        start: safeStart,
        end: safeEnd,
        startLine: startPosition.line,
        startColumn: startPosition.column,
        endLine: endPosition.line,
        endColumn: endPosition.column
      };
    }
  };
};
