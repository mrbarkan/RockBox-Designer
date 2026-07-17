import type { ProjectState, ScreenType } from '../../types';
import { applyProjectSyntaxDocument } from '../../services/rockboxSyntaxAdapter';
import { decodeKnownTag, insertNodeWithPrefix } from '../editing';
import type { DeviceProfile } from '../devices';
import { createThemeAsset } from '../packages';
import { parseRockbox, serializeRockbox, type RockboxDocument, type RockboxNode } from '../syntax';
import { getRockboxComponent } from './catalog';
import type {
  ComponentInsertResult,
  ComponentRemoveResult,
  RockboxComponentDefinition,
  RockboxComponentInstance
} from './types';

type SourceScreen = Exclude<ScreenType, 'usb'>;

const walkNodes = (document: RockboxDocument, visit: (node: RockboxNode) => void) => {
  document.nodes.forEach(node => {
    visit(node);
    if (node.kind === 'conditional') {
      visit(node.test);
      node.branches.forEach(branch => walkNodes(branch, visit));
    }
  });
};

const collectAllocatedNames = (document: RockboxDocument) => {
  const handles = new Set<string>();
  const viewports = new Set<string>();
  walkNodes(document, node => {
    if (node.kind !== 'tag') return;
    const decoded = decodeKnownTag(node);
    if (node.name === 'xl' && decoded?.values.handle) handles.add(decoded.values.handle);
    if (['Vl', 'Vi'].includes(node.name) && decoded?.values.id && decoded.values.id !== '-') {
      viewports.add(decoded.values.id);
    }
  });
  return { handles, viewports };
};

const collectAssetReferences = (document: RockboxDocument) => {
  const references = new Set<string>();
  walkNodes(document, node => {
    if (node.kind !== 'tag') return;
    const path = decodeKnownTag(node)?.values.path;
    if (path && path !== '-') references.add(path);
  });
  return references;
};

const allocateName = (used: Set<string>, base: string) => {
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
};

const nextInstanceId = (instances: RockboxComponentInstance[]) => {
  const used = new Set(instances.map(instance => instance.id));
  let sequence = 1;
  let id = `cmp-${String(sequence).padStart(3, '0')}`;
  while (used.has(id)) {
    sequence += 1;
    id = `cmp-${String(sequence).padStart(3, '0')}`;
  }
  return id;
};

const screenPathFor = (project: ProjectState, screen: SourceScreen) => {
  const imported = project.themePackage?.screenPaths[screen];
  if (imported) return imported;
  const safeName = project.settings.name.replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'theme';
  return `.rockbox/wps/${safeName}.${screen}`;
};

const sourceAssetLocation = (project: ProjectState, screen: SourceScreen, filename: string) => {
  const screenPath = screenPathFor(project, screen);
  const slash = screenPath.lastIndexOf('/');
  const directory = slash >= 0 ? screenPath.slice(0, slash) : '';
  const screenFilename = slash >= 0 ? screenPath.slice(slash + 1) : screenPath;
  const stem = screenFilename.replace(/\.[^.]+$/, '');
  return {
    archivePath: `${directory}/${stem}/${filename}`.replace(/^\/+/, ''),
    reference: filename
  };
};

const withSuffix = (filename: string, suffix: number) => {
  const dot = filename.lastIndexOf('.');
  return dot < 0
    ? `${filename}-${suffix}`
    : `${filename.slice(0, dot)}-${suffix}${filename.slice(dot)}`;
};

const availabilityConflicts = (
  definition: RockboxComponentDefinition,
  screen: ScreenType,
  profile: DeviceProfile
) => {
  const conflicts: string[] = [];
  if (screen === 'usb') {
    conflicts.push('USB is an SBS activity scene. Generic insertion cannot safely create a %cs = 21 branch; edit the source-linked SBS branch instead.');
  }
  else if (!definition.supportedScreens.includes(screen)) {
    conflicts.push(`${definition.name} is not valid on the ${screen.toUpperCase()} screen.`);
  } else if (!profile.supportedScreenFiles.includes(screen)) {
    conflicts.push(`${profile.model} does not support a ${screen.toUpperCase()} theme file.`);
  }
  if (definition.supportedTargets && !definition.supportedTargets.some(target => target === profile.id)) {
    conflicts.push(`${definition.name} is not supported by ${profile.model}.`);
  }
  definition.requiredCapabilities.forEach(capability => {
    if (!profile.capabilities[capability]) conflicts.push(`${profile.model} does not provide ${capability}.`);
  });
  return conflicts;
};

export const getComponentAvailability = (
  definition: RockboxComponentDefinition,
  screen: ScreenType,
  profile: DeviceProfile
) => {
  const conflicts = availabilityConflicts(definition, screen, profile);
  return { available: conflicts.length === 0, conflicts };
};

