import { createDiagnostic, parseRockbox, RockboxDocument, RockboxNode, TagNode } from '../syntax';
import { updateKnownTagArguments } from './knownTags';

export type EditResult = {
  document: RockboxDocument;
  diagnostics: ReturnType<typeof createDiagnostic>[];
  changed: boolean;
};

export type InsertAnchor = {
  nodeId?: string;
  position: 'start' | 'end' | 'before' | 'after';
};

let createdSequence = 0;

const failure = (document: RockboxDocument, code: string, message: string): EditResult => ({
  document,
  diagnostics: [createDiagnostic('warning', code, message, document.span, 'The source was left unchanged.')],
  changed: false
});

const success = (document: RockboxDocument): EditResult => ({ document, diagnostics: [], changed: true });

type Mutation = { document: RockboxDocument; found: boolean; changed: boolean };

const updateDocumentNode = (
  document: RockboxDocument,
  nodeId: string,
  updater: (node: RockboxNode) => RockboxNode | null
): Mutation => {
  let found = false;
  let changed = false;
  const nodes = document.nodes.map(node => {
    if (node.id === nodeId) {
      found = true;
      const replacement = updater(node);
      if (replacement && replacement !== node) changed = true;
      return replacement ?? node;
    }
    if (node.kind !== 'conditional') return node;

    let nextTest = node.test;
    if (node.test.id === nodeId) {
      found = true;
      const replacement = updater(node.test);
      if (replacement?.kind === 'tag' || replacement?.kind === 'invalid') {
        nextTest = replacement;
        changed = replacement !== node.test;
      }
    }

    let branchChanged = false;
    const branches = node.branches.map(branch => {
      const result = updateDocumentNode(branch, nodeId, updater);
      found ||= result.found;
      branchChanged ||= result.changed;
      return result.document;
    });
    if (!branchChanged && nextTest === node.test) return node;
    changed = true;
    return { ...node, test: nextTest, branches, dirty: true };
  });

  if (!changed) return { document, found, changed: false };
  return { document: { ...document, nodes, dirty: true }, found, changed: true };
};

const updateTag = (
  document: RockboxDocument,
  nodeId: string,
  updater: (tag: TagNode) => TagNode | null,
  expected: string
): EditResult => {
  let incompatible = false;
  const result = updateDocumentNode(document, nodeId, node => {
    if (node.kind !== 'tag') {
      incompatible = true;
      return null;
    }
    const updated = updater(node);
    if (!updated) incompatible = true;
    return updated;
  });
  if (!result.found) return failure(document, 'edit-node-not-found', `Node ${nodeId} was not found.`);
  if (incompatible || !result.changed) return failure(document, 'edit-incompatible-node', expected);
  return success(result.document);
};

export const updateTextNode = (document: RockboxDocument, nodeId: string, value: string): EditResult => {
  let incompatible = false;
  const result = updateDocumentNode(document, nodeId, node => {
    if (node.kind !== 'text') {
      incompatible = true;
      return null;
    }
    if (node.value === value) return node;
    return { ...node, value, dirty: true };
  });
  if (!result.found) return failure(document, 'edit-node-not-found', `Node ${nodeId} was not found.`);
  if (incompatible) return failure(document, 'edit-incompatible-node', 'The selected node is not editable text.');
  if (!result.changed) return { document, diagnostics: [], changed: false };
  return success(result.document);
};

export const updateTagArguments = (
  document: RockboxDocument,
  nodeId: string,
  updates: Record<string | number, string>
) => updateTag(
  document,
  nodeId,
  tag => updateKnownTagArguments(tag, updates),
  'The selected tag or argument key is not supported for source-aware editing.'
);

export const updateViewport = (
  document: RockboxDocument,
  nodeId: string,
  updates: { x: number; y: number; width: number; height: number }
) => updateTag(
  document,
  nodeId,
  tag => ['V', 'Vl', 'Vi'].includes(tag.name)
    ? updateKnownTagArguments(tag, Object.fromEntries(Object.entries(updates).map(([key, value]) => [key, String(value)])))
    : null,
  'The selected node is not an editable viewport tag.'
);

export const updateImageReference = (document: RockboxDocument, nodeId: string, path: string) =>
  updateTag(
    document,
    nodeId,
    tag => ['x', 'xl', 'X'].includes(tag.name) ? updateKnownTagArguments(tag, { path }) : null,
    'The selected node is not an editable image-reference tag.'
  );

const rekeyNode = (node: RockboxNode, prefix: string): RockboxNode => {
  const id = `${prefix}:${node.id}`;
  if (node.kind !== 'conditional') return { ...node, id };
  return {
    ...node,
    id,
    test: rekeyNode(node.test, prefix) as typeof node.test,
    branches: node.branches.map(branch => rekeyDocument(branch, prefix))
  };
};

const rekeyDocument = (document: RockboxDocument, prefix: string): RockboxDocument => ({
  ...document,
  nodes: document.nodes.map(node => rekeyNode(node, prefix))
});

const documentUsesPrefix = (document: RockboxDocument, prefix: string): boolean =>
  document.nodes.some(node =>
    node.id.startsWith(`${prefix}:`) ||
    (node.kind === 'conditional' && node.branches.some(branch => documentUsesPrefix(branch, prefix)))
  );

