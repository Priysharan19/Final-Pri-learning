import { readFile, writeFile } from 'node:fs/promises';

const path = new URL('../.github/workflows/ci.yml', import.meta.url);
const text = await readFile(path, 'utf8');

const startNeedle = `          hits="$(grep -rn 'fetch(\\|XMLHttpRequest\\|sendBeacon\\|new WebSocket\\|EventSource' client/src)" || rc=$?`;
const endNeedle = `          echo "read $count source files: no fetch, XHR, beacon, WebSocket or EventSource"`;
const start = text.indexOf(startNeedle);
const endStart = text.indexOf(endNeedle, start);
if (start < 0 || endStart < 0) {
  throw new Error('CI network gate block did not match; refusing blind patch');
}
const end = endStart + endNeedle.length;

const replacement = `          # The optional handwriting cloud transport is the sole audited client-side
          # network boundary. Everything else remains offline-only. Keep this
          # exception exact: one fetch in cloud.js, gateway-only, and never a key.
          hits="$(grep -rn --exclude='cloud.js' 'fetch(\\|XMLHttpRequest\\|sendBeacon\\|new WebSocket\\|EventSource' client/src)" || rc=$?
          if [ "$rc" -gt 1 ]; then
            echo "::error::the scan itself failed (grep exit $rc) — nothing was checked"
            exit 1
          fi
          if [ -n "$hits" ]; then
            printf '%s\\n' "$hits"
            echo "::error::client/src opens an unapproved network path — see README, \\"No telemetry\\""
            exit 1
          fi

          cloud_file="client/src/ink/cloud.js"
          if [ ! -s "$cloud_file" ]; then
            echo "::error::the approved handwriting cloud boundary is missing"
            exit 1
          fi
          cloud_hits="$(grep -n 'fetch(' "$cloud_file" || true)"
          cloud_count="$(printf '%s\\n' "$cloud_hits" | sed '/^$/d' | wc -l | tr -d ' ')"
          if [ "$cloud_count" -ne 1 ]; then
            printf '%s\\n' "$cloud_hits"
            echo "::error::cloud.js must contain exactly one audited fetch call, found $cloud_count"
            exit 1
          fi
          if grep -Eq 'api\\.openai\\.com|OPENAI_API_KEY' "$cloud_file"; then
            echo "::error::cloud.js must talk only to the Pri gateway; OpenAI secrets/endpoints are server-side"
            exit 1
          fi
          grep -q 'VITE_PRI_CLOUD_INK_ENDPOINT' "$cloud_file" || { echo "::error::cloud endpoint must remain explicit configuration"; exit 1; }
          grep -q '4190/v1/handwriting/recognize' "$cloud_file" || { echo "::error::LAN cloud endpoint contract disappeared"; exit 1; }
          echo "read $count source files: no unapproved network primitives; one audited handwriting gateway fetch"`;

await writeFile(path, text.slice(0, start) + replacement + text.slice(end));
console.log('Patched CI network boundary gate');
