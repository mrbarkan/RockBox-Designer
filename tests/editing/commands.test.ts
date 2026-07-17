import { describe, expect, it } from 'vitest';
import {
  deleteNode,
  decodeKnownTag,
  duplicateConditionalBranch,
  insertNode,
  KNOWN_TAG_SCHEMAS,
  moveNode,
  replaceConditionalBranch,
  updateImageReference,
  updateTagArguments,
  updateTextNode,
  updateViewport
} from '../../rockbox/editing';
import { parseRockbox, serializeRockbox } from '../../rockbox/syntax';

const findTag = (source: string, name: string) => {
  const document = parseRockbox(source);
  const tag = document.nodes.find(node => node.kind === 'tag' && node.name === name);
  if (!tag || tag.kind !== 'tag') throw new Error(`Missing tag ${name}`);
  return { document, tag };
};

describe('source-aware narrow edits', () => {
  it('changes only the intended viewport arguments and retains node identity', () => {
    const source = '# keep\r\n%V( 0, 0, 320, 240, - )\r\n%zzFuture( raw )';
    const { document, tag } = findTag(source, 'V');
    const result = updateViewport(document, tag.id, { x: 7, y: 0, width: 320, height: 240 });

    expect(result.changed).toBe(true);
    expect(serializeRockbox(document)).toBe(source);
    expect(serializeRockbox(result.document)).toBe('# keep\r\n%V( 7, 0, 320, 240, - )\r\n%zzFuture( raw )');
    expect(result.document.nodes.find(node => node.id === tag.id)?.id).toBe(tag.id);
  });

  it('updates one pipe-style image path without normalizing other tags', () => {
    const source = '%x|old.bmp|\n%V( 0, 0, 320, 240, - )\n%Qq|raw|';
    const { document, tag } = findTag(source, 'x');
    const result = updateImageReference(document, tag.id, 'new.bmp');

    expect(serializeRockbox(result.document)).toBe('%x|new.bmp|\n%V( 0, 0, 320, 240, - )\n%Qq|raw|');
  });

  it('updates text while preserving surrounding tags and comments', () => {
    const source = '# title\n%V(0,0,320,240,-)\nHello %it';
    const document = parseRockbox(source);
    const text = document.nodes.find(node => node.kind === 'text' && node.value.includes('Hello'));
    if (!text || text.kind !== 'text') throw new Error('Missing text');
    const result = updateTextNode(document, text.id, '\nWorld ');

    expect(serializeRockbox(result.document)).toBe('# title\n%V(0,0,320,240,-)\nWorld %it');
  });

  it('edits inside one nested branch and preserves sibling branches', () => {
    const source = '%?mh<%x|hold.bmp||%?mp<playing|paused>>';
    const document = parseRockbox(source);
    const outer = document.nodes[0];
    if (outer.kind !== 'conditional') throw new Error('Missing conditional');
    const image = outer.branches[0].nodes.find(node => node.kind === 'tag' && node.name === 'x');
    if (!image || image.kind !== 'tag') throw new Error('Missing image');
    const result = updateImageReference(document, image.id, 'locked.bmp');

    expect(serializeRockbox(result.document)).toBe('%?mh<%x|locked.bmp||%?mp<playing|paused>>');
  });

  it('preserves parenthesis invocation style for generic known-tag updates', () => {
    const { document, tag } = findTag('%pb( 0, 220, 320, 8, - )', 'pb');
    const result = updateTagArguments(document, tag.id, { y: '200' });
    expect(serializeRockbox(result.document)).toBe('%pb( 0, 200, 320, 8, - )');
  });

  it('returns a diagnostic and the original document for an unsafe edit', () => {
    const document = parseRockbox('%it');
    const result = updateImageReference(document, document.nodes[0].id, 'bad.bmp');

    expect(result.changed).toBe(false);
    expect(result.document).toBe(document);
    expect(result.diagnostics[0]?.code).toBe('edit-incompatible-node');
    expect(serializeRockbox(result.document)).toBe('%it');
  });
});

describe('structural commands', () => {
  it('replaces one conditional branch without changing its sibling', () => {
    const document = parseRockbox('%?mp<playing|paused>');
    const conditional = document.nodes[0];
    const result = replaceConditionalBranch(document, conditional.id, 0, 'stopped');
    expect(serializeRockbox(result.document)).toBe('%?mp<stopped|paused>');
  });

  it('duplicates a conditional branch without normalizing its siblings', () => {
    const document = parseRockbox('# keep\r\n%?mh< hold | free >\r\n%zzFuture(raw)');
    const conditional = document.nodes.find(node => node.kind === 'conditional');
    if (!conditional) throw new Error('Missing conditional');
    const result = duplicateConditionalBranch(document, conditional.id, 0);
    expect(serializeRockbox(result.document)).toBe('# keep\r\n%?mh< hold | free | hold >\r\n%zzFuture(raw)');
  });

  it('inserts, moves, and deletes nodes while retaining moved identity', () => {
    const original = parseRockbox('A%itB%iaC');
    const titleTag = original.nodes.find(node => node.kind === 'tag' && node.name === 'it');
    const artistTag = original.nodes.find(node => node.kind === 'tag' && node.name === 'ia');
    if (!titleTag || !artistTag) throw new Error('Missing tags');

    const inserted = insertNode(original, { nodeId: titleTag.id, position: 'after' }, '%ac');
    expect(serializeRockbox(inserted.document)).toBe('A%it%acB%iaC');

    const moved = moveNode(inserted.document, artistTag.id, { nodeId: titleTag.id, position: 'before' });
    expect(serializeRockbox(moved.document)).toBe('A%ia%it%acBC');
    expect(moved.document.nodes.find(node => node.id === artistTag.id)?.id).toBe(artistTag.id);

    const deleted = deleteNode(moved.document, titleTag.id);
    expect(serializeRockbox(deleted.document)).toBe('A%ia%acBC');
  });
});

describe('known semantic argument helpers', () => {
  it('covers the Phase 1B tag subset', () => {
    expect(Object.keys(KNOWN_TAG_SCHEMAS)).toEqual(expect.arrayContaining([
      'V', 'Vl', 'Vi', 'Vf', 'Vb', 'Fl', 'x', 'xl', 'xd', 'X', 'pb', 'pv', 'Cl', 'Cd', 'T'
    ]));
  });

  it.each([
    ['%V(0,0,320,240,-)', 'V'],
    ['%Vl(main,0,0,320,240,-)', 'Vl'],
    ['%Vi(ui,0,0,320,240,-)', 'Vi'],
    ['%Vf(ffffff)', 'Vf'],
    ['%Vb(000000)', 'Vb'],
    ['%Fl(1,font.fnt,latin1)', 'Fl'],
    ['%x|icon.bmp|', 'x'],
    ['%xl|A|strip.bmp|0|0|10|', 'xl'],
    ['%xd(A,1)', 'xd'],
    ['%X|backdrop.bmp|', 'X'],
    ['%pb(0,0,100,5,-)', 'pb'],
    ['%pv(0,0,100,5,-)', 'pv'],
    ['%Cl(0,0,100,100,c,c)', 'Cl'],
    ['%Cd', 'Cd'],
    ['%T(0,0,20,20,play)', 'T']
  ])('decodes %s through the %s semantic schema', (source, name) => {
    const document = parseRockbox(source);
    const tag = document.nodes[0];
    expect(tag.kind).toBe('tag');
    if (tag.kind !== 'tag') return;
    expect(tag.name).toBe(name);
    expect(decodeKnownTag(tag)?.name).toBe(name);
  });
});
