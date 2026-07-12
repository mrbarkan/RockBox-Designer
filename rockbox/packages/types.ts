import type { RockboxDocument } from '../syntax';

export type CfgLine = {
  kind: 'blank' | 'comment' | 'setting' | 'invalid';
  raw: string;
  newline: string;
  dirty: boolean;
  key?: string;
  value?: string;
  keyRaw?: string;
  valueRaw?: string;
};

export type CfgDocument = {
  source: string;
  newline: '\n' | '\r\n' | '\r';
  lines: CfgLine[];
  dirty: boolean;
};

export type ThemeAssetKind = 'bitmap' | 'font' | 'iconset' | 'text' | 'unknown';

export type ThemeAsset = {
  id: string;
  archivePath: string;
  basename: string;
  bytes: Uint8Array;
  mimeType?: string;
  kind: ThemeAssetKind;
  hash: string;
};

export type PackageDiagnostic = {
  severity: 'warning' | 'error';
  code: string;
  message: string;
  path?: string;
};

export type ThemeManifestEntry = {
  path: string;
  size: number;
  hash: string;
};

export type ThemeManifest = {
  files: ThemeManifestEntry[];
};

export type ThemePackage = {
  cfg?: CfgDocument;
  cfgPath?: string;
  screens: {
    wps?: RockboxDocument;
    sbs?: RockboxDocument;
    fms?: RockboxDocument;
  };
  screenPaths: {
    wps?: string;
    sbs?: string;
    fms?: string;
  };
  assets: ThemeAsset[];
  manifest: ThemeManifest;
  diagnostics: PackageDiagnostic[];
};
