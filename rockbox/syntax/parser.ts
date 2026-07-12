import { createDiagnostic } from './diagnostics';
import { getLongestKnownTagAt } from '../registry';
import { createSourceText, SourceText } from './sourceText';
import { isCommentStart, isEscapeSequence } from './tokenizer';
import {
  CommentNode,
  ConditionalNode,
  Diagnostic,
  EscapeNode,
  InvalidNode,
  InvocationStyle,
  RockboxDocument,
  RockboxNode,
  TagNode,
  TextNode
} from './types';

const PIPE_ARITY: Record<string, { min: number; max: number }> = {
  X: { min: 1, max: 1 },
  x: { min: 1, max: 3 },
  xl: { min: 5, max: 5 },
  xd: { min: 1, max: 2 },
  V: { min: 5, max: 5 },
  Vl: { min: 6, max: 6 }
};

type ParsedNode = {
  node: RockboxNode;
  end: number;
};

type ArgumentScan = {
  end: number;
  closeIndex: number | null;
  closed: boolean;
};

type ConditionalBodyScan = {
  separators: number[];
  closeIndex: number | null;
};

const isTagNameCharacter = (character: string | undefined) =>
  Boolean(character && /[A-Za-z0-9]/.test(character));

class LosslessParser {
  private readonly sourceText: SourceText;
  private readonly diagnostics: Diagnostic[] = [];

  constructor(private readonly source: string) {
    this.sourceText = createSourceText(source);
  }

  parse(): RockboxDocument {
    return this.parseRange(0, this.source.length);
  }

  private nodeId(kind: string, start: number, end: number) {
    return `${kind}:${start}:${end}`;
  }

  private addDiagnostic(
    severity: Diagnostic['severity'],
    code: string,
    message: string,
    start: number,
    end: number,
    recovery?: string
  ) {
    this.diagnostics.push(
      createDiagnostic(severity, code, message, this.sourceText.span(start, end), recovery)
    );
  }

  private parseRange(start: number, end: number): RockboxDocument {
    const diagnosticStart = this.diagnostics.length;
    const nodes: RockboxNode[] = [];
    let offset = start;

    while (offset < end) {
      if (isCommentStart(this.source, offset)) {
        const commentStart = offset;
        while (offset < end && this.source[offset] !== '\r' && this.source[offset] !== '\n') offset += 1;
        const raw = this.source.slice(commentStart, offset);
        const node: CommentNode = {
          kind: 'comment',
          id: this.nodeId('comment', commentStart, offset),
          span: this.sourceText.span(commentStart, offset),
          raw,
          value: raw,
          dirty: false
        };
        nodes.push(node);
        continue;
      }

      if (this.source[offset] === '%') {
        if (isEscapeSequence(this.source, offset)) {
          const escapeEnd = Math.min(end, offset + 2);
          const raw = this.source.slice(offset, escapeEnd);
          const node: EscapeNode = {
            kind: 'escape',
            id: this.nodeId('escape', offset, escapeEnd),
            span: this.sourceText.span(offset, escapeEnd),
            raw,
            value: raw.slice(1),
            dirty: false
          };
          nodes.push(node);
          offset = escapeEnd;
          continue;
        }

        const parsed = this.source.startsWith('%?', offset)
          ? this.parseConditional(offset, end)
          : this.parseTag(offset, end);
        nodes.push(parsed.node);
        offset = Math.max(offset + 1, parsed.end);
        continue;
      }

      if (this.source[offset] === '|' || this.source[offset] === '>') {
        const invalidEnd = offset + 1;
        const character = this.source[offset];
        this.addDiagnostic(
          'warning',
          character === '|' ? 'unexpected-branch-separator' : 'unexpected-conditional-close',
          character === '|'
            ? 'A branch separator appeared outside an active conditional.'
            : 'A conditional closing delimiter appeared without an active conditional.',
          offset,
          invalidEnd,
          'The character was preserved as an invalid source node.'
        );
        nodes.push(this.invalidNode(offset, invalidEnd, `unexpected ${character}`));
        offset = invalidEnd;
        continue;
      }

      const textStart = offset;
      while (
        offset < end &&
        this.source[offset] !== '%' &&
        this.source[offset] !== '|' &&
        this.source[offset] !== '>' &&
        !isCommentStart(this.source, offset)
      ) {
        offset += 1;
      }
      const raw = this.source.slice(textStart, offset);
      const node: TextNode = {
        kind: 'text',
        id: this.nodeId('text', textStart, offset),
        span: this.sourceText.span(textStart, offset),
        raw,
        value: raw,
        dirty: false
      };
      nodes.push(node);
    }

    return {
      kind: 'document',
      source: this.source,
      span: this.sourceText.span(start, end),
      newline: this.sourceText.newline,
      nodes,
      diagnostics: this.diagnostics.slice(diagnosticStart),
      dirty: false
    };
  }

