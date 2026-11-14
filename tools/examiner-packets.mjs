#!/usr/bin/env node
// Pri Learning · examiner certification packets (mission CERT)
//
// One command regenerates both packets from the current commit:
//
//   node tools/examiner-packets.mjs            # write docs/marking/packets/**
//   node tools/examiner-packets.mjs --check    # fail if any packet file is stale
//   npm run examiner:packets                   # both dossiers, then both packets
//
// Each packet (docs/marking/packets/cbse/, docs/marking/packets/hsc/) holds a
// cover letter, the worked answer cases with the engine's verdict, the
// decision form with one line per item, the independence statement, and
// items.json — the machine list the verifier checks a signed record against.
// MANIFEST.json records the sha256 of every file and one packet digest.
//
// Everything is generated from the code and the two dossiers. Nothing here is
// an examiner's decision, and every page says "not yet reviewed by a human
// examiner". The dossiers must be current (`--check`) before a packet is built.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CHECK = process.argv.includes('--check');
const CBSE_DOSSIER = 'docs/marking/order14-examiner-certification-dossier.md';
const PACKETS = 'docs/marking/packets';
const sha = s => createHash('sha256').update(s).digest('hex');
const esc = v => String(v ?? '').replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const fail = m => { console.error(`EXAMINER PACKETS: FAIL — ${m}`); process.exit(1); };

for (const args of [['--check'], ['--jurisdiction', 'nsw', '--check']]) {
  try { execFileSync(process.execPath, [path.join(ROOT, 'tools/examiner-dossier.mjs'), ...args], { stdio: 'pipe' }); }
  catch (e) { fail(`the dossier is stale (${args.join(' ')}): ${String(e.stderr || e.message).trim()}`); }
}

const { generateQuestion, loadAllBanks } = await import(path.join(ROOT, 'client/src/engine/generators/index.js'));
const { workedCases } = await import('./examiner-cases.mjs');
const { buildNswDossier, NSW_DOSSIER } = await import('./examiner-dossier-nsw.mjs');
await loadAllBanks();

export const NOT_REVIEWED = '> **Not yet reviewed by a human examiner.** This packet is a review request generated from the code. Nothing in it is academically approved, and no examiner has seen or signed it.';

// ── CBSE: read the dossier the CI already pins (its digest and bank table) ──
const cbseText = readFileSync(path.join(ROOT, CBSE_DOSSIER), 'utf8');
const cbseDigest = cbseText.match(/\*\*Rubric digest \(sha256\): `([0-9a-f]{64})`\*\*/)?.[1] || fail('no digest in the CBSE dossier');
const cbseBanks = [...cbseText.matchAll(/^\| `([a-z0-9-]+)` \| D(\d) \| (\d+) \| ([^|]+) \| ([^|]+) \| \d+ \|/gm)].map(m => ({ id: `${m[1]}/D${m[2]}`, generator: m[1], difficulty: Number(m[2]), marks: Number(m[3]), shape: m[4].trim(), ecf: m[5].trim() }));
if (!cbseBanks.length) fail('no rubric bank rows in the CBSE dossier');
const CBSE_POLICY_ITEMS = [
  { id: 'cbse-policy:ap-ecf', text: 'The AP / ECF policy as the marker applies it (dossier §3).' },
  { id: 'cbse-call:A-wrong-givens-substitution', text: 'Call A — ECF on wholly wrong givens pays the substitution mark (dossier §4).' },
  { id: 'cbse-call:B-formula-then-guess', text: 'Call B — formula-then-guess pays the method mark (dossier §4).' },
  { id: 'cbse-call:class-xi-least-value-d3', text: 'Class XI least-value D3 three-mark scheme is final-answer-only (dossier §5).' }
];
// The dossier's own fixed seeds; the first one on which the bank issues a step check.
const CBSE_SEEDS = Array.from({ length: 12 }, (_, i) => 1009 + i * 7919);
const cbseCases = cbseBanks.map(b => {
  const seed = CBSE_SEEDS.find(s => { try { return !!generateQuestion(b.generator, b.difficulty, s)?.stepcheck; } catch { return false; } });
  if (seed === undefined) fail(`${b.id} issues no step check on the dossier's seeds`);
  const q = generateQuestion(b.generator, b.difficulty, seed);
  return { ...b, seed, prompt: q.prompt, cases: workedCases(q) };
});

