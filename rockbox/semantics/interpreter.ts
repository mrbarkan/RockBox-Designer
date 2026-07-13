import type { SimulationState, SongMetadata } from '../../types';
import { splitRawArguments } from '../editing/knownTags';
import {
  parseRockbox,
  type ConditionalNode,
  type RockboxDocument,
  type RockboxNode,
  type TagNode
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
  settings?: Record<string, string | number | boolean | undefined>;
  branchOverrides?: BranchOverrides;
};

type Preload = { path: string; x: number; y: number; count: number };
type FontSlot = { name: string; size: number; weight: 'normal' | 'bold' };
type Context = {
  viewport: Rect;
  active: boolean;
  foreground: string;
  background: string;
  align: 'left' | 'center' | 'right';
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  preloads: Map<string, Preload>;
  fontSlots: Map<string, FontSlot>;
  albumArt?: Rect;
  scrollNext: boolean;
  viewportSerial: number;
  visualRows: Map<number, number>;
  nextVisualRow: number;
  sublineSegments: Map<number, number>;
};

const SUPPORTED_TEXT_TAGS = new Set([
  'it', 'ia', 'id', 'iA', 'ig', 'iy', 'in', 'ik', 'ic', 'fn',
  'pc', 'pr', 'pt', 'pp', 'pe', 'fc', 'fb', 'bl', 'pv', 'mp',
  'mm', 'ps', 'cH', 'cM', 'cl', 'cP', 'cp', 'Sx'
]);
const SOURCE_ONLY_TAGS = new Set(['wd', 'we', 'Fl', 'VI', 's', 't', 'VB']);
const SUPPORTED_CONDITIONAL_TAGS = new Set([
  'if', 'and', 'or', 'mp', 'mm', 'bl', 'pv', 'ps', 'mh', 'bc', 'bp', 'bu',
  'lh', 'C', 'mv', 'it', 'ia', 'id', 'pe', 'pt', 'fc', 'ss'
]);

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
  const match = font?.match(/(?:^|\/)(\d+)-/);
  return match ? Number.parseInt(match[1], 10) : fallback;
};
const fontWeight = (font: string | undefined): 'normal' | 'bold' =>
  /bold/i.test(font ?? '') ? 'bold' : 'normal';
const args = (tag: TagNode) => splitRawArguments(tag).map(slot => slot.value);
const sourceLink = (node: RockboxNode): SourceLink => ({ nodeId: node.id, span: node.span });

const viewportRect = (values: string[], offset: number, options: InterpreterOptions): Rect => {
  const rawX = numberValue(values[offset], 0);
  const rawY = numberValue(values[offset + 1], 0);
  const x = rawX < 0 ? options.width + rawX : rawX;
  const y = rawY < 0 ? options.height + rawY : rawY;
  const rawWidth = values[offset + 2];
  const rawHeight = values[offset + 3];
  const widthValue = numberValue(rawWidth, options.width - x);
  const heightValue = numberValue(rawHeight, options.height - y);
  return {
    x,
    y,
    width: widthValue < 0 ? options.width + widthValue - x : widthValue,
    height: heightValue < 0 ? options.height + heightValue - y : heightValue
  };
};

const relativeRect = (context: Context, values: string[], fallback: Rect): Rect => {
  const x = numberValue(values[0], fallback.x - context.viewport.x);
  const y = numberValue(values[1], fallback.y - context.viewport.y);
  const widthValue = numberValue(values[2], fallback.width);
  const heightValue = numberValue(values[3], fallback.height);
  return {
    x: context.viewport.x + x,
    y: context.viewport.y + y,
    width: widthValue < 0 ? context.viewport.width + widthValue - x : widthValue,
    height: heightValue < 0 ? context.viewport.height + heightValue - y : heightValue
  };
};

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

const expressionTagCache = new Map<string, TagNode | undefined>();
const expressionTag = (raw: string) => {
  const clean = raw.trim();
  if (expressionTagCache.has(clean)) return expressionTagCache.get(clean);
  const document = parseRockbox(clean);
  const tag = document.nodes.find((node): node is TagNode => node.kind === 'tag');
  expressionTagCache.set(clean, tag);
  return tag;
};

const settingValue = (name: string, options: InterpreterOptions) => {
  const entry = Object.entries(options.settings ?? {})
    .find(([key]) => key.toLowerCase() === name.trim().toLowerCase());
  if (entry) return entry[1];
  if (name.trim().toLowerCase() === 'lang') return 'english-us';
  return undefined;
};

