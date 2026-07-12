import { RockboxDocument, RockboxNode, TagNode } from '../syntax';
import { decodeKnownTag } from './knownTags';

export type SyntaxViewportEditable = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SyntaxTextEditable = {
  id: string;
  value: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SyntaxImageEditable = {
  id: string;
  filename: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type QueryContext = {
  viewport: { x: number; y: number; width: number; height: number };
  lineOrigin: number;
  fontId: string;
  lineHeight: number;
};

const fontSize = (fontId: string) => {
  const match = fontId.match(/^(\d+)-/);
  return match ? parseInt(match[1], 10) : 14;
};

const lineHeight = (fontId: string) => Math.max(10, fontSize(fontId) + 2);

const initialContext = (fontId: string): QueryContext => ({
  viewport: { x: 0, y: 0, width: 320, height: 240 },
  lineOrigin: 1,
  fontId,
  lineHeight: lineHeight(fontId)
});

const numberValue = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const applyViewport = (tag: TagNode, context: QueryContext) => {
  if (!['V', 'Vl', 'Vi'].includes(tag.name)) return null;
  const decoded = decodeKnownTag(tag);
  if (!decoded) return null;
  const viewport = {
    x: numberValue(decoded.values.x, 0),
    y: numberValue(decoded.values.y, 0),
    width: numberValue(decoded.values.width, 320),
    height: numberValue(decoded.values.height, 240)
  };
  context.viewport = viewport;
  context.lineOrigin = tag.span.startLine;
  if (decoded.values.font && decoded.values.font !== '-') {
    context.fontId = decoded.values.font.split('/').pop() || context.fontId;
    context.lineHeight = lineHeight(context.fontId);
  }
  return viewport;
};

const walkNodes = (
  nodes: RockboxNode[],
  context: QueryContext,
  visitor: (node: RockboxNode, context: QueryContext) => void
) => {
  for (const node of nodes) {
    visitor(node, context);
    if (node.kind === 'tag') applyViewport(node, context);
    if (node.kind === 'conditional') {
      node.branches.forEach(branch => walkNodes(branch.nodes, {
        ...context,
        viewport: { ...context.viewport }
      }, visitor));
    }
  }
};

export const listSyntaxViewports = (document?: RockboxDocument): SyntaxViewportEditable[] => {
  if (!document) return [];
  const output: SyntaxViewportEditable[] = [];
  walkNodes(document.nodes, initialContext('14-Nimbus.fnt'), node => {
    if (node.kind !== 'tag' || !['V', 'Vl', 'Vi'].includes(node.name)) return;
    const decoded = decodeKnownTag(node);
    if (!decoded) return;
    output.push({
      id: node.id,
      x: numberValue(decoded.values.x, 0),
      y: numberValue(decoded.values.y, 0),
      width: numberValue(decoded.values.width, 320),
      height: numberValue(decoded.values.height, 240)
    });
  });
  return output;
};

export const listSyntaxTextNodes = (
  document?: RockboxDocument,
  defaultFont = '14-Nimbus.fnt'
): SyntaxTextEditable[] => {
  if (!document) return [];
  const output: SyntaxTextEditable[] = [];
  walkNodes(document.nodes, initialContext(defaultFont), (node, context) => {
    if (node.kind !== 'text' || node.value.trim().length === 0) return;
    output.push({
      id: node.id,
      value: node.value,
      x: context.viewport.x,
      y: context.viewport.y + (node.span.startLine - context.lineOrigin) * context.lineHeight,
      width: context.viewport.width,
      height: context.lineHeight
    });
  });
  return output;
};

export const listSyntaxImageNodes = (
  document?: RockboxDocument,
  defaultFont = '14-Nimbus.fnt'
): SyntaxImageEditable[] => {
  if (!document) return [];
  const output: SyntaxImageEditable[] = [];
  walkNodes(document.nodes, initialContext(defaultFont), (node, context) => {
    if (node.kind !== 'tag' || !['x', 'X'].includes(node.name)) return;
    const decoded = decodeKnownTag(node);
    if (!decoded?.values.path) return;
    output.push({
      id: node.id,
      filename: decoded.values.path,
      x: context.viewport.x,
      y: context.viewport.y + (node.span.startLine - context.lineOrigin) * context.lineHeight,
      width: context.viewport.width,
      height: context.viewport.height
    });
  });
  return output;
};
