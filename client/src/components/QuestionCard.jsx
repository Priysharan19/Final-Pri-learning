// ─────────────────────────────────────────────────────────────────────────────
// The question experience, styled as a full page: marks + live timer up top,
// hint bulbs that trade credit for help, three answer modes (type / write /
// photo), an evaluation card with reasoning, worked solution, final answer and
// a marks criteria table. All marking logic is the verified v3 engine.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { MathText } from '../lib/latex.jsx';
import { useApp } from '../App.jsx';
import InkCanvas from '../ink/InkCanvas.jsx';
import { flushInkDrafts } from '../local/inkDrafts.js';
import { sanitizeFigure } from '../lib/sanitize.js';
import { clearDraft, queueDraft, readDraft, saveDraft } from './drafts.js';
import {
  clearInkDraft, clearPendingSubmission, newSubmissionId, readInkDraft, readPendingSubmission,
  saveInkDraft, savePendingSubmission, submissionContentKey
} from './practiceRecovery.js';
import { cloudReadingEnabled, INK_READER_STATE, photoReadingBlockedKey, readPhotoWithCloud, takeCloudReadingNotice } from '../ink/cloudReader.js';
import { onCloudSessionChange } from '../platform/cloudSession.js';
import { MAX_PDF_PAGES, renderPdfPages } from '../ink/pdfPage.js';
import PriPlot from './PriPlot.jsx';
import { plotSpecFor } from '../engine/plotSpec.js';
import { awardStepMarks, marksSentenceKey } from '../engine/cbseMarking.js';
import { checkWorkingWithCloud, mergeVerdicts, misconceptionProposal, shouldCheckWorking, workingNote } from '../ink/cloudWorking.js';
import { misconceptionById } from '../engine/misconceptions.js';
import { tLater, translate, useLanguage, useT } from '../i18n/index.js';
import TermGloss from './TermGloss.jsx';
import { useFormFactor } from '../platform/formFactor.js';
import Icon from './Icon.jsx';
import '../workspace.css';
import { tutorFeatureEnabled } from '../tutor/flag.js';
// True in a production build made with the tutor off (see src/tutor/flag.js).
// A literal test of the build constants, not a helper imported from flag.js:
// the bundler folds only what it can see in this module, and that fold is what
// keeps TutorHelp.jsx out of a dark build entirely (install-budget-check.mjs).
/* global __PRI_FEATURE_TUTOR__, __PRI_PRODUCTION_BUILD__ */
const TUTOR_BUILT_OUT = typeof __PRI_PRODUCTION_BUILD__ === 'boolean' && __PRI_PRODUCTION_BUILD__ && __PRI_FEATURE_TUTOR__ !== true;

const DIFF_CLASS = { 1: 'tag-d1', 2: 'tag-d2', 3: 'tag-d3', 4: 'tag-d4' };
// Public question metadata may constrain what a single answer glyph can be,
// but it must never disclose or encode the expected answer. Numeric questions
// therefore expose only the ten digit symbols to the one-glyph tie-breaker.
// Multi-glyph grammar/context scoring deliberately ignores this separate field.
const NUMERIC_SINGLE_GLYPH_ALPHABET = Array.from({ length: 10 }, (_, i) => String(i));
const recognitionContextForQuestion = question => question?.answerType === 'numeric'
  ? { answerType: 'numeric', singleGlyphAlphabet: NUMERIC_SINGLE_GLYPH_ALPHABET }
  : null;
// Each key carries the name of the thing it inserts, because "≥" and "√(" are
// read out as punctuation — or not at all — by a screen reader.
const SYMBOLS = [
  ['π', 'sym.pi'], ['√(', 'sym.sqrt'], ['^', 'sym.power'], ['±', 'sym.plusMinus'],
  ['×', 'sym.times'], ['÷', 'sym.divide'], ['≤', 'sym.lte'], ['≥', 'sym.gte'],
  ['≠', 'sym.neq'], ['°', 'sym.degrees'], ['θ', 'sym.theta'], ['(', 'sym.openBracket'],
  [')', 'sym.closeBracket'], ['/', 'sym.dividedBy'], [':', 'sym.ratio']
];
const preferMode = () => {
  const saved = localStorage.getItem('pri-input-mode');
  if (saved) return saved;
  // Touch-first devices write by default (coarse pointer, or no hover: see formFactor.js).
  return (window.matchMedia?.('(pointer: coarse)').matches || window.matchMedia?.('(hover: none)').matches) ? 'write' : 'type';
};

/** Off-screen but spoken — for names and announcements the page shows visually. */
export const SR_ONLY = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0
};

// ── The writing surface, fetched the first time it is asked for ──────────────
// It arrives as a chunk of its own, so opening the write tab can fail the way
// any fetch can. The in-flight promise is remembered only while it is still
// alive — the moment it rejects it is dropped, because a memo held past a
// rejection leaves the tab dead until the whole app is reloaded.
//
// Dropping the memo is not enough on its own: a module that failed to fetch is
// remembered by the browser itself, so importing the SAME specifier a second
// time replays the stored rejection without a single byte crossing the network.
// A retry loop over one specifier therefore retries nothing. Every attempt below
// asks for a specifier carrying its own query string, which is a URL the
// document has never requested and so a fetch that genuinely happens. They are
// spelled out one per line because a bundler emits a chunk only for a specifier
// it can see; four specifiers is four real attempts, and once they are spent
// only a reload has anything new to try.
// ── The AI tutor panel, fetched only when a student asks for help ─────────────
// A lazy chunk of its own: most questions are answered without it, so nobody
// pays for it at install. If the chunk cannot be fetched the boundary below
// says so and the hint bulbs keep working.
// In a production build with the tutor off the panel is unreachable
// (tutorEnabled below is false on every device), so it is not built at all.
const TutorHelp = TUTOR_BUILT_OUT ? null : React.lazy(() => import('../tutor/TutorHelp.jsx'));
// Load account recovery only when a student explicitly asks to sign in.
// Keeps the selected photo in component memory rather than plaintext storage.
const PhotoAccountRecovery = React.lazy(() => import('./CloudAccountPanel.jsx'));

class TutorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* nothing about the question or the student is logged */ }
  render() {
    return this.state.failed
      ? <div className="hintbox" role="status">{this.props.fallback}</div>
      : this.props.children;
  }
}

const INK_SOURCES = [
  () => import('../ink/InkAnswer.jsx'),
  () => import('../ink/InkAnswer.jsx?retry=1'),
  () => import('../ink/InkAnswer.jsx?retry=2'),
  () => import('../ink/InkAnswer.jsx?retry=3')
];
const INK_RETRIES = 1;          // spent automatically; the rest belong to the student
const INK_BACKOFF_MS = 350;

let inkModule = null;
let inkPending = null;
let inkSpent = 0;               // module scope: a specifier once asked for stays asked for

const inkExhausted = () => inkSpent >= INK_SOURCES.length;

function fetchInk(retries = INK_RETRIES) {
  if (inkExhausted()) return Promise.reject(new Error('No untried address left for the handwriting engine.'));
  return INK_SOURCES[inkSpent++]().catch(err => {
    if (retries <= 0 || inkExhausted()) throw err;
    return new Promise(done => setTimeout(done, INK_BACKOFF_MS)).then(() => fetchInk(retries - 1));
  });
}

function loadInk() {
  if (inkModule) return Promise.resolve(inkModule);
  if (!inkPending) {
    inkPending = fetchInk().then(
      mod => { inkModule = mod; inkPending = null; return mod; },
      err => { inkPending = null; throw err; }
    );
  }
  return inkPending;
}

// ── exprToLatex, kept off the entry chunk ────────────────────────────────────
// The helper lives in the recogniser, whose graph reaches nn.js and the 798 kB
// of weights behind it. A static import would put all of that in the entry's
// preload list for the sake of one string transform, so it is fetched only when
// something on screen genuinely needs it. In write mode the module is already
// in memory and this resolves in the same tick; a typed answer asks for it only
// once it contains notation the helper would actually rewrite — plain algebra
// like 2x+3 comes out of exprToLatex unchanged, so it previews as written.
const TEX_WORTH = /sqrt|theta|pi|LHS|RHS|sin|cos|tan|sec|csc|cot|ln|log|<=|>=|!=|[\^*/%°±\\]/i;

let latexFn = null;
let latexPending = null;

function loadLatex() {
  if (latexFn) return Promise.resolve(latexFn);
  if (!latexPending) {
    latexPending = import('../ink/recognizer.js').then(
      mod => { latexFn = mod.exprToLatex; latexPending = null; return latexFn; },
      err => { latexPending = null; throw err; }
    );
  }
  return latexPending;
}

// ── Never lose a mark to a misread ───────────────────────────────────────────
// Marking an answer the student got right is the worst thing this app can do:
// it feeds a wrong outcome to the Elo update, the mark predictor and the
// misconception tags at once, and the student has no way to appeal. So no mark
// is awarded or withheld on a reading the engine was unsure of — an uncertain
// answer line becomes a one-tap confirmation instead of a submission.
//
// The thresholds come from the confidence distribution measured over 3,920
// simulated answer lines — the writer model of the holdout suites, run on two
// seeds none of them use, against recognize()'s own minConf and margin:
//
//   glyph confidence < 0.55        catch 22.5% / 15.9% of misreads   cost 4.4% / 4.9%
//   top-2 gap        < 0.15        catch 28.4% / 22.4%               cost 6.5% / 7.1%
//   reading is not well-formed     catch 27.5% / 28.0%               cost 0.0% / 0.0%
//   all three together             catch 56.3% / 49.5%               cost 6.9% / 6.8%
//
// "cost" is the share of correctly-read lines that get the extra tap. 0.55 is
// chosen over anything higher because the curve is flat through it — 0.50 to
// 0.65 buys 4 points of catch for 0.7 of cost — and because it sits just above
// the 0.45 at which the reading panel already draws a glyph as shaky, so the
// glyphs the student sees marked are the same glyphs that ask to be confirmed.
//
// The well-formedness test is free: across all 3,711 correctly-read lines in
// those runs it flagged none, because a correct reading of school maths does
// not come out with a stray '?', an unclosed bracket, a doubled operator or a
// dangling '='.
//
// All three run over the whole reading rather than the answer line alone —
// minConf and margin because that is the scope the engine reports them at, and
// well-formedness because a working question is marked line by line. On a
// multi-line answer that compounds: three lines carry roughly three times one
// line's chance of asking. That is the right direction to err in when every one
// of those lines is worth a mark.
const CONFIRM_CONF = 0.55;
const CONFIRM_MARGIN = 0.15;

