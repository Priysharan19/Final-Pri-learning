#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';

const strict = process.argv.includes('--strict');
const packageFile = 'ios/PriLearning.swiftpm/Package.swift';
const shellFile = 'ios/PriLearning.swiftpm/WebShell.swift';
const appFile = 'ios/PriLearning.swiftpm/PriLearningApp.swift';

const read = file => fs.readFileSync(file, 'utf8');
const pkg = read(packageFile);
const shell = read(shellFile);
const app = read(appFile);

const blockers = [];
const warnings = [];
const passed = [];

function pass(label) { passed.push(label); }
function block(label) { blockers.push(label); }
function warn(label) { warnings.push(label); }

if (/appIcon:\s*\.placeholder\b/.test(pkg)) block('release app icon is still a placeholder');
else pass('release app icon is not configured as a Swift Playgrounds placeholder');

if (!/bundleIdentifier:\s*"com\.prilearning\.app"/.test(pkg)) warn('bundle identifier differs from com.prilearning.app; verify signing/App Store identity intentionally changed');
else pass('bundle identifier is explicit');

if (!/displayVersion:\s*"[^"\n]+"/.test(pkg) || !/bundleVersion:\s*"[^"\n]+"/.test(pkg)) block('displayVersion/bundleVersion must both be explicit');
else pass('display and build versions are explicit');

if (!/\.camera\(purposeString:\s*"[^"\n]+"\)/.test(pkg)) block('camera capability requires a non-empty purpose string');
else pass('camera purpose string is explicit');

const inspectableLines = shell.split(/\r?\n/).map((line, i) => ({ line, n: i + 1 })).filter(x => x.line.includes('isInspectable'));
if (!inspectableLines.length) {
  pass('no WKWebView inspectability hook is present');
} else {
  const debugStart = shell.indexOf('#if DEBUG');
  const debugEnd = shell.indexOf('#endif', debugStart + 1);
  const allInsideDebug = debugStart >= 0 && debugEnd > debugStart && inspectableLines.every(({ line }) => {
    const at = shell.indexOf(line);
    return at > debugStart && at < debugEnd;
  });
  if (!allInsideDebug) block(`WKWebView.isInspectable is reachable outside a DEBUG compile block (line${inspectableLines.length > 1 ? 's' : ''} ${inspectableLines.map(x => x.n).join(', ')})`);
  else pass('WKWebView inspectability is DEBUG-only');
}

if (/preferredColorScheme\(\.dark\)/.test(app)) warn('native shell still forces dark appearance; verify this is an intentional product/accessibility decision');
else pass('native shell does not force dark appearance');

if (/persistentSystemOverlays\(\.hidden\)/.test(app)) warn('system overlays are forcibly hidden; validate accessibility, multitasking and classroom usability on physical iPad');

if (!/supportedDeviceFamilies:[\s\S]*\.pad/.test(pkg)) block('iPad is not declared in supportedDeviceFamilies');
else pass('iPad is a declared device family');

console.log('IOS RELEASE AUDIT');
for (const label of passed) console.log(`PASS: ${label}`);
for (const label of warnings) console.warn(`WARNING: ${label}`);
for (const label of blockers) console.error(`BLOCKER: ${label}`);
console.log(`IOS RELEASE AUDIT — ${blockers.length ? 'BLOCKED' : 'PASS'}: ${passed.length} passed, ${warnings.length} warning(s), ${blockers.length} blocker(s).`);

if (strict && (blockers.length || warnings.length)) process.exit(1);
process.exit(blockers.length ? 1 : 0);
