import type { DeviceCapabilities, DeviceProfileId } from '../devices';
import type { ScreenType } from '../../types';

export type ComponentCategory =
  | 'battery'
  | 'charging'
  | 'playback'
  | 'shuffle'
  | 'repeat'
  | 'volume'
  | 'progress'
  | 'time'
  | 'metadata'
  | 'album-art'
  | 'codec'
  | 'playlist'
  | 'next-track'
  | 'clock'
  | 'status'
  | 'touch'
  | 'fm'
  | 'list-menu';

export type ComponentCapability = keyof DeviceCapabilities;

export type ComponentAssetDefinition = {
  id: string;
  filename: string;
  bytes: Uint8Array;
  description: string;
};

export type ComponentProperty = {
  key: string;
  label: string;
  type: 'number' | 'text' | 'select' | 'color';
  defaultValue: string | number;
  options?: string[];
};

export type ComponentValidationRule = {
  id: string;
  description: string;
  level: 'browser' | 'official';
};

export type RockboxComponentDefinition = {
  id: string;
  version: number;
  name: string;
  description: string;
  category: ComponentCategory;
  preview: string;
  supportedScreens: Array<Exclude<ScreenType, 'usb'>>;
  supportedTargets?: DeviceProfileId[];
  requiredCapabilities: ComponentCapability[];
  requiredTags: string[];
  sourceTemplate: string;
  assets: ComponentAssetDefinition[];
  editableProperties: ComponentProperty[];
  validationRules: ComponentValidationRule[];
  insertion: 'start' | 'end';
  sourceComplexity: 'simple' | 'conditional' | 'composite';
};

export type RockboxComponentInstance = {
  id: string;
  definitionId: string;
  definitionVersion: number;
  screen: Exclude<ScreenType, 'usb'>;
  sourceNodeIds: string[];
  assetIds: string[];
  assetReferences: string[];
  properties: Record<string, string | number>;
  allocated: {
    handle: string;
    viewport: string;
  };
};

export type ComponentInsertResult = {
  ok: boolean;
  project: import('../../types').ProjectState;
  instance?: RockboxComponentInstance;
  conflicts: string[];
};

export type ComponentRemoveResult = {
  ok: boolean;
  project: import('../../types').ProjectState;
  conflicts: string[];
};
