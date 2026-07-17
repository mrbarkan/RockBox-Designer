import { readFileSync } from 'node:fs';

const reportPath = new URL('../reports/phase8-firmware/latest.json', import.meta.url);
const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const expectedCommit = '078a506dfd0deb18165a3ed80c7fcbdb3afb0d31';

const fail = message => {
  throw new Error(`Phase 8 firmware report is invalid: ${message}`);
};

if (report.schemaVersion !== 1) fail('unsupported schemaVersion');
if (report.upstream?.commit !== expectedCommit || report.upstream?.target !== 'ipodvideo') fail('upstream target or SHA drifted');
if (report.feature?.id !== 'usb-screen' || report.feature?.patchCheckPassed !== true) fail('USB patch evidence is missing');
if (report.package?.ordinaryThemeInstall !== false) fail('firmware output is mislabeled as a theme install');
if (report.package?.containsRockboxSourceTree !== false || report.package?.containsRockboxBinary !== false) fail('a Rockbox source tree or binary was bundled');
if (report.package?.containsRockboxDerivedPatch !== true || report.package?.containsGeneratedGplSource !== true) fail('GPL patch/source disclosure is missing');
if (report.package?.containsProprietaryFirmware !== false) fail('proprietary firmware was bundled');
if (report.targetBuild?.status !== 'passed' || report.targetBuild?.passes !== 2) fail('two target builds did not pass');
if (report.targetBuild?.compilerRockboxRecommended !== false || report.targetBuild?.rockboxRecommendedCompiler !== 'arm-elf-eabi-gcc 9.5.0') fail('compiler caveat is missing');
if (report.targetBuild?.reproducibleFirmwareBinary !== true) fail('rockbox.ipod was not reproducible');
if (!Array.isArray(report.targetBuild?.builds) || report.targetBuild.builds.length !== 2) fail('build metrics are missing');
if (report.targetBuild.builds[0]?.firmware?.sha256 !== report.targetBuild.builds[1]?.firmware?.sha256) fail('firmware hashes differ');
if (report.productBoundary?.firmwareModeOptIn !== true || report.productBoundary?.requiresRecoveryAcknowledgement !== true) fail('safety gate is missing');
if (report.productBoundary?.themeModeOutputChanged !== false || report.productBoundary?.browserCompilesFirmware !== false) fail('Theme Mode or browser boundary changed');
if (report.evidence?.localPathsCommitted !== false || report.evidence?.outputCommitted !== false || report.evidence?.reportOnlyCommitsHashesAndMetrics !== true) fail('binary evidence boundary changed');

console.log(`Phase 8 firmware report verified at ${expectedCommit.slice(0, 12)}.`);
