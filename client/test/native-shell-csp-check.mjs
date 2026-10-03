#!/usr/bin/env node
// NATIVE SHELL CSP — the iPad (WKURLSchemeHandler) and Android
// (WebViewAssetLoader) shells serve the bundled web build themselves, so the
// Pri platform server's response hardening (server/platform/headers.js) never
// reaches a native student unless the shells emit it. This static check reads
// the shells' source and refuses:
//   • a shell response without Content-Security-Policy, X-Content-Type-Options
//     or Referrer-Policy;
//   • any CSP directive weaker than the server's enforced policy (every server
//     directive must be present and may only allow a subset of its sources;
//     script-src, object-src and frame-ancestors are additionally pinned);
//   • an inline <script> or inline event handler in client/index.html, which
//     would need 'unsafe-inline' or a hash to run under script-src 'self'.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { contentSecurityPolicy } from '../../server/platform/headers.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const at = rel => path.join(ROOT, rel);
const read = rel => readFileSync(at(rel), 'utf8');

let passed = 0;
let failed = 0;
function ok(condition, message) {
  if (condition) passed += 1;
  else { failed += 1; console.error(`  ✗ ${message}`); }
}

function parsePolicy(policy) {
  const map = new Map();
  for (const part of String(policy).split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) continue;
    const [name, ...sources] = tokens;
    map.set(name, sources);
  }
  return map;
}

