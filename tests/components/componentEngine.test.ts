import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT } from '../../constants';
import {
  getComponentAvailability,
  insertRockboxComponent,
  removeRockboxComponent,
  ROCKBOX_COMPONENT_CATALOG
} from '../../rockbox/components';
import { getDeviceProfile } from '../../rockbox/devices';
import { insertNode } from '../../rockbox/editing';
import { createThemeAsset, importThemePackage } from '../../rockbox/packages';
import { parseRockbox, serializeRockbox } from '../../rockbox/syntax';
import { applyProjectSyntaxDocument } from '../../services/rockboxSyntaxAdapter';
import { generateZip } from '../../services/rockboxCompiler';
import { parseProjectData, stringifyProjectData } from '../../services/projectSerialization';
import type { ProjectState } from '../../types';

const video = getDeviceProfile('apple-ipod-video-5g');
const classic = getDeviceProfile('apple-ipod-classic-6g');

const sourceProject = (source = '# exact source\r\n%it\r\n'): ProjectState => ({
  ...DEFAULT_PROJECT,
  elements: [],
  assets: {},
  selectedElementIds: [],
  wpsDocument: parseRockbox(source)
});

const insert = (
  project: ProjectState,
  definitionId: string,
  screen: 'wps' | 'sbs' | 'fms' = 'wps',
  profile = video
) => insertRockboxComponent({
  project,
  definitionId,
  screen,
  profile,
  fallbackSource: '',
  properties: {}
});

