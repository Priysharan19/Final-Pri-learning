#!/usr/bin/env node
// Pri Learning · run the production content certifier over approved rows.
//
// Reads approved JSONL rows on stdin, builds each one's student payload with
// the same runtime the app uses (asJeePyqPayload) and runs client/test/
// content-certify.mjs's certifyQuestion over it (KaTeX renders, no leaked
// template / undefined text, answer contract shape). Writes one JSON verdict
// per row. review_official.py publish-set holds every row with a problem: a
// reviewed record is never edited after review to make it pass.

import { createInterface } from 'node:readline';
import { asJeePyqPayload } from '../../client/src/engine/generators/jee-pyq-runtime.js';
import { certifyQuestion } from '../../client/test/content-certify.mjs';

function compact(row) {
  const src = row.source || {}, exam = row.exam || {};
  return {
    id: row.id, chapterId: row.routing?.targetChapter, sourceChapter: null, sourceTopic: '',
    sourceQuestionNumber: src.questionNumber, sourcePage: src.page, sourcePdfPage: src.page,
    examYear: exam.year, examTrack: exam.track, difficulty: row.difficulty, answerType: row.answerType,
    prompt: row.prompt, answer: row.answer, mcqOptions: row.mcqOptions, hints: row.hints || [], steps: row.steps || [],
    official: { authority: src.authority, documentId: src.documentId, url: src.url, keyUrl: src.keyUrl, paper: exam.paper, session: exam.session, shift: exam.shift },
    review: { reviewedBy: row.review?.reviewedBy, reviewedAt: row.review?.reviewedAt, tier: row.review?.tier }
  };
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of rl) {
  if (!line.trim()) continue;
  const row = JSON.parse(line);
  let problems;
  try {
    const q = asJeePyqPayload(compact(row));
    problems = certifyQuestion(q, { generatorId: `${row.exam?.track}-${row.routing?.targetChapter}`, identity: false });
  } catch (err) {
    problems = [`payload threw: ${err.message || err}`];
  }
  process.stdout.write(JSON.stringify({ id: row.id, problems }) + '\n');
}
