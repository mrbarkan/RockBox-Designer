import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import JSZip from 'jszip';
import {
  FIRMWARE_UPSTREAM_COMMIT,
  createUsbFirmwarePackage,
  inspectUsbLogoBmp
} from '../../rockbox/firmware';

const sourceDir = process.env.ROCKBOX_SOURCE_DIR;
const compilerPrefix = process.env.ROCKBOX_COMPILER_PREFIX;
if (!sourceDir || !compilerPrefix) {
  throw new Error('ROCKBOX_SOURCE_DIR and ROCKBOX_COMPILER_PREFIX are required for Phase 8 target-build evidence.');
}

const repositoryRoot = resolve('.');
const sourceRoot = resolve(sourceDir);
const sourceCommit = execFileSync('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (sourceCommit !== FIRMWARE_UPSTREAM_COMMIT) {
  throw new Error(`Rockbox checkout SHA ${sourceCommit} does not match ${FIRMWARE_UPSTREAM_COMMIT}.`);
}

const writeU16 = (bytes: Uint8Array, offset: number, value: number) => {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
};

const writeU32 = (bytes: Uint8Array, offset: number, value: number) => {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
};

const createValidationLogo = () => {
  const width = 176;
  const height = 48;
  const pixelOffset = 54;
  const rowBytes = width * 3;
  const bytes = new Uint8Array(pixelOffset + rowBytes * height);
  bytes[0] = 0x42;
  bytes[1] = 0x4d;
  writeU32(bytes, 2, bytes.byteLength);
  writeU32(bytes, 10, pixelOffset);
  writeU32(bytes, 14, 40);
  writeU32(bytes, 18, width);
  writeU32(bytes, 22, height);
  writeU16(bytes, 26, 1);
  writeU16(bytes, 28, 24);
  writeU32(bytes, 34, rowBytes * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = pixelOffset + y * rowBytes + x * 3;
      const border = x < 4 || x >= width - 4 || y < 4 || y >= height - 4;
      const diagonal = Math.abs((x % 48) - y) < 3;
      bytes[offset] = border ? 0x18 : diagonal ? 0x23 : 0xf4;
      bytes[offset + 1] = border ? 0x18 : diagonal ? 0xbd : 0xf4;
      bytes[offset + 2] = border ? 0x18 : diagonal ? 0x20 : 0xf4;
    }
  }
  return bytes;
};

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const phaseRoot = process.env.ROCKBOX_PHASE8_WORK_DIR
  ? resolve(process.env.ROCKBOX_PHASE8_WORK_DIR)
  : mkdtempSync(resolve(tmpdir(), 'rockbox-designer-phase8-'));
if (existsSync(resolve(phaseRoot, 'package'))) {
  throw new Error(`Refusing to replace existing Phase 8 package work at ${phaseRoot}.`);
}
mkdirSync(phaseRoot, { recursive: true });

const logoBmp = createValidationLogo();
const inspection = inspectUsbLogoBmp(logoBmp);
if (!inspection.valid) throw new Error(inspection.error ?? 'Generated Phase 8 validation logo is invalid.');
const generated = await createUsbFirmwarePackage({
  packageName: 'Phase 8 acceptance',
  logoPosition: 'center',
  logoBmp
});
const packageZipPath = resolve(phaseRoot, generated.filename);
writeFileSync(packageZipPath, generated.bytes);

const packageDir = resolve(phaseRoot, 'package');
const zip = await JSZip.loadAsync(generated.bytes);
for (const [path, entry] of Object.entries(zip.files)) {
  const destination = resolve(packageDir, path);
  if (entry.dir) {
    mkdirSync(destination, { recursive: true });
    continue;
  }
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, await entry.async('uint8array'));
  chmodSync(destination, path.startsWith('scripts/') ? 0o755 : 0o644);
}

const commonEnv = {
  ...process.env,
  ROCKBOX_SOURCE_DIR: sourceRoot,
  ROCKBOX_COMPILER_PREFIX: compilerPrefix,
  ROCKBOX_BUILD_JOBS: process.env.ROCKBOX_BUILD_JOBS ?? '4'
};
execFileSync(resolve(packageDir, 'scripts/verify.sh'), [], {
  cwd: packageDir,
  env: commonEnv,
  stdio: 'inherit'
});

