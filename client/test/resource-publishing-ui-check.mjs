// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the staff Library section and its file upload (plan F3)
//
//   · a file goes up as parts of at most 512 KiB, each inside the transport's
//     1 MiB JSON limit, in order, then one completion carrying the file's own
//     length and sha256 — the same numbers the server recomputes;
//   · a file that cannot succeed (empty, over 25 MB, not a PDF) is turned away
//     before anything is sent;
//   · the section draws nothing until the server says publishing is on, asks
//     for no token, and reaches the server only through the audited transport;
//   · every string is in both languages.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const root = fileURLToPath(new URL('..', import.meta.url));
const read = rel => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

const { createServer } = await import('vite');
const react = (await import('@vitejs/plugin-react')).default;
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const server = await createServer({
  root, configFile: false, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true },
  plugins: [react()], define: { __PRI_FEATURE_TUTOR__: 'false', __PRI_PRODUCTION_BUILD__: 'false' }
});
try {
  const up = await server.ssrLoadModule('/src/library/assetUpload.js');
  const calls = [];
  const transport = {
    resourceAdminAssetStart: async (...a) => { calls.push(['start', ...a]); return {}; },
    resourceAdminAssetPart: async (rid, n, i, data) => { calls.push(['part', i, Buffer.from(data, 'base64').length, JSON.stringify({ data }).length]); return {}; },
    resourceAdminAssetComplete: async (rid, n, body) => { calls.push(['complete', body]); return { asset: { sha256: body.sha256 } }; }
  };
  const bytes = Buffer.alloc(up.PART_BYTES * 2 + 100, 0x41);
  bytes.write('%PDF-1.4\n', 0);
  const file = { size: bytes.length, type: 'application/pdf', arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
  const seen = [];
  await up.uploadAsset(transport, 'some-paper-1', 1, file, (n, total) => seen.push([n, total]));
  ok(calls[0][0] === 'start' && calls.filter(c => c[0] === 'part').length === 3 && calls.at(-1)[0] === 'complete', 'start, three parts, then complete, in order');
  ok(calls.filter(c => c[0] === 'part').every(c => c[2] <= up.PART_BYTES && c[3] < 1024 * 1024), 'every part is at most 512 KiB and its JSON body is under the 1 MiB transport limit');
  ok(calls.filter(c => c[0] === 'part').map(c => c[2]).join() === `${up.PART_BYTES},${up.PART_BYTES},100`, 'parts are full except the last');
  const done = calls.at(-1)[1];
  ok(done.parts === 3 && done.byteLength === bytes.length && done.sha256 === createHash('sha256').update(bytes).digest('hex'), 'the completion carries the file\'s own length, part count and sha256');
  ok(JSON.stringify(seen) === '[[1,3],[2,3],[3,3]]', 'progress is reported after each part');
  ok(JSON.stringify(up.fileProblems({ size: 0 })) === '["empty"]' && JSON.stringify(up.fileProblems({ size: up.MAX_BYTES + 1, type: 'application/pdf' })) === '["large"]'
    && JSON.stringify(up.fileProblems({ size: 10, type: 'text/html' })) === '["type"]' && up.fileProblems({ size: 10, type: 'application/pdf' }).length === 0, 'an empty, oversized or non-PDF file is refused before anything is sent');
  let local = null; const before = calls.length;
  try { await up.uploadAsset(transport, 'some-paper-1', 1, { size: 0 }); } catch (e) { local = e.code; }
  ok(local === 'UPLOAD_LOCAL' && calls.length === before, 'a refused file makes no request');

  const i18n = await server.ssrLoadModule('/src/i18n/index.js');
  const { default: en } = await server.ssrLoadModule('/src/i18n/strings.en.js');
  const { default: hi } = await server.ssrLoadModule('/src/i18n/strings.hi.js');
  const keys = Object.keys(en).filter(k => k.startsWith('staffLib.'));
  ok(keys.length >= 40 && keys.every(k => hi[k] !== undefined && hi[k] !== en[k]), 'every staff Library string has its own Hindi');
  const panel = await server.ssrLoadModule('/src/components/ResourcePublishingPanel.jsx');
  await i18n.setLanguage('en');
  ok(renderToStaticMarkup(React.createElement(panel.default, { admin: true })) === '', 'the section draws nothing until the server says publishing is on');
} finally {
  await server.close();
}

const panelSrc = read('src/components/ResourcePublishingPanel.jsx');
ok(!/token|github/i.test(panelSrc) && !/token|github/i.test(read('src/library/assetUpload.js')), 'no token or GitHub anywhere in the section or the upload');
ok(!/fetch\(/.test(panelSrc) && !/fetch\(/.test(read('src/library/assetUpload.js')), 'the section reaches the server only through the audited transport');
ok(/useMfaStepUp/.test(panelSrc) && /withMfa\(/.test(panelSrc), 'each action re-asks for the second factor when the server wants it');
ok(/<ResourcePublishingPanel admin=\{admin\} \/>/.test(read('src/components/StaffOperationsPanel.jsx')), 'it sits inside the MFA-gated staff console');
const transportSrc = read('src/platform/cloudTransport.js');
ok((transportSrc.match(/\/v1\/resources\/admin/g) || []).length >= 9 && !/\/v1\/resources\/admin[^`'/]*\?/.test(transportSrc), 'the admin calls use fixed paths with no query string');

if (failures.length) {
  console.error(`RESOURCE PUBLISHING UI: FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const f of failures) console.error(`  · ${f}`);
  process.exit(1);
}
console.log(`RESOURCE PUBLISHING UI: PASS — ${pass}/${pass} checks`);
