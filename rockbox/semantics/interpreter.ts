import type { SimulationState, SongMetadata } from '../../types';
import { splitRawArguments } from '../editing/knownTags';
import type {
  ConditionalNode,
  RockboxDocument,
  RockboxNode,
  TagNode
} from '../syntax';
import type {
  BranchOverrides,
  Rect,
  RenderOperation,
  SemanticLayer,
  SemanticProperty,
  SemanticResult,
  SourceLink
} from './types';

export type InterpreterOptions = {
  width: number;
  height: number;
  defaultFont: string;
  foreground: string;
  background: string;
  sim: SimulationState;
  song: SongMetadata;
  branchOverrides?: BranchOverrides;
};

type Preload = { path: string; x: number; y: number; count: number };
type Context = {
  viewport: Rect;
  namedViewports: Map<string, Rect>;
  foreground: string;
  background: string;
  align: 'left' | 'center' | 'right';
  fontSize: number;
  lineOrigin: number;
  preloads: Map<string, Preload>;
  albumArt?: Rect;
  scrollNext: boolean;
};

const SUPPORTED_TEXT_TAGS = new Set([
  'it', 'ia', 'id', 'iA', 'ig', 'iy', 'in', 'ik', 'ic', 'fn',
  'pc', 'pr', 'pt', 'pp', 'pe', 'fc', 'fb', 'bl', 'pv', 'mp',
  'mm', 'ps', 'cH', 'cM', 'cl', 'cP', 'cp', 'Sx'
]);
const SOURCE_ONLY_TAGS = new Set(['wd', 'we', 'Fl', 'VI', 'Vd', 's', 't']);
const SUPPORTED_CONDITIONAL_TAGS = new Set(['mp', 'mm', 'bl', 'pv', 'ps', 'mh', 'bc', 'bp', 'bu', 'lh', 'C', 'mv']);

