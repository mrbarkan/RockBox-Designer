import { SourceText } from './sourceText';
import { SourceSpan } from './types';

export const createSpan = (source: SourceText, start: number, end: number): SourceSpan =>
  source.span(start, end);

export const containsOffset = (span: SourceSpan, offset: number) =>
  offset >= span.start && offset < span.end;