// ── NSW: built in-process from the same module as its dossier ──
const nsw = await buildNswDossier();

const JURISDICTIONS = [
  {
    key: 'cbse', folder: 'cbse', jurisdiction: 'cbse', issue: '#499', minExaminers: 1,
    title: 'CBSE (Priyabhata) — method-mark rubric certification',
    dossier: CBSE_DOSSIER, digest: cbseDigest,
    syllabusVersions: ['cbse-mathematics-2026-27'],
    items: [...CBSE_POLICY_ITEMS.map(i => i.id), ...cbseBanks.map(b => `cbse-bank:${b.id}`)],
    itemText: Object.fromEntries([...CBSE_POLICY_ITEMS.map(i => [i.id, i.text]), ...cbseBanks.map(b => [`cbse-bank:${b.id}`, `${b.marks} marks · ${b.shape} · ECF ${b.ecf}`])]),
    caseRows: cbseCases.map(c => ({ id: `cbse-bank:${c.id}`, seed: c.seed, prompt: c.prompt, cases: c.cases })),
    who: 'an independent, qualified CBSE mathematics examiner (Class X–XII board-examination marking experience), who did not write or commission this code',
    asked: [
      'Whether each method rubric (generator × level) below awards the marks a CBSE examiner would award, stage by stage, including first-error and error-carried-forward behaviour.',
      'A ruling on the two open policy calls (A and B) and the Class XI least-value scheme.',
      'Whether each bank fits the current CBSE syllabus.'
    ]
  },
  {
    key: 'nsw', folder: 'hsc', jurisdiction: 'nsw-hsc', issue: 'G6 (HSC counterpart of #499)', minExaminers: 2,
    title: 'NSW HSC (Prithagoras) — final-answer marking and method-rubric certification',
    dossier: NSW_DOSSIER, digest: nsw.digest,
    syllabusVersions: nsw.syllabusVersions,
    items: nsw.items,
    itemText: Object.fromEntries(nsw.items.map(id => {
      const conv = id.startsWith('nsw-convention:');
      const c = nsw.cells.find(x => id.endsWith(`:${x.id}`));
      return [id, conv ? 'Marking convention (dossier §4) — to be confirmed by the examiner.' : id.startsWith('nsw-method:') ? `Method rubric (${c.stepcheck}) — may partial marks ever be paid?` : `Final answer only · ${c.syllabus}@${c.syllabusVersion} · ${c.outcomes.join(', ')}`];
    })),
    caseRows: nsw.cells.map(c => ({ id: `nsw-final:${c.id}`, seed: c.seeds[0], prompt: c.prompt, cases: c.cases })),
    who: 'at least two independent, experienced NSW HSC mathematics markers (or NSW-accredited teachers with recent Year 12 teaching of the course), who did not write or commission this code (research §8.3)',
    asked: [
      'Whether the final-answer marking of each issued cell is right: the forms accepted, the forms refused, and the outcome each cell is located at in the current syllabus.',
      'A ruling on each marking convention and on the rounding tolerances the dossier lists.',
      'For each method rubric listed, whether partial marks may ever be paid, and on what ladder. Prithagoras pays none today.'
    ]
  }
];