const scalar = (raw: string, options: InterpreterOptions): string | number | boolean | undefined => {
  const clean = raw.trim();
  if (clean.startsWith('%')) {
    const tag = expressionTag(clean);
    return tag ? tagValue(tag, options) : undefined;
  }
  if (/^-?\d+(?:\.\d+)?$/.test(clean)) return Number(clean);
  return clean;
};

const compare = (left: string | number | boolean | undefined, operator: string, right: string | number | boolean | undefined) => {
  if (left === undefined || right === undefined) return false;
  const leftNumber = typeof left === 'number' ? left : Number(left);
  const rightNumber = typeof right === 'number' ? right : Number(right);
  const numeric = Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && String(left).trim() !== '' && String(right).trim() !== '';
  const a = numeric ? leftNumber : String(left).trim().toLowerCase();
  const b = numeric ? rightNumber : String(right).trim().toLowerCase();
  if (operator === '=' || operator === '==') return a === b;
  if (operator === '!=') return a !== b;
  if (operator === '>') return a > b;
  if (operator === '>=') return a >= b;
  if (operator === '<') return a < b;
  if (operator === '<=') return a <= b;
  return false;
};

function tagValue(tag: TagNode, options: InterpreterOptions): string | number | boolean | undefined {
  const values = args(tag);
  const { sim, song } = options;
  if (tag.name === 'if') return compare(scalar(values[0] ?? '', options), values[1] ?? '=', scalar(values[2] ?? '', options));
  if (tag.name === 'and') return values.every(value => Boolean(scalar(value, options)));
  if (tag.name === 'or') return values.some(value => Boolean(scalar(value, options)));
  if (tag.name === 'St') return settingValue(values[0] ?? '', options);
  if (tag.name === 'ss') {
    const value = String(scalar(values[2] ?? '', options) ?? '');
    const start = numberValue(values[0], 0);
    const length = numberValue(values[1], value.length);
    return value.slice(start < 0 ? value.length + start : start, length < 0 ? undefined : start + length);
  }
  if (tag.name === 'pc') return song.currentSec;
  if (tag.name === 'pt') return song.totalSec;
  if (tag.name === 'pp') return song.trackNum;
  if (tag.name === 'pe') return song.totalTracks;
  if (tag.name === 'bl') return sim.batteryLevel;
  if (tag.name === 'pv') return sim.volume;
  if (tag.name === 'mp') return playbackBranch(sim.playStatus) + 1;
  if (tag.name === 'mm') return ({ off: 1, all: 2, one: 3 })[sim.repeat] ?? 1;
  if (tag.name === 'ps') return sim.shuffle;
  if (tag.name === 'mh') return sim.isHold;
  if (tag.name === 'bc') return sim.isCharging;
  if (tag.name === 'bp') return sim.externalPower;
  if (tag.name === 'bu') return sim.isUsb;
  if (tag.name === 'lh') return sim.diskActivity;
  if (tag.name === 'C') return Boolean(song.albumArt);
  if (tag.name === 'mv') return Date.now() - sim.volumeLastChanged < Number.parseFloat(values[0] ?? '1') * 1000;
  if (tag.name === 'it') return song.title;
  if (tag.name === 'ia') return song.artist;
  if (tag.name === 'id') return song.album;
  if (tag.name === 'fc') return song.format;
  if (SUPPORTED_TEXT_TAGS.has(tag.name)) return textForTag(tag, options);
  return undefined;
}

const conditionalBranch = (node: ConditionalNode, options: InterpreterOptions): number | undefined => {
  const override = options.branchOverrides?.[node.id];
  if (override !== undefined) return Math.max(0, Math.min(node.branches.length - 1, override));
  if (node.test.kind !== 'tag') return node.branches.length ? 0 : undefined;
  const name = node.test.name;
  if (name === 'mp' && node.branches.length > 2) return Math.min(node.branches.length - 1, playbackBranch(options.sim.playStatus));
  if (name === 'mm' && node.branches.length > 2) return Math.min(node.branches.length - 1, ({ off: 0, all: 1, one: 2 })[options.sim.repeat] ?? 0);
  if (name === 'bl' && node.branches.length > 2) return Math.min(node.branches.length - 1, Math.floor(clamp01(options.sim.batteryLevel / 100) * node.branches.length));
  if (name === 'pv' && node.branches.length > 2) return Math.min(node.branches.length - 1, Math.floor(clamp01((options.sim.volume + 90) / 90) * node.branches.length));
  const truthy = Boolean(tagValue(node.test, options));
  if (truthy) return 0;
  return node.branches.length > 1 ? 1 : undefined;
};

