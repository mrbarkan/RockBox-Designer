import type { ImageElement, ProgressBarElement, ProjectState, ScreenType } from '../../types';
import { applyProjectSyntaxDocument, getProjectSyntaxDocument } from '../../services/rockboxSyntaxAdapter';
import { decodeKnownTag, splitRawArguments, updateTagArguments } from '../editing';
import type { RockboxDocument, RockboxNode, TagNode } from '../syntax';
import { createThemeAsset } from '../packages/assetStore';
import { getCfgValues } from '../packages/cfgParser';
import { archiveBasename, archiveDirname, joinArchivePath, normalizeArchivePath } from '../packages/paths';
import type { ThemeAsset } from '../packages/types';
import { themeScreenForPreview } from '../screens';
import { parseRb12Font } from '../fonts/rb12';
import { inspectRockboxBitmap } from './bitmap';

export type ProjectAssetOwner = 'theme' | 'project' | 'component';

export type ProjectAssetRecord = {
  asset: ThemeAsset;
  owner: ProjectAssetOwner;
  editable: boolean;
};

export type ProjectAssetReference = {
  id: string;
  scope: 'wps' | 'sbs' | 'fms' | 'cfg' | 'legacy';
  label: string;
  raw: string;
  resolvedPath?: string;
  nodeId?: string;
  argumentIndex?: number;
  cfgLineIndex?: number;
  cfgKey?: string;
  resolutionBase?: string;
  frameCount?: number;
};

export type AssetMutationResult = {
  ok: boolean;
  project: ProjectState;
  conflicts: string[];
  message?: string;
};

const ASSET_CFG_KEYS = new Set(['font', 'backdrop', 'iconset', 'viewers iconset']);
const PATH_ARGUMENTS: Record<string, number> = {
  x: 1,
  xl: 1,
  X: 0,
  pb: 4,
  pv: 4,
  pR: 4,
  tr: 4,
  St: 4,
  Fl: 1
};

const bytesToDataUrl = (bytes: Uint8Array, mimeType = 'application/octet-stream') => {
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)));
  }
  return `data:${mimeType};base64,${btoa(chunks.join(''))}`;
};

const archiveRoot = (project: ProjectState) => {
  const cfgPath = project.themePackage?.cfgPath ?? project.standaloneThemeConfig?.cfgPath ?? '';
  const marker = cfgPath.toLowerCase().indexOf('.rockbox/');
  return marker >= 0 ? cfgPath.slice(0, marker) : '';
};

export const listProjectAssets = (project: ProjectState): ProjectAssetRecord[] => {
  const records = new Map<string, ProjectAssetRecord>();
  for (const asset of project.themePackage?.assets ?? []) {
    records.set(asset.archivePath, { asset, owner: 'theme', editable: true });
  }
  for (const asset of project.projectAssets ?? []) {
    records.set(asset.archivePath, { asset, owner: 'project', editable: true });
  }
  for (const asset of project.componentAssets ?? []) {
    if (!records.has(asset.archivePath)) records.set(asset.archivePath, { asset, owner: 'component', editable: false });
  }
  return [...records.values()].sort((left, right) => left.asset.archivePath.localeCompare(right.asset.archivePath));
};

const absoluteCandidate = (project: ProjectState, raw: string) => {
  const normalized = normalizeArchivePath(raw);
  if (!normalized) return undefined;
  const root = archiveRoot(project);
  return root && normalized.startsWith('.rockbox/') ? normalizeArchivePath(`${root}${normalized}`) ?? undefined : normalized;
};

const resolveReference = (
  project: ProjectState,
  raw: string,
  assetPaths: Set<string>,
  options: { screenPath?: string; font?: boolean } = {}
) => {
  if (!raw || raw === '-' || raw === '__list_icons__') return {};
  if (raw.startsWith('/')) {
    const candidate = absoluteCandidate(project, raw);
    return { resolvedPath: candidate && assetPaths.has(candidate) ? candidate : undefined };
  }
  if (options.font) {
    const candidate = absoluteCandidate(project, `.rockbox/fonts/${raw}`);
    return { resolvedPath: candidate && assetPaths.has(candidate) ? candidate : undefined, resolutionBase: 'font' };
  }
  if (options.screenPath) {
    const bitmapDir = options.screenPath.replace(/\.[^./]+$/, '');
    const screenDir = archiveDirname(options.screenPath);
    for (const base of [bitmapDir, screenDir]) {
      const candidate = joinArchivePath(base, raw);
      if (candidate && assetPaths.has(candidate)) return { resolvedPath: candidate, resolutionBase: base };
    }
  }
  const candidate = absoluteCandidate(project, raw);
  return { resolvedPath: candidate && assetPaths.has(candidate) ? candidate : undefined };
};

