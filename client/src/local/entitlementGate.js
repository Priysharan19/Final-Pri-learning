// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Free tier and Premium gate for the local backend.
//
// The FREE plan is enforced here, on the device, so it works with no account
// and no network: 20 practice questions per calendar day (the day boundary is
// the profile's own timezone — Asia/Kolkata for India profiles), one exam
// simulation every 30 days, and basic Pri Explain. Nothing about the free cap
// is mirrored by the server; the counter is a device-local row.
//
// PREMIUM is never decided here. The only source of Premium is the cloud
// entitlement snapshot the server issued for the linked account, read through
// platform/entitlements.js — which fails closed when the server window or the
// 7-day offline window has expired. This module asks that contract a question
// and records usage; it never writes an entitlement.
// ─────────────────────────────────────────────────────────────────────────────
import { get, put } from './idb.js';
import { cloudLinkRowId } from '../platform/cloudAccount.js';
import { ENTITLEMENTS, entitlementDecision, normalizeEntitlementSnapshot } from '../platform/entitlements.js';

const DAY = 86_400_000;
const USAGE_PREFIX = 'pri-free-usage-v1:';

export const FREE_TIER = Object.freeze({
  practicePerDay: 20,
  examsPerWindow: 1,
  examWindowDays: 30,
  explain: 'basic'
});

/**
 * Where each declared Premium capability is enforced. A capability that is
 * declared but enforced nowhere is exactly the bug this package closes, so the
 * enforcement suite checks every ENTITLEMENTS value has an entry here.
 */
export const CAPABILITY_ENFORCEMENT = Object.freeze({
  [ENTITLEMENTS.UNLIMITED_PRACTICE]: 'local backend · POST /practice/next and /history/:id/retry lift the daily free cap',
  [ENTITLEMENTS.PREMIUM_EXAMS]: 'local backend · POST /exams (HSC paper builder and India exam module) beyond the free simulation',
  [ENTITLEMENTS.JEE_ADVANCED]: 'local backend · every route that can serve jee-advanced content, checked on the RESOLVED track rather than the request shape: POST /practice/next smart practice, POST /practice/next against a task whose targets name the track (a student can set one themselves on the Tasks page), POST /history/:id/retry on a row whose india.track is jee-advanced, and POST /exams in the India exam module',
  [ENTITLEMENTS.ADVANCED_EXPLAIN]: 'client · PriExplainV5 adaptive teaching plan, retrieval checkpoints and follow-up (basic playback stays free)',
  [ENTITLEMENTS.ADVANCED_ANALYTICS]: 'client · Progress priorities / knowledge map tabs and the teacher progress-file export',
  [ENTITLEMENTS.EXTRA_AI]: 'reserved · no call site consumes additional AI usage yet (no-op by design)'
});

// Tests replace the clock and the connectivity probe; production never does.
let clock = () => Date.now();
let onlineProbe = () => (typeof navigator === 'undefined' || navigator.onLine !== false);

export function configureEntitlementGate({ now, online } = {}) {
  clock = typeof now === 'function' ? now : () => Date.now();
  onlineProbe = typeof online === 'function' ? online : () => (typeof navigator === 'undefined' || navigator.onLine !== false);
}

function validTimeZone(tz) {
  try { new Intl.DateTimeFormat('en-CA', { timeZone: tz }); return true; } catch { return false; }
}

/** The calendar a profile lives in. India profiles default to Asia/Kolkata. */
export function profileTimeZone(profile) {
  const tz = String(profile?.timezone || '').trim();
  if (tz && validTimeZone(tz)) return tz;
  return profile?.course === 'in' ? 'Asia/Kolkata' : 'Australia/Sydney';
}

export function dayKey(ms, timeZone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}

/** The first instant of the next calendar day in `timeZone`, to the minute. */
export function nextDayStart(ms, timeZone) {
  // The instant the daily cap resets is shown to the student, so it is bisected
  // to the millisecond. Stopping a minute short returned a time up to sixty
  // seconds after midnight, which reads as a wrong answer to "when can I
  // practise again?" — and made the value drift with whenever it was asked.
  const today = dayKey(ms, timeZone);
  let lo = ms;
  let hi = ms + 60_000;
  while (dayKey(hi, timeZone) === today) { lo = hi; hi += 3_600_000; }
  while (hi - lo > 1) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (dayKey(mid, timeZone) === today) lo = mid; else hi = mid;
  }
  return hi;
}