const numberValue = (value: string | undefined, fallback: number) => {
  if (value === '-' || value === '') return fallback;
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const playbackBranch = (status: SimulationState['playStatus']) =>
  ({ stop: 0, play: 1, pause: 2, ffwd: 3, rew: 4 })[status] ?? 0;
const normalizeColor = (value: string | undefined, fallback: string) => {
  const clean = (value ?? '').replace(/^0x/i, '').replace(/^#/, '').trim();
  return /^[0-9a-f]{6}$/i.test(clean) ? `#${clean}` : fallback;
};
const fontSize = (font: string | undefined, fallback = 14) => {
  const match = font?.match(/(\d+)/);
  return match ? Number.parseInt(match[1], 10) : fallback;
};
const args = (tag: TagNode) => splitRawArguments(tag).map(slot => slot.value);
const sourceLink = (node: RockboxNode): SourceLink => ({ nodeId: node.id, span: node.span });
const relativeRect = (context: Context, values: string[], fallback: Rect): Rect => ({
  x: context.viewport.x + numberValue(values[0], fallback.x - context.viewport.x),
  y: context.viewport.y + numberValue(values[1], fallback.y - context.viewport.y),
  width: numberValue(values[2], fallback.width),
  height: numberValue(values[3], fallback.height)
});

const textForTag = (tag: TagNode, options: InterpreterOptions) => {
  const { song, sim } = options;
  const elapsed = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const values: Record<string, string> = {
    it: song.title || 'No title', ia: song.artist || 'No artist', id: song.album || 'No album',
    iA: song.artist || 'No artist', ig: 'Genre', iy: '2026', in: String(song.trackNum), ik: '1',
    ic: '', fn: song.title || 'No title', pc: elapsed(song.currentSec), pt: elapsed(song.totalSec),
    pr: `-${elapsed(Math.max(0, song.totalSec - song.currentSec))}`, pp: String(song.trackNum),
    pe: String(song.totalTracks), fc: song.format, fb: String(song.kbps), bl: String(sim.batteryLevel),
    pv: `${sim.volume} dB`, mp: sim.playStatus, mm: sim.repeat, ps: sim.shuffle ? 'Shuffle' : '',
    cH: sim.currentTime.split(':')[0] ?? '00', cM: sim.currentTime.split(':')[1] ?? '00',
    cl: String(Number.parseInt(sim.currentTime.split(':')[0] ?? '0', 10) % 12 || 12),
    cP: Number.parseInt(sim.currentTime.split(':')[0] ?? '0', 10) >= 12 ? 'PM' : 'AM',
    cp: Number.parseInt(sim.currentTime.split(':')[0] ?? '0', 10) >= 12 ? 'pm' : 'am'
  };
  if (tag.name === 'Sx') return args(tag)[0] ?? '';
  return values[tag.name] ?? `%${tag.name}`;
};

const conditionalBranch = (
  node: ConditionalNode,
  options: InterpreterOptions
) => {
  const override = options.branchOverrides?.[node.id];
  if (override !== undefined) return Math.max(0, Math.min(node.branches.length - 1, override));
  if (node.test.kind !== 'tag') return 0;
  const { sim, song } = options;
  const name = node.test.name;
  if (name === 'mp') return playbackBranch(sim.playStatus);
  if (name === 'mm') return { off: 0, all: 1, one: 2 }[sim.repeat] ?? 0;
  if (name === 'bl') return Math.min(node.branches.length - 1, Math.floor(clamp01(sim.batteryLevel / 100) * node.branches.length));
  if (name === 'pv') return Math.min(node.branches.length - 1, Math.floor(clamp01((sim.volume + 90) / 90) * node.branches.length));
  const truthy = name === 'ps' ? sim.shuffle :
    name === 'mh' ? sim.isHold :
    name === 'bc' ? sim.isCharging :
    name === 'bp' ? sim.externalPower :
    name === 'bu' ? sim.isUsb :
    name === 'lh' ? sim.diskActivity :
    name === 'C' ? Boolean(song.albumArt) :
    name === 'mv' ? Date.now() - sim.volumeLastChanged < numberValue(args(node.test)[0], 1) * 1000 : true;
  return truthy ? 0 : Math.min(1, node.branches.length - 1);
};

const tagProperties = (tag: TagNode): SemanticProperty[] => {
  const values = args(tag);
  const fields: Record<string, Array<[string, string, SemanticProperty['input']]>> = {
    V: [['x', 'X', 'number'], ['y', 'Y', 'number'], ['width', 'Width', 'number'], ['height', 'Height', 'number'], ['font', 'Font slot', 'text']],
    Vl: [['id', 'Viewport ID', 'text'], ['x', 'X', 'number'], ['y', 'Y', 'number'], ['width', 'Width', 'number'], ['height', 'Height', 'number'], ['font', 'Font slot', 'text']],
    Vi: [['id', 'Viewport ID', 'text'], ['x', 'X', 'number'], ['y', 'Y', 'number'], ['width', 'Width', 'number'], ['height', 'Height', 'number'], ['font', 'Font slot', 'text']],
    Vf: [['color', 'Foreground', 'color']], Vb: [['color', 'Background', 'color']],
    xl: [['handle', 'Handle', 'text'], ['path', 'Bitmap path', 'text'], ['x', 'X', 'number'], ['y', 'Y', 'number'], ['count', 'Frames', 'number']],
    xd: [['handle', 'Handle', 'text'], ['index', 'Frame', 'text']],
    pb: [['x', 'X', 'number'], ['y', 'Y', 'number'], ['width', 'Width', 'number'], ['height', 'Height', 'number'], ['path', 'Bitmap path', 'text']],
    pv: [['x', 'X', 'number'], ['y', 'Y', 'number'], ['width', 'Width', 'number'], ['height', 'Height', 'number'], ['path', 'Bitmap path', 'text']],
    Cl: [['x', 'X', 'number'], ['y', 'Y', 'number'], ['width', 'Width', 'number'], ['height', 'Height', 'number']],
    T: [['x', 'X', 'number'], ['y', 'Y', 'number'], ['width', 'Width', 'number'], ['height', 'Height', 'number'], ['action', 'Action', 'text']]
  };
  if (tag.name === 'x') {
    const modern = tag.invocationStyle === 'parentheses' && values.length >= 4;
    const schema = modern
      ? [['handle', 'Handle', 'text'], ['path', 'Bitmap path', 'text'], ['x', 'X', 'number'], ['y', 'Y', 'number']]
      : [['path', 'Bitmap path', 'text'], ['x', 'X', 'number'], ['y', 'Y', 'number']];
    return schema.map(([key, label, input], index) => ({ key, label, input, value: values[index] ?? '' })) as SemanticProperty[];
  }
  return (fields[tag.name] ?? []).map(([key, label, input], index) => ({
    key, label, input, value: values[index] ?? ''
  }));
};

export const interpretWps = (
  document: RockboxDocument,
  options: InterpreterOptions
): SemanticResult => {
  const operations: RenderOperation[] = [];
  const layers: SemanticLayer[] = [];
  const initialViewport = { x: 0, y: 0, width: options.width, height: options.height };
  const context: Context = {
    viewport: initialViewport,
    namedViewports: new Map(),
    foreground: options.foreground,
    background: options.background,
    align: 'left',
    fontSize: fontSize(options.defaultFont),
    lineOrigin: 1,
    preloads: new Map(),
    scrollNext: false
  };

  const addLayer = (
    node: RockboxNode,
    depth: number,
    kind: SemanticLayer['kind'],
    label: string,
    supported: boolean,
    parentId?: string,
    properties: SemanticProperty[] = [],
    active = true
  ) => layers.push({
    id: `${kind}:${node.id}:${layers.length}`,
    sourceNodeId: node.id,
    parentId,
    depth,
    kind,
    label,
    active,
    supported,
    properties
  });

  const drawText = (node: RockboxNode, text: string, current: Context) => {
    if (!text.trim()) return;
    const line = Math.max(0, node.span.startLine - current.lineOrigin);
    const rect = {
      x: current.viewport.x,
      y: current.viewport.y + line * Math.max(8, current.fontSize + 2),
      width: current.viewport.width,
      height: Math.max(8, current.fontSize + 2)
    };
    operations.push({
      type: 'drawText', rect, text: text.replace(/[\r\n]+/g, ' ').trim(),
      color: current.foreground, fontSize: current.fontSize, align: current.align,
      scroll: current.scrollNext, scrollOffset: options.sim.sublineCycle * 20,
      source: sourceLink(node)
    });
    current.scrollNext = false;
  };

  const inactiveKind = (node: RockboxNode): SemanticLayer['kind'] => {
    if (node.kind === 'comment' || node.kind === 'escape') return 'source-only';
    if (node.kind === 'invalid') return 'unsupported';
    if (node.kind === 'text') return 'element';
    if (node.kind === 'conditional') return 'conditional';
    if (['V', 'Vl', 'Vi'].includes(node.name)) return 'viewport';
    if (SUPPORTED_TEXT_TAGS.has(node.name) || ['x', 'xd', 'Cl', 'Cd', 'pb', 'pv', 'dr', 'T'].includes(node.name)) return 'element';
    if (SOURCE_ONLY_TAGS.has(node.name) || ['Vd', 'Vf', 'Vb', 'al', 'ac', 'ar', 'Fn'].includes(node.name)) return 'source-only';
    if (node.name === 'xl') return 'global';
    return 'unsupported';
  };

  const inventoryInactive = (nodes: RockboxNode[], depth: number, parentId: string) => {
    for (const node of nodes) {
      if (node.kind === 'conditional') {
        const layerId = `conditional:${node.id}:${layers.length}`;
        layers.push({
          id: layerId, sourceNodeId: node.id, parentId, depth, kind: 'conditional',
          label: `Conditional %?${node.test.kind === 'tag' ? node.test.name : 'invalid'}`,
          active: false, supported: node.test.kind === 'tag' && SUPPORTED_CONDITIONAL_TAGS.has(node.test.name), properties: [],
          branchCount: node.branches.length, selectedBranch: conditionalBranch(node, options)
        });
        node.branches.forEach((branch, index) => {
          const branchId = `branch:${node.id}:${index}`;
          layers.push({
            id: branchId, sourceNodeId: node.id, parentId: layerId, depth: depth + 1,
            kind: 'branch', label: `Branch ${index + 1}`, active: false, supported: true, properties: []
          });
          inventoryInactive(branch.nodes, depth + 2, branchId);
        });
        continue;
      }
      const label = node.kind === 'tag' ? `%${node.name}` :
        node.kind === 'text' ? `Text: ${node.value.replace(/[\r\n]+/g, ' ').trim().slice(0, 32)}` :
        node.kind === 'invalid' ? `Invalid: ${node.reason}` : node.kind;
      addLayer(node, depth, inactiveKind(node), label, inactiveKind(node) !== 'unsupported', parentId, node.kind === 'tag' ? tagProperties(node) : [], false);
    }
  };

  const walk = (nodes: RockboxNode[], current: Context, depth: number, parentId?: string) => {
    for (const node of nodes) {
      if (node.kind === 'comment' || node.kind === 'escape') {
        addLayer(node, depth, 'source-only', node.kind === 'comment' ? 'Comment' : 'Escaped source', true, parentId);
        continue;
      }
      if (node.kind === 'invalid') {
        addLayer(node, depth, 'unsupported', `Invalid: ${node.reason}`, false, parentId);
        continue;
      }
      if (node.kind === 'text') {
        if (node.value.trim()) {
          addLayer(node, depth, 'element', `Text: ${node.value.replace(/[\r\n]+/g, ' ').trim().slice(0, 32)}`, true, parentId, [
            { key: 'value', label: 'Text', value: node.value, input: 'text' }
          ]);
          drawText(node, node.value, current);
        }
        continue;
      }
      if (node.kind === 'conditional') {
        const selected = conditionalBranch(node, options);
        const layerId = `conditional:${node.id}:${layers.length}`;
        layers.push({
          id: layerId, sourceNodeId: node.id, parentId, depth, kind: 'conditional',
          label: `Conditional %?${node.test.kind === 'tag' ? node.test.name : 'invalid'}`,
          active: true, supported: node.test.kind === 'tag' && SUPPORTED_CONDITIONAL_TAGS.has(node.test.name), properties: [],
          branchCount: node.branches.length, selectedBranch: selected
        });
        node.branches.forEach((branch, index) => {
          const branchId = `branch:${node.id}:${index}`;
          layers.push({
            id: branchId, sourceNodeId: node.id, parentId: layerId, depth: depth + 1,
            kind: 'branch', label: `Branch ${index + 1}`, active: index === selected,
            supported: true, properties: []
          });
          if (index === selected) walk(branch.nodes, { ...current, viewport: { ...current.viewport } }, depth + 2, branchId);
          else inventoryInactive(branch.nodes, depth + 2, branchId);
        });
        continue;
      }

      const values = args(node);
      const link = sourceLink(node);
      const properties = tagProperties(node);
      if (['V', 'Vl', 'Vi'].includes(node.name)) {
        const offset = node.name === 'V' ? 0 : 1;
        const rect = {
          x: numberValue(values[offset], 0), y: numberValue(values[offset + 1], 0),
          width: numberValue(values[offset + 2], options.width),
          height: numberValue(values[offset + 3], options.height)
        };
        if (node.name !== 'V') current.namedViewports.set(values[0] ?? '', rect);
        current.viewport = rect;
        current.lineOrigin = node.span.startLine;
        const font = values[offset + 4];
        if (font && font !== '-') current.fontSize = fontSize(font, current.fontSize);
        operations.push({ type: 'setViewport', rect, clip: true, source: link });
        addLayer(node, depth, 'viewport', `${node.name === 'V' ? 'Viewport' : `Viewport ${values[0] ?? ''}`}`, true, parentId, properties);
        continue;
      }
      if (node.name === 'Vd') {
        const rect = current.namedViewports.get(values[0] ?? '');
        if (rect) {
          current.viewport = rect;
          current.lineOrigin = node.span.startLine;
          operations.push({ type: 'setViewport', rect, clip: true, source: link });
        }
        addLayer(node, depth, 'source-only', `Enable viewport ${values[0] ?? ''}`, Boolean(rect), parentId, properties);
        continue;
      }
      if (node.name === 'Vf' || node.name === 'Vb') {
        const color = normalizeColor(values[0], node.name === 'Vf' ? current.foreground : current.background);
        if (node.name === 'Vf') current.foreground = color;
        else current.background = color;
        addLayer(node, depth, 'source-only', `${node.name === 'Vf' ? 'Foreground' : 'Background'} ${color}`, true, parentId, properties);
        continue;
      }
      if (node.name === 'al' || node.name === 'ac' || node.name === 'ar') {
        current.align = node.name === 'al' ? 'left' : node.name === 'ac' ? 'center' : 'right';
        addLayer(node, depth, 'source-only', `Align ${current.align}`, true, parentId);
        continue;
      }
      if (node.name === 'Fn') {
        current.fontSize = fontSize(values[0], current.fontSize);
        addLayer(node, depth, 'source-only', `Font ${values[0] ?? ''}`, true, parentId, properties);
        continue;
      }
      if (node.name === 's') {
        current.scrollNext = true;
        addLayer(node, depth, 'source-only', 'Scroll next line', true, parentId);
        continue;
      }
      if (node.name === 'xl') {
        current.preloads.set(values[0] ?? '', {
          path: values[1] ?? '', x: numberValue(values[2], 0), y: numberValue(values[3], 0), count: Math.max(1, numberValue(values[4], 1))
        });
        addLayer(node, depth, 'global', `Preload ${values[0] ?? ''}: ${values[1] ?? ''}`, true, parentId, properties);
        continue;
      }
      if (node.name === 'x') {
        const modern = node.invocationStyle === 'parentheses' && values.length >= 4;
        const path = values[modern ? 1 : 0] ?? '';
        const x = numberValue(values[modern ? 2 : 1], 0);
        const y = numberValue(values[modern ? 3 : 2], 0);
        const rect = { x: current.viewport.x + x, y: current.viewport.y + y, width: current.viewport.width - x, height: current.viewport.height - y };
        operations.push({ type: 'drawBitmap', rect, assetPath: path, frame: 0, frameCount: 1, source: link });
        addLayer(node, depth, 'element', `Bitmap ${path}`, true, parentId, properties);
        continue;
      }
      if (node.name === 'xd') {
        const preload = current.preloads.get(values[0] ?? '');
        if (preload) {
          const rawFrame = values[1] ?? '1';
          const frame = rawFrame.includes('%bl') ? Math.floor(clamp01(options.sim.batteryLevel / 100) * (preload.count - 1)) :
            rawFrame.includes('%mp') ? playbackBranch(options.sim.playStatus) :
            Math.max(0, numberValue(rawFrame, 1) - 1);
          const rect = { x: current.viewport.x + preload.x, y: current.viewport.y + preload.y, width: current.viewport.width, height: current.viewport.height };
          operations.push({ type: 'drawBitmap', rect, assetPath: preload.path, frame, frameCount: preload.count, source: link });
        }
        addLayer(node, depth, preload ? 'element' : 'unsupported', `Sprite ${values[0] ?? ''}`, Boolean(preload), parentId, properties);
        continue;
      }
      if (node.name === 'Cl') {
        current.albumArt = relativeRect(current, values, current.viewport);
        addLayer(node, depth, 'element', 'Album art area', true, parentId, properties);
        continue;
      }
      if (node.name === 'Cd') {
        const rect = current.albumArt ?? current.viewport;
        operations.push({ type: 'drawAlbumArt', rect, source: link });
        addLayer(node, depth, 'element', 'Album art', true, parentId);
        continue;
      }
      if (node.name === 'pb' || node.name === 'pv') {
        const hasGeometry = values.length >= 4 && values.slice(0, 4).some(value => value !== '');
        const rect = hasGeometry ? relativeRect(current, values, current.viewport) : current.viewport;
        const value = node.name === 'pb'
          ? clamp01(options.song.totalSec ? options.song.currentSec / options.song.totalSec : 0)
          : clamp01((options.sim.volume + 90) / 90);
        operations.push({
          type: 'drawProgress', rect, value, foreground: current.foreground,
          background: current.background, mode: node.name === 'pb' ? 'track' : 'volume', source: link
        });
        addLayer(node, depth, 'element', node.name === 'pb' ? 'Track progress' : 'Volume bar', true, parentId, properties);
        continue;
      }
      if (node.name === 'dr') {
        const rect = relativeRect(current, values, current.viewport);
        operations.push({ type: 'drawRect', rect, color: normalizeColor(values[4], current.foreground), source: link });
        addLayer(node, depth, 'element', 'Rectangle', true, parentId, properties);
        continue;
      }
      if (node.name === 'T') {
        const rect = relativeRect(current, values, current.viewport);
        operations.push({ type: 'debugOverlay', rect, label: `Touch: ${values[4] ?? 'action'}`, source: link });
        addLayer(node, depth, 'element', `Touch ${values[4] ?? ''}`, true, parentId, properties);
        continue;
      }
      if (SUPPORTED_TEXT_TAGS.has(node.name)) {
        drawText(node, textForTag(node, options), current);
        addLayer(node, depth, 'element', `Metadata %${node.name}`, true, parentId, properties);
        continue;
      }
      if (SOURCE_ONLY_TAGS.has(node.name)) {
        addLayer(node, depth, 'source-only', `Source %${node.name}`, true, parentId, properties);
        continue;
      }
      addLayer(node, depth, 'unsupported', `Unsupported %${node.name}`, false, parentId, properties);
    }
  };

  walk(document.nodes, context, 0);
  return {
    operations,
    layers,
    diagnostics: document.diagnostics,
    valid: !document.diagnostics.some(diagnostic => diagnostic.severity === 'error'),
    stale: false
  };
};
