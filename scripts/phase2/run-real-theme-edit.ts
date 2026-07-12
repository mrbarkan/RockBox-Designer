import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DEFAULT_SIMULATION, DEFAULT_SONG } from '../../constants';
import { listSyntaxViewports, updateViewport } from '../../rockbox/editing';
import { exportThemePackage, importThemePackage } from '../../rockbox/packages';
import { interpretWps } from '../../rockbox/semantics';
import { serializeNode, serializeRockbox } from '../../rockbox/syntax';

const fixtures = ['AMusicPod', 'Adwaitapod'];
const results = [];
for (const name of fixtures) {
  const path = resolve(`tests/private-themes/${name}.zip`);
  if (!existsSync(path)) throw new Error(`Missing private fixture ${path}. Run themes:prepare-private first.`);
  const theme = await importThemePackage(new Uint8Array(readFileSync(path)));
  const document = theme.screens.wps;
  if (!document) throw new Error(`${name} has no WPS.`);
  const viewport = listSyntaxViewports(document).find(candidate =>
    candidate.x + candidate.width + 1 <= 320
  );
  if (!viewport) throw new Error(`${name} has no safely movable viewport.`);
  const originalSource = serializeRockbox(document);
  const originalTag = document.nodes.find(node => node.id === viewport.id)?.raw;
  const edit = updateViewport(document, viewport.id, {
    x: viewport.x + 1,
    y: viewport.y,
    width: viewport.width,
    height: viewport.height
  });
  if (!edit.changed || !originalTag) throw new Error(`${name} viewport edit failed.`);
  const editedSource = serializeRockbox(edit.document);
  const editedTag = edit.document.nodes.find(node => node.id === viewport.id);
  theme.screens.wps = edit.document;
  const semantic = interpretWps(edit.document, {
    width: 320, height: 240, defaultFont: '14-Nimbus.fnt',
    foreground: '#ffffff', background: '#000000', sim: DEFAULT_SIMULATION, song: DEFAULT_SONG
  });
  const exported = await exportThemePackage(theme);
  const reimported = await importThemePackage(exported);
  const reimportedSource = serializeRockbox(reimported.screens.wps!);
  const preservedAssets = theme.assets.every(asset =>
    reimported.assets.some(candidate => candidate.archivePath === asset.archivePath && candidate.hash === asset.hash)
  );
  results.push({
    name,
    target: 'ipodvideo',
    sourceSha256Before: createHash('sha256').update(originalSource).digest('hex'),
    sourceSha256After: createHash('sha256').update(editedSource).digest('hex'),
    viewportEdit: { nodeId: viewport.id, xBefore: viewport.x, xAfter: viewport.x + 1 },
    semanticProjectionUpdated: semantic.operations.some(operation =>
      operation.type === 'setViewport' && operation.source.nodeId === viewport.id && operation.rect.x === viewport.x + 1
    ),
    minimumChange: Boolean(editedTag && originalSource.replace(originalTag, serializeNode(editedTag)) === editedSource),
    exactAfterExport: reimportedSource === editedSource,
    assetsPreserved: preservedAssets,
    unsupportedNodesRetained: semantic.layers.filter(layer => layer.kind === 'unsupported').length,
    packageDiagnostics: reimported.diagnostics.length
  });
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  scope: {
    privateFixturesCommitted: false,
    sourceIncluded: false,
    preservationIsNotVisualSupport: true
  },
  themes: results
};
const reportPath = resolve('reports/phase2-real-theme/latest.json');
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`Phase 2 real-theme edit report: ${results.length} themes.\nReport: ${reportPath}\n`);
if (results.some(result =>
  !result.semanticProjectionUpdated || !result.minimumChange || !result.exactAfterExport ||
  !result.assetsPreserved || result.packageDiagnostics > 0
)) process.exitCode = 1;
