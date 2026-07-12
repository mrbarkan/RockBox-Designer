import { Diagnostic, DiagnosticSeverity, SourceSpan } from './types';

export const createDiagnostic = (
  severity: DiagnosticSeverity,
  code: string,
  message: string,
  span: SourceSpan,
  recovery?: string
): Diagnostic => ({
  severity,
  code,
  message,
  span,
  ...(recovery ? { recovery } : {})
});

export const hasErrors = (diagnostics: Diagnostic[]) =>
  diagnostics.some(diagnostic => diagnostic.severity === 'error');