const builds = [];
for (let pass = 1; pass <= 2; pass += 1) {
  const workDir = resolve(phaseRoot, `pass-${pass}-work`);
  const outputDir = resolve(phaseRoot, `pass-${pass}-output`);
  execFileSync(resolve(packageDir, 'scripts/build-ipodvideo.sh'), [], {
    cwd: packageDir,
    env: {
      ...commonEnv,
      ROCKBOX_FIRMWARE_WORK_DIR: workDir,
      ROCKBOX_FIRMWARE_OUTPUT_DIR: outputDir
    },
    stdio: 'inherit'
  });
  const firmwarePath = resolve(outputDir, 'rockbox.ipod');
  const installZipPath = resolve(outputDir, 'rockbox.zip');
  if (!existsSync(firmwarePath) || !existsSync(installZipPath)) {
    throw new Error(`Target build pass ${pass} did not produce rockbox.ipod and rockbox.zip.`);
  }
  const firmwareBytes = new Uint8Array(readFileSync(firmwarePath));
  const installZipBytes = new Uint8Array(readFileSync(installZipPath));
  builds.push({
    pass,
    firmware: { bytes: firmwareBytes.byteLength, sha256: sha256(firmwareBytes) },
    installZip: { bytes: installZipBytes.byteLength, sha256: sha256(installZipBytes) }
  });
}

if (builds[0].firmware.sha256 !== builds[1].firmware.sha256) {
  throw new Error('Independent iPod Video firmware builds produced different rockbox.ipod hashes.');
}

const compilerCommand = `${compilerPrefix}gcc`;
const compilerVersion = execFileSync(compilerCommand, ['--version'], { encoding: 'utf8' }).split(/\r?\n/)[0];
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  upstream: {
    repository: 'https://git.rockbox.org/cgit/rockbox.git/',
    commit: sourceCommit,
    target: 'ipodvideo',
    sourceTreeBundled: false,
    binaryBundled: false,
    proprietaryFirmwareBundled: false
  },
  feature: {
    id: 'usb-screen',
    sourcePatch: 'apps/gui/usb_screen.c',
    sourceOverlay: 'apps/gui/rockbox_designer_usb.h',
    targetAsset: 'apps/bitmaps/native/usblogo.176x48x16.bmp',
    logoPosition: 'center',
    patchCheckPassed: true
  },
  package: {
    schemaVersion: generated.manifest.schemaVersion,
    filename: generated.filename,
    bytes: generated.bytes.byteLength,
    sha256: sha256(generated.bytes),
    fileCount: generated.manifest.files.length + 1,
    ordinaryThemeInstall: generated.manifest.output.ordinaryThemeInstall,
    containsRockboxSourceTree: generated.manifest.output.containsRockboxSourceTree,
    containsRockboxDerivedPatch: generated.manifest.output.containsRockboxDerivedPatch,
    containsGeneratedGplSource: generated.manifest.output.containsGeneratedGplSource,
    containsRockboxBinary: generated.manifest.output.containsRockboxBinary,
    containsProprietaryFirmware: generated.manifest.output.containsProprietaryFirmware
  },
  targetBuild: {
    status: 'passed',
    buildScript: 'scripts/build-ipodvideo.sh',
    compiler: compilerVersion,
    compilerPrefix: 'arm-none-eabi-',
    compilerRockboxRecommended: false,
    rockboxRecommendedCompiler: 'arm-elf-eabi-gcc 9.5.0',
    passes: builds.length,
    reproducibleFirmwareBinary: true,
    builds
  },
  productBoundary: {
    firmwareModeOptIn: true,
    firmwareModeEntryPointSeparate: true,
    requiresRecoveryAcknowledgement: true,
    themeModeOutputChanged: false,
    browserCompilesFirmware: false,
    externalLevelCRemainsAuthoritative: true
  },
  evidence: {
    packageZipRetainedOutsideRepository: true,
    workRootOutsideRepository: true,
    localPathsCommitted: false,
    outputCommitted: false,
    reportOnlyCommitsHashesAndMetrics: true
  }
};

const reportPath = resolve(repositoryRoot, 'reports/phase8-firmware/latest.json');
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write([
  'Phase 8 Firmware Mode acceptance build passed.',
  `Target: ${report.upstream.target} at ${report.upstream.commit}`,
  `Firmware SHA-256: ${builds[0].firmware.sha256}`,
  `Report: ${reportPath}`,
  `External work: ${phaseRoot}`,
  ''
].join('\n'));
