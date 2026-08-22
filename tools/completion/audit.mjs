import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const argv = process.argv.slice(2);
const has = flag => argv.includes(flag);
const argValue = (name, fallback = null) => {
  const direct = argv.find(v => v.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const OUT_DIR = resolve(ROOT, argValue('--out-dir', 'artifacts/completion'));
const EVIDENCE_OUT = argValue('--evidence-out');

function safeRead(path) {
  try { return readFileSync(join(ROOT, path), 'utf8'); } catch { return ''; }
}

function fileExists(path) { return existsSync(join(ROOT, path)); }
function filesExist(paths) { return paths.every(fileExists); }
function contains(path, needles) {
  const text = safeRead(path);
  return needles.every(n => text.includes(n));
}

function staticGate(id, pass, evidence) {
  return { id, pass: Boolean(pass), kind: 'static', measured: pass ? 1 : 0, floor: 1, evidence, source: 'repository' };
}

function commandGate(id, result, evidence) {
  const ran = result && Number.isInteger(result.status);
  return {
    id,
    pass: Boolean(ran && result.status === 0),
    kind: 'command',
    measured: ran ? result.status : null,
    floor: 0,
    evidence: ran ? evidence : `${evidence}: not measured`,
    source: result?.name || 'command'
  };
}

function parseCiFloors() {
  const text = safeRead('.github/workflows/ci.yml');
  const keys = [
    'ENGINE_SELFCHECKS','ENGINE_MULTIPART','BACKEND_CHECKS','BACKEND_ROUTES','SECURITY_CHECKS',
    'INK_SELF','INK_PROBES','HARD_SYMBOLS','HARD_SCENES','HARD_DIGITS','LINES_EXACT','LINES_CHARS',
    'HOLDOUT1_LINES','HOLDOUT1_WORST','HOLDOUT2_LINES','HOLDOUT2_WORST','CONTEXT_WRONG_READINGS'
  ];
  const out = {};
  for (const key of keys) {
    const match = text.match(new RegExp(`^\\s*${key}:\\s*["']?([0-9.]+)["']?\\s*$`, 'm'));
    if (match) out[key] = Number(match[1]);
  }
  return out;
}

const METRICS = [
  ['engine.selfchecks', 'ENGINE_SELFCHECKS', /^(\d+)\/\d+ self-checks passed across/m],
  ['engine.multipart', 'ENGINE_MULTIPART', /^(\d+)\/\d+ multipart part-checks passed/m],
  ['backend.checks', 'BACKEND_CHECKS', /BACKEND SUITE[^\n]*—\s*(\d+)\//m],
  ['backend.routes', 'BACKEND_ROUTES', /route coverage:\s*(\d+)\//m],
  ['security.checks', 'SECURITY_CHECKS', /SECURITY SUITE[^\n]*—\s*(\d+)\//m],
  ['ink.self', 'INK_SELF', /RECOGNIZER SUITE[^\n]*self\s+([0-9.]+)%/m],
  ['ink.probes', 'INK_PROBES', /RECOGNIZER SUITE[^\n]*probes\s+([0-9.]+)%/m],
  ['ink.hard.symbols', 'HARD_SYMBOLS', /HARD SUITE[^\n]*symbols\s+([0-9.]+)%/m],
  ['ink.hard.scenes', 'HARD_SCENES', /HARD SUITE[^\n]*scenes\s+(\d+)\//m],
  ['ink.hard.digits', 'HARD_DIGITS', /HARD SUITE[^\n]*digit strings\s+([0-9.]+)%/m],
  ['ink.lines.exact', 'LINES_EXACT', /LINE SUITE[^\n]*—\s*([0-9.]+)% lines exact/m],
  ['ink.lines.chars', 'LINES_CHARS', /LINE SUITE[^\n]*exact,\s*([0-9.]+)% chars/m],
  ['ink.holdout1.lines', 'HOLDOUT1_LINES', /HELD-OUT SCORE[^\n]*—\s*([0-9.]+)% lines/m],
  ['ink.holdout1.worst', 'HOLDOUT1_WORST', /HELD-OUT SCORE[^\n]*worst writer\s+([0-9.]+)%/m],
  ['ink.holdout2.lines', 'HOLDOUT2_LINES', /HELD-OUT-2 SCORE[^\n]*—\s*([0-9.]+)% lines/m],
  ['ink.holdout2.worst', 'HOLDOUT2_WORST', /HELD-OUT-2 SCORE[^\n]*worst writer\s+([0-9.]+)%/m],
  ['ink.context.coverage', 'CONTEXT_WRONG_READINGS', /wrong-answer readings ctx left alone[^\n]*\/(\d+)/m]
];

function metricGates(log) {
  const floors = parseCiFloors();
  return METRICS.map(([id, floorKey, regex]) => {
    const floor = floors[floorKey];
    const match = log.match(regex);
    const measured = match ? Number(match[1]) : null;
    const valid = Number.isFinite(floor) && Number.isFinite(measured);
    return {
      id,
      pass: Boolean(valid && measured >= floor),
      kind: 'metric',
      measured,
      floor: Number.isFinite(floor) ? floor : null,
      evidence: !Number.isFinite(floor) ? `CI floor ${floorKey} missing` : measured === null ? 'metric not measured' : `${measured} >= CI floor ${floor}`,
      source: 'npm test / .github/workflows/ci.yml'
    };
  });
}

function run(name, command, args) {
  console.log(`\n=== ${name} ===`);
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 96 * 1024 * 1024,
    env: { ...process.env, CI: process.env.CI || '1' }
  });
  const text = `${result.stdout || ''}${result.stderr || ''}`;
  process.stdout.write(text);
  return { name, status: Number.isInteger(result.status) ? result.status : null, signal: result.signal || null, text };
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function nodeEvidence() {
  const suite = run('npm test', 'npm', ['test']);
  const e2e = run('e2e', 'npm', ['run', 'test:e2e']);
  const a11y = run('accessibility', 'npm', ['run', 'test:a11y']);
  const build = run('client build', 'npm', ['run', 'build', '--prefix', 'client']);
  const iosSync = run('iOS bundle sync check', 'npm', ['run', 'check:ios']);
  const realInk = run('real Pencil corpus', 'npm', ['run', 'test:real']);
  const realMeasured = realInk.status === 0 && !/not measured|no (?:real )?(?:ink|corpus)|empty corpus|0 writers|0 samples/i.test(realInk.text);
  return {
    schema: 1,
    kind: 'node',
    generatedAt: new Date().toISOString(),
    gates: [
      ...metricGates(suite.text),
      commandGate('frontend.e2e', e2e, 'end-to-end flows exited 0'),
      commandGate('frontend.a11y', a11y, 'accessibility gate exited 0'),
      commandGate('frontend.build', build, 'Vite production build exited 0'),
      commandGate('ios.bundle-sync', iosSync, 'bundled iOS web assets match current client build'),
      {
        id: 'ml.real-ink-measured', pass: Boolean(realMeasured), kind: 'measurement',
        measured: realMeasured ? 1 : 0, floor: 1,
        evidence: realMeasured ? 'real Pencil corpus produced a measurable benchmark' : 'real Pencil corpus is absent/unmeasured or the suite failed',
        source: 'npm run test:real'
      }
    ],
    commands: [suite, e2e, a11y, build, iosSync, realInk].map(({ name, status, signal }) => ({ name, status, signal }))
  };
}

function nativeEvidence() {
  const bridge = run('native JS-Swift bridge', 'npm', ['run', 'test:ink:bridge']);
  const native = run('native PencilKit/Vision validation', 'npm', ['run', 'test:ink:native']);
  return {
    schema: 1,
    kind: 'native',
    generatedAt: new Date().toISOString(),
    gates: [
      commandGate('ios.ink-bridge', bridge, 'JS ↔ Swift ink contract exited 0'),
      commandGate('ios.native-ink', native, 'native PencilKit/Vision build + simulator validation exited 0')
    ],
    commands: [bridge, native].map(({ name, status, signal }) => ({ name, status, signal }))
  };
}

function repositoryGates() {
  return [
    staticGate('repo.frontend-shell', contains('client/src/App.jsx', ['<Routes>', '<Route path="/practice"', '<Route path="/progress"', '<Route path="/settings"']), 'React application shell and core routes are present'),
    staticGate('repo.pwa', filesExist(['client/public/manifest.webmanifest', 'client/public/sw.js']), 'PWA manifest and service worker are present'),
    staticGate('repo.student-platform', filesExist(['client/src/pages/Practice.jsx','client/src/pages/Progress.jsx','client/src/pages/Exams.jsx','client/src/pages/ExamRoom.jsx','client/src/pages/History.jsx','client/src/pages/Favorites.jsx','client/src/pages/Rush.jsx','client/src/pages/Match.jsx']), 'student product surfaces are present'),
    staticGate('repo.teacher-platform', filesExist(['client/src/pages/Teach.jsx','client/src/pages/Classes.jsx','client/src/pages/Tasks.jsx']) && contains('client/src/local/backend.js', ['/classes', '/tasks', '/custom-questions']), 'teacher UI and teacher-domain backend routes are present'),
    staticGate('repo.math-marker', contains('client/src/engine/checker.js', ['export function checkAnswer', 'stepCheck']), 'answer and step marking entry points are present'),
    staticGate('repo.curriculum', contains('client/src/engine/curriculum.js', ['CURRICULUM', 'dotpointsFor', 'scopeForYear']), 'curriculum and dot-point APIs are present'),
    staticGate('repo.generator-banks', filesExist(['client/src/engine/generators/year7.js','client/src/engine/generators/year8.js','client/src/engine/generators/year9.js','client/src/engine/generators/year10.js','client/src/engine/generators/year11.js','client/src/engine/generators/year12.js','client/src/engine/generators/multipart.js']), 'Years 7–12 and multipart generator banks are present'),
    staticGate('repo.adaptive-engine', contains('client/src/engine/adaptive.js', ['updateRating', 'masteryOf', 'pickDifficulty', 'scheduleReview', 'predictMark']), 'adaptive rating, mastery, difficulty, review and prediction APIs are present'),
    staticGate('repo.web-ink', filesExist(['client/src/ink/recognizer.js','client/src/ink/InkAnswer.jsx','client/src/ink/InkCanvas.jsx','client/src/ink/nn.js','client/src/ink/personal.js']), 'browser handwriting runtime and personalisation modules are present'),
    staticGate('repo.ml-toolchain', filesExist(['tools/ink-train/train.py','tools/ink-train/trainC.py','tools/ink-train/train_rerank.py','tools/ink-train/gen.mjs','tools/ink-collect/index.html']), 'training and genuine Pencil data-collection tools are present'),
    staticGate('repo.local-backend', filesExist(['client/src/local/backend.js','client/src/local/gateway.js','client/src/local/idb.js','client/src/local/outbox.js','client/src/local/auth.js']), 'local API, storage, sync queue and auth modules are present'),
    staticGate('repo.indexeddb-schema', contains('client/src/local/idb.js', ["mk('profiles'", "mk('ratings'", "mk('attempts'", "mk('inks'", "mk('classes'", "mk('tasks'"]), 'core production IndexedDB stores are declared'),
    staticGate('repo.ios-package', filesExist(['ios/PriLearning.swiftpm/Package.swift','ios/PriLearning.swiftpm/PriLearningApp.swift','ios/PriLearning.swiftpm/WebShell.swift','ios/PriLearning.swiftpm/Ink/InkBridge.swift']), 'Swift package, app shell, web shell and ink bridge are present'),
    staticGate('repo.ci', filesExist(['.github/workflows/ci.yml','.github/workflows/native-ink.yml']) && contains('.github/workflows/ci.yml', ['Coverage and accuracy gates', 'npm test']), 'main CI and native iPad validation workflows are present')
  ];
}

const DEPARTMENTS = [
  { id: 'product-ui', name: 'Product & UI/UX', gates: ['repo.frontend-shell','frontend.e2e','frontend.a11y'] },
  { id: 'frontend', name: 'Frontend Platform', gates: ['repo.frontend-shell','repo.pwa','frontend.build','frontend.e2e'] },
  { id: 'learning', name: 'Learning Intelligence', gates: ['repo.adaptive-engine','engine.selfchecks'] },
  { id: 'maths', name: 'Mathematics Intelligence', gates: ['repo.math-marker','engine.selfchecks','engine.multipart'] },
  { id: 'curriculum', name: 'Curriculum & Content', gates: ['repo.curriculum','repo.generator-banks','engine.selfchecks','engine.multipart'] },
  { id: 'handwriting', name: 'Handwriting Intelligence', gates: ['repo.web-ink','ink.self','ink.probes','ink.hard.symbols','ink.hard.scenes','ink.hard.digits','ink.lines.exact','ink.lines.chars','ink.holdout1.lines','ink.holdout1.worst','ink.holdout2.lines','ink.holdout2.worst','ink.context.coverage','ios.ink-bridge','ios.native-ink'] },
  { id: 'ml-data', name: 'ML & Data', gates: ['repo.ml-toolchain','ml.real-ink-measured','ink.holdout2.lines','ink.holdout2.worst'] },
  { id: 'student', name: 'Student Platform', gates: ['repo.student-platform','frontend.e2e','backend.routes'] },
  { id: 'teacher', name: 'Teacher Platform', gates: ['repo.teacher-platform','backend.routes'] },
  { id: 'backend', name: 'Platform / Backend / Data', gates: ['repo.local-backend','repo.indexeddb-schema','backend.checks','backend.routes'] },
  { id: 'ios', name: 'iOS Platform', gates: ['repo.ios-package','ios.bundle-sync','ios.ink-bridge','ios.native-ink'] },
  { id: 'quality', name: 'Quality / Security / Release', gates: ['repo.ci','security.checks','frontend.a11y','frontend.build','ios.bundle-sync'] }
];

function gitValue(args) {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  return r.status === 0 ? String(r.stdout || '').trim() : null;
}

function scoreDepartments(gatesById) {
  return DEPARTMENTS.map(d => {
    const gates = d.gates.map(id => gatesById[id] || { id, pass: false, kind: 'missing', measured: null, floor: null, evidence: 'required gate has no current evidence', source: 'missing' });
    const passed = gates.filter(g => g.pass).length;
    return { ...d, passed, total: gates.length, percent: gates.length ? (100 * passed / gates.length) : 0, gateResults: gates };
  });
}

function render(report) {
  const data = JSON.stringify(report).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pri Learning · Verified Completion</title>
<style>
:root{color-scheme:dark light;font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif}*{box-sizing:border-box}body{margin:0;background:#0b0d10;color:#f5f7fa}main{max-width:1180px;margin:auto;padding:28px 18px 60px}.top{display:flex;justify-content:space-between;gap:18px;align-items:flex-end;flex-wrap:wrap}.eyebrow{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#9da7b3}h1{font-size:clamp(28px,4vw,48px);margin:6px 0 8px}.sub{color:#aab3bd;max-width:760px;line-height:1.55}.overall{font-size:44px;font-weight:780;letter-spacing:-.04em}.meta{font-size:12px;color:#8f99a5}.notice{margin:20px 0;padding:14px 16px;border:1px solid #313741;background:#12161c;border-radius:12px;line-height:1.45}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:12px}.card{background:#12161c;border:1px solid #292f38;border-radius:14px;padding:16px}.row{display:flex;justify-content:space-between;gap:12px;align-items:baseline}.pct{font-size:27px;font-weight:760}.bar{height:8px;background:#262c34;border-radius:99px;overflow:hidden;margin:12px 0}.bar>i{display:block;height:100%;background:linear-gradient(90deg,#72d4a6,#d4c672);border-radius:inherit}.small{font-size:12px;color:#96a0ab}.gates{margin-top:12px;display:grid;gap:7px}.gate{font-size:12px;display:grid;grid-template-columns:17px 1fr;gap:7px;align-items:start}.pass{color:#83d9ad}.fail{color:#f0a4a4}.gate b{font-weight:620}.gate span{color:#9da7b3}.metrics{margin-top:26px}.metrics table{width:100%;border-collapse:collapse;font-size:13px}.metrics th,.metrics td{text-align:left;padding:9px 8px;border-bottom:1px solid #262c34}.metrics th{color:#9da7b3;font-weight:600}.pill{display:inline-block;padding:2px 7px;border-radius:99px;background:#222832}.footer{margin-top:24px;color:#87919d;font-size:12px;line-height:1.5}@media(max-width:620px){.metrics{overflow:auto}.metrics table{min-width:680px}}
</style></head><body><main>
<div class="top"><div><div class="eyebrow">Evidence-driven engineering status</div><h1>Pri Learning verified completion</h1><div class="sub">No percentage is hand-entered. Every department score is exactly passed required gates ÷ total required gates. Missing or stale evidence fails the gate. Benchmark accuracy is shown separately.</div></div><div><div id="overall" class="overall"></div><div class="meta">unique required gates passed</div></div></div>
<div id="notice" class="notice"></div><div id="grid" class="grid"></div><section class="metrics"><h2>Raw quantitative evidence</h2><table><thead><tr><th>Gate</th><th>Measured</th><th>Required floor</th><th>Verdict</th><th>Source</th></tr></thead><tbody id="metricRows"></tbody></table></section><div class="footer">Definition: verified completion is a release-evidence metric, not a subjective estimate of remaining engineering hours. Adding a new mandatory requirement can lower the score; that is intentional. A green score cannot hide an unmeasured required gate.</div>
<script type="application/json" id="report">${data}</script><script>
const r=JSON.parse(document.getElementById('report').textContent);const f=n=>Number(n).toFixed(Number.isInteger(Number(n))?0:1);document.getElementById('overall').textContent=f(r.overall.percent)+'%';document.getElementById('notice').textContent='Commit '+(r.commit||'unknown')+' · '+r.generatedAt+' · '+r.overall.passed+'/'+r.overall.total+' unique gates passed.';const grid=document.getElementById('grid');for(const d of r.departments){const c=document.createElement('article');c.className='card';c.innerHTML='<div class="row"><strong>'+d.name+'</strong><span class="pct">'+f(d.percent)+'%</span></div><div class="bar"><i style="width:'+Math.max(0,Math.min(100,d.percent))+'%"></i></div><div class="small">'+d.passed+' of '+d.total+' required gates passed</div><div class="gates">'+d.gateResults.map(g=>'<div class="gate '+(g.pass?'pass':'fail')+'"><b>'+(g.pass?'✓':'×')+'</b><div><b>'+g.id+'</b><br><span>'+g.evidence+'</span></div></div>').join('')+'</div>';grid.appendChild(c)}const tbody=document.getElementById('metricRows');for(const g of r.gates.filter(x=>x.kind==='metric')){const tr=document.createElement('tr');tr.innerHTML='<td>'+g.id+'</td><td>'+(g.measured??'not measured')+'</td><td>'+(g.floor??'missing')+'</td><td><span class="pill '+(g.pass?'pass':'fail')+'">'+(g.pass?'PASS':'FAIL')+'</span></td><td>'+g.source+'</td>';tbody.appendChild(tr)}
</script></main></body></html>`;
}

function aggregate(evidenceFiles) {
  const all = repositoryGates();
  for (const file of evidenceFiles) {
    if (!file || !existsSync(file)) continue;
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    if (Array.isArray(parsed.gates)) all.push(...parsed.gates);
  }
  const byId = {};
  for (const gate of all) byId[gate.id] = gate;
  const departments = scoreDepartments(byId);
  const referenced = [...new Set(DEPARTMENTS.flatMap(d => d.gates))];
  const unique = referenced.map(id => byId[id] || { id, pass: false, kind: 'missing', measured: null, floor: null, evidence: 'required gate has no current evidence', source: 'missing' });
  const passed = unique.filter(g => g.pass).length;
  const report = {
    schema: 1,
    generatedAt: new Date().toISOString(),
    commit: gitValue(['rev-parse', 'HEAD']),
    branch: gitValue(['rev-parse', '--abbrev-ref', 'HEAD']),
    formula: '100 * passed required gates / total required gates; all gates equal; missing evidence fails',
    overall: { passed, total: unique.length, percent: unique.length ? 100 * passed / unique.length : 0 },
    departments,
    gates: unique
  };
  mkdirSync(OUT_DIR, { recursive: true });
  writeJson(join(OUT_DIR, 'completion-report.json'), report);
  writeFileSync(join(OUT_DIR, 'index.html'), render(report));
  console.log(`\nCompletion dashboard: ${join(OUT_DIR, 'index.html')}`);
  console.log(`Overall verified completion: ${report.overall.percent.toFixed(2)}% (${passed}/${unique.length})`);
  return report;
}

if (has('--run-node')) {
  const evidence = nodeEvidence();
  if (!EVIDENCE_OUT) throw new Error('--run-node requires --evidence-out <file>');
  writeJson(resolve(ROOT, EVIDENCE_OUT), evidence);
} else if (has('--run-native')) {
  const evidence = nativeEvidence();
  if (!EVIDENCE_OUT) throw new Error('--run-native requires --evidence-out <file>');
  writeJson(resolve(ROOT, EVIDENCE_OUT), evidence);
} else if (has('--aggregate')) {
  const files = argv.filter(v => v.endsWith('.json')).map(v => resolve(ROOT, v));
  aggregate(files);
} else if (has('--run')) {
  const temp = resolve(ROOT, '.completion-evidence');
  mkdirSync(temp, { recursive: true });
  const node = nodeEvidence();
  const nodeFile = join(temp, 'node.json');
  writeJson(nodeFile, node);
  const files = [nodeFile];
  if (process.platform === 'darwin') {
    const native = nativeEvidence();
    const nativeFile = join(temp, 'native.json');
    writeJson(nativeFile, native);
    files.push(nativeFile);
  }
  aggregate(files);
} else {
  console.log('Usage: node tools/completion/audit.mjs --run | --run-node --evidence-out <file> | --run-native --evidence-out <file> | --aggregate <evidence.json...> [--out-dir <dir>]');
  process.exitCode = 2;
}
