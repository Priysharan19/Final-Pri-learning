// Pri Learning — only the India curriculum's question banks are issued (owner
// default D15, docs/release/V1_DECISIONS_2026-11-01.md).
//
// The engine still carries the banks written for the NSW (Australian) course
// the product began with. The India curriculum (client/src/engine/
// curriculum-in.js) draws on 254 of the 355 generators through its chapter
// covers, plus its own previous-year banks; the rest are outside it. D15: a bank outside the India covers is
// refused at the server now, and deleted after launch.
//
// The server decides this, not the device: practice.js refuses to issue,
// prepare or twin a question from such a bank, and exams.js refuses the
// NSW-era "practice-paper" kind outright. The India client never asks for
// one; a request that does is refused, never served.
//
// A few server suites use an NSW bank as a convenient vehicle for something
// else (exam authority, marker isolation, notebook twins). They may say so with
// allowBanksOutsideIndiaForTests(), which is refused in production exactly like
// useMarkerPoolForTests() — so a production server can never serve these banks.
import { allGenerators, IN_CHAPTERS } from '../../client/src/engine/curriculum-in.js';
import { indiaPyqCells } from '../../client/src/engine/indiaExamCells.js';
import { hasJeePyqGenerator } from '../../client/src/engine/generators/jee-pyq-runtime.js';
import { hasPyqGenerator } from '../../client/src/engine/pyq/pyqCoverage.js';

// The covers' generators, and the India previous-year banks the exam cells
// draw on (the source-cited archive and the reviewed JEE department catalog).
// Whether a student sees past papers is D23's switch, not this module's.
const INDIA_BANKS = new Set(allGenerators());
for (const track of ['cbse', 'jee-main', 'jee-advanced', 'olympiad']) {
  for (const cells of indiaPyqCells(track, IN_CHAPTERS).values()) for (const cell of cells) INDIA_BANKS.add(cell.generator);
}
let outsideAllowedForTests = false;

/** Is this generator one the India curriculum's covers draw on? */
export function indiaBank(generator) {
  return typeof generator === 'string' && (INDIA_BANKS.has(generator) || indiaPyqBank(generator) || outsideAllowedForTests);
}

/**
 * Every bank of the two India previous-year sources — the reviewed JEE Main /
 * Advanced department catalog and the source-cited CBSE / JEE archive
 * (pyq-…) — is India content, whether or not an exam cell draws on it yet:
 * premium JEE practice asks for these by name (#732).
 */
export function indiaPyqBank(generator) {
  return hasJeePyqGenerator(generator) || hasPyqGenerator(generator);
}

/** May the NSW-era practice-paper kind be issued? Never, outside a test that asked. */
export function practicePapersAllowed() {
  return outsideAllowedForTests;
}

/** How many banks the server will issue from (tests and operator reports). */
export const INDIA_BANK_COUNT = INDIA_BANKS.size;

/**
 * Let this process issue banks outside the India covers. Tests only: a suite
 * that uses an NSW bank as a vehicle calls it, and says why. Refused in
 * production.
 */
export function allowBanksOutsideIndiaForTests() {
  if (process.env.NODE_ENV === 'production') {
    throw Object.assign(new Error('Banks outside the India curriculum are never issued in production (D15).'), { code: 'INDIA_BANKS_CONFIG_INVALID' });
  }
  outsideAllowedForTests = true;
}

export const BANK_OUTSIDE_INDIA = Object.freeze({
  status: 422,
  code: 'PRACTICE_BANK_OUTSIDE_CURRICULUM',
  message: 'This question is not part of the India curriculum.'
});