  private invalidNode(start: number, end: number, reason: string): InvalidNode {
    return {
      kind: 'invalid',
      id: this.nodeId('invalid', start, end),
      span: this.sourceText.span(start, end),
      raw: this.source.slice(start, end),
      reason,
      dirty: false
    };
  }

  private readTagName(start: number, end: number) {
    const known = getLongestKnownTagAt(this.source, start);
    if (known && start + known.name.length <= end) return known.name;

    let offset = start;
    while (offset < end && isTagNameCharacter(this.source[offset])) offset += 1;
    return this.source.slice(start, offset);
  }

  private parseTag(start: number, end: number): ParsedNode {
    return this.parseTagExpression(start, start + 1, end, '%');
  }

  private parseTagExpression(
    nodeStart: number,
    nameStart: number,
    end: number,
    introducer: '%' | ''
  ): ParsedNode {
    const name = this.readTagName(nameStart, end);
    if (!name) {
      const invalidEnd = Math.max(nameStart, nodeStart + introducer.length);
      this.addDiagnostic(
        'error',
        'incomplete-tag',
        'A tag introducer was not followed by a tag name.',
        nodeStart,
        invalidEnd,
        'The introducer was preserved as an invalid source node.'
      );
      return {
        node: this.invalidNode(nodeStart, invalidEnd, 'missing tag name'),
        end: invalidEnd
      };
    }

    let offset = nameStart + name.length;
    let invocationStyle: InvocationStyle = 'none';
    let rawArguments = '';
    let argumentsClosed = true;

    if (this.source[offset] === '(') {
      invocationStyle = 'parentheses';
      const scan = this.scanParenthesized(offset, end, true);
      argumentsClosed = scan.closed;
      rawArguments = this.source.slice(offset + 1, scan.closeIndex ?? scan.end);
      offset = scan.end;
      if (!scan.closed) {
        this.addDiagnostic(
          'error',
          'unterminated-parenthesis-arguments',
          `Tag ${name} has no closing parenthesis.`,
          nodeStart,
          offset,
          'The incomplete argument region was preserved verbatim.'
        );
      }
    } else if (this.source[offset] === '|') {
      invocationStyle = 'pipe';
      const scan = this.scanPipeArguments(name, offset, end, true);
      argumentsClosed = scan.closed;
      rawArguments = this.source.slice(offset + 1, scan.closeIndex ?? scan.end);
      offset = scan.end;
      if (!scan.closed) {
        this.addDiagnostic(
          'error',
          'unterminated-pipe-arguments',
          `Tag ${name} has no closing pipe delimiter.`,
          nodeStart,
          offset,
          'The incomplete argument region was preserved verbatim.'
        );
      }
    }

    const node: TagNode = {
      kind: 'tag',
      id: this.nodeId('tag', nodeStart, offset),
      span: this.sourceText.span(nodeStart, offset),
      raw: this.source.slice(nodeStart, offset),
      dirty: false,
      name,
      introducer,
      invocationStyle,
      rawArguments,
      argumentsClosed
    };

    return { node, end: offset };
  }

  private parseConditional(start: number, end: number): ParsedNode {
    const testStart = start + 2;
    const parsedTest = this.parseTagExpression(testStart, testStart, end, '');
    const test = parsedTest.node.kind === 'tag'
      ? parsedTest.node
      : parsedTest.node as InvalidNode;

    if (this.source[parsedTest.end] !== '<') {
      const invalidEnd = Math.max(start + 2, parsedTest.end);
      this.addDiagnostic(
        'error',
        'missing-conditional-open',
        'A conditional test was not followed by an opening angle bracket.',
        start,
        invalidEnd,
        'The incomplete conditional was preserved as an invalid source node.'
      );
      return {
        node: this.invalidNode(start, invalidEnd, 'missing conditional opening delimiter'),
        end: invalidEnd
      };
    }

    const bodyStart = parsedTest.end + 1;
    const bodyScan = this.scanConditionalBody(bodyStart, end);
    const conditionalEnd = bodyScan.closeIndex === null ? end : bodyScan.closeIndex + 1;
    const branchBoundaries = [bodyStart, ...bodyScan.separators, bodyScan.closeIndex ?? end];
    const branches: RockboxDocument[] = [];

    for (let index = 0; index < branchBoundaries.length - 1; index += 1) {
      const branchStart = branchBoundaries[index] + (index === 0 ? 0 : 1);
      const branchEnd = branchBoundaries[index + 1];
      branches.push(this.parseRange(branchStart, branchEnd));
    }

    if (bodyScan.closeIndex === null) {
      this.addDiagnostic(
        'error',
        'unterminated-conditional',
        'A conditional has no closing angle bracket.',
        start,
        conditionalEnd,
        'The available branches were preserved through the end of the document.'
      );
    }

    const node: ConditionalNode = {
      kind: 'conditional',
      id: this.nodeId('conditional', start, conditionalEnd),
      span: this.sourceText.span(start, conditionalEnd),
      raw: this.source.slice(start, conditionalEnd),
      dirty: false,
      test,
      openRaw: '<',
      branches,
      separators: bodyScan.separators.map(position => this.source[position]),
      closeRaw: bodyScan.closeIndex === null ? '' : '>'
    };

    return { node, end: conditionalEnd };
  }

