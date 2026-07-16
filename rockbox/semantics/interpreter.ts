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
  SkinScreen,
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
  screen?: SkinScreen;
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
  'mm', 'ps', 'cH', 'cM', 'cl', 'cP', 'cp', 'Sx', 'cs',
  'Lt', 'LT', 'LN', 'LR', 'LC',
  'tf', 'ta', 'tb', 'tr', 'tl', 'th', 'Tn', 'Tf', 'Ti', 'Tc', 'ty', 'tz',
  'QT', 'QB', 'QL', 'QR', 'Qt', 'Qb', 'Ql', 'Qr'
]);
const SOURCE_ONLY_TAGS = new Set(['wd', 'we', 'Fl', 'VI', 's', 't', 'VB', 'Lb', 'Vp', 'Vs', 'Vg', 'wi']);
const SUPPORTED_CONDITIONAL_TAGS = new Set([
  'if', 'and', 'or', 'mp', 'mm', 'bl', 'pv', 'ps', 'mh', 'bc', 'bp', 'bu',
  'lh', 'C', 'mv', 'it', 'ia', 'id', 'pe', 'pt', 'fc', 'ss', 'cs',
  'cf', 'Lc', 'tp', 'tt', 'tm', 'ts', 'tx'
]);

const DIRECTLY_INTERPRETED_TAGS = new Set([
  'V', 'Vl', 'Vi', 'Vd', 'VI', 'Vf', 'Vb', 'al', 'ac', 'ar', 'Fl', 'Fn', 's',
  'xl', 'x', 'xd', 'Cl', 'Cd', 'pb', 'pv', 'tr', 'dr', 'T', 'LI', 'Li', 'LB'
]);

/**
 * Phase 4 compatibility evidence reads this catalog instead of inferring
 * support from the generated upstream name registry. A known name is not a
 * claim that the browser understands or draws it.
 */
export const semanticTagSupport = {
  interpreted: new Set([
    ...DIRECTLY_INTERPRETED_TAGS,
    ...SUPPORTED_TEXT_TAGS,
    ...SUPPORTED_CONDITIONAL_TAGS
  ]),
  rendered: new Set([
    ...DIRECTLY_INTERPRETED_TAGS,
    ...SUPPORTED_TEXT_TAGS,
    ...SUPPORTED_CONDITIONAL_TAGS
  ]),
  // These tags have both a visible property surface and a source-aware edit
  // schema. Tags that merely have a low-level serializer helper are excluded.
  editable: new Set(['V', 'Vl', 'Vi', 'Vf', 'Vb', 'x', 'xl', 'xd', 'pb', 'pv', 'Cl', 'T'])
} as const;

