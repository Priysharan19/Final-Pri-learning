# NCERT term list

Hindi review packet. Status: **No native-speaker review on record.**

These are the maths terms in `client/src/i18n/ncertTerms.js`. That file holds the NCERT Hindi term the app shows beside an English term when the "Show NCERT Hindi terms" setting is on. Each term carries where it was read: `page` (a rendered page of an NCERT Hindi textbook PDF), `title` (a chapter or section title), or `corpus` with `n`, its count in the extracted text of the sampled chapters (Classes 7–12). None of this has been checked by a person against the printed books.

For each term, the table counts the catalogue strings whose English uses it, and how many of their Hindi translations use the NCERT term. The match is a plain text search, so an inflected form can count as a use, and a string can rightly use another word. Rows in the last column are the ones to read first.

Please check: is the NCERT term right for that class level? Does the interface use it consistently? Where a string uses a different word, is that deliberate?

| English | NCERT Hindi | Source | Strings using the English | Hindi uses the term | Keys where the Hindi does not (first 10) | OK? | Note |
|---|---|---|---|---|---|---|---|
| mathematics (also maths, math) | गणित | corpus, n = 377 | 41 | 40 | `exams.bp.ioqm` |  |  |
| number (also numbers) | संख्या | corpus, n = 1091 | 37 | 21 | `progress.rankedByMarks` `placement.progressBody` `signup.phoneLabel` `signup.changeNumber` `signup.parentPhoneLabel` `signup.parentHome1` `signup.withdrawPhone` `signup.withdrawSent` `guardianPage.yourPhone` `cloudSecurity.codeDeleteHelp` |  |  |
| real number (also real numbers) | वास्तविक संख्या | title | 0 | 0 | — |  |  |
| integer (also integers) | पूर्णांक | title | 1 | 1 | — |  |  |
| rational number (also rational numbers) | परिमेय संख्या | title, n = 85 | 3 | 3 | — |  |  |
| fraction (also fractions) | भिन्न | title, n = 76 | 7 | 7 | — |  |  |
| decimal (also decimals) | दशमलव | title, n = 67 | 2 | 2 | — |  |  |
| algebra | बीजगणित | corpus, n = 25 | 5 | 5 | — |  |  |
| equation (also equations) | समीकरण | corpus, n = 112 | 19 | 18 | `ncert.leQ3Note` |  |  |
| linear equation (also linear equations) | रैखिक समीकरण | title | 4 | 4 | — |  |  |
| quadratic equation (also quadratic equations) | द्विघात समीकरण | title, n = 72 | 1 | 1 | — |  |  |
| polynomial (also polynomials) | बहुपद | title, n = 92 | 0 | 0 | — |  |  |
| expression (also expressions) | व्यंजक | page | 5 | 4 | `explain.v.focusOn` |  |  |
| variable (also variables) | चर | corpus, n = 44 | 2 | 2 | — |  |  |
| constant | अचर | corpus, n = 9 | 0 | 0 | — |  |  |
| coefficient (also coefficients) | गुणांक | corpus, n = 11 | 0 | 0 | — |  |  |
| function (also functions) | फलन | corpus, n = 707 | 2 | 2 | — |  |  |
| relation (also relations) | संबंध | corpus, n = 112 | 1 | 1 | — |  |  |
| domain | प्रांत | corpus, n = 38 | 0 | 0 | — |  |  |
| codomain | सहप्रांत | corpus, n = 8 | 0 | 0 | — |  |  |
| range | परिसर | corpus, n = 32 | 4 | 0 | `progress.likelyRange` `progressAu.rangeLabel` `progressAu.bandRange` `progressAu.range` |  |  |
| graph (also graphs) | आलेख | page, n = 64 | 5 | 1 | `explain.visual.graph` `explain.concept.graph` `explain.v.viewGraph` `charts.plotFailed` |  |  |
| axis (also axes) | अक्ष | corpus, n = 145 | 2 | 2 | — |  |  |
| coordinate (also coordinates) | निर्देशांक | corpus, n = 91 | 2 | 2 | — |  |  |
| cartesian | कार्तीय | page | 0 | 0 | — |  |  |
| origin | मूल बिंदु | corpus, n = 33 | 2 | 1 | `cloud.disabled` |  |  |
| slope | ढाल | corpus, n = 81 | 0 | 0 | — |  |  |
| geometry | ज्यामिति | corpus, n = 25 | 6 | 5 | `explain.visual.geometry` |  |  |
| triangle (also triangles) | त्रिभुज | title, n = 216 | 0 | 0 | — |  |  |
| right triangle | समकोण त्रिभुज | page | 0 | 0 | — |  |  |
| circle (also circles) | वृत्त | title | 1 | 1 | — |  |  |
| angle (also angles) | कोण | corpus, n = 357 | 2 | 2 | — |  |  |
| acute angle | न्यून कोण | page | 0 | 0 | — |  |  |
| area (also areas) | क्षेत्रफल | page | 3 | 1 | `teach.weakestArea` `examRoom.verdictSolid` |  |  |
| perimeter | परिमाप | title | 0 | 0 | — |  |  |
| volume (also volumes) | आयतन | page, n = 39 | 0 | 0 | — |  |  |
| surface area (also surface areas) | पृष्ठीय क्षेत्रफल | title | 0 | 0 | — |  |  |
| radius | त्रिज्या | page | 0 | 0 | — |  |  |
| diameter | व्यास | page | 0 | 0 | — |  |  |
| height | ऊँचाई | page | 0 | 0 | — |  |  |
| cuboid | घनाभ | page | 0 | 0 | — |  |  |
| cylinder | बेलन | page | 0 | 0 | — |  |  |
| cone | शंकु | page | 0 | 0 | — |  |  |
| sphere | गोला | page | 0 | 0 | — |  |  |
| hemisphere | अर्धगोला | page | 0 | 0 | — |  |  |
| trigonometry | त्रिकोणमिति | title | 2 | 2 | — |  |  |
| trigonometric ratio (also trigonometric ratios) | त्रिकोणमितीय अनुपात | page | 0 | 0 | — |  |  |
| ratio (also ratios) | अनुपात | corpus, n = 112 | 1 | 1 | — |  |  |
| proportion (also proportions) | समानुपात | corpus, n = 17 | 0 | 0 | — |  |  |
| percentage (also percent) | प्रतिशत | corpus, n = 148 | 10 | 2 | `verdict.creditAvailable` `verdict.ocrConfidence` `settings.spaceOf` `verdict.rungLabel` `verdict.markWeightShort` `verdict.markWeightLeft` `review.recall` `inst.rungCost` |  |  |
| hypotenuse | कर्ण | page | 0 | 0 | — |  |  |
| opposite side | सम्मुख भुजा | page | 0 | 0 | — |  |  |
| adjacent side | संलग्न भुजा | page | 0 | 0 | — |  |  |
| calculus | कलन | page | 8 | 8 | — |  |  |
| differential calculus | अवकल गणित | page | 0 | 0 | — |  |  |
| integral calculus | समाकलन गणित | page | 0 | 0 | — |  |  |
| derivative (also derivatives) | अवकलज | corpus, n = 137 | 0 | 0 | — |  |  |
| differentiation | अवकलन | page | 0 | 0 | — |  |  |
| differentiable | अवकलनीय | page | 0 | 0 | — |  |  |
| integral (also integrals, integration) | समाकलन | title | 1 | 0 | `verdict.finalNumberWorking` |  |  |
| indefinite integral | अनिश्चित समाकलन | page | 0 | 0 | — |  |  |
| limit (also limits) | सीमा | corpus, n = 186 | 11 | 9 | `settings.localPlanSub` `placement.unresolvedCap` |  |  |
| continuity | संततता | corpus, n = 116 | 0 | 0 | — |  |  |
| continuous | संतत | page | 0 | 0 | — |  |  |
| chain rule | श्रृंखला-नियम | page | 0 | 0 | — |  |  |
| tangent (also tangent line) | स्पर्श रेखा | page | 1 | 1 | — |  |  |
| probability | प्रायिकता | corpus, n = 295 | 4 | 4 | — |  |  |
| statistics | सांख्यिकी | title, n = 47 | 4 | 4 | — |  |  |
| mean | माध्य | corpus, n = 303 | 4 | 0 | `verifiedMarks.finalAccepted` `photo.answerAmbiguous` `ink.answerAmbiguous` `inst.accuracyHeld` |  |  |
| median | माध्यक | corpus, n = 48 | 0 | 0 | — |  |  |
| mode | बहुलक | corpus, n = 58 | 9 | 0 | `settings.themeSystemNote` `explain.launchVisual` `explain.launchAnimated` `explain.kicker` `ncert.c9QuestionModeTitle` `ncert.c8QuestionModeTitle` `match.title` `match.resultHeading` `match.racingHeading` |  |  |
| event (also events) | घटना | page | 2 | 1 | `cloud.syncComplete` |  |  |
| sample space | प्रतिदर्श समष्टि | page | 0 | 0 | — |  |  |
| outcome (also outcomes) | परिणाम | page | 7 | 6 | `study.selectedOutcome` |  |  |
| data | आँकड़े | page | 16 | 2 | `app.dataStaysHere` `settings.secData` `settings.dataLocation` `settings.dataBackup` `settings.reallyDelete` `explain.visual.statistics` `explain.v.viewData` `examRoom.pendingDeviceOnly` `cloud.disconnected` `cloudSecurity.currentRevoked` |  |  |
| frequency distribution | बारंबारता बंटन | page | 0 | 0 | — |  |  |
| set (also sets) | समुच्चय | corpus, n = 681 | 33 | 0 | `lang.changed` `tasks.sub` `tasks.setMyself` `tasks.empty` `practice.pyqOnlyNote` `settings.emailNotSet` `settings.setPassword` `settings.dataNote` `settings.backupRestoredUnprotected` `misconception.dividedByVariable.explain` |  |  |
| subset (also subsets) | उपसमुच्चय | page | 0 | 0 | — |  |  |
| union | सम्मिलन | page, n = 14 | 0 | 0 | — |  |  |
| intersection | सर्वनिष्ठ | page, n = 12 | 0 | 0 | — |  |  |
| element (also elements) | अवयव | corpus, n = 82 | 0 | 0 | — |  |  |
| empty set | रिक्त समुच्चय | corpus, n = 22 | 0 | 0 | — |  |  |
| finite | परिमित | page | 0 | 0 | — |  |  |
| infinite | अपरिमित | page | 0 | 0 | — |  |  |
| interval (also intervals) | अंतराल | page | 0 | 0 | — |  |  |
| theorem (also theorems) | प्रमेय | corpus, n = 139 | 1 | 1 | — |  |  |
| formula (also formulae, formulas) | सूत्र | corpus, n = 66 | 8 | 8 | — |  |  |
| identity (also identities) | सर्वसमिका | page, n = 19 | 4 | 0 | `login.stepReadySub` `cloud.identity` `cloudSecurity.verifyHelp` `cloudSecurity.socialNote` |  |  |
| chapter (also chapters) | अध्याय | page | 88 | 78 | `tasks.dotpointIn` `placement.rootGapAt` `placement.practiseRoot` `placement.cellStatus` `placement.homeDone` `notes.bookmarkChapter` `notes.cardsTitle` `inst.ledeChapter` `inst.mapCardFeeds` `inst.mapCardFeedsSecure` |  |  |
| exercise (also exercises) | प्रश्नावली | title, n = 68 | 19 | 15 | `ncert.ncertExercises` `ncert.c10Intro` `ncert.c10TabExercises` `ncert.c9AnswerVerification` |  |  |
| question (also questions) | प्रश्न | page | 219 | 217 | `examAnalysis.partial` `cloud.socialCreateNote` |  |  |
| solution (also solutions) | हल | page | 50 | 49 | `ncert.leQ3Note` |  |  |
| answer (also answers) | उत्तर | page | 219 | 214 | `history.emptyAll` `examRoom.yours` `examRoom.correctShort` `progressAu.answerToStart` `progressAu.emptyPriorities` |  |  |
| example (also examples) | उदाहरण | corpus, n = 551 | 16 | 15 | `gloss.example` |  |  |
| summary | सारांश | corpus, n = 21 | 2 | 2 | — |  |  |
| figure (also figures) | आकृति | corpus, n = 549 | 3 | 2 | `inst.reportSeriesFailed` |  |  |
| table (also tables) | सारणी | corpus, n = 176 | 3 | 0 | `progress.rankedByMarks` `teach.noPredictionIndia` `ncert.rnIntro` |  |  |
| hint (also hints) | संकेत | page | 26 | 26 | — |  |  |
| method (also methods) | विधि | corpus, n = 36 | 31 | 30 | `cloudSecurity.signInMethods` |  |  |

Deliberately not translated, because NCERT's own Hindi books print them in Latin: sin, cos, tan, lim, log, dx, unit symbols, JEE, NCERT, CBSE (see the head of `ncertTerms.js`).