const replaceTemplate = (source: string, values: Record<string, string | number>) =>
  source.replace(/\{\{([a-zA-Z0-9_-]+)\}\}/g, (_match, key: string) => String(values[key] ?? ''));

const resolveProperties = (
  definition: RockboxComponentDefinition,
  provided: Record<string, string | number>,
  profile: DeviceProfile
) => {
  const values: Record<string, string | number> = {};
  const conflicts: string[] = [];
  definition.editableProperties.forEach(property => {
    const value = provided[property.key] ?? property.defaultValue;
    if (property.type !== 'number') {
      values[property.key] = value;
      return;
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || !Number.isInteger(numeric)) {
      conflicts.push(`${property.label} must be a whole number.`);
      return;
    }
    const maximum = property.key === 'x' || property.key === 'width'
      ? profile.mainScreen.width
      : property.key === 'y' || property.key === 'height'
        ? profile.mainScreen.height
        : Number.MAX_SAFE_INTEGER;
    const minimum = property.key === 'width' || property.key === 'height' ? 1 : 0;
    if (numeric < minimum || numeric > maximum) {
      conflicts.push(`${property.label} must be between ${minimum} and ${maximum}.`);
      return;
    }
    values[property.key] = numeric;
  });
  const x = Number(values.x ?? 0);
  const y = Number(values.y ?? 0);
  const width = Number(values.width ?? 0);
  const height = Number(values.height ?? 0);
  if ('width' in values && x + width > profile.mainScreen.width) {
    conflicts.push('The component extends beyond the right edge of the target screen.');
  }
  if ('height' in values && y + height > profile.mainScreen.height) {
    conflicts.push('The component extends beyond the bottom edge of the target screen.');
  }
  return { values, conflicts };
};

const rootNodeIdsForPrefix = (document: RockboxDocument, prefix: string) =>
  document.nodes.filter(node => node.id.startsWith(`${prefix}:`)).map(node => node.id);

const getDocument = (
  project: ProjectState,
  screen: SourceScreen,
  fallbackSource: string
) => {
  if (screen === 'wps' && project.wpsDocument) return project.wpsDocument;
  if (screen === 'sbs' && project.sbsDocument) return project.sbsDocument;
  if (screen === 'fms' && project.fmsDocument) return project.fmsDocument;
  return parseRockbox(fallbackSource);
};

export const insertRockboxComponent = async ({
  project,
  definitionId,
  screen,
  profile,
  fallbackSource,
  properties = {}
}: {
  project: ProjectState;
  definitionId: string;
  screen: ScreenType;
  profile: DeviceProfile;
  fallbackSource: string;
  properties?: Record<string, string | number>;
}): Promise<ComponentInsertResult> => {
  const definition = getRockboxComponent(definitionId);
  if (!definition) return { ok: false, project, conflicts: [`Unknown component ${definitionId}.`] };
  const conflicts = availabilityConflicts(definition, screen, profile);
  if (conflicts.length > 0 || screen === 'usb') return { ok: false, project, conflicts };

  const sourceScreen = screen as SourceScreen;
  const document = getDocument(project, sourceScreen, fallbackSource);
  if (document.diagnostics.some(diagnostic => diagnostic.severity === 'error')) {
    return {
      ok: false,
      project,
      conflicts: ['Fix source errors before inserting a component; the source was left unchanged.']
    };
  }

  const resolved = resolveProperties(definition, properties, profile);
  if (resolved.conflicts.length > 0) {
    return { ok: false, project, conflicts: resolved.conflicts };
  }

  const instances = project.componentInstances ?? [];
  const instanceId = nextInstanceId(instances);
  const allocated = collectAllocatedNames(document);
  const baseName = definition.id.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toUpperCase();
  const handle = allocateName(allocated.handles, `RBD_${baseName}`);
  const viewport = allocateName(allocated.viewports, `rbd_${definition.id.replace(/[^a-z0-9]+/gi, '_')}`);
  const componentAssets = [...(project.componentAssets ?? [])];
  const packageAssets = project.themePackage?.assets ?? [];
  const assetIds: string[] = [];
  const assetReferences: string[] = [];
  let assetPath = '';

  for (const assetDefinition of definition.assets) {
    let suffix = 1;
    let filename = assetDefinition.filename;
    let location = sourceAssetLocation(project, sourceScreen, filename);
    let created = await createThemeAsset(location.archivePath, assetDefinition.bytes);
    let existing = [...packageAssets, ...componentAssets].find(asset => asset.archivePath === location.archivePath);
    while (existing && existing.hash !== created.hash) {
      suffix += 1;
      filename = withSuffix(assetDefinition.filename, suffix);
      location = sourceAssetLocation(project, sourceScreen, filename);
      created = await createThemeAsset(location.archivePath, assetDefinition.bytes);
      existing = [...packageAssets, ...componentAssets].find(asset => asset.archivePath === location.archivePath);
    }
    const retained = existing ?? created;
    if (!existing) componentAssets.push(created);
    assetIds.push(retained.id);
    assetReferences.push(location.reference);
    assetPath ||= location.reference;
  }

  const resolvedProperties = resolved.values;
  const templateValues = { ...resolvedProperties, handle, viewport, assetPath };
  const body = replaceTemplate(definition.sourceTemplate, templateValues);
  const existingSource = serializeRockbox(document);
  const separator = definition.insertion === 'end' && existingSource.length > 0 && !/[\r\n]$/.test(existingSource)
    ? document.newline
    : '';
  const fragment = definition.insertion === 'start'
    ? `# RBD component ${definition.id}@${definition.version} (${instanceId})${document.newline}${body}${document.newline}`
    : `${separator}# RBD component ${definition.id}@${definition.version} (${instanceId})${document.newline}${body}${document.newline}`;
  const parsedFragment = parseRockbox(fragment);
  if (parsedFragment.diagnostics.some(diagnostic => diagnostic.severity === 'error')) {
    return { ok: false, project, conflicts: ['The component template did not produce valid Rockbox source.'] };
  }

  const prefix = `component:${instanceId}`;
  const edit = insertNodeWithPrefix(
    document,
    { position: definition.insertion },
    fragment,
    prefix
  );
  if (!edit.changed) {
    return { ok: false, project, conflicts: edit.diagnostics.map(diagnostic => diagnostic.message) };
  }
  const sourceNodeIds = rootNodeIdsForPrefix(edit.document, prefix);
  const instance: RockboxComponentInstance = {
    id: instanceId,
    definitionId: definition.id,
    definitionVersion: definition.version,
    screen: sourceScreen,
    sourceNodeIds,
    assetIds,
    assetReferences,
    properties: resolvedProperties,
    allocated: { handle, viewport }
  };
  const next = applyProjectSyntaxDocument(project, sourceScreen, edit.document);
  return {
    ok: true,
    conflicts: [],
    instance,
    project: {
      ...next,
      componentAssets,
      componentInstances: [...instances, instance],
      selectedElementIds: sourceNodeIds.slice(0, 1),
      validationReport: []
    }
  };
};

