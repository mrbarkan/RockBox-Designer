export type SupportLevel =
  | 'preserved'
  | 'parsed'
  | 'interpreted'
  | 'rendered'
  | 'editable'
  | 'officially-validated';

export type RockboxTagDefinition = {
  name: string;
  token: string;
  rawParameterSpec: string;
  rawFlags: string;
  category: string;
  supportLevels: SupportLevel[];
};

export type RockboxTagRegistryData = {
  schemaVersion: 1;
  upstream: {
    repository: string;
    commit: string;
    commitTimestamp: string;
    generatedAt: string;
    sourcePaths: string[];
  };
  tags: RockboxTagDefinition[];
};
