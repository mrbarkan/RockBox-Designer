import { RockboxAstDocument } from '../types';
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
