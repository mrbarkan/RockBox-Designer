import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT } from '../../constants';
import {
  listSyntaxImageNodes,
  listSyntaxTextNodes,
  listSyntaxViewports,
  updateImageReference,
  updateViewport
} from '../../rockbox/editing';
import { parseRockbox, serializeRockbox } from '../../rockbox/syntax';
import { compileAstScreen } from '../../services/rockboxCompiler';
import {
  applyProjectSyntaxDocument,
  getProjectSyntaxDocument
} from '../../services/rockboxSyntaxAdapter';

describe('project lossless-source integration', () => {
  it('makes the lossless document authoritative for compilation', () => {
    const source = '# exact\r\n%V( 0, 0, 320, 240, - )\r\n%x|old.bmp|';
    const project = {
      ...DEFAULT_PROJECT,
      wpsDocument: parseRockbox(source),
      wpsAst: { type: 'document' as const, raw: 'legacy', nodes: [] }
    };

    expect(compileAstScreen(project, 'wps')).toBe(source);
  });

  it('synchronizes the rendering adapter after a source-aware edit', () => {
    const source = '%V(0,0,320,240,-)\nText';
    const project = { ...DEFAULT_PROJECT, wpsDocument: parseRockbox(source) };
    const document = getProjectSyntaxDocument(project, 'wps');
    if (!document) throw new Error('Missing document');
    const viewport = listSyntaxViewports(document)[0];
    const edit = updateViewport(document, viewport.id, { x: 10, y: 0, width: 320, height: 240 });
    const next = applyProjectSyntaxDocument(project, 'wps', edit.document);

    expect(serializeRockbox(next.wpsDocument!)).toBe('%V(10,0,320,240,-)\nText');
    expect(next.wpsAst?.raw).toBe('%V(10,0,320,240,-)\nText');
  });

  it('lazily migrates an existing saved legacy AST on its first edit', () => {
    const source = '%V(0,0,320,240,-)\nLegacy';
    const project = {
      ...DEFAULT_PROJECT,
      wpsAst: { type: 'document' as const, raw: source, nodes: [] }
    };
    const document = getProjectSyntaxDocument(project, 'wps');
    if (!document) throw new Error('Missing migrated document');
    const viewport = listSyntaxViewports(document)[0];
    const edit = updateViewport(document, viewport.id, { x: 4, y: 0, width: 320, height: 240 });
    const next = applyProjectSyntaxDocument(project, 'wps', edit.document);

    expect(next.wpsDocument).toBeDefined();
    expect(compileAstScreen(next, 'wps')).toBe('%V(4,0,320,240,-)\nLegacy');
  });

  it('lists viewport, text, and image controls from the lossless document', () => {
    const document = parseRockbox('%V(5,6,100,80,-)\nLabel\n%x|icon.bmp|');
    expect(listSyntaxViewports(document)[0]).toMatchObject({ x: 5, y: 6, width: 100, height: 80 });
    expect(listSyntaxTextNodes(document).some(node => node.value.includes('Label'))).toBe(true);
    expect(listSyntaxImageNodes(document)[0]?.filename).toBe('icon.bmp');
  });

  it('updates the path slot of modern labeled image syntax', () => {
    const document = parseRockbox('%x(Backdrop,old.bmp,4,5)');
    const image = listSyntaxImageNodes(document)[0];
    expect(image.filename).toBe('old.bmp');
    const updated = updateImageReference(document, image.id, 'new.bmp');
    expect(serializeRockbox(updated.document)).toBe('%x(Backdrop,new.bmp,4,5)');
  });

  it('routes USB scene reads and edits through the authoritative SBS document', () => {
    const source = '%?if(%cs, =, 21)<%Vd(USB)>\n%Vl(USB,0,0,320,240,-)Connected';
    const project = { ...DEFAULT_PROJECT, sbsDocument: parseRockbox(source) };
    const document = getProjectSyntaxDocument(project, 'usb');
    if (!document) throw new Error('Missing USB scene SBS document');
    const viewport = listSyntaxViewports(document)[0];
    const edit = updateViewport(document, viewport.id, { x: 4, y: 5, width: 300, height: 220 });
    const next = applyProjectSyntaxDocument(project, 'usb', edit.document);

    expect(serializeRockbox(next.sbsDocument!)).toBe('%?if(%cs, =, 21)<%Vd(USB)>\n%Vl(USB,4,5,300,220,-)Connected');
    expect(next.wpsDocument).toBe(project.wpsDocument);
    expect(next.fmsDocument).toBe(project.fmsDocument);
  });
});
