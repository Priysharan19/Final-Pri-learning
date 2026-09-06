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
import { sanitizeFigure } from '../lib/sanitize.js';
import { clearDraft, queueDraft, readDraft } from './drafts.js';
import { nativePhotoAvailable, recognizePhoto } from '../native/photo.js';
import { cloudReadingEnabled, readPhotoWithCloud } from '../ink/cloudReader.js';
import { MAX_PDF_PAGES, renderPdfPages } from '../ink/pdfPage.js';
import PriPlot from './PriPlot.jsx';
import { plotSpecFor } from '../engine/plotSpec.js';
import { awardStepMarks, marksSentence } from '../engine/cbseMarking.js';
import { checkWorkingWithCloud, mergeVerdicts, shouldCheckWorking, workingNote } from '../ink/cloudWorking.js';
import { useT, useTx } from '../i18n/index.js';
import TermGloss from './TermGloss.jsx';

const DIFF_CLASS = { 1: 'tag-d1', 2: 'tag-d2', 3: 'tag-d3', 4: 'tag-d4' };
// Four ways of saying "right", picked by question id so one question always
// praises the same way. Keys, not literals: a Hindi profile gets four Hindi
// ways of saying it rather than the same English one four times over.
const PRAISE_KEYS = ['verdict.nailedIt', 'verdict.correct', 'verdict.beautifulWork', 'verdict.thatsIt'];
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
  return (window.matchMedia?.('(pointer: coarse)').matches ?? false) ? 'write' : 'type';
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
  if (typeof ink.minConf === 'number' && ink.minConf < CONFIRM_CONF) return { why: 'glyph', weakest };
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

