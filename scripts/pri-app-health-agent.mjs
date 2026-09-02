#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const opts = {
    mode: 'fast',
    out: path.join(ROOT, 'artifacts', 'app-health-agent'),
    url: process.env.PRI_APP_URL || '',
    timeoutScale: 1
  };
  for (const arg of argv) {
    if (arg.startsWith('--mode=')) opts.mode = arg.slice(7);
    else if (arg.startsWith('--out=')) opts.out = path.resolve(ROOT, arg.slice(6));
    else if (arg.startsWith('--url=')) opts.url = arg.slice(6);
    else if (arg.startsWith('--timeout-scale=')) opts.timeoutScale = Math.max(0.25, Number(arg.slice(16)) || 1);
  }
  if (!['fast', 'deep', 'native'].includes(opts.mode)) {
    throw new Error(`unknown mode ${opts.mode}; expected fast, deep or native`);
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));

const TESTS = [
  {
    id: 'build', modes: ['fast', 'deep'], subsystem: 'App build', severity: 'P0', blocking: true,
    command: ['npm', ['run', 'build']], timeoutMs: 180000,
    fixArea: 'client build / Vite imports / production asset graph',
    action: 'Fix the first build error. Do not inspect downstream UI failures until the production bundle builds cleanly.'
  },
  {
    id: 'ios-bundle-sync', modes: ['fast', 'deep'], subsystem: 'iPad packaged app', severity: 'P0', blocking: true,
    command: ['npm', ['run', 'check:ios']], timeoutMs: 120000,
    fixArea: 'ios/PriLearning*.swiftpm/Resources/Web and scripts/sync-ios.mjs',
    action: 'Rebuild the client, run npm run sync:ios, then verify npm run check:ios. Commit both mirrored bundles together.'
  },
  {
    id: 'backend', modes: ['fast', 'deep'], subsystem: 'Local backend / Practice API', severity: 'P0', blocking: true,
    command: ['npm', ['run', 'test:backend']], timeoutMs: 120000,
    fixArea: 'client/src/local/backend.js and its state transitions',
    action: 'Repair the first failing production API contract before changing UI code; Practice depends on this local backend.'
  },
  {
    id: 'security', modes: ['fast', 'deep'], subsystem: 'Security / data boundaries', severity: 'P0', blocking: true,
    command: ['npm', ['run', 'test:security']], timeoutMs: 120000,
    fixArea: 'payload validation, sanitisation, auth/session boundaries and local persistence',
    action: 'Treat any security regression as release-blocking. Restore the violated invariant instead of weakening the test.'
  },
  {
    id: 'gateway', modes: ['fast', 'deep'], subsystem: 'Client gateway', severity: 'P1', blocking: true,
    command: ['npm', ['run', 'test:gateway']], timeoutMs: 120000,
    fixArea: 'client API/gateway routing and error handling',
    action: 'Fix request/response compatibility so the UI and local backend agree on the same contract.'
  },
  {
    id: 'outbox', modes: ['fast', 'deep'], subsystem: 'Offline queue / sync', severity: 'P1', blocking: true,
    command: ['npm', ['run', 'test:outbox']], timeoutMs: 120000,
    fixArea: 'offline outbox, retry/idempotency and persistence',
    action: 'Restore deterministic offline replay and make retries idempotent before shipping.'
  },
  {
    id: 'diagnose', modes: ['fast', 'deep'], subsystem: 'Misconception diagnosis', severity: 'P1', blocking: true,
    command: ['npm', ['run', 'test:diagnose']], timeoutMs: 120000,
    fixArea: 'client/src/engine/diagnose.js and step-diagnosis rules',
    action: 'Fix the earliest false positive/false negative rule. Do not broaden a misconception rule to make one fixture pass.'
  },
  {
    id: 'explain', modes: ['fast', 'deep'], subsystem: 'Pri Explain', severity: 'P1', blocking: true,
    command: ['npm', ['run', 'test:explain']], timeoutMs: 120000,
    fixArea: 'client/src/explain and evidence-led teaching profiles',
    action: 'Keep explanation adaptation answer-blind. Repair evidence/profile selection rather than injecting expected answers.'
  },
  {
    id: 'ink-bridge', modes: ['fast', 'deep', 'native'], subsystem: 'Handwriting JS↔Swift bridge', severity: 'P0', blocking: true,
    command: ['npm', ['run', 'test:ink:bridge']], timeoutMs: 120000,
    fixArea: 'client/src/ink/native.js and ios/PriLearning*.swiftpm/Ink',
    action: 'Restore bridge schema/lifecycle parity in both mirrored Swift packages before touching recognition thresholds.'
  },
  {
    id: 'ink-hybrid', modes: ['fast', 'deep'], subsystem: 'Handwriting authority / arbitration', severity: 'P0', blocking: true,
    command: ['npm', ['run', 'test:ink:hybrid']], timeoutMs: 180000,
    fixArea: 'client/src/ink/nativeConsensus.js, hybrid.js and confidence authority',
    action: 'Fix answer-blind reader fusion or uncertainty handling. Never make a disagreement auto-mark merely to make the suite green.'
  },
  {
    id: 'mounted-app', modes: ['fast', 'deep'], subsystem: 'Actual mounted student flows', severity: 'P0', blocking: true,
    command: ['node', ['client/test/e2e.mjs', '--no-build']], timeoutMs: 900000,
    fixArea: 'rendered login, Home, Practice, handwriting and exam flows',
    action: 'Use the named failing flow/assertion and its screenshot. Repair the student-visible behaviour, then rerun the complete mounted suite.'
  },
  {
    id: 'person1-loop', modes: ['deep'], subsystem: 'Intelligence loop', severity: 'P0', blocking: true,
    command: ['node', ['client/test/person1-intelligence-loop-check.mjs']], timeoutMs: 180000,
    fixArea: 'recognition → marking → diagnosis → adaptivity → Pri Explain contract',
    action: 'Repair the first broken boundary in the loop. Later stages must not compensate for an earlier incorrect authority decision.'
  },
  {
    id: 'engine-quick', modes: ['deep'], subsystem: 'Maths engine', severity: 'P0', blocking: true,
    command: ['npm', ['run', 'test:engine:quick']], timeoutMs: 900000,
    fixArea: 'server question generators, markers and mathematical equivalence engine',
    action: 'Fix the specific generator/marker pair that violates self-consistency. Do not reduce coverage or accepted invariants.'
  },
  {
    id: 'india-coverage', modes: ['deep'], subsystem: 'India curriculum coverage', severity: 'P1', blocking: true,
    command: ['npm', ['run', 'test:india']], timeoutMs: 600000,
    fixArea: 'India curriculum map, generators, topic metadata and coverage declarations',
    action: 'Restore the missing/invalid curriculum mapping and keep declared coverage aligned with executable generators.'
  },
  {
    id: 'ncert-rational', modes: ['deep'], subsystem: 'NCERT Class 8 rational numbers', severity: 'P1', blocking: true,
    command: ['npm', ['run', 'test:ncert:rational']], timeoutMs: 300000,
    fixArea: 'NCERT Class 8 rational-number content and verification',
    action: 'Repair source-backed content or exercise representation without inventing unsupported NCERT material.'
  },
  {
    id: 'ncert-linear', modes: ['deep'], subsystem: 'NCERT Class 8 linear equations', severity: 'P1', blocking: true,
    command: ['npm', ['run', 'test:ncert:linear']], timeoutMs: 300000,
    fixArea: 'NCERT Class 8 linear-equation content and verification',
    action: 'Repair source-backed content or exercise representation without weakening source verification.'
  },
  {
    id: 'ncert-class8-rest', modes: ['deep'], subsystem: 'NCERT Class 8 remaining chapters', severity: 'P1', blocking: true,
    command: ['npm', ['run', 'test:ncert:class8:rest']], timeoutMs: 600000,
    fixArea: 'NCERT Class 8 chapter coverage and formal-exercise mapping',
    action: 'Fix the named chapter/page/exercise gap and preserve source-verification counts.'
  },
  {
    id: 'ncert-class9', modes: ['deep'], subsystem: 'NCERT Class 9', severity: 'P1', blocking: true,
    command: ['npm', ['run', 'test:ncert:class9']], timeoutMs: 600000,
    fixArea: 'NCERT Class 9 content, handwriting-ready forms and coverage',
    action: 'Fix the failing chapter/form generator while retaining the declared source-backed coverage.'
  },
  {
    id: 'ink-arbitration', modes: ['deep'], subsystem: 'Handwriting arbitration edge cases', severity: 'P0', blocking: true,
    command: ['npm', ['run', 'test:ink:arbitration']], timeoutMs: 180000,
    fixArea: 'native reader arbitration and confirmation boundary',
    action: 'Preserve conservative confirmation on disagreement; correct evidence fusion instead of raising unsafe confidence.'
  },
  {
    id: 'ink-sets', modes: ['deep'], subsystem: 'Handwritten set notation', severity: 'P1', blocking: true,
    command: ['npm', ['run', 'test:ink:sets']], timeoutMs: 180000,
    fixArea: 'setNotation.js and answer-blind notation context',
    action: 'Repair notation recognition/context without using hidden expected-answer information.'
  },
  {
    id: 'ink-stability', modes: ['deep'], subsystem: 'Long-page handwriting stability', severity: 'P0', blocking: true,
    command: ['npm', ['run', 'test:ink:stability']], timeoutMs: 300000,
    fixArea: 'InkAnswer lifecycle, stale-read cancellation and long-page recognition stability',
    action: 'Fix lifecycle/stale work first. Avoid reintroducing deep copies or remounts that make long solutions lag.'
  },
  {
    id: 'accessibility', modes: ['deep'], subsystem: 'Accessibility', severity: 'P1', blocking: true,
    command: ['npm', ['run', 'test:a11y']], timeoutMs: 600000,
    fixArea: 'interactive semantics, labels, focus order and screen-reader state',
    action: 'Repair the named accessibility contract in the actual component; do not suppress axe/test output.'
  },
  {
    id: 'real-ink-status', modes: ['deep'], subsystem: 'Real-writer handwriting evidence', severity: 'P2', blocking: false,
    command: ['npm', ['run', 'test:real']], timeoutMs: 300000,
    fixArea: 'real-writer corpus/evidence quantity and recognizer failure taxonomy',
    action: 'Treat this as empirical evidence, not a synthetic gate. Collect/fix real writer failures; never manufacture samples.'
  },
  {
    id: 'physical-evidence-status', modes: ['deep'], subsystem: 'Physical Apple Pencil release evidence', severity: 'P2', blocking: false,
    command: ['node', ['client/test/ink-physical-release-evidence.mjs']], timeoutMs: 120000,
    fixArea: 'handwriting/v12/evidence/physical and physical study execution',
    action: 'If evidence is NOT MEASURED, continue the real iPad study. Do not lower release floors or add synthetic evidence.'
  },
  {
    id: 'study-plan', modes: ['deep'], subsystem: 'Physical handwriting study plan', severity: 'P1', blocking: true,
    command: ['node', ['client/test/ink-physical-study-plan-check.mjs']], timeoutMs: 120000,
    fixArea: 'handwriting/v12/PHYSICAL_STUDY_PLAN.json and deterministic split allocation',
    action: 'Restore writer-disjoint deterministic splits, hardware balance and study capacity before collecting more evidence.'
  },
  {
    id: 'native-package-sync', modes: ['native'], subsystem: 'Native iPad source parity', severity: 'P0', blocking: true,
    command: ['node', ['scripts/check-native-package-sync.mjs']], timeoutMs: 120000,
    fixArea: 'ios/PriLearning.swiftpm and ios/PriLearning 2.swiftpm',
    action: 'Make the two tracked Swift packages source-identical; never fix only one copy.'
  },
  {
    id: 'xcode-ipad', modes: ['native'], subsystem: 'Native iPad toolchain', severity: 'P0', blocking: true,
    command: ['bash', ['-lc', "set -euo pipefail; xcodebuild -version; xcrun simctl list devices available | grep -m 1 'iPad'"]], timeoutMs: 120000,
    fixArea: 'Xcode/macOS runner and supported iPad simulator availability',
    action: 'Use a runner/Xcode image with an available iPad simulator before trusting native results.'
  },
  {
    id: 'native-ink-app', modes: ['native'], subsystem: 'Native PencilKit/Vision app', severity: 'P0', blocking: true,
    command: ['npm', ['run', 'test:ink:native']], timeoutMs: 1200000,
    fixArea: 'Swift PencilKit/Vision integration, mounted iPad app and native lifecycle',
    action: 'Fix the first native self-check/benchmark failure and preserve stale-result cancellation and package parity.'
  }
];