async function linkRow(pid) {
  return get('device', cloudLinkRowId(pid)).catch(() => null);
}

async function usageRow(pid) {
  const row = await get('device', `${USAGE_PREFIX}${pid}`).catch(() => null);
  return row || { id: `${USAGE_PREFIX}${pid}`, pid, practice: null, exams: [] };
}

/** The normalized entitlement snapshot for a local profile — 'free' when unlinked. */
export async function cloudEntitlement(pid, now = clock()) {
  const row = await linkRow(pid);
  return normalizeEntitlementSnapshot(row?.entitlement || {}, now);
}

/** Ask the server-authoritative contract whether a capability is usable now. */
export async function capabilityDecision(pid, capability, now = clock()) {
  const row = await linkRow(pid);
  return entitlementDecision(row?.entitlement || {}, capability, { online: onlineProbe(), now });
}

function gateError(code, message, details = {}) {
  return Object.assign(new Error(message), { status: 402, code, ...details });
}

function offlineNote(decision) {
  return decision?.reason === 'offline-entitlement-expired'
    ? ' Your Premium needs to reconnect — this device has been offline for longer than the 7-day window.'
    : '';
}

function whenLabel(ms, timeZone) {
  try {
    return new Intl.DateTimeFormat('en-IN', { timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms));
  } catch { return new Date(ms).toISOString(); }
}

export async function practiceAllowance(profile, now = clock()) {
  const decision = await capabilityDecision(profile.id, ENTITLEMENTS.UNLIMITED_PRACTICE, now);
  const timeZone = profileTimeZone(profile);
  const day = dayKey(now, timeZone);
  const usage = await usageRow(profile.id);
  const used = usage.practice?.day === day ? Math.max(0, Number(usage.practice.served) || 0) : 0;
  const resetsAt = nextDayStart(now, timeZone);
  const base = { used, resetsAt, timeZone, day, reason: decision.reason, refreshRequired: !!decision.refreshRequired };
  if (decision.allowed) return { ...base, allowed: true, plan: 'premium', unlimited: true, limit: null };
  return { ...base, allowed: used < FREE_TIER.practicePerDay, plan: 'free', unlimited: false, limit: FREE_TIER.practicePerDay };
}

export async function assertPracticeAllowed(profile, now = clock()) {
  const allowance = await practiceAllowance(profile, now);
  if (allowance.allowed) return allowance;
  const decision = { reason: allowance.reason };
  throw gateError('FREE_CAP_REACHED',
    `You have used today's ${FREE_TIER.practicePerDay} free practice questions. They reset at midnight (${allowance.timeZone}), and Premium removes the daily cap.${offlineNote(decision)}`,
    { capability: ENTITLEMENTS.UNLIMITED_PRACTICE, used: allowance.used, limit: allowance.limit, resetsAt: allowance.resetsAt, timeZone: allowance.timeZone, reason: allowance.reason, refreshRequired: allowance.refreshRequired });
}

export async function recordPracticeServed(profile, now = clock()) {
  const usage = await usageRow(profile.id);
  const timeZone = profileTimeZone(profile);
  const day = dayKey(now, timeZone);
  const served = usage.practice?.day === day ? (Number(usage.practice.served) || 0) + 1 : 1;
  usage.practice = { day, timeZone, served, updatedAt: now };
  await put('device', usage);
  return served;
}

export async function examAllowance(profile, now = clock()) {
  const decision = await capabilityDecision(profile.id, ENTITLEMENTS.PREMIUM_EXAMS, now);
  const usage = await usageRow(profile.id);
  const windowMs = FREE_TIER.examWindowDays * DAY;
  const recent = (Array.isArray(usage.exams) ? usage.exams : []).map(Number).filter(t => Number.isFinite(t) && t > now - windowMs && t <= now);
  const used = recent.length;
  const nextAt = recent.length ? Math.min(...recent) + windowMs : null;
  const base = { used, windowDays: FREE_TIER.examWindowDays, reason: decision.reason, refreshRequired: !!decision.refreshRequired };
  if (decision.allowed) return { ...base, allowed: true, plan: 'premium', unlimited: true, limit: null, nextAt: null };
  return { ...base, allowed: used < FREE_TIER.examsPerWindow, plan: 'free', unlimited: false, limit: FREE_TIER.examsPerWindow, nextAt };
}