const walkTags = (nodes: RockboxNode[], visitor: (tag: TagNode) => void) => {
  for (const node of nodes) {
    if (node.kind === 'tag') visitor(node);
    if (node.kind === 'conditional') {
      if (node.test.kind === 'tag') visitor(node.test);
      node.branches.forEach(branch => walkTags(branch.nodes, visitor));
    }
  }
};

const screenReferences = (
  project: ProjectState,
  screen: 'wps' | 'sbs' | 'fms',
  document: RockboxDocument,
  assetPaths: Set<string>
) => {
  const output: ProjectAssetReference[] = [];
  const cfg = project.themePackage?.cfg ?? project.standaloneThemeConfig?.cfg;
  const screenPath = project.themePackage?.screenPaths[screen]
    ?? (cfg ? normalizeArchivePath(getCfgValues(cfg, screen).at(-1) ?? '') ?? undefined : undefined);
  walkTags(document.nodes, tag => {
    const argumentIndex = PATH_ARGUMENTS[tag.name];
    if (argumentIndex === undefined) return;
    const slots = splitRawArguments(tag);
    const raw = slots[argumentIndex]?.value;
    if (!raw || raw === '-') return;
    const font = tag.name === 'Fl';
    const resolved = resolveReference(project, raw, assetPaths, { screenPath, font });
    const decoded = decodeKnownTag(tag);
    const frameCount = tag.name === 'xl'
      ? Number.parseInt(decoded?.values.count ?? '', 10)
      : undefined;
    output.push({
      id: `${screen}:${tag.id}:${argumentIndex}`,
      scope: screen,
      label: font ? `Font slot in ${screen.toUpperCase()}` : `${tag.name} image in ${screen.toUpperCase()}`,
      raw,
      ...resolved,
      nodeId: tag.id,
      argumentIndex,
      frameCount: Number.isFinite(frameCount) && frameCount! > 1 ? frameCount : undefined
    });
  });
  return output;
};

export const collectProjectAssetReferences = (project: ProjectState): ProjectAssetReference[] => {
  const assetPaths = new Set(listProjectAssets(project).map(record => record.asset.archivePath));
  const output: ProjectAssetReference[] = [];
  for (const screen of ['wps', 'sbs', 'fms'] as const) {
    const document = getProjectSyntaxDocument(project, screen);
    if (document) output.push(...screenReferences(project, screen, document, assetPaths));
  }

  const cfg = project.themePackage?.cfg ?? project.standaloneThemeConfig?.cfg;
  cfg?.lines.forEach((line, index) => {
    const key = line.key?.toLowerCase();
    const raw = line.value ?? '';
    if (line.kind !== 'setting' || !key || !ASSET_CFG_KEYS.has(key) || !raw || raw === '-') return;
    const resolved = resolveReference(project, raw, assetPaths, { font: key === 'font' && !raw.includes('/') });
    output.push({
      id: `cfg:${index}`,
      scope: 'cfg',
      label: `Theme setting: ${key}`,
      raw,
      ...resolved,
      cfgLineIndex: index,
      cfgKey: key
    });
  });

  if (!output.some(reference => reference.scope === 'cfg' && reference.cfgKey === 'font')) {
    const fontMatches = listProjectAssets(project).filter(record =>
      record.asset.kind === 'font' && record.asset.basename.toLowerCase() === project.settings.uiFont.toLowerCase()
    );
    output.push({
      id: 'legacy:settings:font',
      scope: 'legacy',
      label: 'Project UI font',
      raw: project.settings.uiFont,
      resolvedPath: fontMatches.length === 1 ? fontMatches[0].asset.archivePath : undefined,
      resolutionBase: 'font'
    });
  }

  const hasSource = Boolean(project.wpsDocument || project.sbsDocument || project.fmsDocument || project.themePackage || project.standaloneThemeConfig);
  if (!hasSource) {
    const basenameCounts = new Map<string, number>();
    listProjectAssets(project).forEach(({ asset }) => basenameCounts.set(asset.basename, (basenameCounts.get(asset.basename) ?? 0) + 1));
    project.elements.forEach(element => {
      const raw = element.type === 'image'
        ? (element as ImageElement).filename
        : element.type === 'progress_bar'
          ? (element as ProgressBarElement).backgroundImage
          : undefined;
      if (!raw) return;
      const record = listProjectAssets(project).find(candidate => candidate.asset.basename === raw);
      output.push({
        id: `legacy:${element.id}`,
        scope: 'legacy',
        label: `Legacy visual element: ${element.name}`,
        raw,
        resolvedPath: record && basenameCounts.get(raw) === 1 ? record.asset.archivePath : undefined
      });
    });
  }
  return output;
};

