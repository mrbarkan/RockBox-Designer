import { ProjectState, RenderList, RenderOp, ScreenType, SimulationState, SongMetadata, RockboxAstDocument, RockboxAstNode, RockboxTagNode } from '../types';
import { checkCondition, parseRockboxString } from './rockboxTagParser';
import { getDeviceProfile } from '../rockbox/devices';
import { themeScreenForPreview } from '../rockbox/screens';

const toCssHex = (hex: string) => hex ? `#${hex.replace(/^0x/, '').replace(/[^0-9A-Fa-f]/g, '')}` : '#ffffff';

const getFontSize = (fontId: string) => {
  const match = fontId.match(/^(\d+)-/);
  return match ? parseInt(match[1], 10) : 14;
};

type AstContext = {
  screen: { width: number; height: number };
  viewport: { x: number; y: number; w: number; h: number };
  namedViewports: Record<string, { x: number; y: number; w: number; h: number }>;
  align: 'left' | 'center' | 'right';
  fontId: string;
  color: string;
  barColor: string;
  barBackground: string;
  lineOrigin: number;
  lineHeight: number;
  preloads: Record<string, { filename: string; x: number; y: number; count: number }>;
  albumArtRect?: { x: number; y: number; w: number; h: number };
};

const getDocumentForScreen = (project: ProjectState, screen: ScreenType): RockboxAstDocument | undefined => {
  const sourceScreen = themeScreenForPreview(screen);
  if (sourceScreen === 'wps') return project.wpsAst;
  if (sourceScreen === 'sbs') return project.sbsAst;
  if (sourceScreen === 'fms') return project.fmsAst;
  return undefined;
};

const updateLineMetrics = (context: AstContext) => {
  context.lineHeight = Math.max(10, getFontSize(context.fontId) + 2);
};

const resolveViewport = (tag: RockboxTagNode, context: AstContext) => {
  if (tag.tag === 'V' && tag.args.length >= 4) {
    context.viewport = {
      x: parseInt(tag.args[0] || '0', 10),
      y: parseInt(tag.args[1] || '0', 10),
      w: parseInt(tag.args[2] || String(context.screen.width), 10),
      h: parseInt(tag.args[3] || String(context.screen.height), 10)
    };
    if (tag.args[4]) {
      context.fontId = tag.args[4].split('/').pop() || context.fontId;
      updateLineMetrics(context);
    }
    context.lineOrigin = tag.line;
    return true;
  }

  if (tag.tag === 'Vl' && tag.args.length >= 5) {
    const name = tag.args[0];
    const viewport = {
      x: parseInt(tag.args[1] || '0', 10),
      y: parseInt(tag.args[2] || '0', 10),
      w: parseInt(tag.args[3] || String(context.screen.width), 10),
      h: parseInt(tag.args[4] || String(context.screen.height), 10)
    };
    context.namedViewports[name] = viewport;
    context.viewport = viewport;
    if (tag.args[5]) {
      context.fontId = tag.args[5].split('/').pop() || context.fontId;
      updateLineMetrics(context);
    }
    context.lineOrigin = tag.line;
    return true;
  }

  if (tag.tag === 'Vd' && tag.args.length >= 1) {
    const name = tag.args[0];
    if (context.namedViewports[name]) {
      context.viewport = context.namedViewports[name];
      context.lineOrigin = tag.line;
      return true;
    }
  }

  if (tag.tag === 'Vf' && tag.args[0]) {
    context.color = toCssHex(tag.args[0]);
    return true;
  }

  if (tag.tag === 'Vb' && tag.args[0]) {
    return true;
  }

  return false;
};

const resolveImages = (tag: RockboxTagNode, context: AstContext, ops: RenderList) => {
  if (tag.tag === 'xl' && tag.args.length >= 2) {
    const [handle, filename, x = '0', y = '0', count = '1'] = tag.args;
    context.preloads[handle] = {
      filename,
      x: parseInt(x, 10),
      y: parseInt(y, 10),
      count: parseInt(count, 10)
    };
    return true;
  }

  if (tag.tag === 'xd' && tag.args.length >= 1) {
    const [handle, frameIndex = '0'] = tag.args;
    const preload = context.preloads[handle];
    if (preload) {
      ops.push({
        type: 'image',
        x: context.viewport.x,
        y: context.viewport.y,
        w: context.viewport.w,
        h: context.viewport.h,
        assetKey: preload.filename,
        sx: -2,
        sy: parseInt(frameIndex, 10),
        sw: preload.count,
        sh: preload.x
      });
      return true;
    }
  }

  if (tag.tag === 'x' && tag.args.length >= 1) {
    const filename = tag.args[0];
    ops.push({
      type: 'image',
      x: context.viewport.x,
      y: context.viewport.y,
      w: context.viewport.w,
      h: context.viewport.h,
      assetKey: filename
    });
    return true;
  }

  if (tag.tag === 'Cl' && tag.args.length >= 4) {
    context.albumArtRect = {
      x: parseInt(tag.args[0] || '0', 10),
      y: parseInt(tag.args[1] || '0', 10),
      w: parseInt(tag.args[2] || '0', 10),
      h: parseInt(tag.args[3] || '0', 10)
    };
    return true;
  }

  if (tag.tag === 'Cd') {
    const rect = context.albumArtRect || context.viewport;
    ops.push({
      type: 'image',
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: rect.h,
      assetKey: 'ALBUM_ART'
    });
    return true;
  }

  return false;
};

