import { describe, expect, it } from 'vitest';
import {
  parseRockbox,
  serializeRockbox,
  TagNode,
  tokenizeRockbox
} from '../../rockbox/syntax';
import {
  getAuthoritativeSource,
  parseRockboxForLegacyConsumer
} from '../../services/rockboxSyntaxAdapter';

describe('conditional structure', () => {
  it('models a parameterized conditional test as a tag', () => {
    const document = parseRockbox('%?if(%pv, =, -90)<muted|audible>');
    const conditional = document.nodes[0];

    expect(conditional.kind).toBe('conditional');
    if (conditional.kind !== 'conditional') return;

    expect(conditional.test.kind).toBe('tag');
    if (conditional.test.kind !== 'tag') return;
    expect(conditional.test.name).toBe('if');
    expect(conditional.test.invocationStyle).toBe('parentheses');
    expect(conditional.test.rawArguments).toBe('%pv, =, -90');
    expect(conditional.branches).toHaveLength(2);
    expect(serializeRockbox(conditional.branches[0])).toBe('muted');
    expect(serializeRockbox(conditional.branches[1])).toBe('audible');
  });

  it('keeps nested conditionals inside their active branch', () => {
    const document = parseRockbox('%?mh<hold|%?mp<playing|paused>>');
    const outer = document.nodes[0];

    expect(outer.kind).toBe('conditional');
    if (outer.kind !== 'conditional') return;
    expect(outer.branches).toHaveLength(2);
    expect(outer.branches[1].nodes[0]?.kind).toBe('conditional');
  });

  it('does not treat escaped or argument pipes as branch separators', () => {
    const document = parseRockbox('%?mp<%x|play.bmp|%|label|paused>');
    const conditional = document.nodes[0];

    expect(conditional.kind).toBe('conditional');
    if (conditional.kind !== 'conditional') return;
    expect(conditional.branches).toHaveLength(2);
    expect(serializeRockbox(conditional.branches[0])).toBe('%x|play.bmp|%|label');
  });

  it('ignores branch-like delimiters inside comments', () => {
    const source = '%?mp<playing # ignored | and >\n|paused>';
    const document = parseRockbox(source);
    const conditional = document.nodes[0];

    expect(conditional.kind).toBe('conditional');
    if (conditional.kind !== 'conditional') return;
    expect(conditional.branches).toHaveLength(2);
    expect(serializeRockbox(document)).toBe(source);
  });
});

describe('diagnostics and recovery', () => {
  it.each([
    ['%', 'incomplete-tag'],
    ['%V(0,0', 'unterminated-parenthesis-arguments'],
    ['%x|icon.bmp', 'unterminated-pipe-arguments'],
    ['%?mp playing', 'missing-conditional-open'],
    ['%?mp<playing|paused', 'unterminated-conditional'],
    ['|', 'unexpected-branch-separator'],
    ['>', 'unexpected-conditional-close']
  ])('preserves malformed source %j and reports %s', (source, code) => {
    const document = parseRockbox(source);
    expect(serializeRockbox(document)).toBe(source);
    expect(document.diagnostics.some(diagnostic => diagnostic.code === code)).toBe(true);
  });

  it('preserves an unknown tag without reporting it as invalid', () => {
    const source = '%zzFuture(  one, two  )';
    const document = parseRockbox(source);
    const tag = document.nodes[0];

    expect(tag.kind).toBe('tag');
    if (tag.kind !== 'tag') return;
    expect(tag.name).toBe('zzFuture');
    expect(tag.rawArguments).toBe('  one, two  ');
    expect(document.diagnostics).toEqual([]);
    expect(serializeRockbox(document)).toBe(source);
  });
});