const relativePath = (base: string, target: string) => {
  const from = base.split('/').filter(Boolean);
  const to = target.split('/').filter(Boolean);
  let common = 0;
  while (common < from.length && common < to.length && from[common] === to[common]) common += 1;
  return [...Array(from.length - common).fill('..'), ...to.slice(common)].join('/') || archiveBasename(target);
};

const rootlessPath = (project: ProjectState, path: string) => {
  const root = archiveRoot(project);
  return root && path.startsWith(root) ? path.slice(root.length) : path;
};

const rewrittenReference = (project: ProjectState, reference: ProjectAssetReference, nextPath: string) => {
  if (reference.raw.startsWith('/')) return `/${rootlessPath(project, nextPath)}`;
  if (reference.resolutionBase === 'font') return archiveBasename(nextPath);
  if (reference.resolutionBase) return relativePath(reference.resolutionBase, nextPath);
  return archiveBasename(nextPath);
};

const replaceOwnedAsset = (
  project: ProjectState,
  owner: ProjectAssetOwner,
  previousPath: string,
  asset: ThemeAsset
) => {
  if (owner === 'theme' && project.themePackage) {
    return {
      ...project,
      themePackage: {
        ...project.themePackage,
        assets: project.themePackage.assets.map(candidate => candidate.archivePath === previousPath ? asset : candidate)
      }
    };
  }
  return {
    ...project,
    projectAssets: (project.projectAssets ?? []).map(candidate => candidate.archivePath === previousPath ? asset : candidate)
  };
};

const updatePreviewAsset = (project: ProjectState, previousPath: string, asset?: ThemeAsset) => {
  const assets = { ...project.assets };
  const records = listProjectAssets(project);
  const previousBasename = archiveBasename(previousPath);
  delete assets[previousPath];
  if (!records.some(record => record.asset.archivePath !== asset?.archivePath && record.asset.basename === previousBasename)) {
    delete assets[previousBasename];
  }
  if (asset) {
    if (asset.kind === 'bitmap') {
      const dataUrl = bytesToDataUrl(asset.bytes, asset.mimeType);
      assets[asset.archivePath] = dataUrl;
      const duplicate = records.some(record =>
        record.asset.archivePath !== asset.archivePath && record.asset.basename === asset.basename
      );
      if (duplicate) delete assets[asset.basename];
      else assets[asset.basename] = dataUrl;
    }
  }
  return { ...project, assets };
};

const failure = (project: ProjectState, ...conflicts: string[]): AssetMutationResult => ({ ok: false, project, conflicts });

const validateMutationBytes = (project: ProjectState, archivePath: string, bytes: Uint8Array) => {
  if (archivePath.toLowerCase().endsWith('.bmp')) {
    const inspection = inspectRockboxBitmap(bytes);
    return inspection.valid ? undefined : failure(project, inspection.error ?? 'Rockbox cannot load this BMP.');
  }
  if (archivePath.toLowerCase().endsWith('.fnt')) {
    try {
      parseRb12Font(bytes);
      return undefined;
    } catch (error) {
      return failure(project, error instanceof Error ? error.message : 'Rockbox cannot load this FNT.');
    }
  }
  return undefined;
};

