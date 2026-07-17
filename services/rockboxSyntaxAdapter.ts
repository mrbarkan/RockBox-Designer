import { ProjectState, RockboxAstDocument, ScreenType } from '../types';
import {
  parseRockbox,
  RockboxDocument,
  serializeRockbox
} from '../rockbox/syntax';
import { themeScreenForPreview } from '../rockbox/screens';
import { parseWpsToAst } from './rockboxAst';

export type ParallelSyntaxDocuments = {
  sourceDocument: RockboxDocument;
  legacyDocument: RockboxAstDocument;
};

/**
 * Transitional Phase 1 adapter. The lossless source document is returned first,
 * while legacy callers can continue consuming their existing AST until Phase 1B.
 */
export const parseRockboxForLegacyConsumer = (source: string): ParallelSyntaxDocuments => ({
  sourceDocument: parseRockbox(source),
  legacyDocument: parseWpsToAst(source)
});

export const getAuthoritativeSource = (document: RockboxDocument) =>
  serializeRockbox(document);

export const getProjectSyntaxDocument = (
  project: ProjectState,
  screen: ScreenType
): RockboxDocument | undefined => {
  const sourceScreen = themeScreenForPreview(screen);
  if (sourceScreen === 'wps') return project.wpsDocument ?? (project.wpsAst ? parseRockbox(project.wpsAst.raw) : undefined);
  if (sourceScreen === 'sbs') return project.sbsDocument ?? (project.sbsAst ? parseRockbox(project.sbsAst.raw) : undefined);
  if (sourceScreen === 'fms') return project.fmsDocument ?? (project.fmsAst ? parseRockbox(project.fmsAst.raw) : undefined);
  return undefined;
};

export const applyProjectSyntaxDocument = (
  project: ProjectState,
  screen: ScreenType,
  document: RockboxDocument
): ProjectState => {
  const sourceScreen = themeScreenForPreview(screen);
  const source = serializeRockbox(document);
  const legacyDocument = parseWpsToAst(source);
  if (sourceScreen === 'wps') return { ...project, wpsDocument: document, wpsAst: legacyDocument };
  if (sourceScreen === 'sbs') return { ...project, sbsDocument: document, sbsAst: legacyDocument };
  if (sourceScreen === 'fms') return { ...project, fmsDocument: document, fmsAst: legacyDocument };
  return project;
};