function readsAsMaths(text) {
  // Spaces out first: the layout pass puts them around fractions, and a gap
  // between two operators would otherwise hide the pair from the last test.
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

/** What is doubtful about this reading, or null when it can be trusted. */
function doubtOf(ink) {
  const lines = ink?.lines || [];
  if (!lines.length) return null;
  const weakest = ink.weakest || null;
  if (!lines.every(readsAsMaths)) return { why: 'shape', weakest };
  // The server reader's own flag: a line under its confidence floor. The
  // student corrects it in the reading panel ("I wrote…") or stands behind
  // it; it is never marked from silently.
  if (ink.needsConfirmation === true) return { why: 'glyph', weakest };
  // The server/provider floor is authoritative for cloud readings. Keep the
  // older local confirmation threshold only as a fallback when no floor was
  // supplied, so a deployment configured at 0.90 cannot be weakened to 0.82
  // (or to this card's historical 0.55) after a line correction.
  const configuredFloor = Number(ink.confidenceFloor);
  const confidenceGate = Number.isFinite(configuredFloor) && configuredFloor >= 0.5 && configuredFloor <= 0.99
    ? configuredFloor
    : CONFIRM_CONF;
  if (typeof ink.minConf === 'number' && ink.minConf < confidenceGate) return { why: 'glyph', weakest };
  if (typeof ink.margin === 'number' && ink.margin < CONFIRM_MARGIN) return { why: 'rival', weakest };
  return null;
}

// The local gateway counts object keys to reject pathological nested payloads.
// Pencil points used to be sent as {x,y}, so a normal full working page could
// exceed that security budget despite being a legitimate answer. Transport each
// point as [x,y]; backend safeStrokes expands it back to the canonical stored
// object shape, so History/replay remains unchanged.
function compactInkStrokes(strokes) {
  return (Array.isArray(strokes) ? strokes : []).map(st => ({
    points: (Array.isArray(st?.points) ? st.points : []).map(p => [
      Math.round(Number(p?.x) || 0), Math.round(Number(p?.y) || 0)
    ])
  }));
}

// The public name of each reason tag a serve can carry. A serve that names its
// tag (the India path does) is labelled from here; one that carries only the
// legacy `reason` keeps the tags it always had.
const REASON_TAG_KEY = {
  'review-due': 'verdict.spacedReview', 'weak-spot': 'verdict.weakSpot', misconception: 'verdict.repeatedSlip',
  'new-ground': 'verdict.newGround', interleave: 'verdict.interleaving'
};

// `diagnostic` turns the card into a placement-check item: the answer goes to
// `diagnostic.submitPath`, it is marked once by the same deterministic marker,
// and nothing that belongs to practice is offered — no hints, no favourite, no
// reveal, no self-marking, no XP or mastery tags. `I don't know` records a miss.
export default function QuestionCard({ question, why, reason, reasonTag = null, onResolved, onNext, onRedo, compact = false, diagnostic = null }) {
  const { celebrate, refreshUser, refreshDue, refreshRecent, toast, user } = useApp();
  const t = useT();
  const [answer, setAnswer] = useState('');
  const [mcqSel, setMcqSel] = useState(null);
  // Handwriting kept from before a reload brings the card back to the pen. It
  // lives in the profile's sealed IndexedDB store and is looked for
  // asynchronously: undefined while that happens, then the strokes or null.
  // The ink surface mounts only once the answer is in, so a kept page is
  // always the page it starts from.
  const [restoredInk, setRestoredInk] = useState(undefined);
  const [mode, setMode] = useState(() => preferMode());       // 'type' | 'write' | 'photo'
  const [inkResult, setInkResult] = useState(null);
  // The ink surface owns the truth about whether recognition was attempted.
  // A blocker before the reader runs must never be labelled bad handwriting.
  const [inkReaderState, setInkReaderState] = useState({ kind: INK_READER_STATE.IDLE });
  const [inkHasStrokes, setInkHasStrokes] = useState(false);
  const [hints, setHints] = useState([]);
  const [hintsLeft, setHintsLeft] = useState(question.hintsAvailable);
  const [showTutor, setShowTutor] = useState(false);
  const [tutorUsed, setTutorUsed] = useState(question.tutorLevel || 0);
  const { language } = useLanguage();
  // Dark by default (src/tutor/flag.js): off, the card offers only the hints.
  const tutorEnabled = useMemo(() => tutorFeatureEnabled(), []);
  const [working, setWorking] = useState('');
  const [showWorking, setShowWorking] = useState(false);
  const [showScribble, setShowScribble] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [showSyms, setShowSyms] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [state, setState] = useState({ phase: 'answering' });
  const [busy, setBusy] = useState(false);
  const [selfMarks, setSelfMarks] = useState({});
  const [selfSaved, setSelfSaved] = useState(false);
  const [selfOpen, setSelfOpen] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [photoSignInOpen, setPhotoSignInOpen] = useState(false);
  const [photoReattachRequired, setPhotoReattachRequired] = useState(false);
  const [photoAuthEpoch, setPhotoAuthEpoch] = useState(0);
  const photoReadGeneration = useRef(0);
  // Keep an original multi-page PDF in component memory only while the user
  // needs an authenticated retry. A thumbnail cannot reconstruct every page.
  const pendingPdf = useRef(null);
  const [pdfUnread, setPdfUnread] = useState(null);
  const [photoOCR, setPhotoOCR] = useState({ phase: 'idle', text: '', confidence: 0, error: '', engine: null });
  // One quiet line, once per device, the first time a photo is read on the
  // server for a student who never chose either way in Settings.
  const [cloudNotice, setCloudNotice] = useState(false);
  const [inkPhase, setInkPhase] = useState(() => (inkModule ? 'ready' : 'idle'));   // idle | loading | ready | failed
  const [inkTry, setInkTry] = useState(0);
  const [toTex, setToTex] = useState(() => latexFn);
  const [checking, setChecking] = useState(false);
  const [vouched, setVouched] = useState(null);     // the exact reading the student stood behind
  const startRef = useRef(Date.now());
  // ── One tap, one submission (§09) ──────────────────────────────────────────
  // `busy` is React state and lands a render late, so two taps inside one frame
  // both saw it false and both posted. The ref is set synchronously.
  const inFlightRef = useRef(false);
  // A submission that has not had a definitive answer: an identical retry
  // reuses its idempotency key, so a timeout followed by a second tap is still
  // one attempt.
  const pendingRef = useRef(null);
  // The submission whose verdict is on screen, and the ink lines it carried.
  // Every late, asynchronous result (cloud working check, misconception
  // proposal) is bound to it and dropped if it names anything else.
  const attemptRef = useRef(null);
  const [attempt, setAttempt] = useState(null);
  // Whether the submission on screen (being marked, retried or resolved) was
  // handwritten: every handwritten verdict says who read it and who marked it.
  const [attemptViaInk, setAttemptViaInk] = useState(false);
  // The reading a submission was made from is frozen while it is marked and
  // after it is resolved: a reading that settles late cannot rewrite it.
  const inkFrozenRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  const inputRef = useRef(null);
  const scribbleRef = useRef(null);
  const photoInputRef = useRef(null);
  const promptRef = useRef(null);
  const peekRef = useRef(null);
  // What the status line is allowed to say about the student's work:
  // null (nothing to report) | 'saving' | 'saved' | 'failed'.
  const [saveState, setSaveState] = useState(null);
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);
  const [peek, setPeek] = useState(false);
  const [peekOpen, setPeekOpen] = useState(false);
  const inkSaveTimer = useRef(null);
  // The most recent pen-lift owns the save indicator. A previous asynchronous
  // IDB acknowledgement must never overwrite the status of newer strokes.
  const inkSaveRevision = useRef(0);
  // The newest strokes on the page. Leaving write mode unmounts the canvas;
  // coming back must restore this, never the draft the card was mounted with.
  const latestInk = useRef(null);
  const typedSaveTimer = useRef(null);

  useEffect(() => {
    const draft = readDraft('question', question.id);
    setAnswer(draft?.typed || ''); setMcqSel(null); setInkResult(null); setInkReaderState({ kind: INK_READER_STATE.IDLE }); setInkHasStrokes(false); setHints([]); setHintsLeft(question.hintsAvailable);
    setShowTutor(false); setTutorUsed(question.tutorLevel || 0);
    setWorking(draft?.working || ''); setShowWorking(!!draft?.working);
    setState({ phase: 'answering' }); setBusy(false);
    setSelfMarks({}); setSelfSaved(false); setSelfOpen(false);
    // An old photo must never follow the student into a new question.
    photoReadGeneration.current += 1;
    pendingPdf.current = null;
    setPhoto(null); setPhotoSignInOpen(false); setPhotoReattachRequired(false); setBookmarked(false);
    setPhotoOCR({ phase: 'idle', text: '', confidence: 0, error: '', engine: null });
    setChecking(false); setVouched(null); setPdfUnread(null); setAttemptViaInk(false);
    setSaveState(draft?.typed || draft?.working ? 'saved' : null);
    latestInk.current = null;
    ++inkSaveRevision.current;
    setPeekOpen(false);
    startRef.current = Date.now();
    if (mode === 'type') setTimeout(() => inputRef.current?.focus(), 60);
  }, [question.id]); // eslint-disable-line

  // The kept page, if there is one, before the pen is offered.
  useEffect(() => {
    let live = true;
    setRestoredInk(undefined);
    Promise.resolve().then(() => flushInkDrafts()).then(() => readInkDraft(question.id)).then(
      kept => { if (!live) return; setRestoredInk(kept || null); if (kept?.length) { setMode('write'); setSaveState('saved'); } },
      () => { if (live) setRestoredInk(null); }
    );
    return () => { live = false; };
  }, [question.id]);

  const resolved = state.phase === 'resolved';
  const res = state.res;

  const isMcq = question.answerType === 'mcq';
  const isWorking = question.answerType === 'working';
  const totalMarks = question.criteria?.length || 1;
  const hintsUsed = hints.length;
  // Each opened tutor level is charged like a hint (backend resolve()).
  const helpUsed = hintsUsed + tutorUsed;
  const credit = Math.max(0.55, 1 - 0.15 * helpUsed);
  const writeMode = mode === 'write';
  const recognitionContext = useMemo(
    () => recognitionContextForQuestion(question),
    [question.answerType]
  );


  // A photo of paper working is read only by Pri's server reader (owner
  // decision: the on-device readers are not good enough to mark from). The
  // text lands in an editable box and is never submitted on the reader's word
  // alone; when the server cannot read it the student is told the real reason.
  const readOnePage = useCallback(async (dataURL) => {
    const lastLine = t => String(t || '').split(/\n+/).map(x => x.trim()).filter(Boolean).at(-1) || '';
    let cloudOutcome = null;
    if (cloudReadingEnabled(user)) {
      cloudOutcome = await readPhotoWithCloud(dataURL, { user });
      if (cloudOutcome?.reason === 'allowance') return { allowance: true };
      if (cloudOutcome && !cloudOutcome.error && !cloudOutcome.reason) {
        const text = String(cloudOutcome.transcription.text || '').trim();
        if (text) return { text, markable: lastLine(text), confidence: cloudOutcome.transcription.confidence, engine: cloudOutcome.transcription.engine };
      }
    }
    // The photo itself was the problem: say so. Anything else is the server
    // route being unavailable, and the student is told the actual reason.
    if (cloudOutcome && ['unreadable', 'empty'].includes(cloudOutcome.reason)) return null;
    return { blocked: photoReadingBlockedKey(user, { outcome: cloudOutcome }) };
  }, [user]);

  const decodePhoto = useCallback(async (dataURL) => {
    if (!dataURL) return;
    pendingPdf.current = null;
    // A new single photo must also clear an earlier multi-page PDF warning.
    setPdfUnread(null);
    // Even a rejected, signed-out replacement invalidates an older in-flight
    // provider response; authentication state cannot revive the old image.
    const generation = ++photoReadGeneration.current;
    if (!cloudReadingEnabled(user)) {
      const blockedKey = photoReadingBlockedKey(user);
      setPhotoOCR({
        phase: 'unavailable', text: '', confidence: 0, engine: null,
        error: tLater(blockedKey), blockedKey
      });
      return;
    }
    setPhotoOCR({ phase: 'reading', text: '', confidence: 0, error: '', engine: null });
    const page = await readOnePage(dataURL);
    if (!mountedRef.current || generation !== photoReadGeneration.current) return;
    if (page?.allowance) {
      setPhotoOCR({
        phase: 'failed', text: '', confidence: 0, engine: null,
        error: tLater('photo.cloudAllowanceUsed')
      });
      return;
    }
    if (page?.blocked) {
      setPhotoOCR({
        phase: 'unavailable', text: '', confidence: 0, engine: null,
        error: tLater(page.blocked), blockedKey: page.blocked
      });
      return;
    }
    if (!page) {
      setPhotoOCR({
        phase: 'failed', text: '', confidence: 0, engine: null,
        error: tLater('verdict.photoUnreadable')
      });
      return;
    }
    if (isWorking && page.text) { setWorking(page.text); setShowWorking(true); }
    if (page.markable) setAnswer(page.markable);
    if (String(page.engine || '').startsWith('cloud') && takeCloudReadingNotice(user)) setCloudNotice(true);
    setPhotoSignInOpen(false);
    setPhotoOCR({ phase: 'done', text: page.text, confidence: Number(page.confidence || 0), error: '', engine: page.engine });
  }, [isWorking, user, readOnePage, t]);

  // Successful cloud authentication is announced by the existing account
  // service, not guessed from a device-local profile. Retry only the same
  // on-screen image, once per session change; the provider and guardian gate
  // remain authoritative. Do not queue private photos in localStorage.
  useEffect(() => onCloudSessionChange(event => {
    if (event?.detail?.connected === true &&
        String(event.detail.localProfileId) === String(user?.id)) {
      setPhotoAuthEpoch(n => n + 1);
    }
  }), [user?.id]);
  useEffect(() => {
    if (!photo || photoOCR.phase !== 'unavailable' ||
        photoOCR.blockedKey !== 'verdict.photoReadingSignIn' ||
        !cloudReadingEnabled(user)) return;
    if (pendingPdf.current) void decodePdf(pendingPdf.current);
    else void decodePhoto(photo);
  // Intentional: only a verified profile/session transition initiates retry,
  // never a failing OCR state update or repeated render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.cloudLinked, photoAuthEpoch]);

  // A scanned PDF becomes pages, and the pages become the same thing a photo
  // already is. More than one page of working is joined in order, because a
  // student who scanned two sides of a page wrote one solution across them.
  const decodePdf = useCallback(async (dataURL) => {
    if (!dataURL) return;
    // A PDF may render and read several pages asynchronously. Every await is
    // scoped to this attachment, never to the next question or a replacement.
    const generation = ++photoReadGeneration.current;
    const stale = () => !mountedRef.current || generation !== photoReadGeneration.current;
    pendingPdf.current = dataURL;
    setPdfUnread(null);
    setPhotoOCR({ phase: 'reading', text: '', confidence: 0, error: '', engine: null });
    let result = { pages: [], reason: 'unreadable' };
    try { result = await renderPdfPages(dataURL); } catch { /* reported below */ }
    if (stale()) return;
    const pages = result.pages || [];
    if (!pages.length) {
      pendingPdf.current = null;
      setPhotoOCR({
        phase: 'failed', text: '', confidence: 0, engine: null,
        error: result.reason === 'renderer-unavailable'
          ? tLater('verdict.pdfRendererMissing')
          : tLater('verdict.pdfUnopenable')
      });
      return;
    }
    setPhoto(pages[0].dataUrl);
    if (pages.length === 1) { decodePhoto(pages[0].dataUrl); return; }
    if (!cloudReadingEnabled(user)) {
      const blockedKey = photoReadingBlockedKey(user);
      setPhotoOCR({ phase: 'unavailable', text: '', confidence: 0, engine: null,
        error: tLater(blockedKey), blockedKey });
      return;
    }

    const texts = [];
    let worst = 1;
    let engine = null;
    let unread = 0;
    for (const page of pages) {
      // The same ladder decodePhoto uses. Reading each page with the server
      // reader alone meant a student who had not switched it on saw "nothing
      // could be read" on a device that could have read it perfectly well.
      const page1 = await readOnePage(page.dataUrl);
      if (stale()) return;
      if (page1?.blocked) {
        setPhotoOCR({ phase: 'unavailable', text: '', confidence: 0, engine: null,
          error: tLater(page1.blocked), blockedKey: page1.blocked });
        return;
      }
      if (page1?.allowance) {
        pendingPdf.current = null;
        setPhotoOCR({ phase: 'failed', text: '', confidence: 0, engine: null,
          error: tLater('photo.cloudAllowanceUsed') });
        return;
      }
      if (!page1) { unread += 1; continue; }
      if (page1.text) texts.push(page1.text);
      worst = Math.min(worst, Number(page1.confidence || 0));
      engine = page1.engine || engine;
    }
    if (!texts.length) {
      pendingPdf.current = null;
      setPhotoOCR({
        phase: 'failed', text: '', confidence: 0, engine: null,
        error: tLater('verdict.pdfNothingRead')
      });
      return;
    }
    if (unread > 0) {
      // Presenting two of three pages as the whole of the working would submit
      // an answer the student never wrote.
      toast(<span>{t('verdict.pdfPagesUnread', { unread, total: pages.length })}</span>);
      setPdfUnread({ unread, total: pages.length });
    }
    const joined = texts.join('\n');
    pendingPdf.current = null;
    if (isWorking) { setWorking(joined); setShowWorking(true); }
    const last = joined.split(/\n+/).map(x => x.trim()).filter(Boolean).at(-1) || '';
    if (last) setAnswer(last);
    setPhotoOCR({ phase: 'done', text: joined, confidence: worst, error: '', engine: engine || 'cloud-pdf' });
  }, [decodePhoto, isWorking, readOnePage, t]);

  // Paste a photo straight in. On a laptop this is how a student moves a shot
  // from their phone: AirDrop or a screenshot, then ⌘V.
  useEffect(() => {
    if (mode !== 'photo' || resolved) return;
    const onPaste = (event) => {
      const item = [...(event.clipboardData?.items || [])].find(i => i.type?.startsWith('image/'));
      if (!item) return;
      const file = item.getAsFile();
      if (!file) return;
      event.preventDefault();
      // Invalidate the previous recognised attachment as soon as the student
      // pastes another image. Waiting for FileReader would leave the old
      // transcript marked as submittable while new bytes were still loading.
      const generation = ++photoReadGeneration.current;
      const live = () => mountedRef.current && generation === photoReadGeneration.current;
      pendingPdf.current = null;
      setPhoto(null);
      setPdfUnread(null);
      setPhotoSignInOpen(false);
      setPhotoOCR({ phase: 'reading', text: '', confidence: 0, error: '', engine: null });
      const reader = new FileReader();
      const fail = () => {
        if (live()) setPhotoOCR({ phase: 'failed', text: '', confidence: 0,
          error: tLater('verdict.imageUnopenable'), engine: null });
      };
      reader.onload = () => {
        if (!live()) return;
        const dataURL = String(reader.result || '');
        if (!dataURL.startsWith('data:image/')) { fail(); return; }
        setPhoto(dataURL);
        decodePhoto(dataURL);
      };
      reader.onerror = fail;
      reader.onabort = fail;
      reader.readAsDataURL(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [mode, resolved, decodePhoto]);

  useEffect(() => {
    if (!writeMode) return;
    if (inkModule) { setInkPhase('ready'); return; }
    let live = true;
    setInkPhase('loading');
    loadInk().then(
      () => { if (live) setInkPhase('ready'); },
      () => { if (live) setInkPhase('failed'); }
    );
    return () => { live = false; };
  }, [writeMode, inkTry]);

  const InkAnswer = inkPhase === 'ready' ? inkModule?.default : null;
  const inkStuck = inkPhase === 'failed' && inkExhausted();
  // The recogniser is 0.9 MB and is deliberately not in the install precache:
  // a phone with no stylus should not pay for it before its student has ever
  // asked to write. That makes "this is the first time you have opened the
  // write tab and you are offline" a real, ordinary case, and a different one
  // from "something went wrong" — the student can fix the first by finding a
  // signal for a moment, and nothing by retrying the second. Same distinction
  // pdfPage.js draws for the PDF renderer, and for the same reason.
  const inkNeedsNetwork = inkPhase === 'failed' && typeof navigator !== 'undefined' && navigator.onLine === false;

  const figure = useMemo(() => sanitizeFigure(question.figure), [question.figure]);

  // A graph, when the question states a function outright. plotSpecFor declines
  // far more often than it offers, because a wrong graph teaches a wrong thing;
  // where it declines there is simply no graph.
  const plotSpec = useMemo(() => {
    if (!res?.solution) return null;
    try {
      return plotSpecFor({
        prompt: question.prompt,
        solutionText: res.solution.solutionText,
        steps: res.solution.steps,
        subtopic: question.subtopic,
        chapterId: question.chapterId
      });
    } catch { return null; }
  }, [question.prompt, question.subtopic, question.chapterId, res]);

  // The recogniser is only fetched once something on screen needs its LaTeX.
  // Outside write mode the only strings that reach texOf are these two.
  const wantsTex = !isMcq && (writeMode || TEX_WORTH.test(answer) || TEX_WORTH.test(working));
  useEffect(() => {
    if (!wantsTex || toTex) return;
    let live = true;
    loadLatex().then(fn => { if (live) setToTex(() => fn); }, () => { });
    return () => { live = false; };
  }, [wantsTex, toTex]);

  const texOf = useCallback((s) => {
    const raw = String(s ?? '');
    if (!toTex) return raw.replace(/\\/g, '');
    try { return toTex(raw); } catch { return raw.replace(/\\/g, ''); }
  }, [toTex]);

  const typedPreview = useMemo(() => {
    const a = answer.trim();
    if (!a || /^[\d\s.]+$/.test(a)) return null;
    if (!toTex) return TEX_WORTH.test(a) ? null : a;
    try { return toTex(a); } catch { return null; }
  }, [answer, toTex]);

  // ── Work in progress, written where a crash cannot reach it ────────────────
  // React state is gone the instant a render throws, so the typed answer and
  // working go to the draft store as they are typed — coalesced, so a burst of
  // keystrokes is one write — and are cleared the moment the attempt is marked.
  // Ink strokes stay out on purpose: the store is for JSON-small records.
  const stash = (typed, wk) => {
    if (resolved) return;
    if (typedSaveTimer.current) clearTimeout(typedSaveTimer.current);
    if (!String(typed).trim() && !String(wk).trim()) { clearDraft('question', question.id); setSaveState(null); return; }
    const meta = { label: question.subtopicName, note: t('verdict.answerInProgress'), path: diagnostic ? '/placement' : '/practice' };
    // queueDraft is the crash-safe path (flushed on pagehide); the timed
    // saveDraft below is the same write made synchronously so the status line
    // reports what the write actually returned rather than assuming it.
    queueDraft('question', question.id, { typed, working: wk }, meta);
    setSaveState('saving');
    typedSaveTimer.current = setTimeout(() => {
      typedSaveTimer.current = null;
      // Once the answer is marked its draft has been cleared on purpose; this
      // late write must not put it back.
      if (attemptRef.current) return;
      setSaveState(saveDraft('question', question.id, { typed, working: wk }, meta) ? 'saved' : 'failed');
    }, 450);
  };
  const editAnswer = (v) => { setAnswer(v); stash(v, working); };
  const editWorking = (v) => { setWorking(v); stash(answer, v); };

  useEffect(() => {
    if (!resolved) return;
    if (typedSaveTimer.current) { clearTimeout(typedSaveTimer.current); typedSaveTimer.current = null; }
    clearDraft('question', question.id);
  }, [resolved, question.id]);

  // ── Handwriting in progress ────────────────────────────────────────────────
  // Ink is kept in the profile-scoped recovery store (practiceRecovery.js) the
  // moment the pen lifts. The status line says "saved" only after the record
  // has been read back from the store, never on the strength of having asked.
  const onInkStrokes = useCallback((strokes) => {
    if (inFlightRef.current || attemptRef.current) return;
    latestInk.current = strokes;
    setInkHasStrokes(Array.isArray(strokes) && strokes.length > 0);
    if (inkSaveTimer.current) { clearTimeout(inkSaveTimer.current); inkSaveTimer.current = null; }
    const revision = ++inkSaveRevision.current;
    // saveInkDraft queues *sealed IndexedDB*, not drafts.js localStorage.
    // Its boolean acknowledges only acceptance into a write queue, not disk.
    if (!saveInkDraft(question.id, strokes, { label: question.subtopicName })) { setSaveState('failed'); return; }
    if (!Array.isArray(strokes) || !strokes.length) { setSaveState(null); return; }
    const expected = JSON.stringify(compactInkStrokes(strokes));
    setSaveState('saving');
    inkSaveTimer.current = setTimeout(() => {
      inkSaveTimer.current = null;
      // Await the sealed store's actual write, then read the same question back.
      // A storage rejection is swallowed by the store (ink remains on canvas),
      // so only an exact durable stroke match can justify saying "Saved".
      flushInkDrafts().then(() => readInkDraft(question.id)).then(
        kept => {
          if (!mountedRef.current || attemptRef.current || inkSaveRevision.current !== revision) return;
          setSaveState(kept && JSON.stringify(compactInkStrokes(kept)) === expected ? 'saved' : 'failed');
        },
        () => {
          if (mountedRef.current && !attemptRef.current && inkSaveRevision.current === revision) setSaveState('failed');
        }
      );
    }, 700);
  }, [question.id, question.subtopicName]);
  useEffect(() => () => { ++inkSaveRevision.current; if (inkSaveTimer.current) clearTimeout(inkSaveTimer.current); }, []);
  useEffect(() => () => { if (typedSaveTimer.current) clearTimeout(typedSaveTimer.current); }, []);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // ── The question, recalled while working far down the page ────────────────
  useEffect(() => {
    const el = promptRef.current;
    if (!el || typeof IntersectionObserver !== 'function') return;
    const io = new IntersectionObserver(([entry]) => setPeek(!entry.isIntersecting && entry.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [question.id]);
  useEffect(() => {
    if (!peekOpen) return;
    peekRef.current?.querySelector('button')?.focus();
    const onKey = e => { if (e.key === 'Escape') setPeekOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [peekOpen]);
  const plainPrompt = useMemo(() => String(question.prompt || '')
    .replace(/\$\$?([^$]*)\$\$?/g, (_, m) => m.replace(/\\[a-zA-Z]+/g, ' ').replace(/[{}^_]/g, ''))
    .replace(/\s+/g, ' ').trim(), [question.prompt]);
  // A page of paper sized to the device: a phone gets a shorter first sheet so
  // the action bar and the question are never pushed off-screen.
  const [, setViewportKey] = useState(0);
  useEffect(() => {
    const onResize = () => setViewportKey(k => k + 1);
    window.addEventListener('orientationchange', onResize);
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('orientationchange', onResize); window.removeEventListener('resize', onResize); };
  }, []);
  // One sheet of the notebook. Read from the form-factor hook, which follows
  // the window, so the sheet is the same height however the window got to its
  // size (it used to depend on whether something else happened to re-render).
  const viewport = useFormFactor();
  const inkPageHeight = !viewport.width ? 420
    : viewport.width <= 760 ? 340
      : viewport.height > viewport.width ? Math.min(640, Math.round(viewport.height * 0.48)) : 420;

  // Only handwriting is gated: typing and photo carry no reading to doubt.
  const doubt = useMemo(
    () => (writeMode && !resolved ? doubtOf(inkResult) : null),
    [writeMode, resolved, inkResult]
  );
  const reading = inkResult?.answerLine || '';
  const needsCheck = !!doubt && !!reading && vouched !== reading;
  const checkFocus = needsCheck && checking ? (doubt.weakest?.id || null) : null;

  useEffect(() => { if (!needsCheck && checking) setChecking(false); }, [needsCheck, checking]);

  // Said as a question about the ink, never as a complaint about the student.
  const checkCopy = useMemo(() => {
    if (!doubt) return '';
    const nice = s => ({ pi: 'π', theta: 'θ', sqrt: '√', percent: '%' })[s] || s;
    if (doubt.why === 'shape') {
      return t('verdict.checkShape');
    }
    // Name a runner-up only when it is genuinely close and genuinely different:
    // offering "1 or l?" on a number is a question with no useful answer.
    const w = doubt.weakest;
    const rival = w?.rival || w?.alts?.find(a => a.sym !== w.sym) || null;
    const contested = rival && rival.conf >= w.conf - CONFIRM_MARGIN;
    if (w && contested) return t('verdict.checkContested', { read: nice(w.sym), rival: nice(rival.sym) });
    if (w) return t('verdict.checkCloseCall', { read: nice(w.sym) });
    return t('verdict.checkCloseCallPlain');
  }, [doubt, t]);

  const flipMode = (m) => {
    setMode(m);
    // Explicitly changing to typing abandons the Photo provenance. A later
    // typed submission receives a fresh idempotency key, never the pending
    // Photo key from an uncertain server acknowledgement.
    if (photoReattachRequired && m === 'type') {
      pendingRef.current = null;
      clearPendingSubmission(question.id);
      setPhotoReattachRequired(false);
    }
    localStorage.setItem('pri-input-mode', m);
    if (m === 'type') setTimeout(() => inputRef.current?.focus(), 60);
    if (m === 'photo' && !photo) setTimeout(() => photoInputRef.current?.click(), 120);
  };

  const insertSym = (s) => {
    const el = inputRef.current;
    const cur = isWorking ? working : answer;
    const st = el?.selectionStart ?? cur.length, en = el?.selectionEnd ?? cur.length;
    const next = cur.slice(0, st) + s + cur.slice(en);
    if (isWorking) editWorking(next); else editAnswer(next);
    if (el) requestAnimationFrame(() => { el.focus(); el.setSelectionRange(st + s.length, st + s.length); });
  };

  /** One tap: the student stands behind this reading, and it goes. */
  function acceptReading() {
    setVouched(reading);
    setChecking(false);
    submit(reading);
  }

  // Every submit control leads here, so the confirmation step cannot be walked
  // around: a reading in doubt turns the press into the question instead.
  async function submit(vouchedNow) {
    if (inFlightRef.current || busy || resolved) return;
    if (needsCheck && vouchedNow !== reading) { setChecking(true); return; }
    // A stale answer left over from another attachment is not evidence that
    // the NEW photo was recognised. Never let Submit race its cloud reading or
    // quietly grade only the readable subset of a multi-page PDF.
    if (mode === 'photo' && (!photo || photoOCR.phase !== 'done' || pdfUnread)) return;
    if (photoReattachRequired && mode === 'photo' && (!photo || photoOCR.phase !== 'done')) return;
    let given, steps, viaInk = false, ink, lines = null;
    if (isMcq) {
      given = mcqSel;
      if (given === null) return;
    } else if (isWorking) {
      if (writeMode) {
        if (!inkResult?.lines?.length) return;
        given = inkResult.lines.join('\n');
        viaInk = true;
        lines = inkResult.lines.slice();
        ink = { strokes: compactInkStrokes(inkResult.strokes), recognized: inkResult.text, engine: inkResult.engine || null };
      } else {
        given = working;
        if (!given.trim()) return;
      }
    } else if (writeMode) {
      if (!inkResult?.answerLine) return;
      given = inkResult.answerLine;
      steps = inkResult.lines.length > 1 ? inkResult.lines.join('\n') : undefined;
      viaInk = true;
      lines = inkResult.lines.slice();
      ink = { strokes: compactInkStrokes(inkResult.strokes), recognized: inkResult.text, engine: inkResult.engine || null };
    } else {
      given = answer;
      if (String(given).trim() === '') return;
      steps = (showWorking || mode === 'photo') && working.trim() ? working : undefined;
    }
    const sourceMode = viaInk ? 'ink' : (mode === 'photo' && photo ? 'photo' : 'typed');
    // The same answer through a different input authority is NOT a replay of
    // the same request. Never reuse a Photo idempotency key as a typed grade.
    const contentKey = submissionContentKey(given, steps);
    const replay = pendingRef.current?.contentKey === contentKey && pendingRef.current?.sourceMode === sourceMode;
    const submissionId = replay ? pendingRef.current.submissionId : newSubmissionId();
    // Preserve the original timer alongside the idempotency key: a retry made
    // seconds later cannot become a different server request under one key.
    const ms = replay && Number.isFinite(pendingRef.current.ms)
      ? pendingRef.current.ms : Date.now() - startRef.current;
    pendingRef.current = { submissionId, contentKey, sourceMode, ms };
    // On disk before the request leaves: a relaunch replays it under this key.
    // A placement answer is not replayed through practice on relaunch: the
    // placement session itself resumes at this exact question.
    if (!diagnostic) savePendingSubmission(question.id, { submissionId, answer: String(given), steps, viaInk, sourceMode, ms, lines }, { label: question.subtopicName });
    const scribbleStrokes = scribbleRef.current && !scribbleRef.current.isEmpty()
      ? compactInkStrokes(scribbleRef.current.getStrokes())
      : undefined;
    await deliver({ answer: String(given), ms, steps, viaInk, ink, photo, scribble: scribbleStrokes, submissionId }, { lines });
  }

  /**
   * Send one submission and settle the card on its definitive answer. Used by
   * a tap and by relaunch recovery alike, so both take the same path.
   */
  async function deliver(body, { lines = null, recovering = false } = {}) {
    inFlightRef.current = true;
    inkFrozenRef.current = !recovering || inkFrozenRef.current;
    setBusy(true);
    setAttemptViaInk(body.viaInk === true);
    try {
      const r = diagnostic
        // A diagnostic keeps no ink, photo or scribble: only the reading the
        // student submitted is marked, and only its outcome is stored.
        ? await api.post(diagnostic.submitPath, { answer: body.answer, ms: body.ms, steps: body.steps, viaInk: body.viaInk })
        : await api.post(`/practice/${question.id}/submit`, body);
      pendingRef.current = null;
      clearPendingSubmission(question.id);
      const live = mountedRef.current;
      if (r.resolved) {
        clearInkDraft(question.id);
        const bound = { submissionId: r.submissionId || body.submissionId, lines: Array.isArray(lines) ? lines : null, viaInk: body.viaInk === true };
        attemptRef.current = bound;
        if (live) {
          setAttempt(bound);
          setState({ phase: 'resolved', res: r });
          if (!diagnostic) {
            if (!r.replayed) celebrate(r);
            refreshUser(); refreshDue(); refreshRecent?.();
          }
          setSaveState(null);
        }
        // The attempt is recorded whether or not this card is still on screen,
        // so the session still counts it — exactly once, because the pending
        // record that could replay it is already gone.
        onResolved?.(r);
      } else {
        inkFrozenRef.current = false;
        if (live) setState({ phase: 'retry', res: r });
      }
    } catch (e) {
      // A refusal (4xx) is a definitive answer. Anything else — a fault, a
      // timeout — is not: the pending record stays, so an identical retry or a
      // relaunch reuses the same key and still lands as one attempt.
      if (e?.status >= 400 && e?.status < 500) { pendingRef.current = null; clearPendingSubmission(question.id); }
      inkFrozenRef.current = false;
      if (recovering && e?.status === 409 && e?.code !== 'QUESTION_DISCARDED') {
        // Answered elsewhere under another submission: nothing here to recover.
        if (mountedRef.current) onNext?.();
        return;
      }
      // Not a marking outcome: the submission itself did not go through. The
      // work is still on screen and still in its draft. A 409 is different:
      // the question was already finished (another tab, a skipped question),
      // and asking the student to submit again would be untrue.
      if (mountedRef.current) setState({ phase: 'retry', res: { feedback: e.message, invalid: true, technical: true, conflict: e?.status === 409 } });
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  }

  // ── Relaunch recovery ──────────────────────────────────────────────────────
  // A submission still marked in flight when this question mounts was cut off
  // by the app going away. It is replayed under its own key: the backend hands
  // back the verdict it already recorded, or marks it now if the first delivery
  // never landed. One attempt either way, and the student sees which.
  useEffect(() => {
    if (diagnostic) return;
    const pending = readPendingSubmission(question.id);
    if (!pending) return;
    pendingRef.current = { submissionId: pending.submissionId, contentKey: submissionContentKey(pending.answer, pending.steps), sourceMode: pending.sourceMode, ms: pending.ms };
    if (pending.sourceMode === 'unknown') {
      // Pre-provenance versions stored Photo and typed attempts identically.
      // Preserve the answer so the student can inspect and submit explicitly,
      // but never automatically re-grade it as typed after a crash.
      setMode('type');
      setAnswer(pending.answer);
      setWorking(pending.steps || '');
      return;
    }
    if (pending.sourceMode === 'photo') {
      // The image is intentionally never written to a plaintext draft. If the
      // app was killed mid-request, retain the attempted answer and key but
      // require a fresh attachment. Replaying the transcript as typed work
      // would bypass the required provider-recognition receipt.
      setMode('photo');
      setAnswer(pending.answer);
      setWorking(pending.steps || '');
      setPhotoReattachRequired(true);
      return;
    }
    (pending.viaInk ? Promise.resolve().then(() => readInkDraft(question.id)).catch(() => null) : Promise.resolve(null)).then(kept => {
      deliver({
        answer: pending.answer, ms: pending.ms, steps: pending.steps, viaInk: pending.viaInk,
        ink: kept ? { strokes: compactInkStrokes(kept), recognized: (pending.lines || []).join('\n') || null, engine: null } : undefined,
        submissionId: pending.submissionId
      }, { lines: pending.lines, recovering: true });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** The ink surface reports here. Frozen while marking and after the verdict. */
  const onInkRecognized = useCallback((r) => {
    if (inkFrozenRef.current) return;
    setInkResult(r);
    // Recovery: the page restored after a relaunch is read once, for display
    // beside the verdict, and then frozen like any submitted reading.
    if (inFlightRef.current || attemptRef.current) inkFrozenRef.current = true;
  }, []);

  // Ink that waited for the reader (offline, signed out, reader down) is
  // marked as soon as it is read: the student already wrote their answer and
  // was told it would be. Once per reading; the deterministic engine decides
  // the mark exactly as for a tap on Submit, and a doubtful reading still turns
  // into the confirmation question instead of a mark.
  const autoMarkedRef = useRef(null);
  useEffect(() => {
    if (!writeMode || !inkResult?.afterWait || !inkResult.readKey) return;
    if (autoMarkedRef.current === inkResult.readKey || resolved) return;
    // Busy (a submit or a hint in flight): wait — the effect runs again when
    // the card is idle, and the reading is marked then, not dropped.
    if (busy || inFlightRef.current) return;
    autoMarkedRef.current = inkResult.readKey;
    submit();
  }, [inkResult, busy]); // eslint-disable-line react-hooks/exhaustive-deps

  async function getHint() {
    if (hintsLeft <= 0 || resolved) return;
    try {
      const r = await api.post(`/practice/${question.id}/hint`, {});
      setHints(h => [...h, r.hint]);
      setHintsLeft(r.remaining);
    } catch { }
  }

  // Showing the solution ends the attempt with no marks, so it takes two
  // deliberate presses: a slip of the Pencil beside Submit cannot do it.
  const [revealArmed, setRevealArmed] = useState(false);
  useEffect(() => {
    if (!revealArmed) return;
    const disarm = setTimeout(() => setRevealArmed(false), 5000);
    return () => clearTimeout(disarm);
  }, [revealArmed]);

  async function dontKnow() {
    if (busy || resolved || !diagnostic) return;
    setBusy(true);
    try {
      const r = await api.post(diagnostic.submitPath, { skip: true, ms: Date.now() - startRef.current });
      setState({ phase: 'resolved', res: r });
      onResolved?.(r);
    } catch (e) {
      setState({ phase: 'retry', res: { feedback: e.message, invalid: true, technical: true, conflict: e?.status === 409 } });
    } finally { setBusy(false); }
  }

  async function reveal() {
    if (inFlightRef.current || busy || resolved) return;
    if (!revealArmed) { setRevealArmed(true); return; }
    setRevealArmed(false);
    inFlightRef.current = true;
    inkFrozenRef.current = true;
    setBusy(true);
    try {
      const r = await api.post(`/practice/${question.id}/reveal`, { ms: Date.now() - startRef.current });
      // Revealing settles the question, so nothing kept for it may replay.
      pendingRef.current = null;
      clearPendingSubmission(question.id);
      clearInkDraft(question.id);
      attemptRef.current = { submissionId: null, lines: null, revealed: true };
      if (mountedRef.current) {
        setAttempt(attemptRef.current);
        setState({ phase: 'resolved', res: r });
        celebrate(r); refreshUser(); refreshDue(); refreshRecent?.();
        setSaveState(null);
      }
      onResolved?.(r);
    } catch (e) {
      inkFrozenRef.current = false;
      throw e;
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  }

  async function toggleBookmark() {
    try {
      const r = await api.post(`/history/${question.id}/bookmark`, {});
      setBookmarked(r.bookmarked);
      toast(r.bookmarked ? t('verdict.savedToFavorites') : t('verdict.removedFromFavorites'), 2200);
    } catch { toast(t('verdict.favoriteNeedsAnswer'), 3200); }
  }

  const verdictGood = resolved && res.correct;
  const activeReport = state.res?.stepReport;
  // Teacher-style pin: per-line verdicts on the student's own ink. Step Check
  // pinpoints the exact line where the maths breaks; if every line is
  // consistent but the answer is still wrong, the final line gets the ✗ — the
  // mistake is always pointed at, never just "incorrect".
  const localLineVerdicts = useMemo(() => {
    if (!writeMode) return null;
    const n = inkResult?.lines?.length || 0;
    let base = activeReport?.lines
      ? activeReport.lines.map(l => ({ status: l.status, note: l.note }))
      : null;
    const wrongNow = (state.phase === 'retry' && !state.res?.invalid) || (resolved && !res?.correct && !res?.revealed);
    if (wrongNow && n > 0) {
      if (!base) base = Array.from({ length: n }, () => ({ status: 'unknown' }));
      if (!base.some(v => v.status === 'break')) {
        const idx = Math.min(n, base.length) - 1;
        if (idx >= 0) base[idx] = {
          status: 'wrong',
          note: resolved && res?.solution?.answerText
            ? `this line should conclude ${String(res.solution.answerText)}`
            : 'this line doesn’t reach the right answer — rework it'
        };
      }
    }
    // Correct → the marked answer line earns its tick on the ink itself.
    if (resolved && res?.correct && n > 0) {
      if (!base) base = Array.from({ length: n }, () => ({ status: 'unknown' }));
      const idx = Math.min(n, base.length) - 1;
      if (idx >= 0 && base[idx].status !== 'break') base[idx] = { status: 'ok', note: base[idx]?.note };
    }
    return base;
  }, [writeMode, activeReport, state.phase, state.res?.invalid, resolved, res, inkResult]);

  // ── A second read of the working ───────────────────────────────────────────
  // Asked for only when the answer is wrong and the on-device checker could not
  // say which line broke. That is the case where the app would otherwise have
  // nothing to offer but "try again", which a student staring at six lines of
  // their own algebra does not need to hear.
  //
  // It is feedback, not marking. The mark above has already been decided by the
  // deterministic engine and does not move when this arrives.
  const [cloudCheckFor, setCloudCheckFor] = useState(null);   // { submissionId, result }
  const [cloudPending, setCloudPending] = useState(false);
  const cloudCheckRef = useRef(null);
  const cloudCheckAbortRef = useRef(null);
  useEffect(() => { setCloudCheckFor(null); setCloudPending(false); }, [question?.id]);
  // The request belongs to the attempt, not to the render that sent it, so it
  // is cancelled only when the card goes away.
  useEffect(() => () => { cloudCheckAbortRef.current?.abort?.(); }, []);
  useEffect(() => {
    if (!writeMode || !resolved) return;
    // The lines checked are the lines that were submitted and marked — not
    // whatever the ink surface reads now.
    const bound = attempt;
    const lines = bound?.lines || [];
    if (!bound?.submissionId || !lines.length) return;
    if (!shouldCheckWorking({
      correct: res?.correct, invalid: res?.invalid, revealed: res?.revealed,
      lines, localReport: activeReport
    })) return;

    const key = `${question?.id}:${bound.submissionId}`;
    if (cloudCheckRef.current === key) return;              // already asked for this attempt
    cloudCheckRef.current = key;

    // No per-render cleanup here. Resolving refreshes the user, which re-runs
    // this effect; a cleanup that aborted the request on that re-run, followed
    // by the "already asked" guard above, meant the answer was thrown away and
    // never asked for again — the working note almost never appeared.
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    cloudCheckAbortRef.current = controller;
    checkWorkingWithCloud(lines, {
      user,
      prompt: question?.prompt || '',
      signal: controller?.signal
    }).then(result => {
      // Dropped unless the card is still up and still showing this attempt.
      if (!mountedRef.current || controller?.signal?.aborted) return;
      if (!result || result.error) return;
      if (attemptRef.current?.submissionId !== bound.submissionId) return;
      setCloudCheckFor({ submissionId: bound.submissionId, result });
    }).catch(() => { })
      // The status line says "Looking at your method" only while this request
      // is genuinely in flight for the attempt on screen.
      .finally(() => { if (mountedRef.current && attemptRef.current?.submissionId === bound.submissionId) setCloudPending(false); });
    setCloudPending(cloudReadingEnabled(user));
  }, [writeMode, resolved, res?.correct, res?.invalid, res?.revealed, attempt, activeReport, user, question?.id, question?.prompt]);

  const cloudCheck = cloudCheckFor && attempt?.submissionId && cloudCheckFor.submissionId === attempt.submissionId
    ? cloudCheckFor.result : null;

  const lineVerdicts = useMemo(
    () => mergeVerdicts(localLineVerdicts, cloudCheck, { lineCount: inkResult?.lines?.length || 0 }),
    [localLineVerdicts, cloudCheck, inkResult]
  );
  const cloudWorkingNote = useMemo(() => workingNote(cloudCheck), [cloudCheck]);

  // The misconception the cloud check proposed, as the deterministic engine
  // judged it: 'confirmed' (recorded in learner state) or 'possible' (shown,
  // hedged, never recorded). The backend decides; this only displays. The
  // proposal names the submission it came from, and the backend ignores one
  // that is not the submission of record.
  const [cloudMisconception, setCloudMisconception] = useState(null);
  useEffect(() => { setCloudMisconception(null); }, [question?.id]);
  useEffect(() => {
    const sid = cloudCheckFor?.submissionId;
    if (!cloudCheck || !sid || attemptRef.current?.submissionId !== sid || !question?.id) return;
    const proposal = misconceptionProposal(cloudCheck, attemptRef.current?.lines || []);
    if (!proposal) return;
    let live = true;
    api.post(`/practice/${question.id}/misconception`, { ...proposal.body, submissionId: sid })
      .then(r => {
        const named = r?.status ? misconceptionById(r.id) : null;
        if (live && named && attemptRef.current?.submissionId === sid) {
          setCloudMisconception({ status: r.status, named, line: proposal.displayLine });
        }
      })
      .catch(() => { });
    return () => { live = false; };
  }, [cloudCheck, cloudCheckFor, question?.id]);

  // ── The board's own arithmetic ─────────────────────────────────────────────
  // CBSE marks per step: formula, substitution, final answer with units. A
  // student whose method is sound and whose arithmetic slipped keeps most of
  // the marks, and a student who wrote only the answer forfeits the rest. Every
  // Indian student is told this and almost none get to practise it, because the
  // teacher who would read their working has twenty-six other children.
  const boardAward = useMemo(() => {
    // A server-attested result owns the marking decision, including method
    // credit. Never overlay it with a competing device-generated award.
    if (!resolved || res?.invalid || res?.revealed || res?.authoritative === true) return null;
    const lines = writeMode ? (inkResult?.lines || []) : String(working || '').split(/\n+/);
    const shown = lines.map(l => String(l || '').trim()).filter(Boolean);
    try {
      return awardStepMarks({
        question: { ...question, marks: totalMarks, steps: res?.solution?.steps || question.steps },
        workingLines: shown,
        stepReport: activeReport,
        answerText: writeMode ? (inkResult?.answerLine || '') : String(answer || ''),
        correct: !!res?.correct
      });
    } catch { return null; }
  }, [resolved, res, writeMode, inkResult, working, answer, question, totalMarks, activeReport]);

  // Teacher comments panel — one card per marked step, like a margin column.
  const inkComments = useMemo(() => {
    if (!writeMode || !lineVerdicts || !inkResult?.lines?.length) return null;
    const cards = [];
    lineVerdicts.forEach((v, i) => {
      const text = inkResult.lines[i];
      if (!text) return;
      if (v.status === 'ok') {
        cards.push({
          kind: 'good', line: i + 1,
          text: v.note || (i === 0 ? t('verdict.lineValidStart') : t('verdict.lineChecksOut'))
        });
      } else if (v.status === 'break' || v.status === 'wrong') {
        cards.push({ kind: 'bad', line: i + 1, text: v.note || t('verdict.lineBreaks') });
      }
    });
    return cards.length ? cards : null;
  }, [writeMode, lineVerdicts, inkResult, t]);
  // Photo mode is never a back door for submitting an old typed transcript.
  // Switch explicitly to Type when there is no fully recognised attachment.
  const photoAwaitingValidReading = mode === 'photo' &&
    (!photo || photoOCR.phase !== 'done' || !!pdfUnread);
  const canSubmit = (isMcq ? mcqSel !== null : isWorking ? (writeMode ? !!inkResult?.lines?.length : !!working.trim()) : writeMode ? !!inkResult?.answerLine : !!answer.trim()) &&
    !photoAwaitingValidReading &&
    (!photoReattachRequired || mode !== 'photo' || (!!photo && photoOCR.phase === 'done'));

  // Client checkboxes are a reflection exercise, never grading authority.
  // When the server supplies an explicit awarded-mark count, use it only if
  // bounded by the question's total. Partial method feedback by itself does
  // not certify that marks were committed to the student's account.
  const serverAuthoritative = res?.authoritative === true;
  const serverMarks = res?.marksEarned;
  const attestedMarks = serverAuthoritative && typeof serverMarks === 'number' &&
    Number.isFinite(serverMarks) && serverMarks >= 0 && serverMarks <= totalMarks
    ? serverMarks : null;
  const earnedMarks = resolved
    ? serverAuthoritative
      ? (attestedMarks ?? (verdictGood ? totalMarks : 0))
      : (verdictGood ? totalMarks : (selfSaved ? Object.values(selfMarks).filter(Boolean).length : 0))
    : 0;
  // Hints/retries cannot invent a different server-issued mark on the device.
  const shownMarks = serverAuthoritative ? earnedMarks : Math.round(earnedMarks * credit * 10) / 10;

  // The verdict lands in the middle of a long page. Spoken as one sentence, a
  // screen reader hears whether the answer was right without hunting for it.
  const verdictSpeech = useMemo(() => {
    if (state.phase === 'retry') {
      return state.res?.invalid
        ? t('verdict.speechUnreadable', { feedback: state.res.feedback || '' })
        : t('verdict.speechRetry', { feedback: state.res?.feedback || t('verdict.oneMoreGo') });
    }
    if (!resolved) return '';
    const earned = verdictGood ? shownMarks : earnedMarks;
    const marks = t('verdict.speechMarks', { count: totalMarks, earned, total: totalMarks });
    if (res.revealed) return t('verdict.speechRevealed', { marks });
    if (verdictGood) return t('verdict.speechCorrect', { marks });
    return t('verdict.speechIncorrect', { marks })
      + (res.solution?.answerText ? t('verdict.speechExpected', { answer: res.solution.answerText }) : '');
  }, [state.phase, state.res, resolved, res, verdictGood, shownMarks, earnedMarks, totalMarks, t]);

  const answerLines = isMcq ? [] : writeMode
    ? (inkResult?.lines || [])
    : isWorking ? working.split('\n').filter(Boolean)
      : [...(showWorking && working ? working.split('\n').filter(Boolean) : []), answer].filter(Boolean);

  // ── Layout: a handwriting or full-working question gets the split
  // workspace (question beside a large page); a short answer or a choice stays
  // one calm column, because a big empty page beside a one-line answer is
  // furniture.
  const split = !isMcq && (writeMode || isWorking);
  const invalidRetry = state.phase === 'retry' && state.res?.invalid && !state.res?.technical;
  const technicalRetry = state.phase === 'retry' && state.res?.technical;

  // ── What the status line may truthfully say ────────────────────────────────
  // It reports only what this device actually knows: a local write that
  // returned, a check that is running, a write that failed. It never says
  // "synced" or "uploaded", because the practice path never claims either.
  const statusState = busy ? 'working'
    : cloudPending ? 'working'
      : saveState === 'failed' ? 'failed'
        : saveState === 'saving' ? 'working'
          : resolved ? 'saved'
            : saveState === 'saved' ? (offline ? 'offline' : 'saved')
              : 'idle';
  // Only a genuine completed read with no usable transcription may ask the
  // student to rewrite. Account/network/readiness blocks are explained above.
  const inkUnread = writeMode && !isMcq && inkHasStrokes && !needsCheck
    && inkReaderState?.kind === INK_READER_STATE.READ_FAILED
    && (isWorking ? !inkResult?.lines?.length : !inkResult?.answerLine);
  const statusText = busy ? t('verdict.statusChecking')
    : cloudPending ? t('verdict.statusMethod')
      : saveState === 'failed' ? t('verdict.statusNotSaved')
        : saveState === 'saving' ? t('verdict.statusSaving')
          : resolved ? t('verdict.statusMarked')
            : inkUnread ? t('verdict.statusInkUnread')
            : saveState === 'saved' ? t(offline ? 'verdict.statusSavedOffline' : 'verdict.statusSaved')
              : (writeMode && !isMcq ? t('verdict.statusWriteHint') : '');

  // ── The one dominant next move ─────────────────────────────────────────────
  const primary = resolved || state.res?.conflict
    ? { label: t('practice.nextQuestion'), run: () => onNext?.(), disabled: false }
    : needsCheck && checking
      ? { label: t('verdict.confirmReading'), run: acceptReading, disabled: busy }
      : needsCheck
        ? { label: t('verdict.checkReadingFirst'), run: () => submit(), disabled: busy || !canSubmit }
        : {
          label: t(busy ? 'verdict.marking' : 'verdict.submit'),
          run: () => submit(), disabled: busy || !canSubmit
        };

  const solutionBody = res?.solution?.steps ? (
    <div className="solution-block">
      {plotSpec && (
        <div className="q-plot" style={{ margin: '4px 0 14px' }}>
          <PriPlot spec={plotSpec} progress={1} reduceMotion />
        </div>
      )}
      <div className="steps">
        {res.solution.steps.map((s, i) => (
          <div className="step" key={i}>
            <span className="step-n">{i + 1}</span>
            <div>
              <div className="step-h"><MathText text={s.h} /></div>
              <div className="step-d"><MathText text={s.d} /></div>
            </div>
          </div>
        ))}
      </div>
      {res.solution.answerText && (
        <div className="final-answer">
          <div className="sc-label" style={{ marginBottom: 8 }}>{t('verdict.finalAnswer')}</div>
          <MathText text={res.solution.answerText} />
        </div>
      )}
    </div>
  ) : null;

  const firstBad = inkComments?.find(c => c.kind === 'bad') || null;
  // Once submitted, the bar shows the answer the attempt was marked on; a
  // reading that lands later can redraw the panel but never this line.
  const boundLines = (state.phase !== 'answering' && attempt?.lines?.length) ? attempt.lines : null;
  const shownAnswerLine = boundLines
    ? boundLines[boundLines.length - 1]
    : (inkResult?.answerLine ? (isWorking ? inkResult.lines[inkResult.lines.length - 1] : inkResult.answerLine) : '');
  const otherComments = (inkComments || []).filter(c => c !== firstBad && c.kind !== 'good');

  return (
    <div className={`qpage ws ${split ? 'ws-split' : 'ws-single'}`} data-phase={state.phase} data-mode={isMcq ? 'mcq' : mode} data-question-id={question.id}>
      {/* ── The question: the page's reference object ── */}
      <section className="ws-context" aria-label={t('verdict.questionRegion')}>
        <div className="q-topmeta">
          <span className="q-marks">{t('verdict.marksAvailable', { count: totalMarks, n: totalMarks })}</span>
          {/* The topic chip is where a student meets the name of what they are
              being asked, so it is the first place worth pairing. The question
              itself below is untouched: it will be in English in the exam hall. */}
          <span className="tag" lang="en"><TermGloss text={question.subtopicName} /></span>
          <span className={`tag ${DIFF_CLASS[question.difficulty] || ''}`}>{question.diffLabel}</span>
          {reasonTag && REASON_TAG_KEY[reasonTag] && <span className="tag tag-brand" data-reason-tag={reasonTag}>{t(REASON_TAG_KEY[reasonTag])}</span>}
          {!reasonTag && reason === 'review' && <span className="tag tag-brand">{t('verdict.spacedReview')}</span>}
          {!reasonTag && reason === 'weak-spot' && <span className="tag tag-brand">{t('verdict.weakSpot')}</span>}
          {!reasonTag && reason === 'new-ground' && <span className="tag tag-brand">{t('verdict.newGround')}</span>}
          {reason === 'task' && <span className="tag tag-brand">{t('verdict.task')}</span>}
          {/* Practice is untimed on screen: time on task is still measured for the
              marker, but a running clock is pressure, not information. */}
        </div>
        {helpUsed > 0 && !resolved && (
          <p className="q-credit">{t('verdict.creditAvailable', { percent: Math.round(credit * 100), marks: Math.round(totalMarks * credit * 10) / 10 })}</p>
        )}

        <div ref={promptRef}>
          <MathText block className="q-prompt" text={question.prompt} />
        </div>
        {figure && <div className="q-figure" dangerouslySetInnerHTML={{ __html: figure }} />}
        {showWhy && why && <p className="q-why">{why}</p>}

        {hints.length > 0 && (
          <div className="hints-block">
            <div className="hints-block-title">{t('verdict.hints')}</div>
            {hints.map((h, i) => (
              <div className="hintbox" key={i}><span className="h-n">{t('verdict.hintNumber', { n: i + 1 })}</span><MathText text={h} /></div>
            ))}
          </div>
        )}

        {/* After marking, the worked method sits beside the student's own
            working: a comparison of two methods, not a verdict sheet. A
            correct answer keeps it folded — a different route is not a
            correction. */}
        {split && resolved && solutionBody && (verdictGood ? (
          <details className="solution-panel">
            <summary><Icon name="compare" size={16} />{t('verdict.anotherMethod')}</summary>
            {solutionBody}
          </details>
        ) : (
          <section className="solution-panel" aria-label={t('verdict.workedSolution')}>
            <div className="solution-panel-title">{t('verdict.workedSolution')}</div>
            {solutionBody}
          </section>
        ))}
      </section>

      {/* ── The student's work: the surface everything else attaches to ── */}
      <section className="ws-work" aria-label={t('verdict.workRegion')}>
        <div className={`ws-qpeek no-print${peek ? ' is-on' : ''}`} aria-hidden={!peek}>
          <span className="ws-qpeek-text">{plainPrompt}</span>
          <button type="button" className="btn btn-quiet btn-sm" tabIndex={peek ? 0 : -1} onClick={() => setPeekOpen(true)}>{t('verdict.showQuestion')}</button>
        </div>

        <div className="ws-tools no-print">
          {!isMcq && (
            <div className="mode-tabs seg" role="group" aria-label={t('verdict.answerModes')}>
              <button type="button" className={`mode-tab ${mode === 'type' ? 'on' : ''}`} aria-pressed={mode === 'type'} title={t('verdict.modeTypeTitle')}
                aria-label={t('verdict.modeTypeLabel')} onClick={() => flipMode('type')}><Icon name="type" size={16} />{t('verdict.modeType')}</button>
              <button type="button" className={`mode-tab ${mode === 'write' ? 'on' : ''}`} aria-pressed={mode === 'write'} title={t('verdict.modeWriteTitle')}
                aria-label={t('verdict.modeWriteLabel')} onClick={() => flipMode('write')}><Icon name="pen" size={16} />{t('verdict.modeWrite')}</button>
              <button type="button" className={`mode-tab ${mode === 'photo' ? 'on' : ''}`} aria-pressed={mode === 'photo'} title={t('verdict.modePhotoTitle')}
                aria-label={t('verdict.modePhotoLabel')} onClick={() => flipMode('photo')}><Icon name="photo" size={16} />{t('verdict.modePhoto')}</button>
            </div>
          )}
          <div className="ws-tools-end">
            {!diagnostic && !isMcq && question.hintsAvailable > 0 && !resolved && (
              <button type="button" className="icon-btn hint-bulb" disabled={hintsLeft <= 0}
                title={t('verdict.hintTitle', { n: hintsUsed + 1 })}
                aria-label={hintsLeft > 0 ? t('verdict.hintLabel', { n: hintsUsed + 1, total: question.hintsAvailable }) : t('verdict.noHintsLeft')}
                onClick={getHint}>
                <Icon name="hint" /><span>{t('verdict.hint')}</span>
                <span className="hint-left">{t('verdict.hintsLeft', { count: hintsLeft, n: hintsLeft })}</span>
              </button>
            )}
            {!resolved && (
              <button type="button" className={`icon-btn q-rail-btn ${showScribble ? 'on' : ''}`} aria-pressed={showScribble}
                title={t('verdict.scribblePad')} aria-label={t('verdict.scribblePad')} onClick={() => setShowScribble(s => !s)}><Icon name="scratch" /></button>
            )}
            {why && (
              <button type="button" className={`icon-btn q-rail-btn ${showWhy ? 'on' : ''}`} aria-pressed={showWhy}
                title={t('verdict.whyThis')} aria-label={t('verdict.whyThis')} onClick={() => setShowWhy(s => !s)}><Icon name="info" /></button>
            )}
            {!diagnostic && (
              <button type="button" className={`icon-btn q-rail-btn ${bookmarked ? 'on' : ''}`} aria-pressed={bookmarked}
                title={t('verdict.favorite')} aria-label={t('verdict.favoriteThis')} onClick={toggleBookmark}><Icon name="bookmark" /></button>
            )}
          </div>
        </div>

        {/* ── answering surface ── */}
        {isMcq ? (
          <div className="mcq" role="group" aria-label={t('verdict.options')}>
            {question.mcqOptions.map((opt, i) => {
              let cls = 'mcq-opt';
              let mark = null;
              if (!resolved && mcqSel === i) cls += ' sel';
              if (resolved) {
                if (opt === res.solution?.answerText) { cls += ' right'; mark = t('verdict.correctOption'); }
                else if (mcqSel === i && !res.correct) { cls += ' wrong'; mark = t('verdict.yourChoice'); }
              }
              return (
                <button key={i} className={cls} disabled={resolved} aria-pressed={!resolved ? mcqSel === i : undefined} onClick={() => setMcqSel(i)}>
                  <span className="mcq-key">{'ABCD'[i]}</span>
                  <MathText text={opt} />
                  {mark && <span className="mcq-mark">{mark}</span>}
                </button>
              );
            })}
          </div>
        ) : mode !== 'write' ? (
          <div className={`editor-shell ${resolved ? 'ink-disabled' : ''}`}>
            {/* Tools for writing an answer: gone once there is nothing left to write. */}
            {!resolved && (
              <div className="editor-toolbar">
                <button className={`editor-tool ${showSyms ? 'on' : ''}`} title={t('verdict.symbolPalette')} aria-label={t('verdict.symbolPalette')} aria-pressed={showSyms} onClick={() => setShowSyms(s => !s)}>Σ</button>
                <span className="editor-hint">{t(isWorking ? 'verdict.editorHintWorking' : 'verdict.editorHintType')}</span>
                <span style={{ flex: 1 }} />
                {question.answerSuffix && <span className="answer-suffix">{t('verdict.answerIn', { unit: question.answerSuffix })}</span>}
              </div>
            )}
            {showSyms && !resolved && (
              <div className="sym-palette">
                {SYMBOLS.map(([sym, nameKey]) => (
                  <button key={sym} className="sym-key" aria-label={t('verdict.insertSymbol', { name: t(nameKey) })} onClick={() => insertSym(sym)}>{sym}</button>
                ))}
              </div>
            )}
            <div className="editor-body">
              {mode === 'photo' && (
                <div style={{ marginBottom: 14 }}>
                  {/* No `capture` attribute: on iOS it forces the camera open and removes
                      the photo-library option, which is the wrong way round. A student
                      photographs their exercise book first and picks the shot afterwards. */}
                  <input ref={photoInputRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
                    onChange={e => {
                      // Cancelled file pickers keep the previously read image.
                      if (!e.target.files?.length) return;
                      // Invalidate the old OCR synchronously. An Image or PDF
                      // FileReader may finish much later, and until then an old
                      // phase='done' would otherwise enable stale submission.
                      const generation = ++photoReadGeneration.current;
                      const live = () => mountedRef.current && generation === photoReadGeneration.current;
                      pendingPdf.current = null;
                      setPhoto(null);
                      setPdfUnread(null);
                      setPhotoSignInOpen(false);
                      setPhotoOCR({ phase: 'reading', text: '', confidence: 0, error: '', engine: null });
                      attachPhoto(e,
                        data => { if (live()) setPhoto(data); },
                        data => { if (live()) void decodePhoto(data); },
                        data => { if (live()) void decodePdf(data); },
                        message => { if (live()) setPhotoOCR({ phase: 'failed', text: '', confidence: 0, engine: null, error: message }); });
                    }} />
                  {!photo && photoOCR.phase === 'idle'
                    ? <button className="btn btn-ghost" onClick={() => photoInputRef.current?.click()}>{t('verdict.photographWorking')}<span className="muted" style={{ display: 'block', fontSize: 12, marginTop: 2, fontWeight: 400 }}>{t('verdict.photoFormats', { pages: MAX_PDF_PAGES })}</span></button>
                    : (
                      <div className="photo-attach">
                        {/* A PDF sets no thumbnail until its pages render, and the whole
                            status block used to live inside the photo branch — so every
                            PDF failure message was unreachable and the screen simply did
                            not move. */}
                        {photo
                          ? <div className="photo-thumb"><img src={photo} alt={t('history.paperWorking')} /><button aria-label={t('verdict.removePhoto')} onClick={() => { photoReadGeneration.current += 1; pendingPdf.current = null; setPdfUnread(null); setPhoto(null); setPhotoSignInOpen(false); setPhotoOCR({ phase: 'idle', text: '', confidence: 0, error: '', engine: null }); }}>✕</button></div>
                          : <div className="photo-thumb" style={{ display: 'grid', placeItems: 'center', fontSize: 22 }}><span aria-hidden="true">▤</span><button aria-label={t('verdict.removeAttachment')} onClick={() => { photoReadGeneration.current += 1; pendingPdf.current = null; setPhoto(null); setPdfUnread(null); setPhotoSignInOpen(false); setPhotoOCR({ phase: 'idle', text: '', confidence: 0, error: '', engine: null }); }}>✕</button></div>}
                        <div style={{ flex: 1 }} role="status" aria-live="polite">
                          {photoOCR.phase === 'reading' && (
                            <span className="muted">{t('verdict.readingWork')}</span>
                          )}
                          {photoOCR.phase === 'done' && (
                            <>
                              {/* What actually read it. Saying "on-device" over a photo that
                                  was uploaded is the one thing this screen must never do. */}
                              <div style={{ fontSize: 12.5, marginBottom: 6 }}>
                                <b>{String(photoOCR.engine || '').startsWith('cloud') ? t('verdict.readOnServer') : t('verdict.decodedOnDevice')}</b>
                                {photoOCR.confidence ? t('verdict.ocrConfidence', { percent: Math.round(photoOCR.confidence * 100) }) : ''}
                              </div>
                              <label className="sc-label" htmlFor="photo-recognition-correction">{t('verdict.readOnServer')}</label>
                              <textarea id="photo-recognition-correction" className="working-input"
                                data-photo-correct-transcript aria-label={t('verdict.readOnServer')}
                                value={photoOCR.text} disabled={resolved} rows={Math.min(8, Math.max(3, photoOCR.text.split('\n').length + 1))}
                                onChange={e => {
                                  const corrected = e.target.value;
                                  setPhotoOCR(v => ({ ...v, text: corrected }));
                                  const lastLine = corrected.split(/\n+/).map(x => x.trim()).filter(Boolean).at(-1) || '';
                                  if (isWorking) editWorking(corrected);
                                  else { editAnswer(lastLine); }
                                }} />
                              <div className="muted" style={{ marginTop: 6 }}>{t('verdict.filledFromLastLine')}</div>
                              {pdfUnread && <div className="verdict-body" style={{ marginTop: 6 }}>{t('verdict.pdfPagesUnread', pdfUnread)}</div>}
                              {cloudNotice && String(photoOCR.engine || '').startsWith('cloud') && (
                                <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>{t('verdict.photoReadOnServerNotice')}</div>
                              )}
                            </>
                          )}
                           {(photoOCR.phase === 'failed' || photoOCR.phase === 'unavailable') && <span className="verdict-body">{photoOCR.error}</span>}
                          {photoOCR.phase === 'unavailable' && photoOCR.blockedKey === 'verdict.photoReadingSignIn' && (
                            <div style={{ marginTop: 10 }}>
                              <button className="btn btn-primary" type="button" data-photo-sign-in
                                aria-expanded={photoSignInOpen} onClick={() => setPhotoSignInOpen(v => !v)}>
                                {t('cloud.signIn')}
                              </button>
                              <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                                {t('verdict.photoAttachedIdle')}
                              </p>
                            </div>
                          )}
                          {photoOCR.phase === 'idle' && <span className="muted">{t('verdict.photoAttachedIdle')}</span>}
                        </div>
                      </div>
                    )}
                </div>
              )}
              {photoSignInOpen && photoOCR.blockedKey === 'verdict.photoReadingSignIn' && (
                <React.Suspense fallback={<p role="status">{t('cloud.stateChecking')}</p>}>
                  <PhotoAccountRecovery />
                </React.Suspense>
              )}
              {isWorking ? (
                <textarea
                  ref={inputRef}
                  className="working-input"
                  aria-label={t('verdict.workingAria')}
                  style={{ background: 'none', border: 'none', color: 'var(--ink)' }}
                  placeholder={question.inputHint || t('verdict.workingPlaceholder')}
                  value={working} disabled={resolved}
                  onChange={e => editWorking(e.target.value)}
                  rows={6}
                />
              ) : (
                <div className="answer-row">
                  {question.answerPrefix && <span className="answer-prefix"><MathText text={question.answerPrefix} /></span>}
                  <input
                    ref={inputRef}
                    className="answer-input"
                    aria-label={question.answerSuffix ? t('verdict.answerAriaWithUnit', { unit: question.answerSuffix }) : t('verdict.answerAria')}
                    placeholder={question.inputHint || t('verdict.answerPlaceholder')}
                    value={answer}
                    disabled={resolved}
                    onChange={e => editAnswer(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') submit(); }}
                    autoCapitalize="none" autoCorrect="off" spellCheck={false}
                    // Answers are expressions as often as numbers (x², 3/4, √2),
                    // so a numeric keypad would block them: keep the full
                    // keyboard and label its Enter key as the submit action.
                    inputMode="text" enterKeyHint="go"
                  />
                  {question.answerSuffix && <span className="answer-suffix">{question.answerSuffix}</span>}
                </div>
              )}
              {typedPreview && !resolved && !isWorking && (
                <div className="typed-preview">{t('verdict.readsAs')}&nbsp; <MathText text={`$${typedPreview}$`} /></div>
              )}
              {question.supportsSteps && !resolved && !isWorking && mode === 'type' && (
                <div style={{ marginTop: 14 }}>
                  <button className="btn-disclose" aria-expanded={showWorking} onClick={() => setShowWorking(s => !s)}>
                    <Icon name="chevronDown" size={16} />{t('verdict.showWorkingToggle')}
                  </button>
                  {showWorking && (
                    <textarea
                      className="input" style={{ marginTop: 8 }}
                      aria-label={t('verdict.workingPartialAria')}
                      placeholder={t('verdict.workingPartialPlaceholder')}
                      value={working} onChange={e => editWorking(e.target.value)}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="ink-row">
            {/* data-marked starts the reading sweep (theme.css): it appears only
                when the deterministic engine has actually marked this page. */}
            <div className="editor-shell" data-marked={(resolved && !res?.revealed) || (state.phase === 'retry' && !state.res?.invalid) ? 'yes' : undefined}>
              {InkAnswer && restoredInk !== undefined && (
                <InkAnswer onRecognized={onInkRecognized} onReaderState={setInkReaderState} height={inkPageHeight} lineVerdicts={lineVerdicts}
                  disabled={resolved || busy} focusSymbol={checkFocus} recognitionContext={recognitionContext}
                  initialStrokes={latestInk.current || restoredInk || null} onStrokes={onInkStrokes} />
              )}
              {inkPhase === 'failed' && (
                <div className="editor-body">
                  <div className="verdict verdict-technical" role="alert">
                    <span className="verdict-ico"><Icon name="alert" /></span>
                    {/* Three outcomes, not two. "You are offline and this needs one
                        download" is a different thing from "it would not load", and
                        only one of them is the student's to act on. */}
                    <div>
                      {inkNeedsNetwork ? (
                        <><div className="verdict-title">{t('verdict.inkNeedsDownloadTitle')}</div><div className="verdict-body">{t('verdict.inkNeedsDownloadBody')}</div></>
                      ) : (
                        <><div className="verdict-title">{t('verdict.inkFailedTitle')}</div><div className="verdict-body">{t(inkStuck ? 'verdict.inkFailedStuck' : 'verdict.inkFailedRetry')}</div></>
                      )}
                    </div>
                  </div>
                  <div className="row" style={{ marginTop: 12 }}>
                    {inkStuck
                      ? <button className="btn btn-ghost btn-sm" onClick={() => window.location.reload()}>{t('verdict.reloadApp')}</button>
                      : <button className="btn btn-ghost btn-sm" onClick={() => setInkTry(n => n + 1)}>{t('common.tryAgain')}</button>}
                    <button className="btn btn-quiet btn-sm" onClick={() => flipMode('type')}>{t('verdict.typeInstead')}</button>
                  </div>
                </div>
              )}
              {(inkPhase === 'idle' || inkPhase === 'loading') && (
                <div className="editor-body">
                  <div className="skeleton" style={{ height: inkPageHeight }} />
                  <p className="muted" role="status" style={{ marginTop: 10 }}>{t('verdict.warmingUp')}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* A reading in doubt asks about the smallest useful region — one
            symbol — instead of asking for the whole solution again. */}
        {needsCheck && checking && (
          <div className="ws-check" role="status">
            <div className="ws-check-title"><Icon name="uncertain" />{t('verdict.checkReadingFirst')}</div>
            <div className="ws-check-body">{checkCopy}</div>
            <div className="ws-check-reading">
              {t('verdict.readingItAs')}&nbsp;<MathText text={`$${texOf(reading)}$`} />
            </div>
            <div><button className="btn btn-quiet btn-sm" onClick={() => setChecking(false)}>{t('verdict.keepWriting')}</button></div>
          </div>
        )}

        {/* Scratch: rough work that is kept with the attempt but never marked. */}
        {showScribble && !resolved && (
          <div className="scratch">
            <div className="scratch-head">
              <span className="scratch-title">{t('verdict.scratch')}</span>
              <span className="scratch-tag">{t('verdict.scratchNotMarked')}</span>
              <span className="scratch-note">{t('verdict.scratchNote')}</span>
              <span style={{ flex: 1 }} />
              <button className="icon-btn" aria-label={t('verdict.undoScribble')} onClick={() => scribbleRef.current?.undo()}><Icon name="undo" /></button>
              <button className="icon-btn" aria-label={t('verdict.clearScribble')} onClick={() => scribbleRef.current?.clear()}><Icon name="clear" /></button>
            </div>
            <InkCanvas ref={scribbleRef} height={200} guides={false} ariaLabel={t('verdict.scribblePad')} />
          </div>
        )}

        {/* AI tutor: three levels of help, lazy-loaded on first use. It sits with
            the work it is about, and never during a placement check. */}
        {!resolved && tutorEnabled && !diagnostic && (
          <div className="tutor-launch-row no-print">
            <button type="button" className={`btn btn-ghost btn-sm tutor-launch ${showTutor ? 'on' : ''}`}
              aria-expanded={showTutor} aria-label={t('tutor.helpLabel')} data-tutor-launch
              onClick={() => setShowTutor(v => !v)}>
              {t('tutor.help')}
            </button>
            {tutorUsed > 0 && <span className="muted" style={{ marginLeft: 8, fontSize: 13 }}>{t('tutor.helpUsed', { count: tutorUsed, n: tutorUsed })}</span>}
          </div>
        )}
        {showTutor && !resolved && tutorEnabled && !diagnostic && TutorHelp && (
          <TutorBoundary fallback={t('tutor.unavailable')}>
            <React.Suspense fallback={<div className="hintbox" role="status">{t('tutor.asking')}</div>}>
              <TutorHelp
                question={{ ...question, tutorLevel: tutorUsed }}
                work={{
                  lines: (isWorking || showWorking) && working ? working.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 40).map(l => l.slice(0, 400)) : [],
                  typed: isMcq ? '' : String(answer || '').slice(0, 300)
                }}
                locale={language === 'hi' ? 'hi' : 'en'}
                onUsed={level => setTutorUsed(u => Math.max(u, level))}
                startedAt={startRef.current}
                onResolved={r => {
                  // Level 3 ends the question like Reveal: same state, same refreshes.
                  setState({ phase: 'resolved', res: r });
                  celebrate(r); refreshUser(); refreshDue(); refreshRecent?.();
                  onResolved?.(r);
                }}
                onClose={() => setShowTutor(false)}
              />
            </React.Suspense>
          </TutorBoundary>
        )}

        <div style={SR_ONLY} role="status" aria-live="polite" aria-atomic="true">{verdictSpeech}</div>

        {/* ── Feedback, attached to the work ── */}
        {state.phase === 'retry' && (
          <div className={`verdict ${technicalRetry ? 'verdict-technical' : invalidRetry ? 'verdict-bad verdict-unsure' : 'verdict-bad'}`}>
            <span className="verdict-ico"><Icon name={technicalRetry ? 'alert' : invalidRetry ? 'uncertain' : 'correction'} /></span>
            <div>
              <div className="verdict-title">{state.res?.conflict ? t('verdict.alreadyFinishedTitle') : t(technicalRetry ? 'verdict.notSubmittedTitle' : invalidRetry ? 'verdict.unreadable' : 'verdict.notQuite')}</div>
              <div className="verdict-body">
                {state.res?.conflict
                  ? <span className="muted">{state.res.feedback}</span>
                  : technicalRetry
                  ? <>{t('verdict.workIsSafe')} <span className="muted">{state.res.feedback}</span></>
                  : <MathText text={state.res.feedback || t('verdict.oneMoreGo')} />}
              </div>
              {attemptViaInk && <div className="eval-provenance" data-provenance="handwriting" style={{ padding: '6px 0 0', border: 0 }}>{t('verdict.readByAiMarkedByEngine')}</div>}
              {state.res.partial && <div className="muted" style={{ marginTop: 6, fontSize: 13.5 }}>{state.res.partial.note}</div>}
              {state.res.stepReport && <StepReport report={state.res.stepReport} />}
              <div className="verdict-next">{state.res?.conflict ? t('verdict.nextAfterConflict') : t(technicalRetry ? 'verdict.nextTechnical' : invalidRetry ? 'verdict.nextUnreadable'
                : (state.res.stepReport?.lines?.some(l => l.status === 'break') || firstBad) ? 'verdict.nextFix' : 'verdict.nextTryAgain')}</div>
            </div>
          </div>
        )}

        {firstBad && (
          <div className="ink-comments">
            <div className="ink-comment bad">
              <div className="ic-head">{t('verdict.lookHere')}<span className="ic-line">{t('verdict.onLine', { n: firstBad.line })}</span></div>
              {firstBad.text}
            </div>
            {cloudWorkingNote && (
              <div className={`ink-comment ${cloudWorkingNote.tone === 'break' ? 'bad' : 'note'}`}>
                <div className="ic-head">{t(cloudWorkingNote.tone === 'break' ? 'verdict.whereItBreaks' : cloudWorkingNote.tone === 'maybe' ? 'verdict.possibly' : 'verdict.yourAlgebra')}</div>
                {cloudWorkingNote.text}
                {cloudMisconception && (
                  <div className="diagnosis-named" data-misconception={cloudMisconception.named.id} data-status={cloudMisconception.status}>
                    <b>{t(cloudMisconception.status === 'confirmed' ? 'verdict.lineMisconception' : 'verdict.possibleMisconception',
                      { n: cloudMisconception.line, name: t(cloudMisconception.named.name) })}</b>
                    <div>{t(cloudMisconception.named.explain)}</div>
                  </div>
                )}
              </div>
            )}
            {otherComments.length > 0 && (
              <details className="ink-comments-more">
                <summary>{t('verdict.moreNotes', { count: otherComments.length, n: otherComments.length })}</summary>
                {otherComments.map((c, i) => (
                  <div key={i} className={`ink-comment ${c.kind}`} style={{ marginTop: 8 }}>
                    <div className="ic-head">{t('verdict.mistake')}<span className="ic-line">{t('verdict.onLine', { n: c.line })}</span></div>
                    {c.text}
                  </div>
                ))}
              </details>
            )}
          </div>
        )}
        {!firstBad && cloudWorkingNote && (
          <div className="ink-comments">
            <div className={`ink-comment ${cloudWorkingNote.tone === 'break' ? 'bad' : 'note'}`}>
              <div className="ic-head">{t(cloudWorkingNote.tone === 'break' ? 'verdict.whereItBreaks' : cloudWorkingNote.tone === 'maybe' ? 'verdict.possibly' : 'verdict.yourAlgebra')}</div>
              {cloudWorkingNote.text}
              {cloudMisconception && (
                <div className="diagnosis-named" data-misconception={cloudMisconception.named.id} data-status={cloudMisconception.status}>
                  <b>{t(cloudMisconception.status === 'confirmed' ? 'verdict.lineMisconception' : 'verdict.possibleMisconception',
                    { n: cloudMisconception.line, name: t(cloudMisconception.named.name) })}</b>
                  <div>{t(cloudMisconception.named.explain)}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {resolved && (
          <>
            {answerLines.length > 0 && mode === 'photo' && !isMcq && (
              <div className="your-answer">
                <div className="sc-label">{t('verdict.yourAnswer')}</div>
                {answerLines.map((l, i) => (
                  <div className="ya-line" key={i}><MathText text={`$${texOf(l)}$`} /></div>
                ))}
                {photo && <div className="photo-thumb" style={{ marginTop: 8 }}><img src={photo} alt={t('verdict.attachedWorking')} /></div>}
              </div>
            )}

            <div className="eval-card" data-outcome={verdictGood ? 'correct' : res.revealed ? 'revealed' : 'incorrect'}>
              <div className="eval-head">
                <span className="eval-title">
                  <Icon name={verdictGood ? 'check' : 'correction'} />
                  {t(verdictGood ? 'verdict.correct' : res.revealed ? 'verdict.revealed' : 'verdict.notThisTime')}
                </span>
                <span className="eval-marks">
                  {t('verdict.marksOutOf', { earned: verdictGood ? shownMarks : earnedMarks, total: totalMarks })}
                  {helpUsed > 0 && <small> · {t('verdict.afterHints', { count: helpUsed, n: helpUsed })}</small>}
                </span>
              </div>
              <div className="eval-body">
                {res.feedback && !verdictGood && <div><MathText text={res.feedback} /></div>}
                {res.partial && !verdictGood && <div className="muted" style={{ marginTop: 6, fontSize: 13.5 }}>{res.partial.note}</div>}
                {verdictGood && writeMode && inkResult?.lines?.length > 1 && (
                  <div>{t('verdict.everyLineChecked', { count: inkResult.lines.length, n: inkResult.lines.length })}</div>
                )}
                {!verdictGood && res.solution && (
                  <div className="eval-expected">{t('verdict.expected')} <b><MathText text={res.solution.answerText} /></b></div>
                )}
                {res.stepReport && <StepReport report={res.stepReport} />}
                {boardAward && (
                  <div className="board-award" style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--hairline)' }}>
                    {/* The header above already states the total. It is repeated here
                        only when there is more than one step to add up. */}
                    <div className="spread" style={{ alignItems: 'baseline' }}>
                      <span className="sc-label" style={{ margin: 0 }}>{t('verdict.markedStepByStep')}</span>
                      {boardAward.rows.length > 1 && <b style={{ fontVariantNumeric: 'tabular-nums' }}>{boardAward.awarded} / {boardAward.total}</b>}
                    </div>
                    {boardAward.rows.map((row, i) => (
                      <div key={i} className="set-row" style={{ paddingTop: 5, paddingBottom: 5 }}>
                        <span className="set-k" style={{ fontWeight: 400 }}>
                          <span aria-hidden="true" style={{ marginRight: 7, color: row.earned === row.outOf ? 'var(--good)' : 'var(--correction)' }}>
                            <Icon name={row.earned === row.outOf ? 'check' : 'correction'} size={14} />
                          </span>
                          {row.labelKey ? t(row.labelKey) : row.label}
                          {row.why && <span className="muted" style={{ display: 'block', fontSize: 12, marginTop: 2, marginLeft: 20 }}>{row.whyKey ? t(row.whyKey, { unit: row.whyVars?.unit ?? '' }) : row.why}</span>}
                        </span>
                        <span className="set-v" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          <span className="sr-only">{t('verdict.rowMarks', { earned: row.earned, total: row.outOf })} </span>{row.earned}/{row.outOf}
                        </span>
                      </div>
                    ))}
                    <p style={{ marginTop: 8, fontSize: 13 }}>{(() => {
                      const line = marksSentenceKey(boardAward);
                      return line ? t(line.key, { awarded: line.vars.awarded, total: line.vars.total, count: line.vars.count, n: line.vars.n }) : null;
                    })()}</p>
                    <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>{t('verdict.boardStyleNote')}</p>
                  </div>
                )}
              </div>
              {diagnostic && <p className="muted" style={{ margin: '0 18px', fontSize: 12.5 }}>{t('placement.cardNote')}</p>}
              {/* Only legacy device-graded results may claim on-device marking.
                  Online grade receipts must not be mislabeled to the learner. */}
              {!serverAuthoritative && (
                <div className="eval-disclaimer" style={{ paddingBottom: attemptViaInk ? 4 : 12 }}>{t('verdict.markedOnDevice')}</div>
              )}
              {attemptViaInk && <div className="eval-provenance" data-provenance="handwriting" style={{ border: 0 }}>{t('verdict.readByAiMarkedByEngine')}</div>}
            </div>

            {!split && solutionBody && (verdictGood ? (
              <details className="solution-panel">
                <summary><Icon name="compare" size={16} />{t('verdict.anotherMethod')}</summary>
                {solutionBody}
              </details>
            ) : (
              <section className="solution-panel" aria-label={t('verdict.workedSolution')}>
                <div className="solution-panel-title">{t('verdict.workedSolution')}</div>
                {solutionBody}
              </section>
            ))}

            {!diagnostic && res.solution?.criteria && (
              <div className="criteria-self">
                <CriteriaTable
                  criteria={res.solution.criteria}
                  correct={verdictGood}
                  selfMarking={!serverAuthoritative && (!boardAward || selfOpen)}
                  selfMarks={selfMarks} setSelfMarks={setSelfMarks}
                  selfSaved={selfSaved} setSelfSaved={setSelfSaved}
                />
                {!serverAuthoritative && boardAward && !verdictGood && !selfSaved && !selfOpen && (
                  <button type="button" className="btn-disclose" style={{ marginTop: 8 }} onClick={() => setSelfOpen(true)}>
                    <Icon name="chevronDown" size={16} />{t('verdict.markItYourself')}
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* ── One obvious next move; everything else stays reachable and quiet ── */}
        <div className="ws-actions editor-foot no-print">
          <span className="status-line" data-state={statusState} role="status" aria-live="polite">
            {statusState !== 'idle' && <span className="dot" aria-hidden="true" />}
            {writeMode && shownAnswerLine && !needsCheck && !cloudPending && !(resolved && !boundLines)
              ? <span className="ws-answer-preview muted">{t('verdict.yourAnswerIs')} <MathText text={`$${texOf(shownAnswerLine)}$`} /></span>
              : statusText}
            {/* Handwriting is read only by the server reader (#316); say so where the work is submitted. */}
            {writeMode && !isMcq && (
              <span className="ws-read-by">{String(inkResult?.engine || '').startsWith('cloud') ? t('verdict.inkReadByServer') : t('verdict.inkReadByServerPending')}</span>
            )}
          </span>
          <div className="ws-actions-btns">
            {!resolved && diagnostic && (
              <button className="btn btn-quiet" onClick={dontKnow} disabled={busy}>{t('placement.dontKnow')}</button>
            )}
            {!resolved && !diagnostic && (
              <button className={`btn ${revealArmed ? 'btn-ghost' : 'btn-quiet'}`} onClick={reveal} disabled={busy} aria-live="polite">
                {revealArmed ? t('verdict.showSolutionConfirm') : t('verdict.showSolution')}
              </button>
            )}
            {resolved && !diagnostic && <button className="btn btn-quiet redo-chip" onClick={() => onRedo ? onRedo() : onNext?.()}>{t('verdict.redoQuestion')}</button>}
            {/* A placement answer is advanced by the placement page itself. */}
            {!(diagnostic && resolved) && (
              <button className="btn btn-primary" onClick={primary.run} disabled={primary.disabled} aria-busy={busy || undefined}>
                {primary.label}
              </button>
            )}
          </div>
        </div>
      </section>

      {peekOpen && (
        <>
          <button type="button" className="sheet-scrim" aria-label={t('nav.close')} onClick={() => setPeekOpen(false)} />
          <div className="sheet" role="dialog" aria-modal="true" aria-label={t('verdict.questionRegion')} ref={peekRef}>
            <MathText block text={question.prompt} />
            {figure && <div className="q-figure" dangerouslySetInnerHTML={{ __html: figure }} />}
            <div className="sheet-actions"><button className="btn btn-primary" onClick={() => setPeekOpen(false)}>{t('verdict.backToWork')}</button></div>
          </div>
        </>
      )}
    </div>
  );
}

function CriteriaTable({ criteria, correct, selfMarking = true, selfMarks, setSelfMarks, selfSaved, setSelfSaved }) {
  const t = useT();
  const marked = i => correct || !!selfMarks[i];
  const missed = i => selfSaved && !marked(i);
  const earned = i => (correct || selfSaved) && marked(i);
  return (
    <div>
      <table className="criteria-table">
        <thead>
          <tr><th style={{ width: '100%', textAlign: 'center' }}>{t('verdict.criteria')}</th><th>{t('verdict.marksColumn')}</th></tr>
        </thead>
        <tbody>
          {criteria.map((c, i) => (
            <tr key={i} className={missed(i) ? 'criteria-row-missed' : earned(i) ? 'criteria-row-earned' : ''}>
              <td>
                {!correct && !selfSaved && selfMarking ? (
                  <label className="selfmark-row" style={{ padding: 0 }}>
                    <input type="checkbox" checked={!!selfMarks[i]}
                      onChange={e => setSelfMarks(m => ({ ...m, [i]: e.target.checked }))} />
                    <span><MathText text={c.text} /></span>
                  </label>
                ) : (
                  <span><span className="crit-bullet">{missed(i) ? '→' : earned(i) ? '✓' : '•'}</span><MathText text={c.text} /></span>
                )}
              </td>
              <td className="cm">1</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!correct && (selfMarking || selfSaved) && (
        <div className="row" style={{ marginTop: 10 }}>
          {!selfSaved
            ? <>
              <span className="muted">{t('verdict.tickCriteria')}</span>
              <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setSelfSaved(true)}>{t('verdict.saveSelfMarking')}</button>
            </>
            : <span className="tag" style={{ color: 'var(--good)' }}>{t('verdict.selfMarkingRecorded', { earned: Object.values(selfMarks).filter(Boolean).length, total: criteria.length })}</span>}
        </div>
      )}
    </div>
  );
}

function StepReport({ report }) {
  const t = useT();
  if (!report?.lines?.length) return null;
  // The first meaningful break leads, with its diagnosis. Every other line is
  // one tap away rather than competing with it for attention.
  const first = report.lines.findIndex(l => l.status === 'break');
  const line = (l, i) => (
    <React.Fragment key={i}>
      <div className={`stepcheck-line sc-${l.status}`}>
        <span aria-hidden="true">{l.status === 'ok' ? '✓' : l.status === 'break' ? '✗' : '·'}</span>
        <span>{l.text}</span>
        {l.status === 'break' && <b style={{ fontFamily: 'var(--font)', fontSize: 12.5, whiteSpace: 'nowrap' }}>{t('verdict.mistakeIsHere')}</b>}
        {l.note && !l.diagnosis && <span style={{ fontFamily: 'var(--font)', fontWeight: 400, fontSize: 12.5 }}> — {l.note}</span>}
      </div>
      {l.diagnosis && <Diagnosis d={l.diagnosis} line={i + 1} />}
    </React.Fragment>
  );
  if (first < 0) {
    return (
      <div className="stepcheck">
        <div className="muted" style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{t('verdict.stepCheck')}</div>
        {report.lines.map(line)}
      </div>
    );
  }
  return (
    <div className="stepcheck">
      <div className="muted" style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{t('verdict.stepCheck')}</div>
      {line(report.lines[first], first)}
      {report.lines.length > 1 && (
        <details className="stepcheck-more">
          <summary>{t('verdict.showEveryLine', { count: report.lines.length, n: report.lines.length })}</summary>
          {report.lines.map((l, i) => (i === first ? null : line(l, i)))}
        </details>
      )}
    </div>
  );
}

/**
 * The mistake by name. Marking the line is where every other marker stops;
 * this card says which move was made, and the rule that move breaks — so the
 * student leaves with something to change rather than something to re-read.
 */
function Diagnosis({ d, line }) {
  // `t` was once read here without being declared, so the first diagnosis
  // card a student earned threw a ReferenceError instead of rendering.
  const t = useT();
  if (!d) return null;
  // A diagnosis the engine could pin to exactly one move is stated; one where
  // more than one move reproduces the line, or that rests on a counterexample
  // alone, is hedged — the student should weigh it, not obey it.
  const hedged = d.confidence !== 'high';
  // The misconception by its stable ontology name, in the student's language:
  // "Line 3: Sign not changed when a term crossed the =". The engine's own
  // sentence about this line's numbers stays underneath it.
  const named = misconceptionById(d.code);
  const nameLine = named && named.recordable && Number.isInteger(line)
    ? t(hedged ? 'verdict.possibleMisconception' : 'verdict.lineMisconception', { n: line, name: t(named.name) })
    : null;
  return (
    <div className="diagnosis-card" data-confidence={d.confidence || 'medium'} data-misconception={nameLine ? named.id : undefined}>
      <div className="diagnosis-label">{t(d.code === 'counterexample' ? 'verdict.whyItFails' : hedged ? 'verdict.thisLooksLike' : 'verdict.whatWentWrong')}</div>
      {nameLine
        ? <div className="diagnosis-title">{nameLine}</div>
        : <div className="diagnosis-title">{hedged && d.code !== 'counterexample' ? t('verdict.thisLooksLikeTitle', { title: d.title }) : d.title}</div>}
      <div className="diagnosis-body">{d.message}</div>
      {nameLine ? <div className="diagnosis-fix">{t(named.explain)}</div> : (d.fix && <div className="diagnosis-fix">{d.fix}</div>)}
    </div>
  );
}

function attachPhoto(e, setPhoto, onReady, onPdf, onFailed) {
  const f = e.target.files?.[0];
  if (!f) return;
  const failed = key => onFailed?.(translate(key));
  // A scanner app hands back a PDF, not a photo. FileReader can reject or
  // abort even after the picker succeeded (device eviction, file permissions).
  // Never strand the student indefinitely in the "Reading…" state.
  if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '')) {
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result || '');
      if (!data.startsWith('data:')) { failed('verdict.pdfUnopenable'); return; }
      onPdf?.(data);
    };
    reader.onerror = reader.onabort = () => failed('verdict.pdfUnopenable');
    try { reader.readAsDataURL(f); } catch { failed('verdict.pdfUnopenable'); }
    e.target.value = '';
    return;
  }
  const img = new Image();
  let url;
  try { url = URL.createObjectURL(f); }
  catch { failed('verdict.imageUnopenable'); e.target.value = ''; return; }
  const release = () => URL.revokeObjectURL(url);
  img.onload = () => {
    try {
      const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
      const context = cv.getContext('2d');
      if (!context) throw new Error('Canvas unavailable');
      context.drawImage(img, 0, 0, cv.width, cv.height);
      const dataURL = cv.toDataURL('image/jpeg', 0.88);
      if (!dataURL.startsWith('data:image/')) throw new Error('Image encoding failed');
      setPhoto(dataURL);
      onReady?.(dataURL);
    } catch {
      failed('verdict.imageUnopenable');
    } finally {
      release();
    }
  };
  img.onerror = () => {
    release();
    // A HEIC from an iPhone opened on Android may land here.
    failed('verdict.imageUnopenable');
  };
  try { img.src = url; }
  catch { release(); failed('verdict.imageUnopenable'); }
  e.target.value = '';
}

