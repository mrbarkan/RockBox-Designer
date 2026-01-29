import { RockboxAstDocument, RockboxAstNode, RockboxTagNode } from '../types';

const TAGS_USE_PIPE = new Set(['x', 'X', 'xl', 'xd']);

const buildArgs = (tag: RockboxTagNode) => {
  if (!tag.args || tag.args.length === 0) {
    return '';
  }
  if (TAGS_USE_PIPE.has(tag.tag)) {
    return `|${tag.args.join('|')}|`;
  }
  return `(${tag.args.join(',')})`;
};

const serializeNode = (node: RockboxAstNode): string => {
  if (node.type === 'text') {
    return node.value;
  }
  if (node.type === 'tag') {
    return `%${node.tag}${buildArgs(node)}`;
  }
  const branches = node.branches.map(serializeDocument);
  return `%?${node.tag}<${branches.join('|')}>`;
};

export const serializeDocument = (doc: RockboxAstDocument): string =>
  doc.nodes.map(serializeNode).join('');
