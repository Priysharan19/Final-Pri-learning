# NCERT term list

Hindi review packet. Status: **No native-speaker review on record.**

These are the maths terms in `client/src/i18n/ncertTerms.js`. That file holds the NCERT Hindi term the app shows beside an English term when the "Show NCERT Hindi terms" setting is on. Each term carries where it was read: `page` (a rendered page of an NCERT Hindi textbook PDF), `title` (a chapter or section title), or `corpus` with `n`, its count in the extracted text of the sampled chapters (Classes 7–12). None of this has been checked by a person against the printed books.

For each term, the table counts the catalogue strings whose English uses it, and how many of their Hindi translations use the NCERT term. The match is a plain text search, so an inflected form can count as a use, and a string can rightly use another word. Rows in the last column are the ones to read first.

Please check: is the NCERT term right for that class level? Does the interface use it consistently? Where a string uses a different word, is that deliberate?

| English | NCERT Hindi | Source | Strings using the English | Hindi uses the term | Keys where the Hindi does not (first 10) | OK? | Note |
|---|---|---|---|---|---|---|---|
| mathematics (also maths, math) | गणित | corpus, n = 377 | 68 | 65 | `exams.bp.ioqm` `landing.proofSyllabusAu` `landing.syllabus.au` |  |  |
| number (also numbers) | संख्या | corpus, n = 1091 | 56 | 38 | `progressEv.how` `invite.privacy` `placement.progressBody` `signup.phoneLabel` `signup.changeNumber` `signup.parentPhoneLabel` `signup.parentHome1` `signup.withdrawPhone` `signup.withdrawSent` `guardianPage.yourPhone` |  |  |
| real number (also real numbers) | वास्तविक संख्या | title | 0 | 0 | — |  |  |
| integer (also integers) | पूर्णांक | title | 1 | 1 | — |  |  |
| rational number (also rational numbers) | परिमेय संख्या | title, n = 85 | 3 | 3 | — |  |  |
| fraction (also fractions) | भिन्न | title, n = 76 | 11 | 11 | — |  |  |
| decimal (also decimals) | दशमलव | title, n = 67 | 2 | 2 | — |  |  |
| algebra | बीजगणित | corpus, n = 25 | 8 | 8 | — |  |  |
| equation (also equations) | समीकरण | corpus, n = 112 | 20 | 19 | `ncert.leQ3Note` |  |  |
| linear equation (also linear equations) | रैखिक समीकरण | title | 4 | 4 | — |  |  |
| quadratic equation (also quadratic equations) | द्विघात समीकरण | title, n = 72 | 1 | 1 | — |  |  |
| polynomial (also polynomials) | बहुपद | title, n = 92 | 1 | 1 | — |  |  |
| expression (also expressions) | व्यंजक | page | 11 | 10 | `explain.v.focusOn` |  |  |
| variable (also variables) | चर | corpus, n = 44 | 12 | 6 | `mistake.graph.reset` `mistake.graph.at` `mistake.graph.live` `mistake.graph.liveEquation` `mistake.graph.marker` `mistake.graph.howTo` |  |  |
| constant | अचर | corpus, n = 9 | 5 | 5 | — |  |  |
| coefficient (also coefficients) | गुणांक | corpus, n = 11 | 8 | 7 | `misconception.solveLinearDividedOneTerm.name` |  |  |
| function (also functions) | फलन | corpus, n = 707 | 6 | 6 | — |  |  |
| relation (also relations) | संबंध | corpus, n = 112 | 1 | 1 | — |  |  |
| domain | प्रांत | corpus, n = 38 | 1 | 0 | `staffLib.basis.publicDomain` |  |  |
| codomain | सहप्रांत | corpus, n = 8 | 0 | 0 | — |  |  |
| range | परिसर | corpus, n = 32 | 11 | 0 | `board.prio.atStake` `board.prio.marksShort` `board.prio.sourceForecast` `board.prio.stakeTotal` `board.ready.spread` `paywall.premium.forecast` `insights.forecastPremium` `insights.forecastHonesty` `insights.trendCaption` `insights.trendRowNone` |  |  |
| graph (also graphs) | आलेख | page, n = 64 | 17 | 13 | `explain.visual.graph` `explain.concept.graph` `explain.v.viewGraph` `charts.plotFailed` |  |  |
| axis (also axes) | अक्ष | corpus, n = 145 | 28 | 28 | — |  |  |
| coordinate (also coordinates) | निर्देशांक | corpus, n = 91 | 3 | 3 | — |  |  |
| cartesian | कार्तीय | page | 0 | 0 | — |  |  |
| origin | मूल बिंदु | corpus, n = 33 | 2 | 1 | `cloud.disabled` |  |  |
| slope | ढाल | corpus, n = 81 | 5 | 5 | — |  |  |
| geometry | ज्यामिति | corpus, n = 25 | 6 | 5 | `explain.visual.geometry` |  |  |
| triangle (also triangles) | त्रिभुज | title, n = 216 | 0 | 0 | — |  |  |
| right triangle | समकोण त्रिभुज | page | 0 | 0 | — |  |  |
| circle (also circles) | वृत्त | title | 10 | 10 | — |  |  |
| angle (also angles) | कोण | corpus, n = 357 | 11 | 11 | — |  |  |
| acute angle | न्यून कोण | page | 0 | 0 | — |  |  |
| area (also areas) | क्षेत्रफल | page | 10 | 2 | `board.areas` `board.contentGroups` `board.mapLabel` `board.nswWording` `board.outcomes` `board.prio.stakeTotal` `teach.weakestArea` `tw.board.outcomeArea` |  |  |
| perimeter | परिमाप | title | 0 | 0 | — |  |  |
| volume (also volumes) | आयतन | page, n = 39 | 0 | 0 | — |  |  |
| surface area (also surface areas) | पृष्ठीय क्षेत्रफल | title | 0 | 0 | — |  |  |
| radius | त्रिज्या | page | 2 | 2 | — |  |  |
| diameter | व्यास | page | 0 | 0 | — |  |  |
| height | ऊँचाई | page | 2 | 2 | — |  |  |
| cuboid | घनाभ | page | 0 | 0 | — |  |  |
| cylinder | बेलन | page | 0 | 0 | — |  |  |
| cone | शंकु | page | 0 | 0 | — |  |  |
| sphere | गोला | page | 0 | 0 | — |  |  |
| hemisphere | अर्धगोला | page | 0 | 0 | — |  |  |
| trigonometry | त्रिकोणमिति | title | 2 | 2 | — |  |  |
| trigonometric ratio (also trigonometric ratios) | त्रिकोणमितीय अनुपात | page | 0 | 0 | — |  |  |
| ratio (also ratios) | अनुपात | corpus, n = 112 | 1 | 1 | — |  |  |
| proportion (also proportions) | समानुपात | corpus, n = 17 | 1 | 0 | `hsc.paperHow` |  |  |
| percentage (also percent) | प्रतिशत | corpus, n = 148 | 8 | 1 | `verdict.creditAvailable` `settings.spaceOf` `verdict.rungLabel` `verdict.markWeightShort` `verdict.markWeightLeft` `review.recall` `inst.rungCost` |  |  |
| hypotenuse | कर्ण | page | 0 | 0 | — |  |  |
| opposite side | सम्मुख भुजा | page | 0 | 0 | — |  |  |
| adjacent side | संलग्न भुजा | page | 0 | 0 | — |  |  |
| calculus | कलन | page | 9 | 9 | — |  |  |
| differential calculus | अवकल गणित | page | 0 | 0 | — |  |  |
| integral calculus | समाकलन गणित | page | 0 | 0 | — |  |  |
| derivative (also derivatives) | अवकलज | corpus, n = 137 | 1 | 1 | — |  |  |
| differentiation | अवकलन | page | 0 | 0 | — |  |  |
| differentiable | अवकलनीय | page | 0 | 0 | — |  |  |
| integral (also integrals, integration) | समाकलन | title | 2 | 1 | `verdict.finalNumberWorking` |  |  |
| indefinite integral | अनिश्चित समाकलन | page | 0 | 0 | — |  |  |
| limit (also limits) | सीमा | corpus, n = 186 | 16 | 14 | `settings.localPlanSub` `placement.unresolvedCap` |  |  |
| continuity | संततता | corpus, n = 116 | 0 | 0 | — |  |  |
| continuous | संतत | page | 1 | 0 | `desk.ledgerPausedNote` |  |  |
| chain rule | श्रृंखला-नियम | page | 1 | 0 | `misconception.diffChainInnerMissing.name` |  |  |
| tangent (also tangent line) | स्पर्श रेखा | page | 3 | 1 | `aw.rule.doubleAngleTan` `aw.rule.compoundTan` |  |  |
| probability | प्रायिकता | corpus, n = 295 | 5 | 5 | — |  |  |
| statistics | सांख्यिकी | title, n = 47 | 5 | 5 | — |  |  |
| mean | माध्य | corpus, n = 303 | 7 | 4 | `verifiedMarks.finalAccepted` `tutorPolicy.prompt.notation` `inst.accuracyHeld` |  |  |
| median | माध्यक | corpus, n = 48 | 1 | 0 | `living.feat.peak` |  |  |
| mode | बहुलक | corpus, n = 58 | 10 | 1 | `settings.themeSystemNote` `explain.launchVisual` `explain.launchAnimated` `explain.kicker` `ncert.c9QuestionModeTitle` `ncert.c8QuestionModeTitle` `match.title` `match.resultHeading` `match.racingHeading` |  |  |
| event (also events) | घटना | page | 2 | 1 | `cloud.syncComplete` |  |  |
| sample space | प्रतिदर्श समष्टि | page | 0 | 0 | — |  |  |
| outcome (also outcomes) | परिणाम | page | 23 | 18 | `study.selectedOutcome` `exams.nsw.omits` `exams.nsw.notYet` `notes.nsw.searchPlaceholder` `notes.nsw.outcomes` |  |  |
| data | आँकड़े | page | 21 | 2 | `app.dataStaysHere` `settings.secData` `settings.dataLocation` `settings.storagePending` `settings.dataBackup` `settings.reallyDelete` `legal.unreviewedBody` `explain.visual.statistics` `explain.v.viewData` `examRoom.pendingDeviceOnly` |  |  |
| frequency distribution | बारंबारता बंटन | page | 0 | 0 | — |  |  |
| set (also sets) | समुच्चय | corpus, n = 681 | 66 | 0 | `lang.changed` `board.ready.whyIn` `board.stateHelp.independent` `board.stateHelp.thin` `tasks.sub` `tasks.setMyself` `tasks.empty` `practice.pyqOnlyNote` `settings.emailNotSet` `settings.setPassword` |  |  |
| subset (also subsets) | उपसमुच्चय | page | 0 | 0 | — |  |  |
| union | सम्मिलन | page, n = 14 | 0 | 0 | — |  |  |
| intersection | सर्वनिष्ठ | page, n = 12 | 0 | 0 | — |  |  |
| element (also elements) | अवयव | corpus, n = 82 | 0 | 0 | — |  |  |
| empty set | रिक्त समुच्चय | corpus, n = 22 | 0 | 0 | — |  |  |
| finite | परिमित | page | 0 | 0 | — |  |  |
| infinite | अपरिमित | page | 0 | 0 | — |  |  |
| interval (also intervals) | अंतराल | page | 0 | 0 | — |  |  |
| theorem (also theorems) | प्रमेय | corpus, n = 139 | 2 | 2 | — |  |  |
| formula (also formulae, formulas) | सूत्र | corpus, n = 66 | 22 | 22 | — |  |  |
| identity (also identities) | सर्वसमिका | page, n = 19 | 10 | 6 | `login.stepReadySub` `cloud.identity` `cloudSecurity.verifyHelp` `cloudSecurity.socialNote` |  |  |
| chapter (also chapters) | अध्याय | page | 125 | 112 | `tasks.dotpointIn` `placement.rootGapAt` `placement.practiseRoot` `placement.cellStatus` `placement.homeDone` `mock.whyRow` `notes.bookmarkChapter` `notes.cardsTitle` `notes.nextWhat` `inst.ledeChapterPeriod` |  |  |
| exercise (also exercises) | प्रश्नावली | title, n = 68 | 20 | 16 | `ncert.ncertExercises` `ncert.c10Intro` `ncert.c10TabExercises` `ncert.c9AnswerVerification` |  |  |
| question (also questions) | प्रश्न | page | 373 | 369 | `examAnalysis.partial` `cloud.socialCreateNote` `readerPermission.leadQuestionPhoto` `readerPermission.what` |  |  |
| solution (also solutions) | हल | page | 63 | 62 | `ncert.leQ3Note` |  |  |
| answer (also answers) | उत्तर | page | 347 | 336 | `history.emptyAll` `examRoom.yours` `examRoom.correctShort` `inst.trend` `insights.dnaEmpty` `paper.err.nothing` `badge.firstSteps.desc` `badge.tenUp.desc` `badge.halfCentury.desc` `badge.century.desc` |  |  |
| example (also examples) | उदाहरण | corpus, n = 551 | 19 | 16 | `gloss.example` `sketch.xIntercepts.placeholder` `sketch.yIntercept.placeholder` |  |  |
| summary | सारांश | corpus, n = 21 | 3 | 3 | — |  |  |
| figure (also figures) | आकृति | corpus, n = 549 | 3 | 2 | `inst.reportSeriesFailed` |  |  |
| table (also tables) | सारणी | corpus, n = 176 | 2 | 0 | `teach.noPredictionIndia` `ncert.rnIntro` |  |  |
| hint (also hints) | संकेत | page | 47 | 45 | `msg.working.maybe` `msg.working.break` |  |  |
| method (also methods) | विधि | corpus, n = 36 | 44 | 42 | `cloudSecurity.signInMethods` `inst.trend` |  |  |

Deliberately not translated, because NCERT's own Hindi books print them in Latin: sin, cos, tan, lim, log, dx, unit symbols, JEE, NCERT, CBSE (see the head of `ncertTerms.js`).
