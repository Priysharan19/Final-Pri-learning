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
  'msg.classTitle': 'Year {n} · {title}',
  'msg.classOnly': 'Year {n}',
  'inst.mapTitleScope': '{scope} Mathematics',
  'inst.mapProvenance': 'Prerequisite links are Pri’s own teaching map, not a NESA publication.',
  'login.heroSub': 'Maths practice for NSW students — your working marked line by line, with worked solutions. Answers are checked by Pri’s server, so checking needs a Pri account and a connection.',
  'login.brandKicker': 'NSW Years 11 and 12 · Advanced and Extension 1',
  'login.welcomeSub': 'Practise for the HSC. Your working is checked line by line.',
  'login.point1': 'Generated practice questions for NSW Mathematics',
  'settings.freeCourses': 'NSW Mathematics',
  'settings.premiumAdds': 'HSC Pass removes the daily practice and exam-simulation limits, and adds advanced Pri Explain and advanced analytics. Your work, history and progress are kept if HSC Pass ends.',
  'verifiedMarks.notOfficial': 'Pri practice feedback, not an official NESA marking guideline.',
  'verdict.boardStyleNote': 'Step marking worked out from this question’s own solution. It is not an official NESA marking guideline.',
  'inst.stepMarksNote': 'Pri practice feedback, not an official NESA marking guideline.',
  'snap.chapterOption': 'Year {grade} · {name}',
  'classroom.classNamePlaceholder': 'Year 10 Mathematics',
  'paywall.from.practice': 'You have used today’s free practice questions. They come back at midnight (Sydney time).',
  'check.freeCapHint': 'Checking this one would be another of today’s free practice questions, and you have used the free plan’s daily allowance. They come back at midnight (Sydney time), and HSC Pass removes the daily cap.',
  'legal.unreviewedBody': 'This notice is published so you can read what the app does with your data. No lawyer qualified in Australian law has reviewed it yet. When that review has happened, this banner will go.',
  'explain.kicker': 'Pri Explain · Exam mode',
  'insights.lead': 'Read from your own marked practice. Nothing here is a predicted exam score.',
  'insights.forecastHonesty': 'An estimate from your practice, not a predicted exam score. The range is over the marks you have practised only, and it is wide when the evidence is thin.',
  'board.whyUnitMissing': 'the value is right but the unit ({unit}) is missing — an examiner may withhold this mark',
  'board.sentenceNoWorking': Object.freeze({
    one: '{awarded}/{total}. You wrote only the answer, so {n} step mark was not available. In an exam those are marks you had already earned and did not claim — show the working.',
    other: '{awarded}/{total}. You wrote only the answer, so {n} step marks were not available. In an exam those are marks you had already earned and did not claim — show the working.'
  }),
  'board.sentenceFull': '{awarded}/{total}. Full marks, and the working would earn them in an exam.',
  'board.sentenceMethod': '{awarded}/{total}. The answer is not right, but the method is, and an examiner may award marks for that.',
  'teach.newClassPlaceholder': 'New class name (e.g. Year 10 A)',
  'teach.rosterHelp': 'Roster files: one student per line — {format}. Names already on this device join; new names get a student profile.',
  'scn.hand.eyebrow': 'Year 11 · Advanced · Quadratics',
  'signup.parentLead': "Because you are under 15, a parent or guardian approves your account once, by email. Until they do, you can read questions, write and keep drafts on this device, but answers cannot be checked and nothing syncs.",
  'signup.noticeWhat': "Prithagoras stores the student’s name, year, contact details, answers and progress on its servers. The privacy policy names where and by whom.",
  'signup.noticeNot': "Until you confirm, Prithagoras’s server holds only what it needs to set up the account and reach you: the student’s name, year and contact details, and yours. Their answers are not checked, their handwriting and photos are not read, and nothing syncs.",
  'signup.noticeWithdraw': "You can withdraw at any time from the link in our email. Withdrawing stops everything at once: marking, handwriting and photo reading, exams and sync.",
  'guardianPage.withdrawHint': "You can withdraw later from the link in our email.",
  'signup.classTitle': 'Which year are you in?',
  'signup.classLabel': 'Year',
  'signup.trackLabel': 'Which maths course?',
  'signup.ageLead': 'If you are under 15, a parent or guardian approves your account once, by email, before answers can be checked or anything syncs. You can ask them on the next step.',
  'exams.indiaHeading': 'Exams',
  'placement.provenance': 'The prerequisite map behind it is Pri’s own teaching judgement (version {version}), not a NESA publication.',
  'pricing.why.syllabus': "Built for the NSW Mathematics syllabuses, including the 2024 Stage 6 syllabuses first examined in the 2027 HSC.",
  // Sweep of 18 Nov 2026: shared strings a Prithagoras screen draws that still said
  // class, a Hindi search hint, or an India chooser.
  'common.class': 'Year',
  'gloss.filterTopics': 'Filter topics',
  'login.stepCourseSub': 'Choose the year and course that should drive Practice, Exams and Progress.',
  'login.courseRequired': 'Choose a year and course to continue.',
  'login.chooseClassTrack': 'Choose a year or course…',
  'notes.classLabel': 'Choose a year',
  'notes.noBookmarks': 'No bookmarked chapters in this year yet.',
  'inst.noChapters': 'No chapters are set for your year yet.',
  'cloudError.consentDeclarationRequired': 'Tell us whether the learner is 18 or older, or their year with a parent or guardian’s name and email, then try again.',
  'upgrade.jeeAdvanced': "This part of the course is included with HSC Pass.",
  // Owner decision, 19 Nov 2026: Years 11 and 12 only.
  'notes.nsw.lede': 'Notes for NSW Mathematics, Years 11 and 12: the ideas in plain words, the formulas, what markers look for, the usual traps, and worked examples the maths engine has checked.',
  // Owner walk-through, 19 Nov 2026: the notebook said "Nothing filed yet" while Review listed wrong answers. Review
  // lists every wrong answer, including ones where the solution was shown and paper answers; the notebook files a
  // wrong answer only when its question was finished without the solution. It says so.
  'notebook.empty': 'Nothing filed yet. A wrong answer is filed once you finish the question without showing its solution. Review lists them all.',
  // Owner walk-through, 19 Nov 2026: difficulty is read in words, never as D1 to D4.
  'settings.allDifficulties': 'All difficulties',
  'home.difficultyChip': '{label}',
  // Owner decision, 19 Nov 2026: no "session 1/1" in the student's view.
  'practice.sessionScore': ' · {correct} of {answered} right',
  // Owner decision, 19 Nov 2026: hints are free in Prithagoras practice.
  'tutor.intro': 'Help comes in three levels, in order. Opening a level is free.',
  // Owner decision, 19 Nov 2026: the paid tier is called "HSC Pass" in Prithagoras copy. The words that say "Premium" are renamed at lookup
  // (i18n/tierName.js, applied in i18n/core.js to every string not overridden here); the capability ids keep their names.
  'picker.year': 'Year',
  'picker.course': 'Course'
});