const tagProperties = (tag: TagNode): SemanticProperty[] => {
  const values = args(tag);
  const fields: Record<string, Array<[string, string, SemanticProperty['input']]>> = {
    V: [['x', 'X', 'number'], ['y', 'Y', 'number'], ['width', 'Width', 'number'], ['height', 'Height', 'number'], ['font', 'Font slot', 'text']],
    Vl: [['id', 'Viewport ID', 'text'], ['x', 'X', 'number'], ['y', 'Y', 'number'], ['width', 'Width', 'number'], ['height', 'Height', 'number'], ['font', 'Font slot', 'text']],
    Vi: [['id', 'Viewport ID', 'text'], ['x', 'X', 'number'], ['y', 'Y', 'number'], ['width', 'Width', 'number'], ['height', 'Height', 'number'], ['font', 'Font slot', 'text']],
    Vf: [['color', 'Foreground', 'color']], Vb: [['color', 'Background', 'color']],
    xl: [['handle', 'Handle', 'text'], ['path', 'Bitmap path', 'text'], ['x/count', 'X or frames', 'number'], ['y', 'Y', 'number'], ['count', 'Frames', 'number']],
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
  return (fields[tag.name] ?? []).map(([key, label, input], index) => ({ key, label, input, value: values[index] ?? '' }));
};

const collectViewportState = (document: RockboxDocument, options: InterpreterOptions) => {
  const definitions = new Set<string>();
  const collect = (nodes: RockboxNode[]) => nodes.forEach(node => {
    if (node.kind === 'tag' && node.name === 'Vl') definitions.add(args(node)[0] ?? '');
    if (node.kind === 'conditional') node.branches.forEach(branch => collect(branch.nodes));
  });
  collect(document.nodes);

  const enabled = new Set<string>();
  for (let pass = 0; pass < Math.max(2, definitions.size + 1); pass += 1) {
    const before = enabled.size;
    const scan = (nodes: RockboxNode[], initialActive: boolean) => {
      let active = initialActive;
      for (const node of nodes) {
        if (node.kind === 'conditional') {
          if (!active) continue;
          const selected = conditionalBranch(node, options);
          if (selected !== undefined) scan(node.branches[selected]?.nodes ?? [], active);
          continue;
        }
        if (node.kind !== 'tag') continue;
        const values = args(node);
        if (node.name === 'V') active = true;
        else if (node.name === 'Vl') active = enabled.has(values[0] ?? '');
        else if (node.name === 'Vi') active = false;
        else if (node.name === 'Vd' && active && definitions.has(values[0] ?? '')) enabled.add(values[0] ?? '');
      }
    };
    scan(document.nodes, true);
    if (enabled.size === before) break;
  }
  return { definitions, enabled };
};

export const interpretWps = (document: RockboxDocument, options: InterpreterOptions): SemanticResult => {
  const operations: RenderOperation[] = [];
  const layers: SemanticLayer[] = [];
  const textOperations = new Map<string, Extract<RenderOperation, { type: 'drawText' }>>();
  const sourceLines = document.source.split(/\r\n|\r|\n/);
  const { definitions, enabled } = collectViewportState(document, options);
  const initialViewport = { x: 0, y: 0, width: options.width, height: options.height };
  const context: Context = {
    viewport: initialViewport,
    active: true,
    foreground: options.foreground,
    background: options.background,
    align: 'left',
    fontSize: fontSize(options.defaultFont),
    fontWeight: fontWeight(options.defaultFont),
    preloads: new Map(),
    fontSlots: new Map(),
    scrollNext: false,
    viewportSerial: 0,
    visualRows: new Map(),
    nextVisualRow: 0,
    sublineSegments: new Map()
  };

  const addLayer = (
    node: RockboxNode,
    depth: number,
    kind: SemanticLayer['kind'],
    label: string,
    supported: boolean,
    parentId?: string,
    properties: SemanticProperty[] = [],
    active = context.active
  ) => layers.push({ id: `${kind}:${node.id}:${layers.length}`, sourceNodeId: node.id, parentId, depth, kind, label, active, supported, properties });

  const selectedSubline = (line: number) => {
    const durations = [...(sourceLines[line - 1] ?? '').matchAll(/%t\(\s*([\d.]+)/g)]
      .map(match => Number.parseFloat(match[1])).filter(duration => duration > 0);
    if (durations.length < 2) return 0;
    const total = durations.reduce((sum, duration) => sum + duration, 0);
    let cursor = options.sim.sublineCycle % total;
    for (let index = 0; index < durations.length; index += 1) {
      if (cursor < durations[index]) return index;
      cursor -= durations[index];
    }
    return 0;
  };

  const rowForLine = (line: number, current: Context) => {
    const existing = current.visualRows.get(line);
    if (existing !== undefined) return existing;
    const row = current.nextVisualRow;
    current.visualRows.set(line, row);
    current.nextVisualRow += 1;
    return row;
  };

  const drawTextPart = (node: RockboxNode, text: string, line: number, current: Context) => {
    if (!current.active || text.length === 0) return;
    const segment = current.sublineSegments.get(line) ?? 0;
    if (segment !== selectedSubline(line)) return;
    const row = rowForLine(line, current);
    const lineHeight = Math.max(8, current.fontSize);
    const rect = {
      x: current.viewport.x,
      y: current.viewport.y + row * lineHeight,
      width: current.viewport.width,
      height: Math.min(lineHeight, Math.max(0, current.viewport.height - row * lineHeight))
    };
    const key = [current.viewportSerial, line, segment, current.align, current.foreground, current.fontSize, current.fontWeight].join(':');
    const existing = textOperations.get(key);
    if (existing) {
      existing.text += text;
      existing.scroll ||= current.scrollNext;
    } else {
      const operation: Extract<RenderOperation, { type: 'drawText' }> = {
        type: 'drawText', rect, text, color: current.foreground, fontSize: current.fontSize,
        fontWeight: current.fontWeight, align: current.align, scroll: current.scrollNext,
        scrollOffset: options.sim.sublineCycle * 20, source: sourceLink(node)
      };
      operations.push(operation);
      textOperations.set(key, operation);
    }
    current.scrollNext = false;
  };

  const drawTextNode = (node: RockboxNode, text: string, current: Context) => {
    let line = node.span.startLine;
    let buffer = '';
    const flush = () => { if (buffer) drawTextPart(node, buffer, line, current); buffer = ''; };
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (character === ';') {
        flush();
        current.sublineSegments.set(line, (current.sublineSegments.get(line) ?? 0) + 1);
      } else if (character === '\r' || character === '\n') {
        flush();
        if (character === '\r' && text[index + 1] === '\n') index += 1;
        line += 1;
      } else {
        buffer += character;
      }
    }
    flush();
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

  const conditionalSupported = (node: ConditionalNode) =>
    node.test.kind === 'tag' && SUPPORTED_CONDITIONAL_TAGS.has(node.test.name);

  const inventoryInactive = (nodes: RockboxNode[], depth: number, parentId: string) => {
    for (const node of nodes) {
      if (node.kind === 'conditional') {
        const layerId = `conditional:${node.id}:${layers.length}`;
        const selected = conditionalBranch(node, options);
        layers.push({
          id: layerId, sourceNodeId: node.id, parentId, depth, kind: 'conditional',
          label: `Conditional %?${node.test.kind === 'tag' ? node.test.name : 'invalid'}`,
          active: false, supported: conditionalSupported(node), properties: [],
          branchCount: node.branches.length, selectedBranch: selected
        });
        node.branches.forEach((branch, index) => {
          const branchId = `branch:${node.id}:${index}`;
          layers.push({ id: branchId, sourceNodeId: node.id, parentId: layerId, depth: depth + 1, kind: 'branch', label: `Branch ${index + 1}`, active: false, supported: true, properties: [] });
          inventoryInactive(branch.nodes, depth + 2, branchId);
        });
        continue;
      }
      const label = node.kind === 'tag' ? `%${node.name}` :
        node.kind === 'text' ? `Text: ${node.value.replace(/[\r\n]+/g, ' ').trim().slice(0, 32)}` :
        node.kind === 'invalid' ? `Invalid: ${node.reason}` : node.kind;
      const kind = inactiveKind(node);
      addLayer(node, depth, kind, label, kind !== 'unsupported', parentId, node.kind === 'tag' ? tagProperties(node) : [], false);
    }
  };

  const resetViewportTextState = (current: Context) => {
    current.viewportSerial += 1;
    current.visualRows = new Map();
    current.nextVisualRow = 0;
    current.sublineSegments = new Map();
    current.align = 'left';
    current.foreground = options.foreground;
    current.background = options.background;
    current.fontSize = fontSize(options.defaultFont);
    current.fontWeight = fontWeight(options.defaultFont);
    current.scrollNext = false;
  };

  const walk = (nodes: RockboxNode[], current: Context, depth: number, parentId?: string) => {
    for (const node of nodes) {
      if (node.kind === 'comment') {
        // Comments belong to the lossless source document, not the visual layer
        // projection. They remain byte-for-byte available in the source editor.
        continue;
      }
      if (node.kind === 'escape') {
        addLayer(node, depth, 'source-only', 'Escaped source', true, parentId, [], current.active);
        continue;
      }
      if (node.kind === 'invalid') {
        addLayer(node, depth, 'unsupported', `Invalid: ${node.reason}`, false, parentId, [], current.active);
        continue;
      }
      if (node.kind === 'text') {
        if (!current.active) {
          if (node.value.trim()) addLayer(node, depth, 'element', `Text: ${node.value.replace(/[\r\n]+/g, ' ').trim().slice(0, 32)}`, true, parentId, [], false);
          continue;
        }
        if (node.value.replace(/[;\s]/g, '')) {
          addLayer(node, depth, 'element', `Text: ${node.value.replace(/[\r\n]+/g, ' ').trim().slice(0, 32)}`, true, parentId, [{ key: 'value', label: 'Text', value: node.value, input: 'text' }]);
        }
        drawTextNode(node, node.value, current);
        continue;
      }
      if (node.kind === 'conditional') {
        if (!current.active) {
          const holder = `inactive:${node.id}:${layers.length}`;
          layers.push({ id: holder, sourceNodeId: node.id, parentId, depth, kind: 'conditional', label: `Conditional %?${node.test.kind === 'tag' ? node.test.name : 'invalid'}`, active: false, supported: conditionalSupported(node), properties: [], branchCount: node.branches.length, selectedBranch: conditionalBranch(node, options) });
          node.branches.forEach((branch, index) => inventoryInactive(branch.nodes, depth + 2, `branch:${node.id}:${index}`));
          continue;
        }
        const selected = conditionalBranch(node, options);
        const layerId = `conditional:${node.id}:${layers.length}`;
        layers.push({
          id: layerId, sourceNodeId: node.id, parentId, depth, kind: 'conditional',
          label: `Conditional %?${node.test.kind === 'tag' ? node.test.name : 'invalid'}`,
          active: true, supported: conditionalSupported(node), properties: [],
          branchCount: node.branches.length, selectedBranch: selected
        });
        node.branches.forEach((branch, index) => {
          const branchId = `branch:${node.id}:${index}`;
          layers.push({ id: branchId, sourceNodeId: node.id, parentId: layerId, depth: depth + 1, kind: 'branch', label: `Branch ${index + 1}`, active: index === selected, supported: true, properties: [] });
          if (index === selected) walk(branch.nodes, current, depth + 2, branchId);
          else inventoryInactive(branch.nodes, depth + 2, branchId);
        });
        continue;
      }

      const values = args(node);
      const link = sourceLink(node);
      const properties = tagProperties(node);
      if (['V', 'Vl', 'Vi'].includes(node.name)) {
        const offset = node.name === 'V' ? 0 : 1;
        current.viewport = viewportRect(values, offset, options);
        current.active = node.name === 'V' ? true : node.name === 'Vl' ? enabled.has(values[0] ?? '') : false;
        resetViewportTextState(current);
        const slot = values[offset + 4];
        if (slot && slot !== '-') {
          const loaded = current.fontSlots.get(slot);
          current.fontSize = loaded?.size ?? fontSize(slot, current.fontSize);
          current.fontWeight = loaded?.weight ?? fontWeight(slot);
        }
        if (current.active) operations.push({ type: 'setViewport', rect: current.viewport, clip: true, source: link });
        addLayer(node, depth, 'viewport', node.name === 'V' ? 'Viewport' : `Viewport ${values[0] ?? ''}`, true, parentId, properties, current.active);
        continue;
      }

      if (!current.active) {
        const kind = inactiveKind(node);
        addLayer(node, depth, kind, node.kind === 'tag' ? `%${node.name}` : kind, kind !== 'unsupported', parentId, properties, false);
        continue;
      }

      if (node.name === 'Vd') {
        const label = values[0] ?? '';
        addLayer(node, depth, 'source-only', `Enable viewport ${label}`, definitions.has(label), parentId, properties);
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
      if (node.name === 'Fl') {
        const name = values[1] ?? '';
        current.fontSlots.set(values[0] ?? '', { name, size: fontSize(name, current.fontSize), weight: fontWeight(name) });
        addLayer(node, depth, 'global', `Font slot ${values[0] ?? ''}: ${name}`, true, parentId, properties);
        continue;
      }
      if (node.name === 'Fn') {
        const loaded = current.fontSlots.get(values[0] ?? '');
        current.fontSize = loaded?.size ?? fontSize(values[0], current.fontSize);
        current.fontWeight = loaded?.weight ?? fontWeight(values[0]);
        addLayer(node, depth, 'source-only', `Font ${values[0] ?? ''}`, true, parentId, properties);
        continue;
      }
      if (node.name === 's') {
        current.scrollNext = true;
        addLayer(node, depth, 'source-only', 'Scroll next line', true, parentId);
        continue;
      }
      if (node.name === 'xl') {
        const compact = values.length === 3;
        current.preloads.set(values[0] ?? '', {
          path: values[1] ?? '',
          x: compact ? 0 : numberValue(values[2], 0),
          y: compact ? 0 : numberValue(values[3], 0),
          count: Math.max(1, numberValue(compact ? values[2] : values[4], 1))
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
          const drawable = !rawFrame.includes('%bs');
          let frame = rawFrame.includes('%bl') ? Math.floor(clamp01(options.sim.batteryLevel / 100) * (preload.count - 1)) :
            rawFrame.includes('%mp') ? playbackBranch(options.sim.playStatus) :
            rawFrame.includes('%ps') ? (options.sim.shuffle ? 1 : 0) :
            rawFrame.includes('%mm') ? ({ off: 0, all: 1, one: 2 })[options.sim.repeat] :
            rawFrame.includes('%mh') ? (options.sim.isHold ? 1 : 0) :
            Math.max(0, numberValue(rawFrame, 1) - 1);
          frame = Math.max(0, Math.min(preload.count - 1, frame));
          const rect = { x: current.viewport.x + preload.x, y: current.viewport.y + preload.y, width: current.viewport.width, height: current.viewport.height };
          if (drawable) operations.push({ type: 'drawBitmap', rect, assetPath: preload.path, frame, frameCount: preload.count, source: link });
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
        operations.push({ type: 'drawAlbumArt', rect: current.albumArt ?? current.viewport, source: link });
        addLayer(node, depth, 'element', 'Album art', true, parentId);
        continue;
      }
      if (node.name === 'pb' || (node.name === 'pv' && values.length > 0)) {
        const hasGeometry = values.length >= 4 && values.slice(0, 4).some(value => value !== '');
        const rect = hasGeometry ? relativeRect(current, values, current.viewport) : current.viewport;
        const value = node.name === 'pb'
          ? clamp01(options.song.totalSec ? options.song.currentSec / options.song.totalSec : 0)
          : clamp01((options.sim.volume + 90) / 90);
        const named: Record<string, string> = {};
        for (let index = 5; index < values.length - 1; index += 2) named[values[index].toLowerCase()] = values[index + 1];
        operations.push({
          type: 'drawProgress', rect, value, foreground: current.foreground,
          background: current.background, mode: node.name === 'pb' ? 'track' : 'volume',
          image: values[4] && values[4] !== '-' ? values[4] : undefined,
          slider: named.slider ? current.preloads.get(named.slider)?.path ?? named.slider : undefined,
          backdrop: named.backdrop ? current.preloads.get(named.backdrop)?.path ?? named.backdrop : undefined,
          source: link
        });
        addLayer(node, depth, 'element', node.name === 'pb' ? 'Track progress' : 'Volume bar', true, parentId, properties);
        continue;
      }
      if (node.name === 'dr') {
        operations.push({ type: 'drawRect', rect: relativeRect(current, values, current.viewport), color: normalizeColor(values[4], current.foreground), source: link });
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
        drawTextPart(node, textForTag(node, options), node.span.startLine, current);
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
    operations: operations.filter(operation => operation.type !== 'drawText' || operation.text.trim().length > 0),
    layers,
    diagnostics: document.diagnostics,
    valid: !document.diagnostics.some(diagnostic => diagnostic.severity === 'error'),
    stale: false
  };
};
