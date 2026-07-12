export type OfficialValidationCategory =
  | 'accepted-by-both'
  | 'browser-preserved-official-rejected'
  | 'browser-diagnostic-differs'
  | 'browser-preservation-failure'
  | 'official-parser-unavailable'
  | 'target-dependent';

export type ParserComparisonInput = {
  browser: {
    preserved: boolean;
    accepted: boolean;
  };
  official: {
    executed: boolean;
    accepted: boolean;
  };
  targetDependent?: boolean;
};

export const classifyParserComparison = (
  comparison: ParserComparisonInput
): OfficialValidationCategory => {
  if (!comparison.official.executed) return 'official-parser-unavailable';
  if (!comparison.browser.preserved) return 'browser-preservation-failure';
  if (comparison.targetDependent) return 'target-dependent';
  if (comparison.browser.accepted && comparison.official.accepted) return 'accepted-by-both';
  if (comparison.browser.accepted && !comparison.official.accepted) {
    return 'browser-preserved-official-rejected';
  }
  return 'browser-diagnostic-differs';
};
