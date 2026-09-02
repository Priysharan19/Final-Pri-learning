import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const swift = readFileSync(new URL('../../ios/PriLearning.swiftpm/NativeCloudBridge.swift', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../../ios/PriLearning.swiftpm/WebShell.swift', import.meta.url), 'utf8');
const transport = readFileSync(new URL('../src/platform/cloudTransport.js', import.meta.url), 'utf8');

assert.match(shell, /__PRI_NATIVE_CLOUD__\s*=\s*true/, 'native shell must advertise the native cloud bridge');
assert.match(shell, /__PRI_NATIVE_CLOUD_CONFIGURED__\s*=\s*\\\(cloudConfigured\)/,
  'native shell must fail closed when no native cloud origin is configured');
assert.match(shell, /name:\s*"priCloud"/, 'WKWebView must install a dedicated native cloud message handler');
assert.match(shell, /cloud\.handle\(message\.body\)/, 'priCloud messages must route only through NativeCloudBridge');
assert.match(shell, /#if DEBUG[\s\S]*webView\.isInspectable\s*=\s*true[\s\S]*#endif/,
  'Safari Web Inspector must be debug-only');

assert.match(swift, /URLSessionConfiguration\.default/, 'native cloud must use URLSession rather than WKWebView fetch');
assert.match(swift, /HTTPCookieStorage/, 'native cloud must keep its HTTPS session in the native cookie jar');
assert.match(swift, /Bundle\.main\.object\(forInfoDictionaryKey:\s*"PRICloudOrigin"\)/,
  'release cloud origin must be deployment-configurable through app metadata');
assert.match(swift, /ProcessInfo\.processInfo\.environment\["PRI_CLOUD_ORIGIN"\]/,
  'development/test builds must support an injected cloud origin');
assert.match(swift, /guard scheme == "https"/, 'release native cloud origin must require HTTPS');
assert.match(swift, /path\.hasPrefix\("\/v1\/"\)/, 'native bridge must be restricted to the Pri platform API');
assert.match(swift, /!path\.contains\("\.\."\)/, 'native bridge must reject traversal paths');
assert.match(swift, /maxRequestBytes\s*=\s*1\s*\*\s*1024\s*\*\s*1024/, 'native request body must be bounded');
assert.match(swift, /maxResponseBytes\s*=\s*2\s*\*\s*1024\s*\*\s*1024/, 'native response body must be bounded');
assert.match(swift, /request\.setValue\("ios-native-v1",\s*forHTTPHeaderField:\s*"X-Pri-Client"\)/,
  'server must be able to identify the non-browser URLSession client');
assert.match(swift, /cookieStorage\.cookies\(for:\s*origin\).*\$0\.name\s*==\s*"pri_csrf"/s,
  'authenticated native mutations must copy the server-issued CSRF cookie into the CSRF header');
assert.doesNotMatch(swift, /body\["origin"\]/,
  'JavaScript must never choose the native destination origin');
assert.doesNotMatch(swift, /Set-Cookie/i,
  'native bridge must not expose cookie headers back to JavaScript');

assert.match(transport, /messageHandlers\?\.priCloud/, 'audited client transport must target only the native cloud handler');
assert.match(transport, /pri:native-cloud-response/, 'client transport must consume native response events');
assert.match(transport, /bridge\.postMessage\(\{ id, action: 'cancel' \}\)/,
  'abort and timeout must cancel the underlying native URLSession request');
const requestBody = transport.slice(transport.indexOf('export async function cloudRequest'));
const nativeBranch = requestBody.indexOf('if (nativeCloudAvailable())');
const webOrigin = requestBody.indexOf('const origin = normalizeCloudOrigin()');
const webFetch = requestBody.indexOf('await fetch(');
assert.ok(nativeBranch >= 0 && webOrigin > nativeBranch && webFetch > webOrigin,
  'cloudRequest must choose native transport before resolving a web origin or calling fetch');
assert.match(transport, /globalThis\.__PRI_NATIVE_CLOUD_CONFIGURED__\s*===\s*true/,
  'native cloud availability must fail closed when the release origin is absent');

console.log('PASS — iOS cloud traffic is bounded to NativeCloudBridge, keeps cookies/CSRF native, rejects JS-selected origins, and preserves the web transport fallback.');