const nextCreatedPrefix = (document: RockboxDocument) => {
  let prefix = `created:${createdSequence++}`;
  while (documentUsesPrefix(document, prefix)) prefix = `created:${createdSequence++}`;
  return prefix;
};

export const replaceConditionalBranch = (
  document: RockboxDocument,
  nodeId: string,
  branchIndex: number,
  source: string
): EditResult => {
  let incompatible = false;
  const result = updateDocumentNode(document, nodeId, node => {
    if (node.kind !== 'conditional' || !node.branches[branchIndex]) {
      incompatible = true;
      return null;
    }
    const branches = [...node.branches];
    branches[branchIndex] = rekeyDocument(parseRockbox(source), nextCreatedPrefix(document));
    return { ...node, branches, dirty: true };
  });
  if (!result.found) return failure(document, 'edit-node-not-found', `Conditional ${nodeId} was not found.`);
  if (incompatible || !result.changed) return failure(document, 'edit-invalid-branch', 'The conditional branch does not exist.');
  return success(result.document);
};

const insertIntoDocument = (document: RockboxDocument, anchor: InsertAnchor, inserted: RockboxNode[]): Mutation => {
  if (anchor.position === 'start' || anchor.position === 'end') {
    const nodes = anchor.position === 'start' ? [...inserted, ...document.nodes] : [...document.nodes, ...inserted];
    return { document: { ...document, nodes, dirty: true }, found: true, changed: inserted.length > 0 };
  }

  let found = false;
  let changed = false;
  const nodes: RockboxNode[] = [];
  document.nodes.forEach(node => {
    if (node.id === anchor.nodeId) {
      found = true;
      changed = true;
      if (anchor.position === 'before') nodes.push(...inserted);
      nodes.push(node);
      if (anchor.position === 'after') nodes.push(...inserted);
      return;
    }
    if (node.kind === 'conditional') {
      let branchChanged = false;
      const branches = node.branches.map(branch => {
        const result = insertIntoDocument(branch, anchor, inserted);
        found ||= result.found;
        branchChanged ||= result.changed;
        return result.document;
      });
      if (branchChanged) {
        nodes.push({ ...node, branches, dirty: true });
        changed = true;
        return;
      }
    }
    nodes.push(node);
  });
  return changed
    ? { document: { ...document, nodes, dirty: true }, found, changed }
    : { document, found, changed: false };
};

export const insertNode = (document: RockboxDocument, anchor: InsertAnchor, source: string): EditResult => {
  const fragment = rekeyDocument(parseRockbox(source), nextCreatedPrefix(document));
  if (fragment.nodes.length === 0) return failure(document, 'edit-empty-insert', 'No source node was provided for insertion.');
  const result = insertIntoDocument(document, anchor, fragment.nodes);
  if (!result.found) return failure(document, 'edit-anchor-not-found', 'The insertion anchor was not found.');
  return success(result.document);
};

const deleteFromDocument = (document: RockboxDocument, nodeId: string): Mutation => {
  let found = false;
  let changed = false;
  const nodes: RockboxNode[] = [];
  document.nodes.forEach(node => {
    if (node.id === nodeId) {
      found = true;
      changed = true;
      return;
    }
    if (node.kind === 'conditional') {
      let branchChanged = false;
      const branches = node.branches.map(branch => {
        const result = deleteFromDocument(branch, nodeId);
        found ||= result.found;
        branchChanged ||= result.changed;
        return result.document;
      });
      if (branchChanged) {
        nodes.push({ ...node, branches, dirty: true });
        changed = true;
        return;
      }
    }
    nodes.push(node);
  });
  return changed
    ? { document: { ...document, nodes, dirty: true }, found, changed }
    : { document, found, changed: false };
};

export const deleteNode = (document: RockboxDocument, nodeId: string): EditResult => {
  const result = deleteFromDocument(document, nodeId);
  return result.found ? success(result.document) : failure(document, 'edit-node-not-found', `Node ${nodeId} was not found.`);
};

const findNode = (document: RockboxDocument, nodeId: string): RockboxNode | null => {
  for (const node of document.nodes) {
    if (node.id === nodeId) return node;
    if (node.kind === 'conditional') {
      for (const branch of node.branches) {
        const found = findNode(branch, nodeId);
        if (found) return found;
      }
    }
  }
  return null;
};

export const moveNode = (
  document: RockboxDocument,
  nodeId: string,
  destination: Omit<InsertAnchor, 'position'> & { position: 'before' | 'after' }
): EditResult => {
  if (nodeId === destination.nodeId) return failure(document, 'edit-invalid-move', 'A node cannot be moved relative to itself.');
  const node = findNode(document, nodeId);
  if (!node) return failure(document, 'edit-node-not-found', `Node ${nodeId} was not found.`);
  if (!destination.nodeId || !findNode(document, destination.nodeId)) return failure(document, 'edit-anchor-not-found', 'The move destination was not found.');
  const removed = deleteFromDocument(document, nodeId);
  const inserted = insertIntoDocument(removed.document, destination, [node]);
  return inserted.found ? success(inserted.document) : failure(document, 'edit-anchor-not-found', 'The move destination was not found.');
};
