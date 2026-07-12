import {
  ConditionalNode,
  RockboxDocument,
  RockboxNode,
  TagNode
} from './types';

const serializeTag = (node: TagNode) => {
  const prefix = node.introducer;
  if (node.invocationStyle === 'parentheses') {
    return `${prefix}${node.name}(${node.rawArguments}${node.argumentsClosed ? ')' : ''}`;
  }
  if (node.invocationStyle === 'pipe') {
    return `${prefix}${node.name}|${node.rawArguments}${node.argumentsClosed ? '|' : ''}`;
  }
  return `${prefix}${node.name}`;
};

const serializeConditional = (node: ConditionalNode) => {
  const test = serializeNode(node.test);
  const branches = node.branches.map(serializeRockbox);
  let body = '';

  branches.forEach((branch, index) => {
    if (index > 0) body += node.separators[index - 1] ?? '|';
    body += branch;
  });

  return `%?${test}${node.openRaw}${body}${node.closeRaw}`;
};

export const serializeNode = (node: RockboxNode): string => {
  if (!node.dirty) return node.raw;
  if (node.kind === 'text' || node.kind === 'comment') return node.value;
  if (node.kind === 'tag') return serializeTag(node);
  if (node.kind === 'conditional') return serializeConditional(node);
  return node.raw;
};

export const serializeRockbox = (document: RockboxDocument): string => {
  if (!document.dirty) {
    return document.source.slice(document.span.start, document.span.end);
  }
  return document.nodes.map(serializeNode).join('');
};