const deleteRootNodes = (document: RockboxDocument, nodeIds: Set<string>) => {
  const nodes = document.nodes.filter(node => !nodeIds.has(node.id));
  if (nodes.length === document.nodes.length) return { document, removed: 0 };
  return {
    document: { ...document, nodes, dirty: true },
    removed: document.nodes.length - nodes.length
  };
};

const documentForScreen = (project: ProjectState, screen: SourceScreen) =>
  screen === 'wps' ? project.wpsDocument : screen === 'sbs' ? project.sbsDocument : project.fmsDocument;

export const removeRockboxComponent = (
  project: ProjectState,
  instanceId: string
): ComponentRemoveResult => {
  const instances = project.componentInstances ?? [];
  const instance = instances.find(candidate => candidate.id === instanceId);
  if (!instance) return { ok: false, project, conflicts: [`Component instance ${instanceId} was not found.`] };
  const document = documentForScreen(project, instance.screen);
  if (!document) return { ok: false, project, conflicts: ['The component source document is missing.'] };
  const removed = deleteRootNodes(document, new Set(instance.sourceNodeIds));
  if (removed.removed !== instance.sourceNodeIds.length) {
    return {
      ok: false,
      project,
      conflicts: ['The component source changed outside its recorded boundary; removal was refused.']
    };
  }

  let next = applyProjectSyntaxDocument(project, instance.screen, removed.document);
  const remainingInstances = instances.filter(candidate => candidate.id !== instanceId);
  const referencedAssetIds = new Set(remainingInstances.flatMap(candidate => candidate.assetIds));
  const sourceReferences = new Set<string>();
  for (const screen of ['wps', 'sbs', 'fms'] as const) {
    const candidate = screen === instance.screen ? removed.document : documentForScreen(project, screen);
    if (candidate) collectAssetReferences(candidate).forEach(reference => sourceReferences.add(reference));
  }
  const componentAssets = (project.componentAssets ?? []).filter(asset => {
    if (!instance.assetIds.includes(asset.id)) return true;
    if (referencedAssetIds.has(asset.id)) return true;
    return instance.assetReferences.some(reference => sourceReferences.has(reference));
  });
  next = {
    ...next,
    componentAssets,
    componentInstances: remainingInstances,
    selectedElementIds: [],
    validationReport: []
  };
  return { ok: true, project: next, conflicts: [] };
};

export const sourceUsesAssetReference = (document: RockboxDocument, reference: string) =>
  collectAssetReferences(document).has(reference);

export const inspectTagAllocation = (source: string) => collectAllocatedNames(parseRockbox(source));
