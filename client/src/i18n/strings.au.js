// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras (Australia) wording, en-AU
//
// One catalogue, one platform (ADR-0002): the Prithagoras edition differs from
// Priyabhata only in curriculum, presentation, language, commercial
// configuration and legal wording. This file holds the wording of the shared
// strings that must not say an Indian thing in the Australian edition. A key
// here replaces the English catalogue's value in a Prithagoras build only;
// Hindi is not offered by that edition. client/test/edition-terms-check.mjs
// fails when a shared string carries an India-only term into this edition
// without an override here or a reasoned entry in its allowlist.
// ─────────────────────────────────────────────────────────────────────────────
export const AU_STRINGS = Object.freeze({
  'common.classNumber': 'Year {n}',
  'inst.mapTitleScope': '{scope} Mathematics',
  'inst.mapProvenance': 'Prerequisite links are Pri’s own teaching map, not a NESA publication.',
  'login.heroSub': 'Maths practice for NSW students — your working marked line by line, with worked solutions. Answers are checked by Pri’s server, so checking needs a Pri account and a connection.',
  'login.brandKicker': 'NSW Mathematics',
  'login.point1': 'Generated practice questions for NSW Mathematics',
  'settings.freeCourses': 'NSW Mathematics',
  'settings.premiumAdds': 'Premium removes the daily practice and exam-simulation limits, and adds advanced Pri Explain and advanced analytics. Your work, history and progress are kept if Premium ends.',
  'verifiedMarks.notOfficial': 'Pri practice feedback, not an official NESA marking guideline.',
  'verdict.boardStyleNote': 'Step marking worked out from this question’s own solution. It is not an official NESA marking guideline.',
  'inst.stepMarksNote': 'Pri practice feedback, not an official NESA marking guideline.',
  'snap.chapterOption': 'Year {grade} · {name}',
  'classroom.classNamePlaceholder': 'Year 10 Mathematics',
  'paywall.from.practice': 'You have used today’s free practice questions. They come back at midnight (Sydney time).',
  'check.freeCapHint': 'Checking this one would be another of today’s free practice questions, and the free plan includes 20 a day. They come back at midnight (Sydney time), and Premium removes the daily cap.',
  'legal.unreviewedBody': 'This notice is published so you can read what the app does with your data. No lawyer qualified in Australian law has reviewed it yet. When that review has happened, this banner will go.',
  'explain.kicker': 'Pri Explain · Exam mode',
  'insights.lead': 'Read from your own marked practice. Nothing here is a predicted exam score.',
  'insights.forecastHonesty': 'An estimate from your practice, not a predicted exam score. The range is over the marks you have practised only, and it is wide when the evidence is thin.',
  'exams.indiaHeading': 'Exams',
  'placement.provenance': 'The prerequisite map behind it is Pri’s own teaching judgement (version {version}), not a NESA publication.'
});