function quotedStrings(block) {
  return [...block.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(m => m[1]);
}

function swiftDirectives(source) {
  const m = source.match(/static let contentSecurityPolicyDirectives:\s*\[String\]\s*=\s*\[([\s\S]*?)\n\s*\]/);
  return m ? quotedStrings(m[1]) : null;
}

function kotlinDirectives(source) {
  const m = source.match(/private val CSP_DIRECTIVES\s*=\s*listOf\(([\s\S]*?)\n\s*\)/);
  return m ? quotedStrings(m[1]) : null;
}

const HOST_SOURCE = /^(https?:|wss?:|\*|[a-z0-9*.-]+\.[a-z]{2,}(:\d+)?(\/|$))/i;
const WEAKENERS = new Set(["'unsafe-inline'", "'unsafe-eval'", "'unsafe-hashes'", "'strict-dynamic'", '*', 'data:', 'blob:', 'filesystem:']);

// Reference: the server policy with no deployment-specific extra connect
// origins, i.e. exactly what the web build is proven to satisfy in
// server/test/security-headers-check.mjs.
const server = parsePolicy(contentSecurityPolicy({ connectSources: [] }));
ok(server.size >= 13, `server policy parsed into ${server.size} directives`);
ok(server.get('script-src')?.join(' ') === "'self'", "server script-src is exactly 'self'");
ok(server.get('object-src')?.join(' ') === "'none'", "server object-src is exactly 'none'");
ok(server.get('frame-ancestors')?.join(' ') === "'none'", "server frame-ancestors is exactly 'none'");

function notWeakerThanServer(label, directives) {
  ok(Array.isArray(directives) && directives.length > 0, `${label}: CSP directive list found in source`);
  if (!Array.isArray(directives)) return;
  const shell = parsePolicy(directives.join('; '));
  for (const [name, serverSources] of server) {
    const shellSources = shell.get(name);
    ok(Array.isArray(shellSources), `${label}: declares ${name} (the server does)`);
    if (!Array.isArray(shellSources)) continue;
    const allowed = new Set(serverSources);
    const extra = shellSources.filter(src => !allowed.has(src));
    ok(extra.length === 0, `${label}: ${name} allows nothing beyond the server policy (extra: ${extra.join(' ') || 'none'})`);
    ok(shellSources.length > 0, `${label}: ${name} is not empty`);
  }
  for (const name of shell.keys()) {
    ok(server.has(name) || !/-src$/.test(name) || name === 'script-src-elem' || name === 'style-src-elem',
      `${label}: ${name} is a directive the server policy also constrains`);
  }
  const script = shell.get('script-src') || [];
  ok(script.join(' ') === "'self'", `${label}: script-src is exactly 'self' (no inline, eval, hosts or schemes)`);
  ok(!script.some(src => WEAKENERS.has(src) || HOST_SOURCE.test(src)), `${label}: script-src carries no weakening source`);
  ok((shell.get('object-src') || []).join(' ') === "'none'", `${label}: object-src 'none'`);
  ok((shell.get('frame-ancestors') || []).join(' ') === "'none'", `${label}: frame-ancestors 'none'`);
  ok((shell.get('base-uri') || []).join(' ') === "'self'", `${label}: base-uri 'self'`);
  ok((shell.get('default-src') || []).join(' ') === "'self'", `${label}: default-src 'self'`);
  // The native shells route every /v1 call through the native cloud bridge
  // (priNative.cloud), so WebKit itself never needs a cloud origin.
  ok((shell.get('connect-src') || []).join(' ') === "'self'", `${label}: connect-src stays 'self' — the cloud session lives in the native bridge, never in the web view`);
  // What the bundle actually needs still works: KaTeX fonts, inline React/KaTeX
  // styles, canvas/photo/blob images and media, the service worker, the manifest.
  ok((shell.get('style-src') || []).includes("'unsafe-inline'"), `${label}: style-src keeps 'unsafe-inline' for React style attributes, KaTeX and the ink guard <style>`);
  ok((shell.get('font-src') || []).includes("'self'"), `${label}: font-src 'self' for the bundled KaTeX woff2 files`);
  ok((shell.get('img-src') || []).includes('blob:') && (shell.get('img-src') || []).includes('data:'), `${label}: img-src allows data: and blob: (canvas exports, photo capture)`);
  ok((shell.get('media-src') || []).includes('blob:'), `${label}: media-src allows blob:`);
  ok((shell.get('worker-src') || []).includes("'self'"), `${label}: worker-src 'self' for the service worker`);
  ok((shell.get('manifest-src') || []).includes("'self'"), `${label}: manifest-src 'self'`);
}

// ── iOS: both Swift packages must stay source-identical ─────────────────────
const IOS_PACKAGES = ['ios/PriLearning.swiftpm', 'ios/PriLearning 2.swiftpm'];
const swiftSources = IOS_PACKAGES.map(pkg => read(`${pkg}/LocalSchemeHandler.swift`));
ok(swiftSources[0] === swiftSources[1], 'LocalSchemeHandler.swift is byte-identical in PriLearning.swiftpm and PriLearning 2.swiftpm');
{
  const swift = swiftSources[0];
  const label = 'iOS LocalSchemeHandler';
  notWeakerThanServer(label, swiftDirectives(swift));
  ok(/HTTPURLResponse\(\s*url:\s*url,\s*statusCode:\s*200,\s*httpVersion:\s*"HTTP\/1\.1",\s*headerFields:\s*headers\s*\)/.test(swift),
    `${label}: serves every bundled file through an HTTPURLResponse built from the security header dictionary`);
  ok(!/\bURLResponse\(\s*url:/.test(swift), `${label}: no bare URLResponse (which cannot carry headers) remains`);
  ok(/var headers = Self\.securityHeaders/.test(swift), `${label}: the response headers start from Self.securityHeaders`);
  const headersBlock = swift.match(/static let securityHeaders:\s*\[String:\s*String\]\s*=\s*\[([\s\S]*?)\n\s*\]/);
  ok(!!headersBlock, `${label}: securityHeaders dictionary is declared`);
  const hb = headersBlock ? headersBlock[1] : '';
  ok(/"Content-Security-Policy":\s*contentSecurityPolicy/.test(hb), `${label}: Content-Security-Policy header is the joined directive list`);
  ok(/"X-Content-Type-Options":\s*"nosniff"/.test(hb), `${label}: X-Content-Type-Options: nosniff`);
  ok(/"Referrer-Policy":\s*"no-referrer"/.test(hb), `${label}: Referrer-Policy: no-referrer`);
  ok(/static let contentSecurityPolicy:\s*String\s*=\s*contentSecurityPolicyDirectives\.joined\(separator:\s*"; "\)/.test(swift),
    `${label}: the policy string is the directives joined by "; "`);
  ok(/urlSchemeTask\.didReceive\(response\)/.test(swift) && /urlSchemeTask\.didReceive\(data\)/.test(swift) && /urlSchemeTask\.didFinish\(\)/.test(swift),
    `${label}: the task still receives response, data and finish`);
  ok(/charset=utf-8/.test(swift), `${label}: text responses keep their utf-8 charset through Content-Type`);
  ok(/index\.html/.test(swift), `${label}: SPA index.html fallback is untouched`);
}

// ── Android: WebViewAssetLoader path handler ────────────────────────────────
{
  const rel = 'android/app/src/main/java/com/prilearning/app/shell/AssetOrigin.kt';
  const label = 'Android AssetOrigin';
  const kt = read(rel);
  notWeakerThanServer(label, kotlinDirectives(kt));
  ok(/val CONTENT_SECURITY_POLICY:\s*String\s*=\s*CSP_DIRECTIVES\.joinToString\("; "\)/.test(kt), `${label}: the policy string is the directives joined by "; "`);
  const headersBlock = kt.match(/val SECURITY_HEADERS:\s*Map<String,\s*String>\s*=\s*mapOf\(([\s\S]*?)\n\s*\)/);
  ok(!!headersBlock, `${label}: SECURITY_HEADERS map is declared`);
  const hb = headersBlock ? headersBlock[1] : '';
  ok(/"Content-Security-Policy"\s+to\s+CONTENT_SECURITY_POLICY/.test(hb), `${label}: Content-Security-Policy header is the policy string`);
  ok(/"X-Content-Type-Options"\s+to\s+"nosniff"/.test(hb), `${label}: X-Content-Type-Options: nosniff`);
  ok(/"Referrer-Policy"\s+to\s+"no-referrer"/.test(hb), `${label}: Referrer-Policy: no-referrer`);
  ok(/responseHeaders = SECURITY_HEADERS/.test(kt), `${label}: every bundled asset response carries SECURITY_HEADERS`);
  ok(!/responseHeaders = mapOf\(/.test(kt), `${label}: no ad-hoc header map bypasses SECURITY_HEADERS`);
  ok(/404, "Not Found", SECURITY_HEADERS/.test(kt), `${label}: the local 404 carries SECURITY_HEADERS too`);
  ok(/const val ORIGIN = "https:\/\/appassets\.androidplatform\.net"/.test(kt), `${label}: the data origin is unchanged`);
}

// ── The bundle needs no inline script, so script-src 'self' is sufficient ───
function inlineScriptFree(rel) {
  if (!existsSync(at(rel))) return;
  const html = read(rel);
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\b[^>]*>/gi)];
  const inline = scripts.filter(m => !/\bsrc\s*=/.test(m[1]) || m[2].trim().length > 0);
  ok(inline.length === 0, `${rel}: no inline <script> (found ${inline.length})`);
  ok(!/\son[a-z]+\s*=\s*["']/i.test(html), `${rel}: no inline event handler attributes`);
  ok(!/javascript:/i.test(html), `${rel}: no javascript: URLs`);
}
inlineScriptFree('client/index.html');
inlineScriptFree('ios/PriLearning.swiftpm/Resources/Web/index.html');
inlineScriptFree('ios/PriLearning 2.swiftpm/Resources/Web/index.html');

const total = passed + failed;
if (failed) {
  console.error(`NATIVE SHELL CSP: FAIL — ${passed}/${total} checks`);
  process.exit(1);
}
console.log(`NATIVE SHELL CSP: PASS — ${passed}/${total} checks — both native shells enforce the server's Content-Security-Policy, nosniff and Referrer-Policy on every bundled response`);