const verdictCell = v => (v === null || v === undefined ? '—' : v);
function casesPage(j) {
  const L = [`# ${j.title}: worked answer cases`, '', NOT_REVIEWED, '', `Dossier digest: \`${j.digest}\` (\`${j.dossier}\`).`, '',
    'For each item, one issued question (seed shown) and the pages a student might hand in, with the engine\'s verdict as the server computes it (`server/platform/markerOps.js`). *Final-answer-only* is what production pays today. *With method marks* is what the engine would pay if method marks were switched on — which they are not. Record every disagreement on the decision form.', ''];
  for (const r of j.caseRows) {
    L.push(`## \`${r.id}\` — seed ${r.seed}`, '', `> ${esc(r.prompt)}`, '');
    L.push('| Case | Final answer written | Engine: correct? | Final-answer-only | With method marks | Note |', '|---|---|---|---|---|---|');
    for (const c of r.cases) L.push(`| ${c.case} | ${c.answer === null ? '—' : `\`${esc(c.answer)}\``} | ${c.correct === null ? '—' : c.correct ? 'yes' : 'no'} | ${c.finalAnswerOnly === null ? '—' : `${c.finalAnswerOnly}/${c.marks}`} | ${c.withMethodMarks === null ? '—' : `${c.withMethodMarks}/${c.marks}`} | ${esc(c.note)} |`);
    const paged = r.cases.filter(c => c.page.length);
    if (paged.length) {
      L.push('', '<details><summary>Pages</summary>', '');
      for (const c of paged) { L.push(`${c.case}:`, '```text', ...c.page, `Final answer: ${c.answer}`, '```'); }
      L.push('</details>');
    }
    L.push('');
  }
  return L.join('\n');
}

function formPage(j) {
  const L = [`# ${j.title}: decision form`, '', NOT_REVIEWED, '',
    'Complete one form per examiner. Return the signed original as the README says; the platform transcribes it into a JSON record (`docs/marking/certifications/`, schema `docs/marking/certifications/schema.json`) and verifies it with `node tools/verify-examiner-certification.mjs`. A form that leaves any item blank is incomplete and turns nothing on.', '',
    '```text',
    `Jurisdiction:                    ${j.jurisdiction}`,
    `Syllabus version(s):             ${j.syllabusVersions.join(', ')}`,
    `Dossier digest reviewed:         ${j.digest}`,
    'Repository commit reviewed:      ________________________________________',
    'Examiner full name:              ________________________________________',
    'Qualification:                   ________________________________________',
    'Affiliation:                     ________________________________________',
    'Date (YYYY-MM-DD):               ______________',
    'Independence statement signed:   [ ] yes (independence-statement.md)',
    'Signature:                       ________________________________________',
    '```', '',
    'Verdict per item: **A** approved as the engine behaves · **C** approved with changes (state them; the code must change and a new dossier be signed before anything turns on) · **R** rejected.', '',
    `| # | Item | What is being certified | Verdict (A / C / R) | Notes |`, '|---:|---|---|---|---|'];
  j.items.forEach((id, i) => L.push(`| ${i + 1} | \`${id}\` | ${esc(j.itemText[id])} |  |  |`));
  L.push('', `Items: ${j.items.length}.`, '');
  return L.join('\n');
}

function independencePage(j) {
  return [`# ${j.title}: independence and conflict statement`, '', NOT_REVIEWED, '',
    'To be signed by each examiner and returned with the decision form.', '',
    '```text',
    'I, ______________________________, confirm that:',
    '',
    '1. I did not write, commission or review the Pri Learning code or rubrics under review before this engagement.',
    '2. I have no financial interest in Pri Learning other than the fee for this review: ____________.',
    '3. I am not bound by any confidentiality obligation (including to an examining authority) that this review would breach.',
    '4. I reviewed the material myself, at the digest named on my decision form, and the decisions are mine.',
    '5. My decisions certify only this jurisdiction and syllabus version. They do not certify any other edition or board.',
    '',
    'Conflicts of interest (or "none"): ____________________________________________',
    'Signature: ________________________   Date (YYYY-MM-DD): ____________',
    '```', ''].join('\n');
}