export default function QuestionCard({ question, why, reason, reasonTag = null, onResolved, onNext, onRedo, compact = false }) {
  const { celebrate, refreshUser, refreshDue, refreshRecent, toast, user } = useApp();
  const t = useT();
  const tx = useTx();
  const [answer, setAnswer] = useState('');
  const [mcqSel, setMcqSel] = useState(null);
  const [mode, setMode] = useState(preferMode());       // 'type' | 'write' | 'photo'
  const [inkResult, setInkResult] = useState(null);
  const [hints, setHints] = useState([]);
  const [hintsLeft, setHintsLeft] = useState(question.hintsAvailable);
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
  const [photo, setPhoto] = useState(null);
  const [photoOCR, setPhotoOCR] = useState({ phase: 'idle', text: '', confidence: 0, error: '', engine: null });
  const [elapsed, setElapsed] = useState(0);
  const [inkPhase, setInkPhase] = useState(() => (inkModule ? 'ready' : 'idle'));   // idle | loading | ready | failed
  const [inkTry, setInkTry] = useState(0);
  const [toTex, setToTex] = useState(() => latexFn);
  const [checking, setChecking] = useState(false);
  const [vouched, setVouched] = useState(null);     // the exact reading the student stood behind
  const startRef = useRef(Date.now());
  const inputRef = useRef(null);
  const scribbleRef = useRef(null);
  const photoInputRef = useRef(null);

  useEffect(() => {
    const draft = readDraft('question', question.id);
    setAnswer(draft?.typed || ''); setMcqSel(null); setInkResult(null); setHints([]); setHintsLeft(question.hintsAvailable);
    setWorking(draft?.working || ''); setShowWorking(!!draft?.working);
    setState({ phase: 'answering' }); setBusy(false);
    setSelfMarks({}); setSelfSaved(false); setPhoto(null); setBookmarked(false); setElapsed(0);
    setPhotoOCR({ phase: 'idle', text: '', confidence: 0, error: '', engine: null });
    setChecking(false); setVouched(null);
    startRef.current = Date.now();
    if (mode === 'type') setTimeout(() => inputRef.current?.focus(), 60);
  }, [question.id]); // eslint-disable-line

  const resolved = state.phase === 'resolved';
  const res = state.res;

  useEffect(() => {
    if (resolved) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [resolved, question.id]);

  const isMcq = question.answerType === 'mcq';
  const isWorking = question.answerType === 'working';
  const totalMarks = question.criteria?.length || 1;
  const hintsUsed = hints.length;
  const credit = Math.max(0.55, 1 - 0.15 * hintsUsed);
  const writeMode = mode === 'write';
  const recognitionContext = useMemo(
    () => recognitionContextForQuestion(question),
    [question.answerType]
  );


  // A photo of paper working is read by whichever reader is actually good at
  // it. The server reader first where the student has turned it on, because
  // Apple Vision was built for printed text and a page of algebra is not that;
  // then Vision, which needs no network and no account; then nothing, said
  // plainly. Whatever reads it, the text lands in an editable box and is never
  // submitted on the reader's word alone.
  /**
   * Read one image of working with whichever reader is actually good at it:
   * the server reader where the student has switched it on, then Apple Vision,
   * which needs no network and no account. Returns null when neither could.
   */
  const readOnePage = useCallback(async (dataURL) => {
    const lastLine = t => String(t || '').split(/\n+/).map(x => x.trim()).filter(Boolean).at(-1) || '';
    if (cloudReadingEnabled(user)) {
      const outcome = await readPhotoWithCloud(dataURL, { user });
      if (outcome && !outcome.error && !outcome.reason) {
        const text = String(outcome.transcription.text || '').trim();
        if (text) return { text, markable: lastLine(text), confidence: outcome.transcription.confidence, engine: outcome.transcription.engine };
      }
    }
    if (!nativePhotoAvailable()) return null;
    try {
      const result = await recognizePhoto(dataURL);
      const text = String(result?.text || '').trim();
      const markable = String(result?.answer || '').trim() || lastLine(text);
      if (!text && !markable) return null;
      return { text, markable, confidence: result?.confidence, engine: result?.engine || 'apple-vision-photo-v1' };
    } catch { return null; }
  }, [user]);

  const decodePhoto = useCallback(async (dataURL) => {
    if (!dataURL) return;
    if (!cloudReadingEnabled(user) && !nativePhotoAvailable()) {
      setPhotoOCR({
        phase: 'unavailable', text: '', confidence: 0, engine: null,
        error: 'Reading photos is not available here. Turn on server reading in Settings, or type your working instead.'
      });
      return;
    }
    setPhotoOCR({ phase: 'reading', text: '', confidence: 0, error: '', engine: null });
    const page = await readOnePage(dataURL);
    if (!page) {
      setPhotoOCR({
        phase: 'failed', text: '', confidence: 0, engine: null,
        error: 'That photo could not be read. Try a straighter, better-lit shot, or type your working.'
      });
      return;
    }
    if (isWorking && page.text) { setWorking(page.text); setShowWorking(true); }
    if (page.markable) setAnswer(page.markable);
    setPhotoOCR({ phase: 'done', text: page.text, confidence: Number(page.confidence || 0), error: '', engine: page.engine });
  }, [isWorking, user, readOnePage]);

  // A scanned PDF becomes pages, and the pages become the same thing a photo
  // already is. More than one page of working is joined in order, because a
  // student who scanned two sides of a page wrote one solution across them.
  const decodePdf = useCallback(async (dataURL) => {
    if (!dataURL) return;
    setPhotoOCR({ phase: 'reading', text: '', confidence: 0, error: '', engine: null });
    let result = { pages: [], reason: 'unreadable' };
    try { result = await renderPdfPages(dataURL); } catch { /* reported below */ }
    const pages = result.pages || [];
    if (!pages.length) {
      setPhotoOCR({
        phase: 'failed', text: '', confidence: 0, engine: null,
        error: result.reason === 'renderer-unavailable'
          ? 'Reading PDFs needs a one-off download that has not happened on this device yet. Connect to the internet once and try again, or photograph the page instead — photos work offline.'
          : 'That PDF could not be opened. If it is password-protected or was made by a scanner that locks it, photograph the page instead.'
      });
      return;
    }
    setPhoto(pages[0].dataUrl);
    if (pages.length === 1) { decodePhoto(pages[0].dataUrl); return; }

    const texts = [];
    let worst = 1;
    let engine = null;
    let unread = 0;
    for (const page of pages) {
      // The same ladder decodePhoto uses. Reading each page with the server
      // reader alone meant a student who had not switched it on saw "nothing
      // could be read" on a device that could have read it perfectly well.
      const page1 = await readOnePage(page.dataUrl);
      if (!page1) { unread += 1; continue; }
      if (page1.text) texts.push(page1.text);
      worst = Math.min(worst, Number(page1.confidence || 0));
      engine = page1.engine || engine;
    }
    if (!texts.length) {
      setPhotoOCR({
        phase: 'failed', text: '', confidence: 0, engine: null,
        error: 'Nothing could be read from that PDF. Try photographing the page instead.'
      });
      return;
    }
    if (unread > 0) {
      // Presenting two of three pages as the whole of the working would submit
      // an answer the student never wrote.
      toast(<span>{unread} of {pages.length} pages could not be read — check the working below before marking.</span>);
    }
    const joined = texts.join('\n');
    if (isWorking) { setWorking(joined); setShowWorking(true); }
    const last = joined.split(/\n+/).map(x => x.trim()).filter(Boolean).at(-1) || '';
    if (last) setAnswer(last);
    setPhotoOCR({ phase: 'done', text: joined, confidence: worst, error: '', engine: engine || 'cloud-pdf' });
  }, [decodePhoto, isWorking, user]);

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
      const reader = new FileReader();
      reader.onload = () => {
        const dataURL = String(reader.result || '');
        if (!dataURL.startsWith('data:image/')) return;
        setPhoto(dataURL);
        decodePhoto(dataURL);
      };
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
    if (!String(typed).trim() && !String(wk).trim()) { clearDraft('question', question.id); return; }
    queueDraft('question', question.id, { typed, working: wk }, {
      label: question.subtopicName, note: 'Answer in progress', path: '/practice'
    });
  };
  const editAnswer = (v) => { setAnswer(v); stash(v, working); };
  const editWorking = (v) => { setWorking(v); stash(answer, v); };

  useEffect(() => { if (resolved) clearDraft('question', question.id); }, [resolved, question.id]);

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
      return 'That doesn’t quite come out as finished maths, so a symbol may have come through wrong. Tap any symbol below to change it.';
    }
    // Name a runner-up only when it is genuinely close and genuinely different:
    // offering "1 or l?" on a number is a question with no useful answer.
    const w = doubt.weakest;
    const rival = w?.rival || w?.alts?.find(a => a.sym !== w.sym) || null;
    const contested = rival && rival.conf >= w.conf - CONFIRM_MARGIN;
    if (w && contested) return `I read one symbol as “${nice(w.sym)}”, but “${nice(rival.sym)}” was close behind. Tap the right one below.`;
    if (w) return `One symbol was a close call — I read it as “${nice(w.sym)}”. Tap it below if that isn’t it.`;
    return 'One symbol was a close call. Tap it below if I read it wrong.';
  }, [doubt]);

  const flipMode = (m) => {
    setMode(m);
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
    if (busy || resolved) return;
    if (needsCheck && vouchedNow !== reading) { setChecking(true); return; }
    let given, steps, viaInk = false, ink;
    if (isMcq) {
      given = mcqSel;
      if (given === null) return;
    } else if (isWorking) {
      if (writeMode) {
        if (!inkResult?.lines?.length) return;
        given = inkResult.lines.join('\n');
        viaInk = true;
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
      ink = { strokes: compactInkStrokes(inkResult.strokes), recognized: inkResult.text, engine: inkResult.engine || null };
    } else {
      given = answer;
      if (String(given).trim() === '') return;
      steps = (showWorking || mode === 'photo') && working.trim() ? working : undefined;
    }
    setBusy(true);
    try {
      const scribbleStrokes = scribbleRef.current && !scribbleRef.current.isEmpty()
        ? compactInkStrokes(scribbleRef.current.getStrokes())
        : undefined;
      const r = await api.post(`/practice/${question.id}/submit`, {
        answer: String(given), ms: Date.now() - startRef.current, steps, viaInk, ink, photo, scribble: scribbleStrokes
      });
      if (r.resolved) {
        setState({ phase: 'resolved', res: r });
        celebrate(r); refreshUser(); refreshDue(); refreshRecent?.();
        toast(<div><b>{t('verdict.outcomeUpdated')}</b><div className="badge-desc">{t('verdict.outcomeBasis', { topic: question.subtopicName })}</div></div>, 4200);
        onResolved?.(r);
      } else {
        setState({ phase: 'retry', res: r });
      }
    } catch (e) {
      setState({ phase: 'retry', res: { feedback: e.message, invalid: true } });
    } finally { setBusy(false); }
  }

  async function getHint() {
    if (hintsLeft <= 0 || resolved) return;
    try {
      const r = await api.post(`/practice/${question.id}/hint`, {});
      setHints(h => [...h, r.hint]);
      setHintsLeft(r.remaining);
    } catch { }
  }

  async function reveal() {
    if (busy || resolved) return;
    setBusy(true);
    try {
      const r = await api.post(`/practice/${question.id}/reveal`, { ms: Date.now() - startRef.current });
      setState({ phase: 'resolved', res: r });
      celebrate(r); refreshUser(); refreshDue(); refreshRecent?.();
      onResolved?.(r);
    } finally { setBusy(false); }
  }

  async function toggleBookmark() {
    try {
      const r = await api.post(`/history/${question.id}/bookmark`, {});
      setBookmarked(r.bookmarked);
      toast(r.bookmarked ? 'Saved to Favorites' : 'Removed from Favorites', 2200);
    } catch { toast('Answer the question first, then favorite it from History.', 3200); }
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
  const [cloudCheck, setCloudCheck] = useState(null);
  const cloudCheckRef = useRef(null);
  useEffect(() => { setCloudCheck(null); }, [question?.id]);
  useEffect(() => {
    if (!writeMode || !resolved) return;
    const lines = inkResult?.lines || [];
    if (!shouldCheckWorking({
      correct: res?.correct, invalid: res?.invalid, revealed: res?.revealed,
      lines, localReport: activeReport
    })) return;

    const key = `${question?.id}:${lines.join('|')}`;
    if (cloudCheckRef.current === key) return;              // already asked for this page
    cloudCheckRef.current = key;

    let live = true;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    checkWorkingWithCloud(lines, {
      user,
      prompt: question?.prompt || '',
      signal: controller?.signal
    }).then(result => { if (live && result && !result.error) setCloudCheck(result); })
      .catch(() => { });
    return () => { live = false; controller?.abort?.(); };
  }, [writeMode, resolved, res?.correct, res?.invalid, res?.revealed, inkResult, activeReport, user, question?.id, question?.prompt]);

  const lineVerdicts = useMemo(
    () => mergeVerdicts(localLineVerdicts, cloudCheck, { lineCount: inkResult?.lines?.length || 0 }),
    [localLineVerdicts, cloudCheck, inkResult]
  );
  const cloudWorkingNote = useMemo(() => workingNote(cloudCheck), [cloudCheck]);

  // ── The board's own arithmetic ─────────────────────────────────────────────
  // CBSE marks per step: formula, substitution, final answer with units. A
  // student whose method is sound and whose arithmetic slipped keeps most of
  // the marks, and a student who wrote only the answer forfeits the rest. Every
  // Indian student is told this and almost none get to practise it, because the
  // teacher who would read their working has twenty-six other children.
  const boardAward = useMemo(() => {
    if (!resolved || res?.invalid || res?.revealed) return null;
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
          text: v.note || (i === 0 ? 'A valid starting point.' : 'Checks out — follows correctly from the line above.')
        });
      } else if (v.status === 'break' || v.status === 'wrong') {
        cards.push({ kind: 'bad', line: i + 1, text: v.note || 'The maths breaks on this line.' });
      }
    });
    return cards.length ? cards : null;
  }, [writeMode, lineVerdicts, inkResult]);
  const canSubmit = isMcq ? mcqSel !== null : isWorking ? (writeMode ? !!inkResult?.lines?.length : !!working.trim()) : writeMode ? !!inkResult?.answerLine : !!answer.trim();

  const earnedMarks = resolved
    ? (verdictGood ? totalMarks : (selfSaved ? Object.values(selfMarks).filter(Boolean).length : 0))
    : 0;
  const shownMarks = Math.round(earnedMarks * credit * 10) / 10;
  const pct = totalMarks ? Math.round(100 * shownMarks / totalMarks) : 0;

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

  return (
    <div className="qpage">
      {/* left action rail */}
      <div className="q-rail no-print">
        <button className={`q-rail-btn ${bookmarked ? 'on' : ''}`} title={t('verdict.favorite')} aria-label={t('verdict.favoriteThis')} aria-pressed={bookmarked} onClick={toggleBookmark}>☆</button>
        <button className={`q-rail-btn ${showWhy ? 'on' : ''}`} title={t('verdict.whyThis')} aria-label={t('verdict.whyThis')} aria-pressed={showWhy} onClick={() => setShowWhy(s => !s)}>ⓘ</button>
        <button className={`q-rail-btn ${showScribble ? 'on' : ''}`} title={t('verdict.scribblePad')} aria-label={t('verdict.scribblePad')} aria-pressed={showScribble} onClick={() => setShowScribble(s => !s)}>✎</button>
      </div>

      {/* hint bulbs */}
      {!isMcq && question.hintsAvailable > 0 && (
        <div className="hint-rail no-print">
          {Array.from({ length: question.hintsAvailable }, (_, i) => (
            <button key={i} className={`hint-bulb ${i < hintsUsed ? 'lit' : ''}`}
              disabled={resolved || i !== hintsUsed}
              title={t('verdict.hintTitle', { n: i + 1 })}
              aria-label={t('verdict.hintLabel', { n: i + 1, total: question.hintsAvailable })}
              onClick={getHint}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M9.5 18h5M10 21h4M12 3a6 6 0 0 0-3.4 10.9c.7.5 1.1 1.2 1.2 2.1h4.4c.1-.9.5-1.6 1.2-2.1A6 6 0 0 0 12 3Z" /></svg>
              <sup>{i + 1}</sup>
            </button>
          ))}
        </div>
      )}

      <div className="q-topmeta">
        <span>{t('verdict.marksAvailable', { count: totalMarks, n: totalMarks })}</span>
        {hintsUsed > 0 && !resolved && (
          <span className="q-credit"><span className="dot">•</span> {t('verdict.creditAvailable', { percent: Math.round(credit * 100), marks: Math.round(totalMarks * credit * 10) / 10 })} <span className="dot">•</span></span>
        )}
        {/* The topic chip is where a student meets the name of what they are
            being asked, so it is the first place worth pairing. The question
            itself below is untouched: it will be in English in the exam hall. */}
        <span className="tag"><TermGloss text={question.subtopicName} /></span>
        <span className={`tag ${DIFF_CLASS[question.difficulty] || ''}`}>{question.diffLabel}</span>
        {reasonTag && REASON_TAG_KEY[reasonTag] && <span className="tag tag-brand" data-reason-tag={reasonTag}>{t(REASON_TAG_KEY[reasonTag])}</span>}
        {!reasonTag && reason === 'review' && <span className="tag tag-brand">{t('verdict.spacedReview')}</span>}
        {!reasonTag && reason === 'weak-spot' && <span className="tag tag-brand">{t('verdict.weakSpot')}</span>}
        {!reasonTag && reason === 'new-ground' && <span className="tag tag-brand">{t('verdict.newGround')}</span>}
        {reason === 'task' && <span className="tag tag-brand">{t('verdict.task')}</span>}
        <span className="q-timer">◷ {fmtTime(elapsed)}</span>
      </div>

      {showWhy && why && <p className="muted" style={{ marginBottom: 12 }}>{why}</p>}

      <MathText block className="q-prompt" text={question.prompt} />
      {figure && <div className="q-figure" dangerouslySetInnerHTML={{ __html: figure }} />}

      {resolved && (
        <div className="row no-print" style={{ margin: '14px 0 2px' }}>
          <button className="redo-chip" onClick={() => onRedo ? onRedo() : onNext?.()}>{t('verdict.redoQuestion')}</button>
        </div>
      )}

      {/* ── answering surface ── */}
      {isMcq ? (
        <div className="mcq">
          {question.mcqOptions.map((opt, i) => {
            let cls = 'mcq-opt';
            if (!resolved && mcqSel === i) cls += ' sel';
            if (resolved) {
              if (opt === res.solution?.answerText) cls += ' right';
              else if (mcqSel === i && !res.correct) cls += ' wrong';
            }
            return (
              <button key={i} className={cls} disabled={resolved} onClick={() => setMcqSel(i)}>
                <span className="mcq-key">{'ABCD'[i]}</span>
                <MathText text={opt} />
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <div className="mode-tabs no-print">
            <button className={`mode-tab ${mode === 'type' ? 'on' : ''}`} title={t('verdict.modeTypeTitle')}
              aria-label={t('verdict.modeTypeLabel')} onClick={() => flipMode('type')}>{t('verdict.modeTypeGlyph')}</button>
            <button className={`mode-tab ${mode === 'write' ? 'on' : ''}`} title={t('verdict.modeWriteTitle')}
              aria-label={t('verdict.modeWriteLabel')} onClick={() => flipMode('write')}>✎</button>
            <button className={`mode-tab ${mode === 'photo' ? 'on' : ''}`} title={t('verdict.modePhotoTitle')}
              aria-label={t('verdict.modePhotoLabel')} onClick={() => flipMode('photo')}>▣</button>
          </div>

          {mode !== 'write' ? (
            <div className={`editor-shell ${resolved ? 'ink-disabled' : ''}`}>
              <div className="editor-toolbar">
                <button className={`editor-tool ${showSyms ? 'on' : ''}`} title={t('verdict.symbolPalette')} aria-label={t('verdict.symbolPalette')} aria-pressed={showSyms} onClick={() => setShowSyms(s => !s)}>Σ</button>
                <span className="editor-hint"><span className="kbd">{isWorking ? '⏎' : t('verdict.kbdType')}</span> {t(isWorking ? 'verdict.editorHintWorking' : 'verdict.editorHintType')}</span>
                <span style={{ flex: 1 }} />
                {question.answerSuffix && <span className="answer-suffix">{t('verdict.answerIn', { unit: question.answerSuffix })}</span>}
              </div>
              {showSyms && (
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
                      onChange={e => attachPhoto(e, setPhoto, decodePhoto, decodePdf, message => setPhotoOCR({ phase: 'failed', text: '', confidence: 0, engine: null, error: message }))} />
                    {!photo && photoOCR.phase === 'idle'
                      ? <button className="btn btn-ghost" onClick={() => photoInputRef.current?.click()}>{t('verdict.photographWorking')}<span className="muted" style={{ display: 'block', fontSize: 11.5, marginTop: 2, fontWeight: 400 }}>{t('verdict.photoFormats', { pages: MAX_PDF_PAGES })}</span></button>
                      : (
                        <div className="photo-attach">
                          {/* A PDF sets no thumbnail until its pages render, and the whole
                              status block used to live inside the photo branch — so every
                              PDF failure message was unreachable and the screen simply did
                              not move. */}
                          {photo
                            ? <div className="photo-thumb"><img src={photo} alt={t('history.paperWorking')} /><button aria-label={t('verdict.removePhoto')} onClick={() => { setPhoto(null); setPhotoOCR({ phase: 'idle', text: '', confidence: 0, error: '', engine: null }); }}>✕</button></div>
                            : <div className="photo-thumb" aria-hidden="true" style={{ display: 'grid', placeItems: 'center', fontSize: 22 }}>▤<button aria-label={t('verdict.removeAttachment')} onClick={() => setPhotoOCR({ phase: 'idle', text: '', confidence: 0, error: '', engine: null })}>✕</button></div>}
                          <div style={{ flex: 1 }}>
                            {photoOCR.phase === 'reading' && (
                              <span className="muted">{cloudReadingEnabled(user) ? t('verdict.readingWork') : t('verdict.readingWithVision')}</span>
                            )}
                            {photoOCR.phase === 'done' && (
                              <>
                                {/* What actually read it. Saying "on-device" over a photo that
                                    was uploaded is the one thing this screen must never do. */}
                                <div style={{ fontSize: 12.5, marginBottom: 6 }}>
                                  <b>{String(photoOCR.engine || '').startsWith('cloud') ? t('verdict.readOnServer') : t('verdict.decodedOnDevice')}</b>
                                  {photoOCR.confidence ? t('verdict.ocrConfidence', { percent: Math.round(photoOCR.confidence * 100) }) : ''}
                                </div>
                                <pre style={{ whiteSpace: 'pre-wrap', margin: 0, font: 'inherit', color: 'var(--ink)' }}>{photoOCR.text}</pre>
                                <div className="muted" style={{ marginTop: 6 }}>{t('verdict.filledFromLastLine')}</div>
                              </>
                            )}
                            {(photoOCR.phase === 'failed' || photoOCR.phase === 'unavailable') && <span style={{ color: 'var(--warn)' }}>{photoOCR.error}</span>}
                            {photoOCR.phase === 'idle' && <span className="muted">{t('verdict.photoAttachedIdle')}</span>}
                          </div>
                        </div>
                      )}
                  </div>
                )}
                {isWorking ? (
                  <textarea
                    ref={inputRef}
                    className="working-input"
                    aria-label={t('verdict.workingAria')}
                    style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--ink)' }}
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
                    />
                    {question.answerSuffix && <span className="answer-suffix">{question.answerSuffix}</span>}
                  </div>
                )}
                {typedPreview && !resolved && !isWorking && (
                  <div className="typed-preview">{t('verdict.readsAs')}&nbsp; <MathText text={`$${typedPreview}$`} /></div>
                )}
                {question.supportsSteps && !resolved && !isWorking && mode === 'type' && (
                  <div style={{ marginTop: 14 }}>
                    <button className="btn btn-quiet btn-sm" onClick={() => setShowWorking(s => !s)}>
                      {showWorking ? '⌄' : '›'} {t('verdict.showWorkingToggle')}
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
              <div className="editor-foot no-print">
                <span className="editor-brand">{t('verdict.inkEngine')}</span>
                <span style={{ flex: 1 }} />
                {!resolved && (
                  <button className={`btn btn-primary ${canSubmit ? 'btn-glow' : ''}`} onClick={() => submit()} disabled={busy || !canSubmit}>
                    {t(busy ? 'verdict.marking' : 'verdict.submit')}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="ink-row">
              <div className="editor-shell" style={{ flex: 1, minWidth: 0 }}>
                {InkAnswer && (
                  <InkAnswer onRecognized={setInkResult} height={380} lineVerdicts={lineVerdicts}
                    disabled={resolved} focusSymbol={checkFocus} recognitionContext={recognitionContext} />
                )}
                {inkPhase === 'failed' && (
                  <div className="editor-body">
                    <div className="error-box" role="alert" style={{ marginBottom: 0 }}>
                      {/* Three outcomes, not two. "You are offline and this needs one
                          download" is a different thing from "it would not load", and
                          only one of them is the student's to act on. */}
                      {inkNeedsNetwork ? (
                        <><b>{t('verdict.inkNeedsDownloadTitle')}</b>{' '}{t('verdict.inkNeedsDownloadBody')}</>
                      ) : (
                        <><b>{t('verdict.inkFailedTitle')}</b>{' '}{t(inkStuck ? 'verdict.inkFailedStuck' : 'verdict.inkFailedRetry')}</>
                      )}
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
                    <div className="skeleton" style={{ height: 380 }} />
                    <p className="muted" role="status" style={{ marginTop: 10 }}>{t('verdict.warmingUp')}</p>
                  </div>
                )}
                {needsCheck && checking && (
                  <div className="editor-body" role="status"
                    style={{ borderTop: '1px solid var(--hairline)', background: 'var(--brand-soft)' }}>
                    <div className="spread" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                      <div>
                        <b>{t('verdict.checkReadingFirst')}</b>
                        <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{checkCopy}</div>
                        <div style={{ marginTop: 6 }}>
                          {t('verdict.readingItAs')}&nbsp;<MathText text={`$${texOf(reading)}$`} />
                        </div>
                      </div>
                      <div className="row" style={{ gap: 8 }}>
                        <button className="btn btn-primary btn-sm" onClick={acceptReading} disabled={busy}>
                          {t('verdict.thatsWhatIWrote')}
                        </button>
                        <button className="btn btn-quiet btn-sm" onClick={() => setChecking(false)}>{t('verdict.keepWriting')}</button>
                      </div>
                    </div>
                  </div>
                )}
                {InkAnswer && (
                  <div className="editor-foot no-print">
                    <span className="editor-brand">{t('verdict.inkEngineOnDevice')}</span>
                    <span style={{ flex: 1 }} />
                    {inkResult?.answerLine && !needsCheck && (
                      <span className="muted" style={{ marginRight: 10 }}>
                        {t('verdict.submitting')} <MathText text={`$${texOf(isWorking ? inkResult.lines[inkResult.lines.length - 1] : inkResult.answerLine)}$`} />
                      </span>
                    )}
                    {!resolved && (
                      <button
                        className={`btn ${needsCheck ? 'btn-ghost' : `btn-primary ${canSubmit ? 'btn-glow' : ''}`}`}
                        onClick={() => submit()} disabled={busy || !canSubmit}>
                        {t(busy ? 'verdict.marking' : needsCheck ? 'verdict.checkReadingFirst' : 'verdict.submit')}
                      </button>
                    )}
                  </div>
                )}
              </div>
              {inkComments && (
                <aside className="ink-comments">
                  <div className="spread">
                    <span className="sc-label" style={{ margin: 0 }}>{t('verdict.comments')}</span>
                    <span className="muted" style={{ fontSize: 11.5 }}>{t('verdict.commentsOnPage', { count: inkComments.length, n: inkComments.length })}</span>
                  </div>
                  {inkComments.map((c, i) => (
                    <div key={i} className={`ink-comment ${c.kind}`}>
                      <div className="ic-head">{t(c.kind === 'good' ? 'app.correct' : 'verdict.mistake')}<span className="ic-line">{t('verdict.onLine', { n: c.line })}</span></div>
                      {c.text}
                    </div>
                  ))}
                  {cloudWorkingNote && (
                    <div className={`ink-comment ${cloudWorkingNote.tone === 'break' ? 'bad' : 'note'}`}>
                      <div className="ic-head">
                        {t(cloudWorkingNote.tone === 'break' ? 'verdict.whereItBreaks' : cloudWorkingNote.tone === 'maybe' ? 'verdict.possibly' : 'verdict.yourAlgebra')}
                      </div>
                      {cloudWorkingNote.text}
                    </div>
                  )}
                </aside>
              )}
            </div>
          )}
        </>
      )}

      <div style={SR_ONLY} role="status" aria-live="polite" aria-atomic="true">{verdictSpeech}</div>

      {/* scribble pad */}
      {showScribble && !resolved && (
        <div className="editor-shell" style={{ marginTop: 12 }}>
          <div className="editor-toolbar">
            <span className="editor-hint">{t('verdict.scribbleRough')}</span>
            <span style={{ flex: 1 }} />
            <button className="editor-tool" aria-label={t('verdict.undoScribble')} onClick={() => scribbleRef.current?.undo()}>↩</button>
            <button className="editor-tool" aria-label={t('verdict.clearScribble')} onClick={() => scribbleRef.current?.clear()}>🗑</button>
          </div>
          <InkCanvas ref={scribbleRef} height={200} guides={false} ariaLabel={t('verdict.scribblePad')} />
        </div>
      )}

      {/* hints shown */}
      {hints.length > 0 && (
        <div className="hints-block">
          <div className="hints-block-title">{t('verdict.hints')}</div>
          {hints.map((h, i) => (
            <div className="hintbox" key={i}><span className="h-n">{t('verdict.hintNumber', { n: i + 1 })}</span><MathText text={h} /></div>
          ))}
        </div>
      )}

      {/* retry */}
      {state.phase === 'retry' && (
        <div className="verdict verdict-bad">
          <span className="verdict-ico">{state.res.invalid ? '?' : '✗'}</span>
          <div>
            <b>{t(state.res.invalid ? 'verdict.unreadable' : 'verdict.notQuite')}</b>{' '}
            <MathText text={state.res.feedback || t('verdict.oneMoreGo')} />
            {state.res.partial && <div className="muted" style={{ marginTop: 6, fontSize: 13.5 }}>◐ {state.res.partial.note}</div>}
            {state.res.stepReport && <StepReport report={state.res.stepReport} />}
          </div>
        </div>
      )}

      {/* ── evaluation ── */}
      {resolved && (
        <>
          {answerLines.length > 0 && (
            <div className="your-answer">
              <div className="sc-label">{t('verdict.yourAnswer')}</div>
              {answerLines.map((l, i) => (
                <div className="ya-line" key={i}><MathText text={`$${texOf(l)}$`} /></div>
              ))}
              {photo && <div className="photo-thumb" style={{ marginTop: 8 }}><img src={photo} alt={t('verdict.attachedWorking')} /></div>}
            </div>
          )}

          <div className="eval-card">
            <div className="eval-head">
              <span className="logo-bb">P</span><span className="eval-title">ri Learning. <span style={{ color: 'var(--ink-2)' }}>{t('verdict.evaluation')}</span></span>
              <span className="eval-marks">
                {t('verdict.marksOutOf', { earned: verdictGood ? shownMarks : earnedMarks, total: totalMarks })}
                {' '}<small>({verdictGood ? pct : (selfSaved ? Math.round(100 * earnedMarks / totalMarks) : 0)}%)</small>
              </span>
            </div>
            <div className="eval-disclaimer">{t('verdict.markedOnDevice')}</div>
            <div className="eval-body">
              <div className="spread">
                <b>{verdictGood
                  ? t(PRAISE_KEYS[question.id.charCodeAt(0) % PRAISE_KEYS.length])
                  : t(res.revealed ? 'verdict.revealed' : 'verdict.notThisTime')}</b>
                <span>
                  {res.xp > 0 && <span className="xp-pop">+{res.xp} XP</span>}
                  {hintsUsed > 0 && <span className="muted" style={{ marginLeft: 8 }}>{t('verdict.afterHints', { count: hintsUsed, n: hintsUsed })}</span>}
                </span>
              </div>
              {res.feedback && !verdictGood && <div style={{ marginTop: 6 }}><b>{t('verdict.reasoning')}</b> <MathText text={res.feedback} /></div>}
              {res.partial && !verdictGood && <div className="muted" style={{ marginTop: 6, fontSize: 13.5 }}>◐ {res.partial.note}</div>}
              {boardAward && (
                <div className="board-award" style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line, rgba(128,128,128,.22))' }}>
                  <div className="spread" style={{ alignItems: 'baseline' }}>
                    <span className="sc-label" style={{ margin: 0 }}>Marked step by step</span>
                    <b style={{ fontVariantNumeric: 'tabular-nums' }}>{boardAward.awarded} / {boardAward.total}</b>
                  </div>
                  {boardAward.rows.map((row, i) => (
                    <div key={i} className="set-row" style={{ paddingTop: 5, paddingBottom: 5 }}>
                      <span className="set-k" style={{ fontWeight: 400 }}>
                        <span aria-hidden="true" style={{ marginRight: 7, color: row.earned === row.outOf ? 'var(--good, #1a8f4c)' : 'var(--bad, #c0392b)' }}>
                          {row.earned === row.outOf ? '✓' : '✗'}
                        </span>
                        {row.label}
                        {row.why && <span className="muted" style={{ display: 'block', fontSize: 11.5, marginTop: 2, marginLeft: 20 }}>{row.why}</span>}
                      </span>
                      <span className="set-v" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        <span className="sr-only">{row.earned} of {row.outOf} marks. </span>{row.earned}/{row.outOf}
                      </span>
                    </div>
                  ))}
                  <p style={{ marginTop: 8, fontSize: 13 }}>{marksSentence(boardAward)}</p>
                  <p className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>
                    Board-style step marking, worked out from this question's own solution. It follows the convention CBSE
                    publishes; it is not CBSE's official marking scheme for a past paper.
                  </p>
                </div>
              )}
              {verdictGood && writeMode && inkResult?.lines?.length > 1 && (
                <div style={{ marginTop: 6 }}><b>{t('verdict.reasoning')}</b> {t('verdict.everyLineChecked', { count: inkResult.lines.length, n: inkResult.lines.length })}</div>
              )}
              {!verdictGood && res.solution && (
                <div style={{ marginTop: 4 }}>{t('verdict.expected')} <b><MathText text={res.solution.answerText} /></b></div>
              )}
              {res.stepReport && <StepReport report={res.stepReport} />}
              <div className="row" style={{ marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
                <span className="tag">{t('verdict.mastery', { n: res.mastery })}</span>
                <span className="tag" style={{ color: res.ratingDelta >= 0 ? 'var(--good)' : 'var(--bad)' }}>
                  {t(res.ratingDelta >= 0 ? 'verdict.skillUp' : 'verdict.skillDown', { n: Math.abs(res.ratingDelta) })}
                </span>
                {res.predicted && <span className="tag">{t('verdict.predictedMark', { mark: res.predicted.mark })}</span>}
              </div>
            </div>

            {res.solution?.steps && (
              <div className="solution-block">
                <div className="sc-label" style={{ margin: '12px 0' }}>{t('verdict.workedSolution')}</div>
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
            )}
          </div>

          {res.solution?.criteria && (
            <CriteriaTable
              criteria={res.solution.criteria}
              correct={verdictGood}
              selfMarks={selfMarks} setSelfMarks={setSelfMarks}
              selfSaved={selfSaved} setSelfSaved={setSelfSaved}
            />
          )}
        </>
      )}

      {/* actions */}
      {!resolved && (
        <div className="row no-print" style={{ marginTop: 18, flexWrap: 'wrap' }}>
          {isMcq && (
            <button className={`btn btn-primary ${canSubmit ? 'btn-glow' : ''}`} onClick={() => submit()} disabled={busy || !canSubmit}>
              {t(busy ? 'verdict.marking' : 'verdict.submit')}
            </button>
          )}
          <button className="btn btn-quiet" onClick={reveal} disabled={busy}>{t('verdict.showSolution')}</button>
          {!writeMode && !isMcq && <span className="muted" style={{ marginLeft: 'auto' }}>{tx('verdict.pressEnter', { key: <span className="kbd">{t('verdict.enterKey')}</span> })}</span>}
        </div>
      )}
    </div>
  );
}

function CriteriaTable({ criteria, correct, selfMarks, setSelfMarks, selfSaved, setSelfSaved }) {
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
                {!correct && !selfSaved ? (
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
      {!correct && (
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
  return (
    <div style={{ marginTop: 10, display: 'grid', gap: 3 }}>
      <div className="muted" style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t('verdict.stepCheck')}</div>
      {report.lines.map((l, i) => (
        <React.Fragment key={i}>
          <div className={`stepcheck-line sc-${l.status}`}>
            <span>{l.status === 'ok' ? '✓' : l.status === 'break' ? '✗' : '·'}</span>
            <span>{l.text}</span>
            {l.status === 'break' && <b style={{ fontFamily: 'var(--font)', fontSize: 12.5, whiteSpace: 'nowrap' }}>{t('verdict.mistakeIsHere')}</b>}
            {l.note && !l.diagnosis && <span style={{ fontFamily: 'var(--font)', fontWeight: 400, fontSize: 12.5 }}> — {l.note}</span>}
          </div>
          {l.diagnosis && <Diagnosis d={l.diagnosis} />}
        </React.Fragment>
      ))}
    </div>
  );
}

/**
 * The mistake by name. Marking the line is where every other marker stops;
 * this card says which move was made, and the rule that move breaks — so the
 * student leaves with something to change rather than something to re-read.
 */
function Diagnosis({ d }) {
  if (!d) return null;
  // A diagnosis the engine could pin to exactly one move is stated; one where
  // more than one move reproduces the line, or that rests on a counterexample
  // alone, is hedged — the student should weigh it, not obey it.
  const hedged = d.confidence !== 'high';
  return (
    <div className="diagnosis-card" data-confidence={d.confidence || 'medium'}>
      <div className="diagnosis-label">{d.code === 'counterexample' ? 'Why it fails' : hedged ? 'This looks like…' : 'What went wrong'}</div>
      <div className="diagnosis-title">{hedged && d.code !== 'counterexample' ? `This looks like: ${d.title}` : d.title}</div>
      <div className="diagnosis-body">{d.message}</div>
      {d.fix && <div className="diagnosis-fix">{d.fix}</div>}
    </div>
  );
}

function attachPhoto(e, setPhoto, onReady, onPdf, onFailed) {
  const f = e.target.files?.[0];
  if (!f) return;
  // A scanner app hands back a PDF, not a photo. Read it as bytes and let the
  // caller render its pages; everything after that is identical.
  if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '')) {
    const reader = new FileReader();
    reader.onload = () => { onPdf?.(String(reader.result || '')); };
    reader.readAsDataURL(f);
    e.target.value = '';
    return;
  }
  const img = new Image();
  const url = URL.createObjectURL(f);
  img.onload = () => {
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    const dataURL = cv.toDataURL('image/jpeg', 0.88);
    setPhoto(dataURL);
    onReady?.(dataURL);
    URL.revokeObjectURL(url);
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    // Previously a silent no-op: the student picked a file and the UI did not
    // move. A HEIC from an iPhone opened on Android lands here.
    onFailed?.('That image could not be opened. Try photographing the page again, or save it as a JPEG first.');
  };
  img.src = url;
  e.target.value = '';
}

function fmtTime(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