export const addProjectAsset = async (
  project: ProjectState,
  archivePath: string,
  bytes: Uint8Array
): Promise<AssetMutationResult> => {
  const path = normalizeArchivePath(archivePath);
  if (!path) return failure(project, 'Choose a safe package path without escaping the theme archive.');
  const invalid = validateMutationBytes(project, path, bytes);
  if (invalid) return invalid;
  if (listProjectAssets(project).some(record => record.asset.archivePath === path)) {
    return failure(project, `An asset already exists at ${path}. Replace it explicitly or choose another path.`);
  }
  const asset = await createThemeAsset(path, bytes);
  const withAsset = { ...project, projectAssets: [...(project.projectAssets ?? []), asset] };
  return { ok: true, project: updatePreviewAsset(withAsset, path, asset), conflicts: [], message: `Added ${path}.` };
};

export const replaceProjectAsset = async (
  project: ProjectState,
  archivePath: string,
  bytes: Uint8Array
): Promise<AssetMutationResult> => {
  const record = listProjectAssets(project).find(candidate => candidate.asset.archivePath === archivePath);
  if (!record) return failure(project, `Asset not found: ${archivePath}`);
  if (!record.editable) return failure(project, 'This asset belongs to a component transaction. Remove or replace the component instead.');
  const invalid = validateMutationBytes(project, archivePath, bytes);
  if (invalid) return invalid;
  const asset = await createThemeAsset(archivePath, bytes);
  let replaced = replaceOwnedAsset(project, record.owner, archivePath, asset);
  if (asset.kind === 'font' && asset.basename.toLowerCase() === project.settings.uiFont.toLowerCase()) {
    replaced = { ...replaced, settings: { ...replaced.settings, fontMetrics: parseRb12Font(asset.bytes) } };
  }
  return { ok: true, project: updatePreviewAsset(replaced, archivePath, asset), conflicts: [], message: `Replaced ${archivePath} without changing its references.` };
};

const rewriteCfgLine = (raw: string, value: string) => {
  const match = raw.match(/^(\s*)([\s\S]*?)(\s*)$/);
  return `${match?.[1] ?? ''}${value}${match?.[3] ?? ''}`;
};

