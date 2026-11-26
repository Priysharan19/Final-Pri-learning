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
  // Australian spelling: the shared catalogue says Favorites (en-US).
  'favorites.title': 'Favourites',
  'favorites.emptyTitle': 'No favourites yet',
  'favorites.remove': 'Remove from favourites',
  'favorites.removeOn': 'Remove this {topic} question from favourites',
  'verdict.favorite': 'Favourite',
  'verdict.favoriteThis': 'Favourite this question',
  'verdict.savedToFavorites': 'Saved to Favourites',
  'verdict.removedFromFavorites': 'Removed from Favourites',
  'verdict.favoriteNeedsAnswer': 'Answer the question first, then favourite it from History.',
  // Plain wording for the students' own account screens (the shared text spoke to developers).
  'settings.helpBody': 'Every subtopic tracks a skill rating that moves with each answer. Harder questions move it more. Smart Practice targets ~70% success, weaves in spaced reviews before topics fade, and the mark estimate covers only the parts of the paper you have actually practised. Handwritten answers are read by Pri’s server reader when you are online, then the final answer is marked by the same engine as typed answers. Hints and retries still earn credit, just a little less.',
  'cloud.intro': 'Your profile stays on this device. Connecting a {brand} account is what lets Pri’s server check your answers, and adds sync between your devices and your HSC Pass plan; it does not replace the profile on this device or its encryption keys.',
  'cloudSecurity.providersUnavailable': 'Linked sign-in methods could not be loaded just now.',
  'cloudSecurity.socialNote': 'Linking Google or Apple needs a fresh sign-in with that provider. {brand} never accepts a typed provider ID or an unverified email in its place.',
  // Overclaims the launch audit found in shared strings: the mark is for the final answer, and Pri checks the lines it can.
  'verdict.workingAria': 'Your working: one line per row. Pri checks the lines it can.',
  'verdict.workingPlaceholder': 'Show every line of your working, one per row. Pri checks the lines it can and labels the rest.\nFinish with the result you were asked to reach.',
  'examRoom.workingNote': 'Full-working question: the mark is for the final answer, and Pri checks the lines of your working it can as feedback.',
  'login.point2': 'Handwritten working, checked where Pri can',
  'ai.checked.body': 'The maths engine checks your working and your answer where it can, and it alone decides what is right and what is marked. It did not check this explanation. Automatic guards only stop it from giving away the answer, from using numbers that are not in the verified solution, and from talking about marks. It can still be wrong, so compare it with the verified steps.',
  'cloudSecurity.deleteHelp': 'This permanently deletes your Prithagoras account data held on Pri’s server and signs out every device. It does not erase the separate profile stored on this device.',
  'common.classNumber': 'Year {n}',
  'msg.classTitle': 'Year {n} · {title}',
  'msg.classOnly': 'Year {n}',
  'inst.mapTitleScope': '{scope} Mathematics',
  'inst.mapProvenance': 'Prerequisite links are Pri’s own teaching map, not a NESA publication.',
  'login.heroSub': 'Maths practice for NSW students, with worked solutions. Pri checks the lines of your working it can, and says so when it cannot. Answers are checked by Pri’s server, so checking needs a Pri account and a connection.',
  'login.brandKicker': 'NSW Years 11 and 12 · Advanced and Extension 1',
  'login.welcomeSub': 'Practise for the HSC. Pri checks the lines of your working it can, and says so when it cannot.',
  'login.heroNote': 'Answers are checked by Pri’s server, so checking needs a connection. Five questions a day need no account. No ads.',
  'login.point1': 'Generated practice questions for NSW Mathematics',
  'settings.freeCourses': 'NSW Mathematics',
  'settings.premiumAdds': 'HSC Pass will remove the daily practice and exam-simulation limits, and add advanced Pri Explain and advanced analytics. Your work, history and progress are kept if HSC Pass ends.',
  'verifiedMarks.notOfficial': 'Pri practice feedback, not an official NESA marking guideline.',
  'verdict.boardStyleNote': 'Step marking worked out from this question’s own solution. It is not an official NESA marking guideline.',
  'inst.stepMarksNote': 'Pri practice feedback, not an official NESA marking guideline.',
  'snap.chapterOption': 'Year {grade} · {name}',
  'classroom.classNamePlaceholder': 'Year 10 Mathematics',
  'paywall.from.practice': 'You have used today’s free practice questions. They come back at midnight (Sydney time).',
  'check.freeCapHint': 'Checking this one would be another of today’s free practice questions, and you have used the free plan’s daily allowance. They come back at midnight (Sydney time), and HSC Pass will remove the daily cap.',
  'legal.unreviewedBody': 'This notice is published so you can read what the app does with your data. No lawyer qualified in Australian law has reviewed it yet. When that review has happened, this banner will go.',
  'explain.kicker': 'Pri Explain · Exam mode',
  'insights.lead': 'Read from your own marked practice. Nothing here is a predicted exam score.',
  'insights.forecastHonesty': 'An estimate from your practice, not a predicted exam score. The range is over the marks you have practised only, and it is wide when the evidence is thin.',
  'board.whyUnitMissing': 'the value is right but the unit ({unit}) is missing: an examiner may withhold this mark',
  'board.sentenceNoWorking': Object.freeze({
    one: '{awarded}/{total}. You wrote only the answer, so {n} step mark was not available. In an exam those are marks you had already earned and did not claim. Show the working.',
    other: '{awarded}/{total}. You wrote only the answer, so {n} step marks were not available. In an exam those are marks you had already earned and did not claim. Show the working.'
  }),
  'board.sentenceFull': '{awarded}/{total}. Full marks, and the working would earn them in an exam.',
  'board.sentenceMethod': '{awarded}/{total}. The answer is not right, but the method is, and an examiner may award marks for that.',
  'teach.newClassPlaceholder': 'New class name (e.g. Year 10 A)',
  'teach.rosterHelp': 'Roster files: one student per line, written as {format}. Names already on this device join; new names get a student profile.',
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
  // Launch audit, 22 Nov 2026: public claims made true to what the edition does. The reading is no longer confirmed before marking
  // (ADR-0001 amendment 2026-11-19), a line the engine cannot judge is labelled and never ticked, and the mark is for the final answer.
  'landing.docTitle': '{brand}: your working, checked where it can be',
  'landing.title': 'Your working, checked where it can be.',
  'landing.sub': 'Write your working by hand. {brand} reads it, and a maths engine checks the lines it can and shows where one first goes wrong. A line it cannot check is labelled, not ticked.',
  'landing.proofEngine': 'A maths engine checks the lines it can verify and labels the rest. AI never decides your mark.',
  'landing.proofConfirm': 'You can see what was read from each line of your handwriting, and correct it.',
  'landing.demo.ask': 'Line {n}: did you write {a} or {b}? In Pri you can see what was read after your work is marked, and correct it.',
  'landing.demo.confirm': 'It’s {a}',
  'landing.marking.p2': '{brand} reads your handwriting. Once your work is marked, it shows what it read on each line, and you can correct a reading and have the same attempt marked again.',
  'landing.marking.p3': 'A maths engine on our server checks each line against the line before, where it can. A line it verifies is Checked. The first line that stops being true is the First error, and the lines after it are shown as following from it.',
  'landing.marking.p4': 'A line the engine can’t prove is labelled Not verified. It is never ticked, and AI never decides your mark. The mark is for your final answer; the line checks are feedback.',
  'landing.teachers.p1': 'Every mark {brand} gives comes from the maths engine. Where it can check your working, it shows the line where the working first goes wrong.',
  'pricing.why.youConfirm': 'You can see how Pri read your handwriting and correct it. A model’s reading never sets a mark.',
  'scn.label.hand': 'Handwriting read, and checked where it can be',
  'picker.year': 'Year',
  'picker.course': 'Course',
  // Signing out forgets the account link on the device, so the gate said the profile was not connected. It is signed out.
  'activation.notLinked': 'This profile is not signed in to a Pri account. Sign in to check your answers.'
});

// Prithagoras only (no catalogue key, so no Hindi): which line Pri looked at for the final answer, and what it offers.
// The Priyabhata edition keeps its one sentence (mark.finalUnreadable).
export const AU_FINAL_ANSWER_NOTE = Object.freeze({
  pick: line => `Pri looked at this line for your final answer: ${line} Tap the answer you mean, or type it here.`,
  none: line => `Pri looked at this line for your final answer: ${line} It does not give one Pri can take. Type it here.`
});
