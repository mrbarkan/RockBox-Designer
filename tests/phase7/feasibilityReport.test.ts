import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const report = JSON.parse(readFileSync(resolve('reports/phase7-simulator/latest.json'), 'utf8'));

describe('Phase 7 full simulator feasibility boundary', () => {
  it('proves the native target, generated theme load, and repeatable screenshot stages', () => {
    expect(report.prototypeStages.slice(0, 3).map((stage: { status: string }) => stage.status)).toEqual([
      'passed-external-development-only',
      'passed',
      'passed'
    ]);
    expect(report.officialCaptureEvidence).toMatchObject({
      target: 'ipodvideo',
      cleanCapturePasses: 2,
      reproducible: true,
      screenshotPathCommitted: false
    });
  });

  it('does not imply that a GPL browser simulator was shipped', () => {
    expect(report.prototypeStages.slice(3).map((stage: { status: string }) => stage.status)).toEqual([
      'blocked-by-decision',
      'blocked-by-stage-4',
      'deferred'
    ]);
    expect(report.upstream).toMatchObject({
      sourceBundled: false,
      binaryBundled: false,
      simulatorAssetsBundled: false
    });
    expect(report.productBoundary).toMatchObject({
      phase7Acceptance: 'passed-with-documented-blockers',
      levelC: 'not-shipped',
      editorIndependent: true,
      browserClientChanged: false,
      browserBundleDeltaBytes: 0
    });
  });

  it('keeps every required browser-port concern explicit', () => {
    expect(report.browserPortConstraints.map((constraint: { id: string }) => constraint.id)).toEqual([
      'license-distribution',
      'target-build-generation',
      'threads-and-main-loop',
      'dynamic-code',
      'filesystem-and-persistence',
      'audio-and-timing',
      'bundle-performance-maintenance'
    ]);
    expect(report.browserPortConstraints.every(
      (constraint: { finding: string; resolution: string; sourceEvidence: string[] }) =>
        constraint.finding && constraint.resolution && constraint.sourceEvidence.length > 0
    )).toBe(true);
  });
});