function shortTail(text, maxChars = 3600) {
  const clean = String(text || '').replace(/\r/g, '').trim();
  if (!clean) return '(no output)';
  return clean.length <= maxChars ? clean : `…${clean.slice(-maxChars)}`;
}

function shellLine(test) {
  const [bin, args] = test.command;
  return [bin, ...args].map(part => /[\s"'`$]/.test(part) ? JSON.stringify(part) : part).join(' ');
}

async function runCommand(test) {
  const started = Date.now();
  const [bin, args] = test.command;
  const timeoutMs = Math.round(test.timeoutMs * opts.timeoutScale);
  return await new Promise(resolve => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const child = spawn(bin, args, {
      cwd: ROOT,
      env: { ...process.env, CI: process.env.CI || '1' },
      shell: process.platform === 'win32'
    });
    const append = (key, chunk) => {
      if (key === 'stdout') stdout += chunk.toString();
      else stderr += chunk.toString();
      const cap = 120000;
      if (stdout.length > cap) stdout = stdout.slice(-cap);
      if (stderr.length > cap) stderr = stderr.slice(-cap);
    };
    child.stdout?.on('data', chunk => append('stdout', chunk));
    child.stderr?.on('data', chunk => append('stderr', chunk));
    child.on('error', error => {
      stderr += `\n${error.stack || error}`;
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 2500).unref();
    }, timeoutMs);
    child.on('close', code => {
      clearTimeout(timer);
      resolve({
        ...test,
        status: !timedOut && code === 0 ? 'pass' : 'fail',
        exitCode: code,
        timedOut,
        durationMs: Date.now() - started,
        commandLine: shellLine(test),
        evidence: shortTail(`${stdout}\n${stderr}`)
      });
    });
  });
}

