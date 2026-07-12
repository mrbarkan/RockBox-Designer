import JSZip from 'jszip';
import { decodeKnownTag } from '../editing';
import { parseRockbox, RockboxDocument, RockboxNode } from '../syntax';
import { createThemeAsset, hashBytes } from './assetStore';
import { getCfgValues, parseCfg } from './cfgParser';
import { archiveDirname, joinArchivePath, normalizeArchivePath } from './paths';
import { PackageDiagnostic, ThemeManifestEntry, ThemePackage } from './types';

type ZipInput = ArrayBuffer | Uint8Array | Blob;

const decodeText = (bytes: Uint8Array) => new TextDecoder('utf-8').decode(bytes);

const collectAssetReferences = (document: RockboxDocument) => {
  const references: string[] = [];
  const walk = (nodes: RockboxNode[]) => nodes.forEach(node => {
    if (node.kind === 'tag' && ['x', 'X', 'xl'].includes(node.name)) {
      const path = decodeKnownTag(node)?.values.path;
      if (path && path !== '-') references.push(path);
    }
    if (node.kind === 'conditional') node.branches.forEach(branch => walk(branch.nodes));
  });
  walk(document.nodes);
  return references;
};

export const importThemePackage = async (input: ZipInput): Promise<ThemePackage> => {
  const zip = await JSZip.loadAsync(input);
  const diagnostics: PackageDiagnostic[] = [];
  const entries = new Map<string, Uint8Array>();

  for (const file of Object.values(zip.files)) {
    if (file.dir || file.name.startsWith('__MACOSX/')) continue;
    const path = normalizeArchivePath(file.name);
    if (!path) {
      diagnostics.push({ severity: 'error', code: 'unsafe-path', message: `Unsafe archive path: ${file.name}`, path: file.name });
      continue;
    }
    entries.set(path, await file.async('uint8array'));
  }

  const manifestEntries: ThemeManifestEntry[] = [];
  for (const [path, bytes] of entries) {
    manifestEntries.push({ path, size: bytes.length, hash: await hashBytes(bytes) });
  }
  manifestEntries.sort((left, right) => left.path.localeCompare(right.path));

  const cfgPath = [...entries.keys()].find(path => path.toLowerCase().endsWith('.cfg'));
  const cfg = cfgPath ? parseCfg(decodeText(entries.get(cfgPath)!)) : undefined;
  if (!cfg) diagnostics.push({ severity: 'error', code: 'missing-cfg', message: 'The archive does not contain a theme CFG file.' });

  const screens: ThemePackage['screens'] = {};
  const screenPaths: ThemePackage['screenPaths'] = {};
  const consumed = new Set<string>(cfgPath ? [cfgPath] : []);

  for (const screen of ['wps', 'sbs', 'fms'] as const) {
    const reference = cfg ? getCfgValues(cfg, screen).at(-1) : undefined;
    if (!reference || reference === '-') continue;
    const path = normalizeArchivePath(reference);
    if (!path || !entries.has(path)) {
      diagnostics.push({ severity: 'error', code: 'missing-screen', message: `CFG ${screen} path is missing from the archive: ${reference}`, path: reference });
      continue;
    }
    screenPaths[screen] = path;
    screens[screen] = parseRockbox(decodeText(entries.get(path)!));
    consumed.add(path);
  }

  for (const screen of ['wps', 'sbs', 'fms'] as const) {
    const document = screens[screen];
    const screenPath = screenPaths[screen];
    if (!document || !screenPath) continue;
    for (const reference of collectAssetReferences(document)) {
      const resolved = reference.startsWith('/')
        ? normalizeArchivePath(reference)
        : joinArchivePath(archiveDirname(screenPath), reference);
      if (!resolved || !entries.has(resolved)) {
        diagnostics.push({ severity: 'warning', code: 'missing-asset', message: `Referenced asset is missing: ${reference}`, path: reference });
      }
    }
  }

  const assets = [];
  for (const [path, bytes] of entries) {
    if (!consumed.has(path)) assets.push(await createThemeAsset(path, bytes));
  }
  assets.sort((left, right) => left.archivePath.localeCompare(right.archivePath));

  return {
    cfg,
    cfgPath,
    screens,
    screenPaths,
    assets,
    manifest: { files: manifestEntries },
    diagnostics
  };
};
