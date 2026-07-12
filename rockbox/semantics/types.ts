import type { Diagnostic, SourceSpan } from '../syntax';

export type SourceLink = {
  nodeId: string;
  span: SourceSpan;
};

export type Rect = { x: number; y: number; width: number; height: number };

export type RenderOperation =
  | { type: 'setViewport'; rect: Rect; clip: boolean; source: SourceLink }
  | { type: 'drawText'; rect: Rect; text: string; color: string; fontSize: number; align: 'left' | 'center' | 'right'; scroll: boolean; scrollOffset: number; source: SourceLink }
  | { type: 'drawBitmap'; rect: Rect; assetPath: string; frame: number; frameCount: number; source: SourceLink }
  | { type: 'drawRect'; rect: Rect; color: string; source: SourceLink }
  | { type: 'drawProgress'; rect: Rect; value: number; foreground: string; background: string; mode: 'track' | 'volume' | 'battery'; source: SourceLink }
  | { type: 'drawAlbumArt'; rect: Rect; source: SourceLink }
  | { type: 'setClip'; rect: Rect; source: SourceLink }
  | { type: 'debugOverlay'; rect: Rect; label: string; source: SourceLink };

export type SemanticProperty = {
  key: string;
  label: string;
  value: string;
  input: 'number' | 'text' | 'color' | 'readonly';
};

export type SemanticLayerKind =
  | 'global'
  | 'viewport'
  | 'element'
  | 'conditional'
  | 'branch'
  | 'source-only'
  | 'unsupported';

export type SemanticLayer = {
  id: string;
  sourceNodeId: string;
  parentId?: string;
  depth: number;
  kind: SemanticLayerKind;
  label: string;
  active: boolean;
  supported: boolean;
  properties: SemanticProperty[];
  branchCount?: number;
  selectedBranch?: number;
};

export type BranchOverrides = Record<string, number>;

export type SemanticResult = {
  operations: RenderOperation[];
  layers: SemanticLayer[];
  diagnostics: Diagnostic[];
  valid: boolean;
  stale: boolean;
};