async function runLiveSmoke(url) {
  if (opts.mode === 'native') return null;
  if (!url) {
    return {
      id: 'live-origin', subsystem: 'Deployed/live app', severity: 'P2', blocking: false,
      status: 'skip', durationMs: 0, commandLine: 'PRI_APP_URL not configured',
      fixArea: 'GitHub Actions repository variable PRI_APP_URL',
      action: 'Set PRI_APP_URL to the public production/staging app origin so the agent also checks the deployed shell and Practice route.',
      evidence: 'Live-origin smoke test was not run. Local production build and mounted browser flows were still checked.'
    };
  }
  const base = url.replace(/\/+$/, '');
  const paths = ['/', '/practice'];
  const started = Date.now();
  const notes = [];
  let failed = false;
  for (const pathname of paths) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(base + pathname, {
        redirect: 'follow', signal: controller.signal,
        headers: { 'user-agent': 'Pri-App-Health-Agent/1.0' }
      });
      const type = response.headers.get('content-type') || '';
      const body = await response.text();
      const htmlLike = /text\/html/i.test(type) || /<html|<div[^>]+id=["']root/i.test(body);
      const appMarker = /Pri Learning|id=["']root["']|class=["'][^"']*(?:auth-wrap|shell)/i.test(body);
      notes.push(`${pathname}: HTTP ${response.status}, ${type || 'unknown content-type'}, app marker ${appMarker ? 'yes' : 'no'}`);
      if (!response.ok || !htmlLike || !appMarker) failed = true;
    } catch (error) {
      failed = true;
      notes.push(`${pathname}: ${error.name || 'Error'}: ${error.message || error}`);
    } finally {
      clearTimeout(timeout);
    }
  }
  return {
    id: 'live-origin', subsystem: 'Deployed/live app', severity: 'P0', blocking: true,
    status: failed ? 'fail' : 'pass', durationMs: Date.now() - started,
    commandLine: `HTTP smoke ${base}{/,/practice}`,
    fixArea: 'deployment, routing, generated assets, hosting configuration',
    action: 'Restore a 2xx HTML app shell on both / and /practice before treating the release as healthy.',
    evidence: notes.join('\n')
  };
}

