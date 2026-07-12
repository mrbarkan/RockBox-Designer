export type NewlineStyle = '\n' | '\r\n' | '\r';

export type SourceSpan = {
  start: number;
  end: number;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
};

export type DiagnosticSeverity = 'info' | 'warning' | 'error';

export type Diagnostic = {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  span: SourceSpan;
  recovery?: string;
};

export type InvocationStyle = 'none' | 'parentheses' | 'pipe' | 'legacy';

export type BaseNode = {
  id: string;
  span: SourceSpan;
  raw: string;
  dirty: boolean;
};

export type TextNode = BaseNode & {
  kind: 'text';
  value: string;
};

export type EscapeNode = BaseNode & {
  kind: 'escape';
  value: string;
};

export type CommentNode = BaseNode & {
  kind: 'comment';
  value: string;
};

export type TagNode = BaseNode & {
  kind: 'tag';
  name: string;
  introducer: '%' | '';
  invocationStyle: InvocationStyle;
  rawArguments: string;
  argumentsClosed: boolean;
};

export type ConditionalNode = BaseNode & {
  kind: 'conditional';
  test: TagNode | InvalidNode;
  openRaw: string;
  branches: RockboxDocument[];
  separators: string[];
  closeRaw: string;
};

export type InvalidNode = BaseNode & {
  kind: 'invalid';
  reason: string;
};

export type RockboxNode =
  | TextNode
  | EscapeNode
  | CommentNode
  | TagNode
  | ConditionalNode
  | InvalidNode;

export type RockboxDocument = {
  kind: 'document';
  source: string;
  span: SourceSpan;
  newline: NewlineStyle;
  nodes: RockboxNode[];
  diagnostics: Diagnostic[];
  dirty: boolean;
};

export type SyntaxTokenKind =
  | 'text'
  | 'newline'
  | 'comment'
  | 'percent'
  | 'escape'
  | 'conditional-introducer'
  | 'delimiter';

export type SyntaxToken = {
  kind: SyntaxTokenKind;
  raw: string;
  span: SourceSpan;
};
