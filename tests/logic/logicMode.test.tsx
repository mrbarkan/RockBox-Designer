import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT, DEFAULT_SIMULATION, DEFAULT_SONG } from '../../constants';
import { LogicMode } from '../../components/LogicMode';
import { getDeviceProfile } from '../../rockbox/devices';
import { duplicateConditionalBranch } from '../../rockbox/editing';
import { collectLogicConditions, logicBranchLabel, logicConditionCounts } from '../../rockbox/logic';
import { interpretSkin } from '../../rockbox/semantics';
import { parseRockbox, serializeRockbox } from '../../rockbox/syntax';

const source = '# comments are source only\n%?mp<Stop|Play|%?mh<Paused + hold|Paused>>\n%?zzFuture<Exact|Still exact>\n';
const document = parseRockbox(source);
const video = getDeviceProfile('apple-ipod-video-5g');

const semantic = interpretSkin(document, {
  width: 320,
  height: 240,
  defaultFont: DEFAULT_PROJECT.settings.uiFont,
  foreground: DEFAULT_PROJECT.settings.foregroundColor,
  background: DEFAULT_PROJECT.settings.backgroundColor,
  sim: { ...DEFAULT_SIMULATION, playStatus: 'pause', isHold: true },
  song: DEFAULT_SONG,
  screen: 'wps',
  capabilities: video.capabilities
});

describe('Logic workspace', () => {
  it('inventories nested conditionals without projecting comments as logic', () => {
    const conditions = collectLogicConditions(document, video);
    expect(conditions).toHaveLength(3);
    expect(conditions[0]).toMatchObject({ label: 'Playback status', expression: '%?mp', depth: 0, supportedByBrowser: true });
    expect(conditions[1]).toMatchObject({ label: 'Main hold switch', depth: 1, parentNodeId: conditions[0].nodeId, parentBranchIndex: 2 });
    expect(conditions[2]).toMatchObject({ label: 'Rockbox %zzFuture condition', supportedByBrowser: false, source: '%?zzFuture<Exact|Still exact>' });
    expect(logicConditionCounts({ wps: document })).toEqual({ wps: 3, sbs: 0, fms: 0 });
  });

  it('uses source-verified playback, repeat, direction, and boolean branch labels', () => {
    expect(Array.from({ length: 9 }, (_, index) => logicBranchLabel('mp', index, 9))).toEqual([
      'Stopped', 'Playing', 'Paused', 'Fast forward', 'Rewind', 'Recording', 'Recording paused', 'FM radio playing', 'FM radio muted'
    ]);
    expect(Array.from({ length: 5 }, (_, index) => logicBranchLabel('mm', index, 5))).toEqual(['Off', 'All', 'One', 'Shuffle', 'A-B']);
    expect(logicBranchLabel('Sr', 1, 2)).toBe('LTR');
    expect(logicBranchLabel('mh', 0, 2)).toBe('Yes / true');
  });

  it('marks capability-gated conditions unavailable without removing source', () => {
    const classic = getDeviceProfile('apple-ipod-classic-6g');
    const fm = parseRockbox('%?tp<Radio|No radio>');
    expect(collectLogicConditions(fm, classic)[0]).toMatchObject({ targetAvailable: false, supportedByBrowser: true });
    expect(serializeRockbox(fm)).toBe('%?tp<Radio|No radio>');
  });

  it('does not invent an automatic branch for unsupported source', () => {
    const unknown = document.nodes.find(node => node.kind === 'conditional' && node.test.kind === 'tag' && node.test.name === 'zzFuture');
    if (!unknown || unknown.kind !== 'conditional') throw new Error('Missing unknown conditional');
    const layer = semantic.layers.find(candidate => candidate.kind === 'conditional' && candidate.sourceNodeId === unknown.id);
    expect(layer?.selectedBranch).toBeUndefined();
    expect(semantic.operations.every(operation => operation.source.nodeId !== unknown.id)).toBe(true);
  });

  it('duplicates only the requested branch and retains untouched surrounding source', () => {
    const original = parseRockbox('# keep\r\n%?mp<Stop|Play>\r\n%zzFuture(raw)');
    const conditional = original.nodes.find(node => node.kind === 'conditional');
    if (!conditional) throw new Error('Missing conditional');
    const result = duplicateConditionalBranch(original, conditional.id, 1);
    expect(result.changed).toBe(true);
    expect(serializeRockbox(result.document)).toBe('# keep\r\n%?mp<Stop|Play|Play>\r\n%zzFuture(raw)');
    expect(serializeRockbox(original)).toBe('# keep\r\n%?mp<Stop|Play>\r\n%zzFuture(raw)');
  });

  it('renders conditional tree, raw preservation, shared simulation, and source/canvas handoffs', () => {
    const project = { ...DEFAULT_PROJECT, wpsDocument: document };
    const html = renderToStaticMarkup(<LogicMode
      project={project}
      profile={video}
      screen="wps"
      semanticResult={semantic}
      branchOverrides={{}}
      simulation={{ ...DEFAULT_SIMULATION, playStatus: 'pause', isHold: true }}
      onScreenChange={() => undefined}
      onSetBranchOverride={() => undefined}
      onSimulationChange={() => undefined}
      onDuplicateBranch={() => ({ ok: true, message: 'done' })}
      onRevealCanvas={() => undefined}
      onRevealSource={() => undefined}
      onOpenPlay={() => undefined}
      onClose={() => undefined}
    />);
    expect(html).toContain('Pulp workspace · lossless source logic');
    expect(html).toContain('WPS · 3');
    expect(html).toContain('Playback status');
    expect(html).toContain('Active 3');
    expect(html).toContain('Rockbox %zzFuture condition');
    expect(html).toContain('>raw<');
    expect(html).toContain('Shared simulator state');
    expect(html).toContain('Reveal on canvas');
    expect(html).toContain('Reveal in source');
  });
});