export async function assertExamAllowed(profile, now = clock()) {
  const allowance = await examAllowance(profile, now);
  if (allowance.allowed) return allowance;
  const timeZone = profileTimeZone(profile);
  throw gateError('FREE_CAP_REACHED',
    `The free plan includes one exam simulation every ${FREE_TIER.examWindowDays} days. Your next free simulation unlocks on ${whenLabel(allowance.nextAt, timeZone)}; Premium includes unlimited simulations.${offlineNote({ reason: allowance.reason })}`,
    { capability: ENTITLEMENTS.PREMIUM_EXAMS, used: allowance.used, limit: allowance.limit, nextAt: allowance.nextAt, windowDays: allowance.windowDays, timeZone, reason: allowance.reason, refreshRequired: allowance.refreshRequired });
}

export async function recordExamSimulation(profile, now = clock()) {
  const usage = await usageRow(profile.id);
  const windowMs = FREE_TIER.examWindowDays * DAY;
  const kept = (Array.isArray(usage.exams) ? usage.exams : []).map(Number).filter(t => Number.isFinite(t) && t > now - windowMs);
  usage.exams = [...kept, now];
  await put('device', usage);
  return usage.exams.length;
}

const CAPABILITY_COPY = Object.freeze({
  [ENTITLEMENTS.JEE_ADVANCED]: 'The JEE Advanced track is part of Pri Learning Premium. JEE Main and the CBSE / NCERT chapters stay on the free plan.',
  [ENTITLEMENTS.ADVANCED_EXPLAIN]: 'Adaptive Pri Explain teaching is part of Pri Learning Premium.',
  [ENTITLEMENTS.ADVANCED_ANALYTICS]: 'Priorities, the knowledge map and teacher analytics exports are part of Pri Learning Premium.',
  [ENTITLEMENTS.PREMIUM_EXAMS]: 'Further exam simulations are part of Pri Learning Premium.',
  [ENTITLEMENTS.UNLIMITED_PRACTICE]: 'Unlimited daily practice is part of Pri Learning Premium.',
  [ENTITLEMENTS.EXTRA_AI]: 'Additional AI usage is reserved for Pri Learning Premium.'
});

/** Throw a 402 unless the linked account currently holds `capability`. */
export async function requireCapability(profile, capability, now = clock()) {
  const decision = await capabilityDecision(profile.id, capability, now);
  if (decision.allowed) return decision;
  throw gateError('PREMIUM_REQUIRED',
    `${CAPABILITY_COPY[capability] || 'This feature is part of Pri Learning Premium.'}${offlineNote(decision)}`,
    { capability, reason: decision.reason, refreshRequired: !!decision.refreshRequired });
}

/** True for the two error shapes the paywall knows how to explain. */
export function isEntitlementGate(error) {
  return !!error && Number(error.status) === 402 && (error.code === 'FREE_CAP_REACHED' || error.code === 'PREMIUM_REQUIRED');
}

/** What /me and question responses expose about the plan — no secrets, no ids. */
export async function planView(profile, now = clock()) {
  const entitlement = await cloudEntitlement(profile.id, now);
  return {
    tier: entitlement.active ? 'premium' : 'free',
    status: entitlement.status,
    provider: entitlement.provider,
    currentPeriodEnd: entitlement.currentPeriodEnd,
    offlineUntil: entitlement.offlineUntil,
    stale: !!entitlement.stale,
    capabilities: [...entitlement.capabilities]
  };
}

export async function usageView(profile, now = clock()) {
  const [practice, exams] = await Promise.all([practiceAllowance(profile, now), examAllowance(profile, now)]);
  return {
    practice: { used: practice.used, limit: practice.limit, unlimited: practice.unlimited, resetsAt: practice.resetsAt, timeZone: practice.timeZone },
    exams: { used: exams.used, limit: exams.limit, unlimited: exams.unlimited, windowDays: exams.windowDays, nextAt: exams.nextAt }
  };
}