function formatDuration(ms) {
  if (!Number.isFinite(ms)) return '?';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)} s`;
}

function reportMarkdown(report) {
  const failures = report.results.filter(r => r.status === 'fail');
  const blockers = failures.filter(r => r.blocking);
  const advisory = failures.filter(r => !r.blocking);
  const skips = report.results.filter(r => r.status === 'skip');
  const icon = blockers.length ? '🔴' : advisory.length || skips.length ? '🟠' : '🟢';
  const lines = [];
  lines.push(`# ${icon} Pri Learning App Health Agent`);
  lines.push('');
  lines.push(`**Verdict:** ${report.summary.verdict}`);
  lines.push(`**Mode:** ${report.mode}  `);
  lines.push(`**Commit:** \`${report.commit}\`  `);
  lines.push(`**Checks:** ${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.skipped} skipped  `);
  lines.push(`**Blocking failures:** ${report.summary.blockingFailures}  `);
  lines.push(`**Run time:** ${formatDuration(report.durationMs)}`);
  lines.push('');

  if (!failures.length) {
    lines.push('## Result');
    lines.push('');
    lines.push('No automated app-health regression was found in the surfaces exercised by this run.');
    lines.push('');
  } else {
    lines.push('## What needs to be fixed');
    lines.push('');
    const ordered = [...failures].sort((a, b) => ['P0', 'P1', 'P2'].indexOf(a.severity) - ['P0', 'P1', 'P2'].indexOf(b.severity));
    for (const failure of ordered) {
      lines.push(`### ${failure.severity} · ${failure.subsystem}`);
      lines.push('');
      lines.push(`- **Check:** \`${failure.id}\``);
      lines.push(`- **Command:** \`${failure.commandLine.replace(/`/g, '\\`')}\``);
      lines.push(`- **Likely repair area:** ${failure.fixArea}`);
      lines.push(`- **Next fix:** ${failure.action}`);
      lines.push(`- **Duration:** ${formatDuration(failure.durationMs)}${failure.timedOut ? ' (timed out)' : ''}`);
      lines.push('');
      lines.push('<details><summary>Failure evidence</summary>');
      lines.push('');
      lines.push('```text');
      lines.push(shortTail(failure.evidence, 4200).replace(/```/g, '``` '));
      lines.push('```');
      lines.push('</details>');
      lines.push('');
    }
  }

  lines.push('## Coverage');
  lines.push('');
  lines.push('| Status | Severity | Subsystem | Check | Time |');
  lines.push('|---|---|---|---|---:|');
  for (const result of report.results) {
    const status = result.status === 'pass' ? '✅ pass' : result.status === 'fail' ? '❌ fail' : '➖ skipped';
    lines.push(`| ${status} | ${result.severity} | ${result.subsystem.replace(/\|/g, '/')} | \`${result.id}\` | ${formatDuration(result.durationMs)} |`);
  }
  lines.push('');
  lines.push('## Evidence boundary');
  lines.push('');
  lines.push('- Browser E2E drives the mounted production build through real student flows; it is not a screenshot-only tour.');
  lines.push('- `check:ios` verifies the packaged SwiftPM web bundle matches the current client build.');
  lines.push('- Native mode builds/exercises the PencilKit/Vision iPad simulator path on macOS.');
  lines.push('- A simulator is not a physical Apple Pencil. Real-writer/physical release evidence remains a separate empirical gate.');
  if (skips.length) {
    lines.push(`- Skipped checks: ${skips.map(s => `\`${s.id}\``).join(', ')}.`);
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const started = Date.now();
  await mkdir(opts.out, { recursive: true });
  const selected = TESTS.filter(test => test.modes.includes(opts.mode));
  const results = [];

  if (opts.mode !== 'native') {
    const live = await runLiveSmoke(opts.url);
    if (live) results.push(live);
  }

  for (const test of selected) {
    process.stdout.write(`[health] ${test.severity} ${test.id} … `);
    const result = await runCommand(test);
    results.push(result);
    process.stdout.write(`${result.status.toUpperCase()} (${formatDuration(result.durationMs)})\n`);
  }

  let commit = process.env.GITHUB_SHA || 'unknown';
  if (commit === 'unknown' && existsSync(path.join(ROOT, '.git'))) {
    const git = await runCommand({
      id: 'git-head', subsystem: 'metadata', severity: 'P2', blocking: false,
      command: ['git', ['rev-parse', 'HEAD']], timeoutMs: 5000, fixArea: '', action: ''
    });
    if (git.status === 'pass') commit = git.evidence.trim().split(/\s+/)[0];
  }

  const failed = results.filter(r => r.status === 'fail');
  const blockingFailures = failed.filter(r => r.blocking).length;
  const skipped = results.filter(r => r.status === 'skip').length;
  const verdict = blockingFailures ? 'FIX REQUIRED' : failed.length || skipped ? 'HEALTHY WITH EVIDENCE GAPS' : 'HEALTHY';
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: opts.mode,
    commit,
    liveUrlConfigured: Boolean(opts.url),
    durationMs: Date.now() - started,
    summary: {
      verdict,
      total: results.length,
      passed: results.filter(r => r.status === 'pass').length,
      failed: failed.length,
      skipped,
      blockingFailures
    },
    results
  };

  const markdown = reportMarkdown(report);
  await writeFile(path.join(opts.out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await writeFile(path.join(opts.out, 'report.md'), markdown);
  process.stdout.write(`\n${markdown}`);
  process.exitCode = blockingFailures ? 1 : 0;
}

main().catch(async error => {
  try {
    await mkdir(opts.out, { recursive: true });
    const body = `# 🔴 Pri Learning App Health Agent\n\nAgent crashed before completing its report.\n\n\`\`\`text\n${String(error?.stack || error)}\n\`\`\`\n`;
    await writeFile(path.join(opts.out, 'report.md'), body);
    await writeFile(path.join(opts.out, 'report.json'), JSON.stringify({
      schemaVersion: 1, generatedAt: new Date().toISOString(), mode: opts.mode,
      summary: { verdict: 'AGENT FAILURE', total: 0, passed: 0, failed: 1, skipped: 0, blockingFailures: 1 },
      error: String(error?.stack || error), results: []
    }, null, 2) + '\n');
  } catch {}
  console.error(error);
  process.exitCode = 1;
});
