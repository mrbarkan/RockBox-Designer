import { ProjectState, RockboxAstDocument, ScreenType } from '../types';
import {
  parseRockbox,
  RockboxDocument,
  serializeRockbox
} from '../rockbox/syntax';
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
  if (screen === 'wps') return project.wpsDocument ?? (project.wpsAst ? parseRockbox(project.wpsAst.raw) : undefined);
  if (screen === 'sbs') return project.sbsDocument ?? (project.sbsAst ? parseRockbox(project.sbsAst.raw) : undefined);
  if (screen === 'fms') return project.fmsDocument ?? (project.fmsAst ? parseRockbox(project.fmsAst.raw) : undefined);
  return undefined;
};

export const applyProjectSyntaxDocument = (
  project: ProjectState,
  screen: ScreenType,
  document: RockboxDocument
): ProjectState => {
  const source = serializeRockbox(document);
  const legacyDocument = parseWpsToAst(source);
  if (screen === 'wps') return { ...project, wpsDocument: document, wpsAst: legacyDocument };
  if (screen === 'sbs') return { ...project, sbsDocument: document, sbsAst: legacyDocument };
  if (screen === 'fms') return { ...project, fmsDocument: document, fmsAst: legacyDocument };
  return project;
};
