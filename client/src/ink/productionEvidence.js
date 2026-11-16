// Pri Ink · physical production-evidence session helpers (server reader)
//
// This module is deliberately answer-blind. It decides only whether the
// production path would mark a server reading as it stands (auto), ask the
// student to confirm it first (confirm) or has no reading (abstain). The
// target transcription is never an input to authority selection.
//
// The reader under study is the server reader (client/src/ink/cloudReader.js):
// the only reader in a student's path since the owner's decision of
// 2026-10-02 (default D16, 2026-11-01). The on-device readers are retired and
// a reading from one of them can never be production evidence.

export const CONFIRM_CONF = 0.55;
export const CONFIRM_MARGIN = 0.15;
export const SPLIT_ALGORITHM = 'fnv1a32-v1:70/10/10/10';
export const CONSENT_VERSION = '2026-08-23-v1';
/** Schema of the evidence file the scorer accepts (client/test/ink-physical-release-evidence.mjs). */
export const PHYSICAL_EVIDENCE_SCHEMA_VERSION = 2;
/** Labels the server reader returns start with this (cloudReader.js CLOUD_ENGINE_PREFIX). */
export const SERVER_ENGINE_PREFIX = 'cloud';
/** How a build under study reached its server. */
export const BUILD_KINDS = Object.freeze(['development', 'testflight']);
export const SERVERS = Object.freeze(['staging', 'production']);

export const REAL_PENCIL_PROMPTS = Object.freeze([
  ['2x + 5 = 17','2x+5=17'],['7y - 3 = 25','7y-3=25'],['4a + 9 = 33','4a+9=33'],['n = 48','n=48'],['k = 106','k=106'],
  ['1  l  I  y','1lIy'],['0  O  θ','0Otheta'],['2  z','2z'],['5  s','5s'],['6  b','6b'],['8  B  3','8B3'],['9  g  q  4','9gq4'],['x  ×  4  k','x*4k'],
  ['3 5 0 9 2 7','350927'],['1 4 8 6 0 3','148603'],['x = 3.75','x=3.75'],['t = 0.08','t=0.08'],['3/4','3/4'],['7/8','7/8'],
  ['x²','x^(2)'],['a³','a^(3)'],['x² + 6x + 9','x^(2)+6x+9'],['x₁ + x₂','x_1+x_2'],['√16 = 4','sqrt(16)=4'],['√x','sqrt(x)'],
  ['x ≤ 12','x<=12'],['y ≥ 7','y>=7'],['a ≠ 0','a!=0'],['45%','45%'],['90°','90°'],['3 : 7','3:7'],['x = 4 ± 3','x=4±3'],
  ['m = -6','m=-6'],['r = -1.5','r=-1.5'],['(x + 3)(x - 5)','(x+3)(x-5)'],['(2b + 1)(b - 4)','(2b+1)(b-4)'],
  ['sin(x) = 1','sin(x)=1'],['sin x = 0.5','sin(x)=0.5'],['cos θ = 1/2','cos(theta)=1/2'],['tan θ','tan(theta)'],['ln x','ln(x)'],['π','pi'],['2πr','2pir'],['θ = 60°','theta=60°'],
  ['1 over 2  (stack it vertically)','(1)/(2)'],['x + 1 over y - 2  (stack it)','(x+1)/(y-2)'],['x³ + 2x² - x + 7','x^(3)+2x^(2)-x+7'],['(x² + 1) / (x - 3)','(x^(2)+1)/(x-3)'],['100 - 64 = 36','100-64=36'],['7 × 8 = 56','7*8=56'],
  ['∫ 10x (x² + 1)² dx','∫10x(x^(2)+1)^(2)dx'],['let u = x² + 1','letu=x^(2)+1'],['du = 2x dx','du=2xdx'],['∫ u² du','∫u^(2)du'],['5 ∫ u² du','5∫u^(2)du'],['u  (on its own, written naturally)','u'],['du','du'],['dx','dx'],['u³','u^(3)'],['[ x² + 1 ]  (square brackets)','(x^(2)+1)'],['5u³ over 3, then + C  (stack the fraction)','(5u^(3))/(3)+c']
].map(([shown, target], index) => Object.freeze({ id: `p${String(index + 1).padStart(3, '0')}`, shown, target })));

export function canonicalEvidenceWriter(value) {
  return String(value || '').trim().toUpperCase();
}

