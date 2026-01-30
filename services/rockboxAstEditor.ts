import { RockboxAstDocument, RockboxAstNode, RockboxAstPath, RockboxAstPathStep, RockboxTagNode } from '../types';

export type AstViewportEditable = {
  id: string;
  path: RockboxAstPath;
  tag: RockboxTagNode;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AstTextEditable = {
  id: string;
  path: RockboxAstPath;
  value: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AstImageEditable = {
  id: string;
  path: RockboxAstPath;
  filename: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

const cloneDocument = (doc: RockboxAstDocument): RockboxAstDocument => ({
  ...doc,
  nodes: doc.nodes.map(node => cloneNode(node))
});

const cloneNode = (node: RockboxAstNode): RockboxAstNode => {
  if (node.type === 'conditional') {
    return {
      ...node,
      branches: node.branches.map(branch => cloneDocument(branch))
    };
  }
  if (node.type === 'tag') {
    return { ...node, args: [...node.args] };
  }
  return { ...node };
};

const buildPathId = (path: RockboxAstPath) =>
  path.map(step => `n${step.nodeIndex}${step.branchIndex !== undefined ? `b${step.branchIndex}` : ''}`).join('.');

const getViewportArgs = (tag: RockboxTagNode) => {
  if (tag.tag === 'V') {
    return { startIndex: 0 };
  }
  if (tag.tag === 'Vl') {
    return { startIndex: 1 };
  }
  return null;
};

const parseViewport = (tag: RockboxTagNode) => {
  const args = getViewportArgs(tag);
  if (!args) return null;
  const start = args.startIndex;
  const x = parseInt(tag.args[start] || '0', 10);
  const y = parseInt(tag.args[start + 1] || '0', 10);
  const width = parseInt(tag.args[start + 2] || '0', 10);
  const height = parseInt(tag.args[start + 3] || '0', 10);
  return { x, y, width, height };
};

export const listAstViewports = (doc?: RockboxAstDocument): AstViewportEditable[] => {
  if (!doc) return [];
  const output: AstViewportEditable[] = [];

  const walk = (nodes: RockboxAstNode[], path: RockboxAstPath) => {
    nodes.forEach((node, index) => {
      const currentPath: RockboxAstPath = [...path, { nodeIndex: index }];
      if (node.type === 'tag') {
        const viewport = parseViewport(node);
        if (viewport) {
          output.push({
            id: buildPathId(currentPath),
            path: currentPath,
            tag: node,
            ...viewport
          });
        }
      }
      if (node.type === 'conditional') {
        node.branches.forEach((branch, branchIndex) => {
          walk(branch.nodes, [...path, { nodeIndex: index, branchIndex }]);
        });
      }
    });
  };

  walk(doc.nodes, []);
  return output;
};

const getFontSize = (fontId: string) => {
  const match = fontId.match(/^(\d+)-/);
  return match ? parseInt(match[1], 10) : 14;
};

const updateLineMetrics = (fontId: string) => Math.max(10, getFontSize(fontId) + 2);

export const listAstTextNodes = (doc?: RockboxAstDocument, defaultFont = '14-Nimbus.fnt'): AstTextEditable[] => {
  if (!doc) return [];
  const output: AstTextEditable[] = [];
  let viewport = { x: 0, y: 0, w: 320, h: 240 };
  let lineOrigin = 1;
  let fontId = defaultFont;
  let lineHeight = updateLineMetrics(fontId);

  const walk = (nodes: RockboxAstNode[], path: RockboxAstPath) => {
    nodes.forEach((node, index) => {
      const currentPath: RockboxAstPath = [...path, { nodeIndex: index }];
      if (node.type === 'tag') {
        if (node.tag === 'V' && node.args.length >= 4) {
          viewport = {
            x: parseInt(node.args[0] || '0', 10),
            y: parseInt(node.args[1] || '0', 10),
            w: parseInt(node.args[2] || '320', 10),
            h: parseInt(node.args[3] || '240', 10)
          };
          if (node.args[4]) {
            fontId = node.args[4].split('/').pop() || fontId;
            lineHeight = updateLineMetrics(fontId);
          }
          lineOrigin = node.line;
        }
        if (node.tag === 'Fn' && node.args[0]) {
          fontId = node.args[0].split('/').pop() || fontId;
          lineHeight = updateLineMetrics(fontId);
        }
      }
      if (node.type === 'text') {
        if (node.value.trim().length > 0) {
          const y = viewport.y + (node.line - lineOrigin) * lineHeight;
          output.push({
            id: buildPathId(currentPath),
            path: currentPath,
            value: node.value,
            x: viewport.x,
            y,
            width: viewport.w,
            height: lineHeight
          });
        }
      }
      if (node.type === 'conditional') {
        node.branches.forEach((branch, branchIndex) => {
          walk(branch.nodes, [...path, { nodeIndex: index, branchIndex }]);
        });
      }
    });
  };

  walk(doc.nodes, []);
  return output;
};

export const listAstImageNodes = (doc?: RockboxAstDocument, defaultFont = '14-Nimbus.fnt'): AstImageEditable[] => {
  if (!doc) return [];
  const output: AstImageEditable[] = [];
  let viewport = { x: 0, y: 0, w: 320, h: 240 };
  let lineOrigin = 1;
  let fontId = defaultFont;
  let lineHeight = updateLineMetrics(fontId);

  const walk = (nodes: RockboxAstNode[], path: RockboxAstPath) => {
    nodes.forEach((node, index) => {
      const currentPath: RockboxAstPath = [...path, { nodeIndex: index }];
      if (node.type === 'tag') {
        if (node.tag === 'V' && node.args.length >= 4) {
          viewport = {
            x: parseInt(node.args[0] || '0', 10),
            y: parseInt(node.args[1] || '0', 10),
            w: parseInt(node.args[2] || '320', 10),
            h: parseInt(node.args[3] || '240', 10)
          };
          if (node.args[4]) {
            fontId = node.args[4].split('/').pop() || fontId;
            lineHeight = updateLineMetrics(fontId);
          }
          lineOrigin = node.line;
        }
        if (node.tag === 'Fn' && node.args[0]) {
          fontId = node.args[0].split('/').pop() || fontId;
          lineHeight = updateLineMetrics(fontId);
        }
        if ((node.tag === 'x' || node.tag === 'X') && node.args.length > 0) {
          output.push({
            id: buildPathId(currentPath),
            path: currentPath,
            filename: node.args[0],
            x: viewport.x,
            y: viewport.y + (node.line - lineOrigin) * lineHeight,
            width: viewport.w,
            height: viewport.h
          });
        }
      }
      if (node.type === 'conditional') {
        node.branches.forEach((branch, branchIndex) => {
          walk(branch.nodes, [...path, { nodeIndex: index, branchIndex }]);
        });
      }
    });
  };

  walk(doc.nodes, []);
  return output;
};

const updateTagViewportArgs = (tag: RockboxTagNode, updates: { x: number; y: number; width: number; height: number }) => {
  const args = getViewportArgs(tag);
  if (!args) return tag;
  const start = args.startIndex;
  const nextArgs = [...tag.args];
  nextArgs[start] = updates.x.toString();
  nextArgs[start + 1] = updates.y.toString();
  nextArgs[start + 2] = updates.width.toString();
  nextArgs[start + 3] = updates.height.toString();
  return { ...tag, args: nextArgs };
};

const updateNodeAtPath = (
  nodes: RockboxAstNode[],
  path: RockboxAstPath,
  updates: { x: number; y: number; width: number; height: number }
): RockboxAstNode[] => {
  if (path.length === 0) return nodes;
  const [head, ...rest] = path;
  const nextNodes = [...nodes];
  const node = nextNodes[head.nodeIndex];
  if (!node) return nextNodes;

  if (head.branchIndex !== undefined && node.type === 'conditional') {
    const nextBranches = node.branches.map((branch, index) => {
      if (index !== head.branchIndex) return branch;
      return {
        ...branch,
        nodes: updateNodeAtPath(branch.nodes, rest, updates)
      };
    });
    nextNodes[head.nodeIndex] = { ...node, branches: nextBranches };
    return nextNodes;
  }

  if (rest.length === 0 && node.type === 'tag') {
    nextNodes[head.nodeIndex] = updateTagViewportArgs(node, updates);
    return nextNodes;
  }

  if (node.type === 'conditional') {
    const nextBranches = node.branches.map(branch => ({
      ...branch,
      nodes: updateNodeAtPath(branch.nodes, rest, updates)
    }));
    nextNodes[head.nodeIndex] = { ...node, branches: nextBranches };
  }

  return nextNodes;
};

const updateTextNodeAtPath = (
  nodes: RockboxAstNode[],
  path: RockboxAstPath,
  value: string
): RockboxAstNode[] => {
  if (path.length === 0) return nodes;
  const [head, ...rest] = path;
  const nextNodes = [...nodes];
  const node = nextNodes[head.nodeIndex];
  if (!node) return nextNodes;

  if (head.branchIndex !== undefined && node.type === 'conditional') {
    const nextBranches = node.branches.map((branch, index) => {
      if (index !== head.branchIndex) return branch;
      return {
        ...branch,
        nodes: updateTextNodeAtPath(branch.nodes, rest, value)
      };
    });
    nextNodes[head.nodeIndex] = { ...node, branches: nextBranches };
    return nextNodes;
  }

  if (rest.length === 0 && node.type === 'text') {
    nextNodes[head.nodeIndex] = { ...node, value };
    return nextNodes;
  }

  if (node.type === 'conditional') {
    const nextBranches = node.branches.map(branch => ({
      ...branch,
      nodes: updateTextNodeAtPath(branch.nodes, rest, value)
    }));
    nextNodes[head.nodeIndex] = { ...node, branches: nextBranches };
  }

  return nextNodes;
};

const updateImageTagAtPath = (
  nodes: RockboxAstNode[],
  path: RockboxAstPath,
  filename: string
): RockboxAstNode[] => {
  if (path.length === 0) return nodes;
  const [head, ...rest] = path;
  const nextNodes = [...nodes];
  const node = nextNodes[head.nodeIndex];
  if (!node) return nextNodes;

  if (head.branchIndex !== undefined && node.type === 'conditional') {
    const nextBranches = node.branches.map((branch, index) => {
      if (index !== head.branchIndex) return branch;
      return {
        ...branch,
        nodes: updateImageTagAtPath(branch.nodes, rest, filename)
      };
    });
    nextNodes[head.nodeIndex] = { ...node, branches: nextBranches };
    return nextNodes;
  }

  if (rest.length === 0 && node.type === 'tag' && (node.tag === 'x' || node.tag === 'X')) {
    const nextArgs = [...node.args];
    nextArgs[0] = filename;
    nextNodes[head.nodeIndex] = { ...node, args: nextArgs };
    return nextNodes;
  }

  if (node.type === 'conditional') {
    const nextBranches = node.branches.map(branch => ({
      ...branch,
      nodes: updateImageTagAtPath(branch.nodes, rest, filename)
    }));
    nextNodes[head.nodeIndex] = { ...node, branches: nextBranches };
  }

  return nextNodes;
};

export const updateAstViewport = (
  doc: RockboxAstDocument,
  path: RockboxAstPath,
  updates: { x: number; y: number; width: number; height: number }
): RockboxAstDocument => {
  const cloned = cloneDocument(doc);
  return {
    ...cloned,
    nodes: updateNodeAtPath(cloned.nodes, path, updates)
  };
};

export const updateAstTextNode = (
  doc: RockboxAstDocument,
  path: RockboxAstPath,
  value: string
): RockboxAstDocument => {
  const cloned = cloneDocument(doc);
  return {
    ...cloned,
    nodes: updateTextNodeAtPath(cloned.nodes, path, value)
  };
};

export const updateAstImageNode = (
  doc: RockboxAstDocument,
  path: RockboxAstPath,
  filename: string
): RockboxAstDocument => {
  const cloned = cloneDocument(doc);
  return {
    ...cloned,
    nodes: updateImageTagAtPath(cloned.nodes, path, filename)
  };
};
