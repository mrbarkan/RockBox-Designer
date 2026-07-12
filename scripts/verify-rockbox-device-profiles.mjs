#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const profiles = JSON.parse(readFileSync(
  resolve(projectRoot, 'rockbox/devices/profiles/device-profiles.json'),
  'utf8'
));
const docs = readFileSync(resolve(projectRoot, 'docs/UPSTREAM_ROCKBOX.md'), 'utf8');

const fail = message => {
  throw new Error(`Rockbox device profile verification failed: ${message}`);
};

if (profiles.schemaVersion !== 1) fail('schemaVersion must be 1.');
if (!Array.isArray(profiles.profiles) || profiles.profiles.length < 2) {
  fail('at least two profiles are required.');
}

const ids = new Set();
const targets = new Set();
for (const profile of profiles.profiles) {
  if (!profile.id || ids.has(profile.id)) fail(`duplicate or missing profile ID ${profile.id}.`);
  if (!profile.rockboxTarget || targets.has(profile.rockboxTarget)) {
    fail(`duplicate or missing Rockbox target ${profile.rockboxTarget}.`);
  }
  ids.add(profile.id);
  targets.add(profile.rockboxTarget);
  if (!/^[0-9a-f]{40}$/.test(profile.source?.rockboxCommit ?? '')) {
    fail(`${profile.id} must cite a full Rockbox SHA.`);
  }
  if (!docs.includes(`Commit SHA:** \`${profile.source.rockboxCommit}\``)) {
    fail(`${profile.id} SHA differs from docs/UPSTREAM_ROCKBOX.md.`);
  }
  if (!Number.isInteger(profile.mainScreen?.width) || !Number.isInteger(profile.mainScreen?.height)) {
    fail(`${profile.id} has invalid screen dimensions.`);
  }
  if (!Array.isArray(profile.supportedScreenFiles) || !profile.supportedScreenFiles.includes('wps')) {
    fail(`${profile.id} must support WPS.`);
  }
  if (profile.capabilities.fmRadio !== profile.supportedScreenFiles.includes('fms')) {
    fail(`${profile.id} FM capability and FMS support disagree.`);
  }
}

if (process.env.ROCKBOX_SOURCE_DIR) {
  const sourceDir = resolve(process.env.ROCKBOX_SOURCE_DIR);
  const commit = execFileSync('git', ['-C', sourceDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const configure = readFileSync(resolve(sourceDir, 'tools/configure'), 'utf8');

  for (const profile of profiles.profiles) {
    if (profile.source.rockboxCommit !== commit) fail(`${profile.id} does not match the checkout SHA.`);
    const configPath = profile.source.configPaths.find(path => path.startsWith('firmware/export/config/'));
    const config = readFileSync(resolve(sourceDir, configPath), 'utf8');
    const activeDefine = name => new RegExp(`^#define\\s+${name}(?:\\s|$)`, 'm').test(config);
    const integerDefine = name => Number(config.match(new RegExp(`^#define\\s+${name}\\s+(\\d+)`, 'm'))?.[1]);

    if (integerDefine('LCD_WIDTH') !== profile.mainScreen.width) fail(`${profile.id} LCD width differs.`);
    if (integerDefine('LCD_HEIGHT') !== profile.mainScreen.height) fail(`${profile.id} LCD height differs.`);
    if (integerDefine('LCD_DEPTH') !== profile.mainScreen.depth) fail(`${profile.id} LCD depth differs.`);
    if (integerDefine('LCD_DPI') !== profile.mainScreen.dpi) fail(`${profile.id} LCD DPI differs.`);
    if (activeDefine('HAVE_TOUCHSCREEN') !== profile.capabilities.touchscreen) fail(`${profile.id} touch differs.`);
    if (activeDefine('HAVE_RECORDING') !== profile.capabilities.recording) fail(`${profile.id} recording differs.`);
    if (activeDefine('HAVE_REMOTE_LCD') !== profile.capabilities.remoteLcd) fail(`${profile.id} remote LCD differs.`);
    if (activeDefine('HAVE_USB_HID_MOUSE') !== profile.capabilities.usbHid) fail(`${profile.id} USB HID differs.`);
    if (activeDefine('CONFIG_RTC') !== profile.capabilities.rtc) fail(`${profile.id} RTC differs.`);
    if (activeDefine('HAVE_ALBUMART') !== profile.capabilities.albumArt) fail(`${profile.id} album art differs.`);
    if (activeDefine('CONFIG_TUNER') !== profile.capabilities.fmRadio) fail(`${profile.id} tuner differs.`);
    if (!new RegExp(`\\|${profile.rockboxTarget}\\)`).test(configure)) {
      fail(`${profile.id} target is absent from tools/configure.`);
    }
  }
}

process.stdout.write(
  `Verified ${profiles.profiles.length} Rockbox device profiles.` +
  (process.env.ROCKBOX_SOURCE_DIR ? ' Local source matches.\n' : '\n')
);