  private scanParenthesized(openIndex: number, end: number, _report: boolean): ArgumentScan {
    let depth = 1;
    let offset = openIndex + 1;

    while (offset < end) {
      if (isEscapeSequence(this.source, offset)) {
        offset += 2;
        continue;
      }
      if (isCommentStart(this.source, offset)) {
        offset = this.skipComment(offset, end);
        continue;
      }
      if (this.source[offset] === '(') depth += 1;
      if (this.source[offset] === ')') {
        depth -= 1;
        if (depth === 0) {
          return { end: offset + 1, closeIndex: offset, closed: true };
        }
      }
      offset += 1;
    }

    return { end, closeIndex: null, closed: false };
  }

  private scanPipeArguments(tagName: string, openIndex: number, end: number, _report: boolean): ArgumentScan {
    const arity = PIPE_ARITY[tagName] ?? { min: 1, max: 1 };
    let offset = openIndex + 1;
    let argumentCount = 0;

    while (offset < end) {
      if (isEscapeSequence(this.source, offset)) {
        offset += 2;
        continue;
      }
      if (isCommentStart(this.source, offset)) {
        offset = this.skipComment(offset, end);
        continue;
      }
      if (this.source[offset] === '\r' || this.source[offset] === '\n' || this.source[offset] === '>') break;
      if (this.source[offset] === '|') {
        argumentCount += 1;
        if (argumentCount >= arity.min) {
          if (argumentCount >= arity.max || !this.hasOptionalPipeArgument(tagName, offset + 1, end)) {
            return { end: offset + 1, closeIndex: offset, closed: true };
          }
        }
      }
      offset += 1;
    }

    return { end: offset, closeIndex: null, closed: false };
  }

  private hasOptionalPipeArgument(tagName: string, start: number, end: number) {
    if (tagName !== 'x' && tagName !== 'xd') return false;
    let close = start;
    while (
      close < end &&
      this.source[close] !== '|' &&
      this.source[close] !== '\r' &&
      this.source[close] !== '\n' &&
      this.source[close] !== '>'
    ) close += 1;
    if (this.source[close] !== '|') return false;
    const candidate = this.source.slice(start, close).trim();
    return tagName === 'x'
      ? /^-?\d+$/.test(candidate)
      : /^(?:-?\d+|%[A-Za-z0-9?]+)$/.test(candidate);
  }

  private scanConditionalBody(start: number, end: number): ConditionalBodyScan {
    const separators: number[] = [];
    let offset = start;

    while (offset < end) {
      if (isEscapeSequence(this.source, offset)) {
        offset += 2;
        continue;
      }
      if (isCommentStart(this.source, offset)) {
        offset = this.skipComment(offset, end);
        continue;
      }
      if (this.source.startsWith('%?', offset)) {
        const nestedEnd = this.scanConditionalEnd(offset, end);
        offset = Math.max(offset + 2, nestedEnd);
        continue;
      }
      if (this.source[offset] === '%') {
        offset = Math.max(offset + 1, this.scanTagEnd(offset, end));
        continue;
      }
      if (this.source[offset] === '|') {
        separators.push(offset);
        offset += 1;
        continue;
      }
      if (this.source[offset] === '>') {
        return { separators, closeIndex: offset };
      }
      offset += 1;
    }

    return { separators, closeIndex: null };
  }

  private scanConditionalEnd(start: number, end: number) {
    const testEnd = this.scanTagExpressionEnd(start + 2, end);
    if (this.source[testEnd] !== '<') return testEnd;
    const body = this.scanConditionalBody(testEnd + 1, end);
    return body.closeIndex === null ? end : body.closeIndex + 1;
  }

  private scanTagEnd(start: number, end: number) {
    return this.scanTagExpressionEnd(start + 1, end);
  }

  private scanTagExpressionEnd(nameStart: number, end: number) {
    const name = this.readTagName(nameStart, end);
    let offset = nameStart + name.length;
    if (!name) return offset;
    if (this.source[offset] === '(') return this.scanParenthesized(offset, end, false).end;
    if (this.source[offset] === '|') return this.scanPipeArguments(name, offset, end, false).end;
    return offset;
  }

  private skipComment(start: number, end: number) {
    let offset = start;
    while (offset < end && this.source[offset] !== '\r' && this.source[offset] !== '\n') offset += 1;
    if (this.source[offset] === '\r' && this.source[offset + 1] === '\n') return offset + 2;
    if (this.source[offset] === '\r' || this.source[offset] === '\n') return offset + 1;
    return offset;
  }
}

export const parseRockbox = (source: string): RockboxDocument =>
  new LosslessParser(source).parse();