function fnv1a32(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function assignedEvidenceSplit(writerId) {
  const bucket = fnv1a32(`pri-ink-split-v1:${canonicalEvidenceWriter(writerId)}`) % 100;
  return bucket < 70 ? 'train' : bucket < 80 ? 'validation' : bucket < 90 ? 'test' : 'final-holdout';
}

export function readsAsMaths(text) {
  const t = String(text || '').replace(/\s+/g, '');
  if (!t) return true;
  if (t.includes('?')) return false;
  let depth = 0;
  for (const ch of t) {
    if (ch === '(') depth++;
    else if (ch === ')' && --depth < 0) return false;
  }
  if (depth !== 0) return false;
  if (/[+\-*/=<>^.]$/.test(t)) return false;
  if (/^[+*/=<>^]/.test(t) || /^\.(?!\d)/.test(t)) return false;
  return !/[+\-*/=<>^]{2,}/.test(t.replace(/<=|>=|!=|=-|\(-/g, 'A'));
}

function readingLines(reading) {
  if (Array.isArray(reading?.lines)) {
    return reading.lines.map(line => typeof line === 'string' ? line : String(line?.text || ''));
  }
  return String(reading?.text || '').split(/\n+/);
}

/** A label of a reader no student reaches, or of a debug/research path. */
export function nonProductionEngine(engine) {
  const e = String(engine || '').toLowerCase();
  if (!e) return true;
  if (/research|debug|v4-dev|v4-unavailable/.test(e)) return true;
  if (/vision|foundation|native-rescue|native-primary|pri-js|consensus|line-stroke-fusion/.test(e)) return true;
  return !e.startsWith(SERVER_ENGINE_PREFIX);
}

/**
 * Answer-blind authority decision equivalent to the production confirmation
 * boundary the card applies to a server reading (QuestionCard.jsx):
 *
 *   · the server said it is unsure (needsConfirmation) → confirm;
 *   · the reading does not read as maths → confirm;
 *   · the server's confidence is under its own floor (confidenceFloor, else
 *     CONFIRM_CONF) → confirm;
 *   · a rival within CONFIRM_MARGIN → confirm;
 *   · otherwise the card would mark it as it stands → auto.
 *
 * `nativeAvailable` is supplied by the evidence page so a browser session can
 * never be mislabeled as physical production evidence; `productionReady` is
 * what InkAnswer publishes (true only for a reading the server made).
 */
export function productionAuthorityOf(reading, { nativeAvailable = false } = {}) {
  const text = String(reading?.text || '').trim();
  const engine = String(reading?.engine || '');
  const productionReady = Boolean(nativeAvailable && reading?.productionReady === true && reading?.researchOnly !== true && !nonProductionEngine(engine));
  if (!productionReady) return { authority: 'abstain', productionReady: false, reason: 'non-production-path' };
  if (!text) return { authority: 'abstain', productionReady: true, reason: 'no-reading' };
  if (reading?.needsConfirmation === true) return { authority: 'confirm', productionReady: true, reason: 'server-doubt' };
  if (!readingLines(reading).every(readsAsMaths)) return { authority: 'confirm', productionReady: true, reason: 'shape' };
  const configuredFloor = Number(reading?.confidenceFloor);
  const floor = Number.isFinite(configuredFloor) && configuredFloor > 0 && configuredFloor <= 1 ? configuredFloor : CONFIRM_CONF;
  if (typeof reading?.minConf === 'number' && reading.minConf < floor) return { authority: 'confirm', productionReady: true, reason: 'confidence' };
  if (typeof reading?.margin === 'number' && reading.margin < CONFIRM_MARGIN) return { authority: 'confirm', productionReady: true, reason: 'rival-margin' };
  return { authority: 'auto', productionReady: true, reason: 'safe-reading' };
}

export function criticalEvidenceTarget(target) {
  const t = String(target || '').replace(/\s+/g, '');
  return /\^|\/|sqrt\(|[=<>]|!=|<=|>=|∫|\n/.test(t);
}

export function makeEvidenceRunId(writerId, now = Date.now()) {
  const safe = canonicalEvidenceWriter(writerId).replace(/[^A-Z0-9_-]/g, '_').slice(0, 40);
  return `${safe || 'WRITER'}-${now.toString(36)}`;
}

export function buildPhysicalEvidenceRun(meta, samples) {
  const writerId = canonicalEvidenceWriter(meta.writerId);
  const split = assignedEvidenceSplit(writerId);
  return {
    schemaVersion: PHYSICAL_EVIDENCE_SCHEMA_VERSION,
    physicalHardware: true,
    reader: 'server',
    runId: meta.runId,
    recordedAt: meta.recordedAt,
    build: {
      commit: meta.buildCommit,
      appVersion: meta.appVersion,
      kind: BUILD_KINDS.includes(meta.buildKind) ? meta.buildKind : 'development',
      server: SERVERS.includes(meta.server) ? meta.server : 'staging'
    },
    device: { model: meta.deviceModel, osVersion: meta.osVersion, pencil: meta.pencil },
    writer: { id: writerId, split, ...(split === 'final-holdout' ? { holdoutLocked: true } : {}) },
    consent: { granted: true, version: CONSENT_VERSION, scope: 'anonymous-handwriting-model-training-and-evaluation', recordedAt: meta.startedAt },
    collector: { name: 'pri-production-evidence-session', version: 2, productionRecognition: 'server', pencilKit: true, predictedTouchesStored: false },
    samples
  };
}

/** The same PencilKit session can be stored in the real-writer corpus without
 * changing its deterministic split. Recognition output is deliberately omitted
 * from the training/evaluation ground-truth corpus; only prompt transcription
 * and raw Pencil strokes remain. */
export function buildCorpusFromPhysicalRun(run) {
  return {
    format: 'pri-ink-corpus',
    version: 2,
    split: run.writer.split,
    splitAssignment: { algorithm: SPLIT_ALGORITHM, deterministic: true },
    holdoutLocked: run.writer.split === 'final-holdout',
    predictedTouchesStored: false,
    consent: run.consent,
    collector: {
      name: 'pri-production-evidence-session', version: 2,
      productionRecognition: 'server', pencilKit: true, predictedEvents: false,
      pencilOnly: true, predictedTouchesStored: false
    },
    writer: {
      id: run.writer.id,
      sessionId: run.runId,
      handedness: 'unknown',
      device: `${run.device.model} · iPadOS ${run.device.osVersion} · ${run.device.pencil}`,
      pen: true,
      recordedAt: Date.parse(run.recordedAt),
      durationMs: null
    },
    samples: run.samples.map(sample => ({
      target: sample.target,
      shown: sample.shown,
      pen: true,
      strokes: sample.strokes
    }))
  };
}