function readmePage(j) {
  return [`# ${j.title}`, '', NOT_REVIEWED, '',
    `Tracking: ${j.issue}. Dossier: [\`${j.dossier}\`](../../${path.basename(j.dossier)}). Dossier digest: \`${j.digest}\`.`, '',
    '## Cover letter', '',
    `Dear examiner,`, '',
    `Pri Learning is a mathematics practice platform. Its marks are decided by a deterministic engine on our server, never by an AI model. Today it pays marks for the final answer only. We are asking ${j.who} to review the rules the engine applies, so that we can either keep them as they are or correct them, and so that partial (method) marks are only ever paid on rules a qualified human has approved.`, '',
    'We are not asking you to endorse the product, and we will not describe your review as approval by any board or authority.', '',
    '## What is being asked', '',
    ...j.asked.map((a, i) => `${i + 1}. ${a}`), '',
    '## How the marking works (plain language)', '',
    '- The server issues every question and keeps its key. A student\'s answer is checked by deterministic code on the server, only online and only for a signed-in account.',
    '- **Final-answer marking (live today):** a right final answer, in any form the engine proves equal to the key, earns the question\'s marks; anything else earns none. Working is read and shown back as feedback, never marked.',
    '- **Method marks (off today):** for questions with a step plan, the engine can check each line of working and award stages, capped at one mark below the question\'s marks for a wrong final answer. This stays off until a complete, signed decision for this jurisdiction exists in the repository and the owner switches it on.',
    '', '## What is in this packet', '',
    '| File | What it is |', '|---|---|',
    `| [\`../../${path.basename(j.dossier)}\`](../../${path.basename(j.dossier)}) | The dossier: every rubric and policy, and the digest you sign. |`,
    '| [`worked-cases.md`](worked-cases.md) | For each item, a sample question and the engine\'s verdict on a correct, alternative, common-wrong and partial answer. |',
    '| [`decision-form.md`](decision-form.md) | One line per item for your verdict. |',
    '| [`independence-statement.md`](independence-statement.md) | Independence and conflict statement to sign. |',
    '| [`items.json`](items.json) | The same item list, for the platform\'s verifier. |',
    '', '## How to return it', '',
    '1. Complete and sign the decision form and the independence statement (paper or a signed PDF).',
    '2. Send them to the Pri Learning owner directly — not by pull request or issue comment.',
    '3. The owner keeps the signed original and records where it is held. A Pri engineer transcribes it into a JSON record; the verifier refuses the record unless it names your qualification, independence, date and a verdict for every item, at exactly the digest above.',
    `4. If the code changes after you sign, the digest changes and your signature no longer applies to it. You will be asked to review the difference.`,
    '', '**Certification status: PENDING. Approved by: nobody.**', ''].join('\n');
}

const files = new Map();
for (const j of JURISDICTIONS) {
  const dir = `${PACKETS}/${j.folder}`;
  files.set(`${dir}/README.md`, readmePage(j));
  files.set(`${dir}/worked-cases.md`, casesPage(j));
  files.set(`${dir}/decision-form.md`, formPage(j));
  files.set(`${dir}/independence-statement.md`, independencePage(j));
  files.set(`${dir}/items.json`, JSON.stringify({
    status: 'not yet reviewed by a human examiner',
    jurisdiction: j.jurisdiction, syllabusVersions: j.syllabusVersions, dossier: j.dossier, dossierDigest: j.digest,
    minExaminers: j.minExaminers, items: j.items
  }, null, 2) + '\n');
}
const manifestFiles = [...files.keys()].sort().map(f => ({ file: f, sha256: sha(files.get(f)) }));
const packetDigest = sha(manifestFiles.map(r => `${r.file} ${r.sha256}`).join('\n'));
files.set(`${PACKETS}/MANIFEST.json`, JSON.stringify({ status: 'not yet reviewed by a human examiner', generator: 'node tools/examiner-packets.mjs', packetDigest, dossierDigests: Object.fromEntries(JURISDICTIONS.map(j => [j.jurisdiction, j.digest])), files: manifestFiles }, null, 2) + '\n');

if (CHECK) {
  const stale = [...files].filter(([f, t]) => !existsSync(path.join(ROOT, f)) || readFileSync(path.join(ROOT, f), 'utf8') !== t).map(([f]) => f);
  if (stale.length) fail(`stale packet files: ${stale.join(', ')}; run npm run examiner:packets`);
  console.log(`EXAMINER PACKETS: PASS — cbse ${JURISDICTIONS[0].items.length} items, nsw-hsc ${JURISDICTIONS[1].items.length} items, packet digest ${packetDigest.slice(0, 12)}…, status PENDING (not reviewed by a human examiner)`);
} else {
  for (const [f, t] of files) { mkdirSync(path.dirname(path.join(ROOT, f)), { recursive: true }); writeFileSync(path.join(ROOT, f), t); }
  console.log(`wrote ${files.size} packet files — packet digest ${packetDigest}`);
  for (const j of JURISDICTIONS) console.log(`  ${j.jurisdiction}: dossier digest ${j.digest}, ${j.items.length} items`);
}
