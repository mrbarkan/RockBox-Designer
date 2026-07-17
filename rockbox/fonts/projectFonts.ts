import type { ProjectState } from '../../types';
import { collectProjectAssetReferences, listProjectAssets, type ProjectAssetOwner, type ProjectAssetReference } from '../assets/projectAssets';
import { updateCfgSetting } from '../packages/cfgParser';
import { archiveBasename, normalizeArchivePath } from '../packages/paths';
import type { ThemeAsset } from '../packages/types';
import type { RockboxDocument, RockboxNode } from '../syntax';
import { decodeRb12Font, type Rb12Font } from './rb12';

export type ProjectFontRecord = {
  asset: ThemeAsset;
  owner: ProjectAssetOwner;
  editable: boolean;
  font?: Rb12Font;
  error?: string;
  references: ProjectAssetReference[];
  current: boolean;
};

export type SetUiFontResult = {
  ok: boolean;
  project: ProjectState;
  message: string;
};

const archiveRoot = (project: ProjectState) => {
  const cfgPath = project.themePackage?.cfgPath ?? '';
  const marker = cfgPath.toLowerCase().indexOf('.rockbox/');
  return marker >= 0 ? cfgPath.slice(0, marker) : '';
};

export const defaultFontDirectory = (project: ProjectState) => `${archiveRoot(project)}.rockbox/fonts`;

export const defaultFontArchivePath = (project: ProjectState, filename: string) =>
  normalizeArchivePath(`${defaultFontDirectory(project)}/${archiveBasename(filename)}`) ?? `.rockbox/fonts/${archiveBasename(filename)}`;

export const listProjectFonts = (project: ProjectState): ProjectFontRecord[] => {
  const references = collectProjectAssetReferences(project);
  return listProjectAssets(project)
    .filter(record => record.asset.kind === 'font' || record.asset.archivePath.toLowerCase().endsWith('.fnt'))
    .map(record => {
      try {
        return {
          ...record,
          font: decodeRb12Font(record.asset.bytes),
          references: references.filter(reference => reference.resolvedPath === record.asset.archivePath),
          current: record.asset.basename.toLowerCase() === project.settings.uiFont.toLowerCase()
        };
      } catch (error) {
        return {
          ...record,
          error: error instanceof Error ? error.message : 'Invalid RB12 font.',
          references: references.filter(reference => reference.resolvedPath === record.asset.archivePath),
          current: record.asset.basename.toLowerCase() === project.settings.uiFont.toLowerCase()
        };
      }
    })
    .sort((left, right) => left.asset.basename.localeCompare(right.asset.basename));
};

export const setProjectUiFont = (project: ProjectState, filename: string): SetUiFontResult => {
  const basename = archiveBasename(filename);
  if (!basename.toLowerCase().endsWith('.fnt')) {
    return { ok: false, project, message: 'Rockbox UI fonts must use an .fnt filename.' };
  }
  const matches = listProjectFonts(project).filter(record => record.asset.basename.toLowerCase() === basename.toLowerCase());
  if (matches.length > 1) {
    return { ok: false, project, message: `More than one package font is named ${basename}; rename the duplicate paths before choosing it.` };
  }
  const packaged = matches[0];
  if (packaged?.error) return { ok: false, project, message: packaged.error };

  const settings = {
    ...project.settings,
    uiFont: basename,
    fontMetrics: packaged?.font?.metrics
  };
  const themePackage = project.themePackage?.cfg ? {
    ...project.themePackage,
    cfg: updateCfgSetting(project.themePackage.cfg, 'font', `/.rockbox/fonts/${basename}`)
  } : project.themePackage;
  return {
    ok: true,
    project: { ...project, settings, themePackage },
    message: packaged
      ? `${basename} is now the project UI font and remains packaged byte-exact.`
      : `${basename} is now the project UI font. It is an external dependency from the separate Rockbox fonts package.`
  };
};

const visitText = (nodes: RockboxNode[], output: string[]) => {
  for (const node of nodes) {
    if (node.kind === 'text') output.push(node.value);
    else if (node.kind === 'escape') output.push(node.value);
    else if (node.kind === 'conditional') node.branches.forEach(branch => visitText(branch.nodes, output));
  }
};

const documentStrings = (document: RockboxDocument | undefined) => {
  if (!document) return [];
  const values: string[] = [];
  visitText(document.nodes, values);
  return values;
};

export const collectProjectTextSamples = (project: ProjectState, limit = 12) => {
  const candidates = [
    project.settings.name,
    ...documentStrings(project.wpsDocument),
    ...documentStrings(project.sbsDocument),
    ...documentStrings(project.fmsDocument)
  ];
  const clean = candidates
    .map(value => value.replace(/\s+/g, ' ').trim())
    .filter(value => value.length >= 2 && !/^[-|<>]+$/.test(value));
  return [...new Set(clean)].slice(0, limit);
};
