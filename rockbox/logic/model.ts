import type { DeviceProfile, DeviceCapabilities } from '../devices';
import { isSupportedConditionalTag } from '../semantics';
import { serializeNode, serializeRockbox, type ConditionalNode, type RockboxDocument, type RockboxNode, type SourceSpan } from '../syntax';

export type LogicBranch = {
  index: number;
  label: string;
  source: string;
  summary: string;
};

export type LogicCondition = {
  nodeId: string;
  parentNodeId?: string;
  parentBranchIndex?: number;
  depth: number;
  tagName?: string;
  label: string;
  expression: string;
  source: string;
  span: SourceSpan;
  supportedByBrowser: boolean;
  targetAvailable: boolean;
  targetReason?: string;
  branches: LogicBranch[];
};

const CONDITION_LABELS: Record<string, string> = {
  if: 'Compared value',
  and: 'All conditions',
  or: 'Any condition',
  mp: 'Playback status',
  mm: 'Repeat mode',
  mh: 'Main hold switch',
  bc: 'Battery charging',
  bp: 'Charger connected',
  bu: 'USB inserted',
  C: 'Album art available',
  mv: 'Volume changed recently',
  ps: 'Shuffle enabled',
  bl: 'Battery level',
  pv: 'Volume level',
  Sr: 'Language direction',
  Tp: 'Touchscreen available',
  Tl: 'Recent touch',
  tp: 'FM radio available',
  tt: 'FM station tuned',
  tm: 'FM scan mode',
  ts: 'FM stereo',
  tx: 'RDS available',
  cc: 'Real-time clock available',
  Re: 'Recording encoder',
  Rf: 'Recording frequency'
};

const PLAYBACK_BRANCHES = [
  'Stopped',
  'Playing',
  'Paused',
  'Fast forward',
  'Rewind',
  'Recording',
  'Recording paused',
  'FM radio playing',
  'FM radio muted'
];

const REPEAT_BRANCHES = ['Off', 'All', 'One', 'Shuffle', 'A-B'];

const BOOLEAN_TAGS = new Set([
  'if', 'and', 'or', 'mh', 'bc', 'bp', 'bu', 'C', 'mv', 'ps', 'lh', 'pS',
  'Lc', 'Tp', 'Tl', 'tp', 'tt', 'tm', 'ts', 'tx'
]);

const CAPABILITY_REQUIREMENTS: Partial<Record<string, keyof DeviceCapabilities>> = {
  C: 'albumArt',
  cc: 'rtc',
  Re: 'recording',
  Rf: 'recording',
  Tp: 'touchscreen',
  Tl: 'touchscreen',
  tp: 'fmRadio',
  tt: 'fmRadio',
  tm: 'fmRadio',
  ts: 'fmRadio',
  tx: 'fmRadio'
};

const capabilityLabel: Record<keyof DeviceCapabilities, string> = {
  touchscreen: 'touchscreen',
  fmRadio: 'FM radio',
  recording: 'recording',
  remoteLcd: 'remote LCD',
  usbHid: 'USB HID',
  rtc: 'real-time clock',
  albumArt: 'album art'
};

export const logicConditionLabel = (tagName?: string) => tagName
  ? CONDITION_LABELS[tagName] ?? `Rockbox %${tagName} condition`
  : 'Invalid source condition';

export const logicBranchLabel = (tagName: string | undefined, index: number, branchCount: number) => {
  if (tagName === 'mp') return PLAYBACK_BRANCHES[index] ?? `Playback value ${index + 1}`;
  if (tagName === 'mm') return REPEAT_BRANCHES[index] ?? `Repeat value ${index + 1}`;
  if (tagName === 'Sr') return ['RTL', 'LTR'][index] ?? `Direction value ${index + 1}`;
  if (BOOLEAN_TAGS.has(tagName ?? '')) {
    if (branchCount === 1) return 'When true';
    return index === 0 ? 'Yes / true' : index === 1 ? 'No / false' : `Branch ${index + 1}`;
  }
  return `Branch ${index + 1}`;
};

const compactSource = (source: string) => {
  const compact = source.replace(/\s+/g, ' ').trim();
  return compact ? compact.slice(0, 88) : '(empty branch)';
};

const expressionFor = (node: ConditionalNode) => {
  const boundary = node.raw.indexOf('<');
  return boundary >= 0 ? node.raw.slice(0, boundary) : node.openRaw.replace(/<$/, '');
};

const targetContract = (tagName: string | undefined, profile: DeviceProfile) => {
  const capability = tagName ? CAPABILITY_REQUIREMENTS[tagName] : undefined;
  if (!capability || profile.capabilities[capability]) return { targetAvailable: true };
  return {
    targetAvailable: false,
    targetReason: `${profile.model} has no ${capabilityLabel[capability]} capability.`
  };
};

export const collectLogicConditions = (document: RockboxDocument, profile: DeviceProfile): LogicCondition[] => {
  const output: LogicCondition[] = [];
  const visit = (nodes: RockboxNode[], depth: number, parentNodeId?: string, parentBranchIndex?: number) => {
    for (const node of nodes) {
      if (node.kind !== 'conditional') continue;
      const tagName = node.test.kind === 'tag' ? node.test.name : undefined;
      const target = targetContract(tagName, profile);
      output.push({
        nodeId: node.id,
        parentNodeId,
        parentBranchIndex,
        depth,
        tagName,
        label: logicConditionLabel(tagName),
        expression: expressionFor(node),
        source: serializeNode(node),
        span: node.span,
        supportedByBrowser: Boolean(tagName && isSupportedConditionalTag(tagName)),
        ...target,
        branches: node.branches.map((branch, index) => {
          const source = serializeRockbox(branch);
          return {
            index,
            label: logicBranchLabel(tagName, index, node.branches.length),
            source,
            summary: compactSource(source)
          };
        })
      });
      node.branches.forEach((branch, index) => visit(branch.nodes, depth + 1, node.id, index));
    }
  };
  visit(document.nodes, 0);
  return output;
};

const countConditionals = (document: RockboxDocument | undefined): number => {
  if (!document) return 0;
  return document.nodes.reduce((count, node) => count + (node.kind === 'conditional'
    ? 1 + node.branches.reduce((nested, branch) => nested + countConditionals(branch), 0)
    : 0), 0);
};

export const logicConditionCounts = (documents: Partial<Record<'wps' | 'sbs' | 'fms', RockboxDocument>>) => ({
  wps: countConditionals(documents.wps),
  sbs: countConditionals(documents.sbs),
  fms: countConditionals(documents.fms)
});