export const renameProjectAsset = async (
  project: ProjectState,
  archivePath: string,
  nextArchivePath: string
): Promise<AssetMutationResult> => {
  const nextPath = normalizeArchivePath(nextArchivePath);
  const record = listProjectAssets(project).find(candidate => candidate.asset.archivePath === archivePath);
  if (!record) return failure(project, `Asset not found: ${archivePath}`);
  if (!record.editable) return failure(project, 'Component-owned assets cannot be renamed independently from their source transaction.');
  if (!nextPath) return failure(project, 'Choose a safe package path without escaping the theme archive.');
  if (nextPath === archivePath) return { ok: true, project, conflicts: [], message: 'The asset path is unchanged.' };
  if (listProjectAssets(project).some(candidate => candidate.asset.archivePath === nextPath)) {
    return failure(project, `An asset already exists at ${nextPath}.`);
  }

  const references = collectProjectAssetReferences(project).filter(reference => reference.resolvedPath === archivePath);
  let nextProject = project;
  for (const screen of ['wps', 'sbs', 'fms'] as const) {
    let document = getProjectSyntaxDocument(nextProject, screen);
    if (!document) continue;
    for (const reference of references.filter(candidate => candidate.scope === screen && candidate.nodeId && candidate.argumentIndex !== undefined)) {
      const edit = updateTagArguments(document, reference.nodeId!, {
        [reference.argumentIndex!]: rewrittenReference(project, reference, nextPath)
      });
      if (!edit.changed) return failure(project, ...edit.diagnostics.map(diagnostic => diagnostic.message));
      document = edit.document;
    }
    nextProject = applyProjectSyntaxDocument(nextProject, screen, document);
    if (nextProject.themePackage?.screens[screen]) {
      nextProject = {
        ...nextProject,
        themePackage: {
          ...nextProject.themePackage,
          screens: { ...nextProject.themePackage.screens, [screen]: document }
        }
      };
    }
  }

  const cfgReferences = references.filter(reference => reference.scope === 'cfg' && reference.cfgLineIndex !== undefined);
  const canonicalCfg = nextProject.themePackage?.cfg ?? nextProject.standaloneThemeConfig?.cfg;
  if (canonicalCfg && cfgReferences.length > 0) {
    const replacements = new Map(cfgReferences.map(reference => [reference.cfgLineIndex!, rewrittenReference(project, reference, nextPath)]));
    const cfg = canonicalCfg;
    const lines = cfg.lines.map((line, index) => replacements.has(index) ? {
      ...line,
      value: replacements.get(index),
      valueRaw: rewriteCfgLine(line.valueRaw ?? '', replacements.get(index)!),
      dirty: true
    } : line);
    const updatedCfg = { ...cfg, lines, dirty: true };
    nextProject = nextProject.themePackage?.cfg
      ? { ...nextProject, themePackage: { ...nextProject.themePackage, cfg: updatedCfg } }
      : { ...nextProject, standaloneThemeConfig: { ...nextProject.standaloneThemeConfig!, cfg: updatedCfg } };
  }

  const renamed = await createThemeAsset(nextPath, record.asset.bytes);
  if (renamed.kind !== record.asset.kind) {
    return failure(project, `Keep the ${record.asset.kind} asset type when renaming ${archivePath}.`);
  }
  nextProject = replaceOwnedAsset(nextProject, record.owner, archivePath, renamed);

  const nextBasename = archiveBasename(nextPath);
  const oldBasename = archiveBasename(archivePath);
  const settings = { ...nextProject.settings };
  for (const reference of cfgReferences) {
    const nextRaw = rewrittenReference(project, reference, nextPath);
    if (reference.cfgKey === 'font') settings.uiFont = nextBasename;
    if (reference.cfgKey === 'backdrop') settings.backdrop = nextBasename;
    if (reference.cfgKey === 'iconset') settings.iconset = nextRaw;
    if (reference.cfgKey === 'viewers iconset') settings.viewersIconset = nextRaw;
  }
  if (references.some(reference => reference.id === 'legacy:settings:font')) settings.uiFont = nextBasename;
  const legacyElementIds = new Set(references
    .filter(reference => reference.scope === 'legacy' && reference.id.startsWith('legacy:'))
    .map(reference => reference.id.slice('legacy:'.length)));
  const elements = nextProject.elements.map(element => {
    if (!legacyElementIds.has(element.id)) return element;
    if (element.type === 'image' && (element as ImageElement).filename === oldBasename) {
      return { ...element, filename: nextBasename };
    }
    if (element.type === 'progress_bar' && (element as ProgressBarElement).backgroundImage === oldBasename) {
      return { ...element, backgroundImage: nextBasename };
    }
    return element;
  });
  nextProject = { ...nextProject, settings, elements };
  return {
    ok: true,
    project: updatePreviewAsset(nextProject, archivePath, renamed),
    conflicts: [],
    message: `Renamed ${archivePath} and updated ${references.length} resolved reference${references.length === 1 ? '' : 's'}.`
  };
};

export const deleteProjectAsset = (project: ProjectState, archivePath: string): AssetMutationResult => {
  const record = listProjectAssets(project).find(candidate => candidate.asset.archivePath === archivePath);
  if (!record) return failure(project, `Asset not found: ${archivePath}`);
  if (!record.editable) return failure(project, 'Component-owned assets are removed with their component transaction.');
  const references = collectProjectAssetReferences(project).filter(reference => reference.resolvedPath === archivePath);
  if (references.length > 0) {
    return failure(project, `Cannot delete ${archivePath}; ${references.length} source or theme setting reference${references.length === 1 ? '' : 's'} still use it.`);
  }
  const without = record.owner === 'theme' && project.themePackage
    ? { ...project, themePackage: { ...project.themePackage, assets: project.themePackage.assets.filter(asset => asset.archivePath !== archivePath) } }
    : { ...project, projectAssets: (project.projectAssets ?? []).filter(asset => asset.archivePath !== archivePath) };
  return { ok: true, project: updatePreviewAsset(without, archivePath), conflicts: [], message: `Deleted unreferenced asset ${archivePath}.` };
};

export const defaultBitmapDirectory = (project: ProjectState, screen: ScreenType) => {
  const sourceScreen = themeScreenForPreview(screen);
  const path = project.themePackage?.screenPaths[sourceScreen];
  if (path) return path.replace(/\.[^./]+$/, '');
  const safeName = project.settings.name.replace(/[^a-z0-9_-]+/gi, '_').toLowerCase();
  return `.rockbox/wps/${safeName}`;
};