const numberValue = (value: string | undefined, fallback: number) => {
  if (value === '-' || value === '') return fallback;
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const ROCKBOX_THEMEABLE_ICON_COUNT = 32;
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
  const [clockHour = '0', clockMinute = '00'] = sim.currentTime.split(':');
  const hour = Number.parseInt(clockHour, 10) || 0;
  const values: Record<string, string> = {
    it: song.title || 'No title', ia: song.artist || 'No artist', id: song.album || 'No album',
    iA: song.artist || 'No artist', ig: 'Genre', iy: '2026', in: String(song.trackNum), ik: '1',
    ic: '', fn: song.title || 'No title', pc: elapsed(song.currentSec), pt: elapsed(song.totalSec),
    pr: `-${elapsed(Math.max(0, song.totalSec - song.currentSec))}`, pp: String(song.trackNum),
    pe: String(song.totalTracks), fc: song.format, fb: String(song.kbps), bl: String(sim.batteryLevel),
    pv: `${sim.volume} dB`, mp: sim.playStatus, mm: sim.repeat, ps: sim.shuffle ? 'Shuffle' : '',
    cH: String(hour).padStart(2, '0'), cM: clockMinute.slice(0, 2).padStart(2, '0'),
    cl: String(hour % 12 || 12),
    cP: hour >= 12 ? 'PM' : 'AM',
    cp: hour >= 12 ? 'pm' : 'am',
    cs: String(sim.currentActivity), Lt: sim.menuTitle,
    LT: sim.menuItems[sim.menuSelectedIndex] ?? '', LN: String(sim.menuSelectedIndex + 1),
    LR: String(sim.menuSelectedIndex), LC: '0',
    tf: sim.fmFrequency.toFixed(1), ta: '87.5', tb: '108.0', tr: String(sim.fmSignalStrength), tl: '0', th: '100',
    Tn: sim.fmPresetName, Tf: sim.fmFrequency.toFixed(1), Ti: String(sim.fmPresetIndex), Tc: String(sim.fmPresetCount),
    ty: sim.fmRdsName, tz: sim.fmRdsText,
    QT: String(options.settings?.['qs top'] ?? 'Brightness'), QB: String(options.settings?.['qs bottom'] ?? 'Brightness'),
    QL: String(options.settings?.['qs left'] ?? 'Shuffle'), QR: String(options.settings?.['qs right'] ?? 'Repeat'),
    Qt: String(options.settings?.['qs top value'] ?? '70%'), Qb: String(options.settings?.['qs bottom value'] ?? '70%'),
    Ql: String(options.settings?.['qs left value'] ?? (sim.shuffle ? 'Yes' : 'No')),
    Qr: String(options.settings?.['qs right value'] ?? sim.repeat)
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
  if (tag.name === 'cs') return sim.currentActivity;
  if (tag.name === 'cf') return sim.clock12Hour ? 2 : 1;
  if (tag.name === 'Lt') return sim.menuTitle;
  if (tag.name === 'LT') return sim.menuItems[sim.menuSelectedIndex] ?? '';
  if (tag.name === 'LN') return sim.menuSelectedIndex + 1;
  if (tag.name === 'LR') return sim.menuSelectedIndex;
  if (tag.name === 'Lc') return true;
  if (tag.name === 'tp') return sim.fmAvailable;
  if (tag.name === 'tt') return sim.fmTuned;
  if (tag.name === 'tm') return sim.fmScanMode;
  if (tag.name === 'ts') return sim.fmStereo;
  if (tag.name === 'tx') return sim.fmRdsAvailable;
  if (tag.name === 'tf' || tag.name === 'Tf') return sim.fmFrequency;
  if (tag.name === 'tr') return sim.fmSignalStrength;
  if (tag.name === 'Ti') return sim.fmPresetIndex;
  if (tag.name === 'Tc') return sim.fmPresetCount;
  if (SUPPORTED_TEXT_TAGS.has(tag.name)) return textForTag(tag, options);
  return undefined;
}

const conditionalBranch = (node: ConditionalNode, options: InterpreterOptions): number | undefined => {
  const override = options.branchOverrides?.[node.id];
  if (override !== undefined) return Math.max(0, Math.min(node.branches.length - 1, override));
  if (node.test.kind !== 'tag') return node.branches.length ? 0 : undefined;
  const name = node.test.name;
  if (name === 'mp') return Math.min(node.branches.length - 1, playbackBranch(options.sim.playStatus));
  if (name === 'mm') return Math.min(node.branches.length - 1, ({ off: 0, all: 1, one: 2 })[options.sim.repeat] ?? 0);
  if (name === 'cf') return Math.min(node.branches.length - 1, options.sim.clock12Hour ? 1 : 0);
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
    T: [['x', 'X', 'number'], ['y', 'Y', 'number'], ['width', 'Width', 'number'], ['height', 'Height', 'number'], ['action', 'Action', 'text']],
    tr: [['x', 'X', 'number'], ['y', 'Y', 'number'], ['width', 'Width', 'number'], ['height', 'Height', 'number'], ['path', 'Bitmap path', 'text']],
    LB: [['x', 'X', 'number'], ['y', 'Y', 'number'], ['width', 'Width', 'number'], ['height', 'Height', 'number'], ['path', 'Bitmap path', 'text']],
    Lb: [['id', 'List config ID', 'text'], ['width', 'Item width', 'number'], ['height', 'Item height', 'number']]
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
  const uiDefinitions = new Map<string, { node: TagNode; rect: Rect; fontSlot?: string }>();
  const collect = (nodes: RockboxNode[]) => nodes.forEach(node => {
    if (node.kind === 'tag' && node.name === 'Vl') definitions.add(args(node)[0] ?? '');
    if (node.kind === 'tag' && node.name === 'Vi') {
      const values = args(node);
      const name = values[0] ?? '';
      if (name) uiDefinitions.set(name, {
        node,
        rect: viewportRect(values, 1, options),
        fontSlot: values[5]
      });
    }
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

  const activeUiNames: string[] = [];
  const scanUi = (nodes: RockboxNode[], initialActive: boolean) => {
    let active = initialActive;
    for (const node of nodes) {
      if (node.kind === 'conditional') {
        if (!active) continue;
        const selected = conditionalBranch(node, options);
        if (selected !== undefined) scanUi(node.branches[selected]?.nodes ?? [], active);
        continue;
      }
      if (node.kind !== 'tag') continue;
      const values = args(node);
      if (node.name === 'V') active = true;
      else if (node.name === 'Vl') active = enabled.has(values[0] ?? '');
      else if (node.name === 'Vi') active = false;
      else if (node.name === 'VI' && active && uiDefinitions.has(values[0] ?? '')) activeUiNames.push(values[0] ?? '');
    }
  };
  scanUi(document.nodes, true);
  return { definitions, enabled, uiDefinitions, activeUiNames };
};

export const interpretSkin = (document: RockboxDocument, options: InterpreterOptions): SemanticResult => {
  const operations: RenderOperation[] = [];
  const layers: SemanticLayer[] = [];
  const textOperations = new Map<string, Extract<RenderOperation, { type: 'drawText' }>>();
  const sourceLines = document.source.split(/\r\n|\r|\n/);
  const { definitions, enabled, uiDefinitions, activeUiNames } = collectViewportState(document, options);
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

  const appendMenuPreview = (name: string, definition: { node: TagNode; rect: Rect; fontSlot?: string }) => {
    const rect = definition.rect;
    const link = sourceLink(definition.node);
    const items = options.sim.menuItems.length ? options.sim.menuItems : ['Empty list'];
    const selected = Math.max(0, Math.min(items.length - 1, options.sim.menuSelectedIndex));
    const loadedFont = definition.fontSlot ? context.fontSlots.get(definition.fontSlot) : undefined;
    const size = loadedFont?.size ?? fontSize(options.defaultFont);
    const weight = loadedFont?.weight ?? fontWeight(options.defaultFont);
    const rowHeight = Math.max(12, size + 4);
    const visibleRows = Math.max(1, Math.floor(rect.height / rowHeight));
    const start = Math.max(0, Math.min(selected - Math.floor(visibleRows / 2), items.length - visibleRows));
    const scrollbar = String(options.settings?.scrollbar ?? 'off');
    const scrollbarWidth = numberValue(String(options.settings?.['scrollbar width'] ?? 6), 6);
    const showIcons = options.settings?.['show icons'] !== false;
    const iconset = String(options.settings?.iconset ?? '');
    const selector = normalizeColor(String(options.settings?.['selector color'] ?? ''), '#d8d8d8');
    const selectorText = normalizeColor(String(options.settings?.['selector text color'] ?? ''), options.foreground);
    const selectorType = String(options.settings?.['line selector'] ?? 'bar_color');
    const leftScrollbar = scrollbar === 'left' ? scrollbarWidth + 2 : 0;
    const rightScrollbar = scrollbar === 'right' ? scrollbarWidth + 2 : 0;
    const iconWidth = showIcons ? 26 : 0;

    operations.push({ type: 'setClip', rect, source: link });
    for (let row = 0; row < visibleRows && start + row < items.length; row += 1) {
      const index = start + row;
      const rowRect = { x: rect.x + leftScrollbar, y: rect.y + row * rowHeight, width: rect.width - leftScrollbar - rightScrollbar, height: rowHeight };
      const isSelected = index === selected;
      if (isSelected && selectorType !== 'pointer') operations.push({ type: 'drawRect', rect: rowRect, color: selector, source: link });
      if (showIcons && iconset) {
        operations.push({
          type: 'drawBitmap',
          rect: { x: rowRect.x + 2, y: rowRect.y + Math.max(0, (rowHeight - 16) / 2), width: 16, height: 16 },
          assetPath: iconset,
          frame: Math.max(0, Math.min(ROCKBOX_THEMEABLE_ICON_COUNT - 1, options.sim.menuIconIds[index] ?? 0)),
          frameCount: ROCKBOX_THEMEABLE_ICON_COUNT,
          source: link
        });
      }
      operations.push({
        type: 'drawText',
        rect: { x: rowRect.x + iconWidth, y: rowRect.y + 1, width: Math.max(0, rowRect.width - iconWidth), height: rowRect.height },
        text: `${isSelected && selectorType === 'pointer' ? '› ' : ''}${items[index]}`,
        color: isSelected ? selectorText : options.foreground,
        fontSize: size,
        fontWeight: weight,
        align: 'left',
        scroll: isSelected,
        scrollOffset: options.sim.sublineCycle * 20,
        source: link
      });
    }
    if (scrollbar !== 'off' && items.length > visibleRows) {
      const track = {
        x: scrollbar === 'left' ? rect.x : rect.x + rect.width - scrollbarWidth,
        y: rect.y,
        width: scrollbarWidth,
        height: rect.height
      };
      operations.push({ type: 'drawRect', rect: track, color: options.background, source: link });
      operations.push({
        type: 'drawRect',
        rect: {
          x: track.x,
          y: track.y + (track.height - Math.max(rowHeight, track.height * visibleRows / items.length)) * (selected / Math.max(1, items.length - 1)),
          width: track.width,
          height: Math.max(rowHeight, track.height * visibleRows / items.length)
        },
        color: selector,
        source: link
      });
    }
    layers.push({
      id: `element:${definition.node.id}:menu`, sourceNodeId: definition.node.id, depth: 0,
      kind: 'element', label: `Rockbox menu list in ${name}`, active: true, supported: true, properties: []
    });
  };

  const appendQuickScreenPreview = (name: string, definition: { node: TagNode; rect: Rect }) => {
    const rect = definition.rect;
    const link = sourceLink(definition.node);
    const size = Math.max(9, fontSize(options.defaultFont) - 2);
    const entries = [
      { label: textForTag(expressionTag('%QT')!, options), value: textForTag(expressionTag('%Qt')!, options), x: rect.x + rect.width * 0.25, y: rect.y },
      { label: textForTag(expressionTag('%QL')!, options), value: textForTag(expressionTag('%Ql')!, options), x: rect.x, y: rect.y + rect.height * 0.45 },
      { label: textForTag(expressionTag('%QR')!, options), value: textForTag(expressionTag('%Qr')!, options), x: rect.x + rect.width * 0.5, y: rect.y + rect.height * 0.45 },
      { label: textForTag(expressionTag('%QB')!, options), value: textForTag(expressionTag('%Qb')!, options), x: rect.x + rect.width * 0.25, y: rect.y + rect.height - size * 2 }
    ];
    operations.push({ type: 'setClip', rect, source: link });
    entries.forEach(entry => operations.push({
      type: 'drawText',
      rect: { x: entry.x, y: entry.y, width: rect.width / 2, height: size * 2 },
      text: `${entry.label}: ${entry.value}`,
      color: options.foreground,
      fontSize: size,
      fontWeight: 'normal',
      align: 'center',
      scroll: false,
      scrollOffset: 0,
      source: link
    }));
    layers.push({
      id: `source-only:${definition.node.id}:quickscreen`, sourceNodeId: definition.node.id, depth: 0,
      kind: 'source-only', label: `Rockbox quick-screen layout in ${name} (firmware controlled)`, active: true,
      supported: true, properties: []
    });
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
      if (node.kind === 'comment') continue;
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
      if (node.name === 'pb' || (node.name === 'pv' && values.length > 0) || (node.name === 'tr' && values.length > 0)) {
        const hasGeometry = values.length >= 4 && values.slice(0, 4).some(value => value !== '');
        const rect = hasGeometry ? relativeRect(current, values, current.viewport) : current.viewport;
        const value = node.name === 'pb'
          ? clamp01(options.song.totalSec ? options.song.currentSec / options.song.totalSec : 0)
          : node.name === 'tr' ? clamp01(options.sim.fmSignalStrength / 100) : clamp01((options.sim.volume + 90) / 90);
        const named: Record<string, string> = {};
        for (let index = 5; index < values.length - 1; index += 2) named[values[index].toLowerCase()] = values[index + 1];
        operations.push({
          type: 'drawProgress', rect, value, foreground: current.foreground,
          background: current.background, mode: node.name === 'pb' ? 'track' : node.name === 'tr' ? 'signal' : 'volume',
          image: values[4] && values[4] !== '-' ? values[4] : undefined,
          slider: named.slider ? current.preloads.get(named.slider)?.path ?? named.slider : undefined,
          backdrop: named.backdrop ? current.preloads.get(named.backdrop)?.path ?? named.backdrop : undefined,
          source: link
        });
        addLayer(node, depth, 'element', node.name === 'pb' ? 'Track progress' : node.name === 'tr' ? 'FM signal bar' : 'Volume bar', true, parentId, properties);
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
      if (node.name === 'LI' || node.name === 'Li') {
        const iconset = String(options.settings?.iconset ?? '');
        if (iconset) operations.push({
          type: 'drawBitmap',
          rect: { x: current.viewport.x, y: current.viewport.y, width: 16, height: 16 },
          assetPath: iconset,
          frame: node.name === 'Li'
            ? options.sim.menuTitleIconId
            : options.sim.menuIconIds[Math.max(0, options.sim.menuSelectedIndex)] ?? 0,
          frameCount: ROCKBOX_THEMEABLE_ICON_COUNT,
          source: link
        });
        addLayer(node, depth, iconset ? 'element' : 'unsupported', node.name === 'Li' ? 'List title icon' : 'List item icon', Boolean(iconset), parentId, properties);
        continue;
      }
      if (node.name === 'LB') {
        const rect = relativeRect(current, values, current.viewport);
        const thumbHeight = Math.max(4, rect.height / Math.max(1, options.sim.menuItems.length));
        operations.push({ type: 'drawRect', rect, color: current.background, source: link });
        operations.push({
          type: 'drawRect',
          rect: {
            x: rect.x,
            y: rect.y + (rect.height - thumbHeight) * (options.sim.menuSelectedIndex / Math.max(1, options.sim.menuItems.length - 1)),
            width: rect.width,
            height: thumbHeight
          },
          color: current.foreground,
          source: link
        });
        addLayer(node, depth, 'element', 'List scrollbar', true, parentId, properties);
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
  if ((options.screen ?? 'wps') === 'sbs' && activeUiNames.length > 0) {
    const name = activeUiNames[activeUiNames.length - 1];
    const definition = uiDefinitions.get(name);
    if (definition && options.sim.currentActivity === 10) appendQuickScreenPreview(name, definition);
    else if (definition && ![2, 3, 4, 21].includes(options.sim.currentActivity)) appendMenuPreview(name, definition);
  }
  return {
    screen: options.screen ?? 'wps',
    operations: operations.filter(operation => operation.type !== 'drawText' || operation.text.trim().length > 0),
    layers,
    diagnostics: document.diagnostics,
    valid: !document.diagnostics.some(diagnostic => diagnostic.severity === 'error'),
    stale: false
  };
};

export const interpretWps = (document: RockboxDocument, options: InterpreterOptions): SemanticResult =>
  interpretSkin(document, { ...options, screen: 'wps' });