describe('Phase 6 Rockbox component contract', () => {
  it('covers every planned component category with versioned source and validation metadata', () => {
    const categories = new Set(ROCKBOX_COMPONENT_CATALOG.map(component => component.category));
    expect(categories).toEqual(new Set([
      'battery', 'charging', 'playback', 'shuffle', 'repeat', 'volume', 'progress', 'time',
      'metadata', 'album-art', 'codec', 'playlist', 'next-track', 'clock', 'status', 'touch',
      'fm', 'list-menu'
    ]));
    for (const component of ROCKBOX_COMPONENT_CATALOG) {
      expect(component.version).toBe(1);
      expect(component.sourceTemplate.length).toBeGreaterThan(0);
      expect(component.requiredTags.length).toBeGreaterThan(0);
      expect(component.validationRules.length).toBeGreaterThan(0);
    }
  });

  it('preserves surrounding CRLF source and allocates collision-free handles and viewport names', async () => {
    const original = [
      '# exact source',
      '%xl(RBD_BATTERY_TEN_FRAME_STRIP,old.bmp,0,0,10)',
      '%Vl(rbd_status_cluster,0,0,10,10,-)',
      '%it',
      ''
    ].join('\r\n');
    const first = await insert(sourceProject(original), 'battery-ten-frame-strip');
    expect(first.ok).toBe(true);
    expect(first.instance?.allocated.handle).toBe('RBD_BATTERY_TEN_FRAME_STRIP_2');
    expect(serializeRockbox(first.project.wpsDocument!)).toContain(original);
    expect(serializeRockbox(first.project.wpsDocument!)).toContain('\r\n');

    const second = await insert(first.project, 'status-cluster');
    expect(second.ok).toBe(true);
    expect(second.instance?.allocated.viewport).toBe('rbd_status_cluster_2');
    expect(second.instance?.sourceNodeIds.length).toBeGreaterThan(0);
    expect(second.project.wpsDocument?.diagnostics.filter(diagnostic => diagnostic.severity === 'error')).toEqual([]);
  });

  it('refuses unsupported screen and target combinations without changing the project', async () => {
    const project = sourceProject();
    expect(getComponentAvailability(
      ROCKBOX_COMPONENT_CATALOG.find(component => component.id === 'touch-play-region')!,
      'wps',
      video
    ).available).toBe(false);
    expect(getComponentAvailability(
      ROCKBOX_COMPONENT_CATALOG.find(component => component.id === 'fm-station')!,
      'fms',
      classic
    ).available).toBe(false);

    const fmOnWps = await insert(project, 'fm-station', 'wps', video);
    expect(fmOnWps.ok).toBe(false);
    expect(fmOnWps.project).toBe(project);
    const fmOnClassic = await insert(project, 'fm-station', 'fms', classic);
    expect(fmOnClassic.ok).toBe(false);
    expect(fmOnClassic.project).toBe(project);
  });

  it('refuses non-integer and off-screen properties without changing source or assets', async () => {
    const project = sourceProject();
    const decimal = await insertRockboxComponent({
      project,
      definitionId: 'track-progress',
      screen: 'wps',
      profile: video,
      fallbackSource: '',
      properties: { x: 8.5 }
    });
    const overflow = await insertRockboxComponent({
      project,
      definitionId: 'track-progress',
      screen: 'wps',
      profile: video,
      fallbackSource: '',
      properties: { x: 200, width: 220 }
    });

    expect(decimal.ok).toBe(false);
    expect(decimal.project).toBe(project);
    expect(decimal.conflicts).toContain('X must be a whole number.');
    expect(overflow.ok).toBe(false);
    expect(overflow.project).toBe(project);
    expect(overflow.conflicts).toContain('The component extends beyond the right edge of the target screen.');
  });

  it('reuses shared bitmap bytes and removes them only after the final instance is gone', async () => {
    const first = await insert(sourceProject(''), 'battery-ten-frame-strip');
    const second = await insert(first.project, 'battery-ten-frame-strip');
    expect(first.ok && second.ok).toBe(true);
    expect(second.project.componentAssets).toHaveLength(1);
    expect(second.project.componentInstances).toHaveLength(2);
    expect(first.instance?.id).toBe('cmp-001');
    expect(second.instance?.id).toBe('cmp-002');
    expect(second.project.componentInstances?.[0].allocated.handle)
      .not.toBe(second.project.componentInstances?.[1].allocated.handle);

    const removedFirst = removeRockboxComponent(second.project, first.instance!.id);
    expect(removedFirst.ok).toBe(true);
    expect(removedFirst.project.componentAssets).toHaveLength(1);
    expect(serializeRockbox(removedFirst.project.wpsDocument!)).toContain(second.instance!.allocated.handle);

    const removedSecond = removeRockboxComponent(removedFirst.project, second.instance!.id);
    expect(removedSecond.ok).toBe(true);
    expect(removedSecond.project.componentAssets).toHaveLength(0);
    expect(removedSecond.project.componentInstances).toHaveLength(0);
    expect(serializeRockbox(removedSecond.project.wpsDocument!)).toBe('');
  });

  it('retains a generated asset when remaining handwritten source still references it', async () => {
    const inserted = await insert(sourceProject(''), 'battery-ten-frame-strip');
    const reference = inserted.instance!.assetReferences[0];
    const manual = insertNode(inserted.project.wpsDocument!, { position: 'end' }, `%x(${reference},0,0)`);
    const edited = applyProjectSyntaxDocument(inserted.project, 'wps', manual.document);
    const removed = removeRockboxComponent(edited, inserted.instance!.id);

    expect(removed.ok).toBe(true);
    expect(removed.project.componentAssets).toHaveLength(1);
    expect(serializeRockbox(removed.project.wpsDocument!)).toBe(`%x(${reference},0,0)`);
  });

  it('allocates a new asset path instead of overwriting an imported path with different bytes', async () => {
    const document = parseRockbox('');
    const importedAsset = await createThemeAsset(
      '.rockbox/wps/modern_dark/rbd-battery-10.bmp',
      new Uint8Array([0x42, 0x4d, 0, 0])
    );
    const project: ProjectState = {
      ...sourceProject(''),
      wpsDocument: document,
      themePackage: {
        screens: { wps: document },
        screenPaths: { wps: '.rockbox/wps/modern_dark.wps' },
        assets: [importedAsset],
        manifest: { files: [] },
        diagnostics: []
      }
    };
    const inserted = await insert(project, 'battery-ten-frame-strip');

    expect(inserted.ok).toBe(true);
    expect(inserted.project.componentAssets?.[0].archivePath)
      .toBe('.rockbox/wps/modern_dark/rbd-battery-10-2.bmp');
    expect(inserted.instance?.assetReferences).toEqual(['rbd-battery-10-2.bmp']);
    expect(serializeRockbox(inserted.project.wpsDocument!)).toContain('rbd-battery-10-2.bmp');
    expect(inserted.project.themePackage?.assets).toEqual([importedAsset]);
  });

  it('exports a valid BMP asset beside the generated WPS and re-imports without missing assets', async () => {
    const inserted = await insert(sourceProject('%wd\n'), 'battery-ten-frame-strip');
    const blob = await generateZip(inserted.project);
    const bytes = new Uint8Array(await blob!.arrayBuffer());
    const zip = await JSZip.loadAsync(bytes);
    const assetPath = inserted.project.componentAssets![0].archivePath;
    const assetBytes = await zip.file(assetPath)!.async('uint8array');
    const imported = await importThemePackage(bytes);

    expect(Array.from(assetBytes.slice(0, 2))).toEqual([0x42, 0x4d]);
    expect(imported.diagnostics.filter(diagnostic => diagnostic.code === 'missing-asset')).toEqual([]);
    expect(imported.screens.wps?.diagnostics.filter(diagnostic => diagnostic.severity === 'error')).toEqual([]);
  });

  it('preserves component instances and binary assets through project save and load', async () => {
    const inserted = await insert(sourceProject(''), 'battery-ten-frame-strip');
    const restored = parseProjectData<ProjectState>(stringifyProjectData(inserted.project));

    expect(restored.componentInstances).toEqual(inserted.project.componentInstances);
    expect(restored.componentAssets?.[0].bytes).toBeInstanceOf(Uint8Array);
    expect(restored.componentAssets?.[0].bytes).toEqual(inserted.project.componentAssets?.[0].bytes);
    expect(serializeRockbox(restored.wpsDocument!)).toBe(serializeRockbox(inserted.project.wpsDocument!));
  });
});