describe('source metadata', () => {
  it('detects CRLF and records exact line and column spans', () => {
    const document = parseRockbox('first\r\n%it\r\n');
    const tag = document.nodes.find(node => node.kind === 'tag');

    expect(document.newline).toBe('\r\n');
    expect(tag?.span).toMatchObject({
      startLine: 2,
      startColumn: 1,
      endLine: 2,
      endColumn: 4
    });
  });

  it('tokenizes comments, escapes, conditional introducers, and delimiters losslessly', () => {
    const source = '# note\r\n%% %?mp<yes|no>';
    const tokens = tokenizeRockbox(source);

    expect(tokens.map(token => token.raw).join('')).toBe(source);
    expect(tokens.map(token => token.kind)).toEqual(expect.arrayContaining([
      'comment',
      'newline',
      'escape',
      'conditional-introducer',
      'delimiter'
    ]));
  });

  it('recognizes an inline Rockbox comment without scanning its delimiters', () => {
    const source = 'text # comment with | and >\n%it';
    const document = parseRockbox(source);

    expect(document.nodes.some(node => node.kind === 'comment')).toBe(true);
    expect(document.diagnostics).toEqual([]);
    expect(serializeRockbox(document)).toBe(source);
  });
});

describe('legacy migration adapter', () => {
  it('keeps the exact source document beside the existing AST', () => {
    const source = '# preserved\r\n%V( 0, 0, 320, 240, - )';
    const result = parseRockboxForLegacyConsumer(source);

    expect(serializeRockbox(result.sourceDocument)).toBe(source);
    expect(getAuthoritativeSource(result.sourceDocument)).toBe(source);
    expect(result.legacyDocument.raw).toBe(source);
  });
});

describe('narrow serializer regeneration', () => {
  it('regenerates only a dirty parenthesis-style tag', () => {
    const parsed = parseRockbox('before %V(0,0,320,240,-) after');
    const tagIndex = parsed.nodes.findIndex(node => node.kind === 'tag');
    const tag = parsed.nodes[tagIndex] as TagNode;
    const changedTag: TagNode = { ...tag, rawArguments: '1,0,320,240,-', dirty: true };
    const changed = {
      ...parsed,
      nodes: parsed.nodes.map((node, index) => index === tagIndex ? changedTag : node),
      dirty: true
    };

    expect(serializeRockbox(changed)).toBe('before %V(1,0,320,240,-) after');
  });

  it('retains pipe invocation style for a dirty tag', () => {
    const parsed = parseRockbox('%x|old.bmp|');
    const tag = parsed.nodes[0] as TagNode;
    const changed = {
      ...parsed,
      nodes: [{ ...tag, rawArguments: 'new.bmp', dirty: true }],
      dirty: true
    };

    expect(serializeRockbox(changed)).toBe('%x|new.bmp|');
  });

  it('does not invent a missing delimiter while regenerating a malformed tag', () => {
    const parsed = parseRockbox('%V(0,0');
    const tag = parsed.nodes[0] as TagNode;
    const changed = {
      ...parsed,
      nodes: [{ ...tag, rawArguments: '1,0', dirty: true }],
      dirty: true
    };

    expect(serializeRockbox(changed)).toBe('%V(1,0');
  });

  it('regenerates one conditional branch without changing its sibling', () => {
    const parsed = parseRockbox('%?mp<playing|paused>');
    const conditional = parsed.nodes[0];
    expect(conditional.kind).toBe('conditional');
    if (conditional.kind !== 'conditional') return;

    const firstBranch = conditional.branches[0];
    const firstText = firstBranch.nodes[0];
    expect(firstText.kind).toBe('text');
    if (firstText.kind !== 'text') return;

    const changedBranch = {
      ...firstBranch,
      nodes: [{ ...firstText, value: 'play', dirty: true }],
      dirty: true
    };
    const changedConditional = {
      ...conditional,
      branches: [changedBranch, conditional.branches[1]],
      dirty: true
    };
    const changed = { ...parsed, nodes: [changedConditional], dirty: true };

    expect(serializeRockbox(changed)).toBe('%?mp<play|paused>');
  });
});