const updateFont = (tag: RockboxTagNode, context: AstContext) => {
  if (tag.tag === 'Fn' && tag.args[0]) {
    context.fontId = tag.args[0].split('/').pop() || context.fontId;
    updateLineMetrics(context);
    return true;
  }
  return false;
};

const updateAlignment = (tag: RockboxTagNode, context: AstContext) => {
  if (tag.tag === 'al') {
    context.align = 'left';
    return true;
  }
  if (tag.tag === 'ac') {
    context.align = 'center';
    return true;
  }
  if (tag.tag === 'ar') {
    context.align = 'right';
    return true;
  }
  return false;
};

const renderProgressBar = (
  context: AstContext,
  ops: RenderList,
  song: SongMetadata
) => {
  const percent = song.totalSec > 0 ? Math.min(1, Math.max(0, song.currentSec / song.totalSec)) : 0;
  ops.push({
    type: 'rect',
    x: context.viewport.x,
    y: context.viewport.y,
    w: context.viewport.w,
    h: context.viewport.h,
    color: context.barBackground
  });
  ops.push({
    type: 'rect',
    x: context.viewport.x,
    y: context.viewport.y,
    w: context.viewport.w * percent,
    h: context.viewport.h,
    color: context.barColor
  });
};

const resolveTextTag = (tag: RockboxTagNode, sim: SimulationState) => {
  if (tag.tag === 'mp') {
    return sim.playStatus === 'play' ? 'Play' : sim.playStatus === 'pause' ? 'Pause' : 'Stop';
  }
  if (tag.tag === 'mm') {
    return sim.repeat === 'all' ? 'All' : sim.repeat === 'one' ? 'One' : 'Off';
  }
  if (tag.tag === 'ps') {
    return sim.shuffle ? 'Shuffle' : 'No Shuffle';
  }
  return `%${tag.tag}`;
};

const buildTextOp = (
  content: string,
  nodeLine: number,
  context: AstContext,
  sim: SimulationState,
  song: SongMetadata
): RenderOp => {
  const text = parseRockboxString(content, sim, song);
  const y = context.viewport.y + (nodeLine - context.lineOrigin) * context.lineHeight;
  return {
    type: 'text',
    x: context.viewport.x,
    y,
    w: context.viewport.w,
    h: context.lineHeight,
    text,
    font: `${getFontSize(context.fontId)}px "Inter", sans-serif`,
    color: context.color,
    align: context.align,
    scroll: false
  };
};

const walkNodes = (
  nodes: RockboxAstNode[],
  context: AstContext,
  ops: RenderList,
  sim: SimulationState,
  song: SongMetadata
) => {
  for (const node of nodes) {
    if (node.type === 'text') {
      if (node.value.trim().length > 0) {
        ops.push(buildTextOp(node.value.trim(), node.line, context, sim, song));
      }
      continue;
    }
    if (node.type === 'conditional') {
      const branches = node.branches;
      const tag = node.tag;
      let matched = false;
      for (let i = 0; i < branches.length; i += 1) {
        if (checkCondition(`${tag}:${i}`, sim, song)) {
          walkNodes(branches[i].nodes, context, ops, sim, song);
          matched = true;
          break;
        }
      }
      if (!matched && branches[0]) {
        walkNodes(branches[0].nodes, context, ops, sim, song);
      }
      continue;
    }
    if (node.type === 'tag') {
      if (resolveViewport(node, context)) continue;
      if (resolveImages(node, context, ops)) continue;
      if (updateFont(node, context)) continue;
      if (updateAlignment(node, context)) continue;
      if (node.tag === 'pb') {
        renderProgressBar(context, ops, song);
        continue;
      }
      if (['s', 'a', 'id', 'it', 'pc', 'pt', 'pv', 'bl', 'mp', 'mm', 'ps'].includes(node.tag)) {
        const textContent = ['mp', 'mm', 'ps'].includes(node.tag)
          ? resolveTextTag(node, sim)
          : `%${node.tag}`;
        ops.push(buildTextOp(textContent, node.line, context, sim, song));
        continue;
      }
    }
  }
};

export const evaluateAstTheme = (
  project: ProjectState,
  screen: ScreenType,
  sim: SimulationState,
  song: SongMetadata
): RenderList => {
  const ops: RenderList = [];
  const ast = getDocumentForScreen(project, screen);
  if (!ast) return ops;
  const profile = getDeviceProfile(project.settings.target);
  const screenWidth = profile.mainScreen.width;
  const screenHeight = profile.mainScreen.height;

  if (project.settings.backdrop && project.assets[project.settings.backdrop]) {
    ops.push({
      type: 'image',
      x: 0,
      y: 0,
      w: screenWidth,
      h: screenHeight,
      assetKey: project.settings.backdrop
    });
  }

  const context: AstContext = {
    screen: { width: screenWidth, height: screenHeight },
    viewport: { x: 0, y: 0, w: screenWidth, h: screenHeight },
    namedViewports: {},
    align: 'left',
    fontId: project.settings.uiFont,
    color: project.settings.foregroundColor,
    barColor: project.settings.foregroundColor,
    barBackground: '#333333',
    lineOrigin: 1,
    lineHeight: Math.max(10, getFontSize(project.settings.uiFont) + 2),
    preloads: {}
  };

  walkNodes(ast.nodes, context, ops, sim, song);
  return ops;
};
