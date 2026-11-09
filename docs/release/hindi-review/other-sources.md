# Hindi outside the catalogue

Hindi review packet. Status: **No native-speaker review on record.**

Hindi a student sees or hears that does not come from `strings.hi.js`. Every function below was called with English and with Hindi, so each pair is what the app actually shows.

## Notices written beside their component

A comment in `photoSubmissionGuard.js` says these notices should move into the parity-checked catalogue. Until they do, they are reviewed here.

| Source | Call | English | Hindi | OK? | Suggested Hindi | Note |
|---|---|---|---|---|---|---|
| `photoSubmissionGuard.js` | `pdfReceiptWarning(language, 3)` | This PDF has 3 pages. You can review the transcription, but online Photo grading currently verifies only one image. Attach a single-page photo or switch to Type after checking your answer. | इस PDF में 3 पेज हैं। आप पढ़े गए हल को देख सकते हैं, लेकिन अभी ऑनलाइन फ़ोटो-जाँच केवल एक तस्वीर की पुष्टि कर सकती है। जाँच के लिए एक पेज की फ़ोटो लगाएँ, या उत्तर जाँचकर टाइप करें। |  |  |  |
| `photoSubmissionGuard.js` | `earlierSubmissionNotice(language, "x = 4", true)` | This is the result for the answer you submitted earlier (“x = 4”) — its reply did not reach this device at the time. Your changed answer was not sent. | यह परिणाम आपके पहले जमा किए गए उत्तर (“x = 4”) का है — उसका जवाब पहले नहीं पहुँच पाया था। आपका बदला हुआ उत्तर नहीं भेजा गया। |  |  |  |
| `photoSubmissionGuard.js` | `earlierSubmissionNotice(language, "x = 4", false)` | This is the result for the answer you submitted earlier (“x = 4”) — its reply did not reach this device at the time. Your changed answer has not been sent yet: check it and press Submit to send it. | यह परिणाम आपके पहले जमा किए गए उत्तर (“x = 4”) का है — उसका जवाब पहले नहीं पहुँच पाया था। आपका बदला हुआ उत्तर अभी नहीं भेजा गया है: उसे जाँचकर फिर से जमा करें। |  |  |  |
| `photoSubmissionGuard.js` | `draftPersistenceWarning(language)` | This device could not safely save the attempt. Check available storage and site data, then try again. Nothing has been submitted. | यह डिवाइस आपके उत्तर और जमा करने की पहचान को सुरक्षित नहीं रख पाया। जगह खाली करें या साइट डेटा चालू करें, फिर कोशिश करें। उत्तर अभी जमा नहीं हुआ है। |  |  |  |
| `photoSubmissionGuard.js` | `photoSupportedFormats(language)` | For online grading, use one photo or a single-page PDF. A multi-page PDF can be transcribed but cannot yet receive a verified Photo grade. | ऑनलाइन जाँच के लिए एक फ़ोटो या एक पेज की PDF चुनें। कई पेज की PDF पढ़ी जा सकती है, लेकिन अभी पूरी PDF के अंक नहीं दिए जा सकते। |  |  |  |
| `photoSubmissionGuard.js` | `photoAwaitingOnlineReader(language)` | The attachment remains on this screen. Reading and grading it require an online eligible account and any required guardian consent. | तस्वीर सुरक्षित रूप से इसी स्क्रीन पर है। इसकी लिखावट पढ़ने और जाँचने के लिए इंटरनेट, सही खाता और आवश्यक अभिभावक अनुमति चाहिए। |  |  |  |
| `photoSubmissionGuard.js` | `pdfReaderNeedsOnlineDownload(language)` | This device needs a one-time online download to open PDFs. Reconnect and try again. Photo and PDF mathematical grading also requires an online server. | इस डिवाइस पर PDF खोलने की सुविधा पहले डाउनलोड करनी होगी। इंटरनेट से जुड़कर फिर कोशिश करें। फ़ोटो और PDF की गणित-जाँच भी ऑनलाइन ही होती है। |  |  |  |
| `authoritativeGrade.js` | `gradingReceiptMismatch(language)` | The server response did not match this submission. Your working is retained for a safe retry. | सर्वर से आया परिणाम इस उत्तर से मेल नहीं खाता। आपका काम सुरक्षित है; इसी उत्तर को फिर भेजें। |  |  |  |
| `authoritativeGrade.js` | `numericalGradeUnavailable(language)` | No server-attested numerical marks are available for this result. | इस परिणाम के लिए सर्वर से सत्यापित संख्यात्मक अंक उपलब्ध नहीं हैं। |  |  |  |
| `signedOutInkRecovery.js` | `inkRecoveryWords(language).action` | Sign in to check this answer | इस उत्तर की जाँच के लिए साइन इन करें |  |  |  |
| `signedOutInkRecovery.js` | `inkRecoveryWords(language).otpAction` | Use a phone or email code | फ़ोन या ईमेल कोड का उपयोग करें |  |  |  |
| `signedOutInkRecovery.js` | `inkRecoveryWords(language).otpNotice` | This connects the saved working on this profile to the Pri account you verify. | पुष्टि किया गया Pri खाता इसी प्रोफ़ाइल की सहेजी गई लिखावट से जुड़ जाएगा। |  |  |  |
| `signedOutInkRecovery.js` | `inkRecoveryWords(language).detail` | Your handwriting has not been read or graded. Check its device-save status below. | आपकी लिखावट अभी जाँची नहीं गई है। इस डिवाइस पर सहेजने की स्थिति नीचे देखें। |  |  |  |
| `signedOutInkRecovery.js` | `inkRecoveryWords(language).saveFirst` | Save your handwriting on this device before signing in. | साइन इन करने से पहले लिखावट सुरक्षित सहेजना आवश्यक है। |  |  |  |
| `signedOutInkRecovery.js` | `inkRecoveryWords(language).blocker.ink.waitingGuardian` | A parent or guardian needs to confirm your account before handwriting can be read. | हैंडराइटिंग पढ़ने से पहले किसी अभिभावक को आपके खाते की पुष्टि करनी होगी। |  |  |  |
| `signedOutInkRecovery.js` | `inkRecoveryWords(language).blocker.ink.waitingVerifyEmail` | Verify your email address to have handwriting read. | हैंडराइटिंग पढ़वाने के लिए अपना ईमेल पता सत्यापित करें। |  |  |  |

## Spoken maths (Explain narration)

`client/src/explain/speech.js` turns a line of the board into words for the speech engine. Hindi puts a comparison after the number it compares with ("x, 3 से कम है"). Please check that each line sounds like a Hindi-medium maths teacher speaking.

| Board | Spoken in English | Spoken in Hindi | OK? | Suggested Hindi | Note |
|---|---|---|---|---|---|
| `\frac{3}{4}` | 3 divided by 4 | 3 बटा 4 |  |  |  |
| `x^2` | x squared | x का वर्ग |  |  |  |
| `x^3` | x cubed | x का घन |  |  |  |
| `x^{5}` | x to the power of 5 | x की घात 5 |  |  |  |
| `\sqrt{2}` | square root of 2 | 2 का वर्गमूल |  |  |  |
| `3 \times 4` | 3 times 4 | 3 गुणा 4 |  |  |  |
| `6 \div 2` | 6 divided by 2 | 6 भाग 2 |  |  |  |
| `x = 5` | x equals 5 | x बराबर 5 |  |  |  |
| `x + 1` | x plus 1 | x धन 1 |  |  |  |
| `x - 1` | x minus 1 | x ऋण 1 |  |  |  |
| `\pm 2` | plus or minus 2 | धन या ऋण 2 |  |  |  |
| `x < 3` | x less than 3 | x, 3 से कम है |  |  |  |
| `x > 3` | x greater than 3 | x, 3 से अधिक है |  |  |  |
| `x \le 5` | x less than or equal to 5 | x, 5 से कम या बराबर है |  |  |  |
| `x \ge 5` | x greater than or equal to 5 | x, 5 से अधिक या बराबर है |  |  |  |
| `x \ne 2` | x 2 | x 2 |  |  |  |
| `-2 < x \le 5` | minus 2 less than x less than or equal to 5 | ऋण 2, x से कम है और x, 5 से कम या बराबर है |  |  |  |
| `\pi` | pi | पाई |  |  |  |
| `\theta` | theta | थीटा |  |  |  |
| `30^\circ` | 30 degrees | 30 डिग्री |  |  |  |

Known defect, found while building this packet and reported to the owner of `speech.js`: `x \ne 2` is spoken as "x 2" / "x 2", so the relation is lost, while `x \neq 2` and `x ≠ 2` are spoken correctly. This packet does not fix it.

## Prerequisite skill labels (placement page)

`client/src/engine/prerequisiteSkillsHi.js`: 137 labels.

| English | Hindi | OK? | Suggested Hindi | Note |
|---|---|---|---|---|
| order of operations and brackets | संक्रियाओं का क्रम और कोष्ठक |  |  |  |
| writing and simplifying expressions with an unknown | अज्ञात राशि वाले व्यंजक लिखना और सरल करना |  |  |  |
| signed-number arithmetic | धन-ऋण संख्याओं का अंकगणित |  |  |  |
| decimal place value | दशमलव का स्थानीय मान |  |  |  |
| angle relationships on intersecting lines | प्रतिच्छेदी रेखाओं पर कोणों के संबंध |  |  |  |
| triangle sides and angles | त्रिभुज की भुजाएँ और कोण |  |  |  |
| perpendicular and angle reasoning | लंब और कोणों पर तर्क |  |  |  |
| dividing totals to find a mean | माध्य के लिए योग को भाग देना |  |  |  |
| operating on fractions | भिन्नों पर संक्रियाएँ |  |  |  |
| sign rules | चिह्नों के नियम |  |  |  |
| solving an equation by balancing both sides | दोनों पक्षों को संतुलित रखकर समीकरण हल करना |  |  |  |
| clearing fractional coefficients | भिन्नात्मक गुणांक हटाना |  |  |  |
| angle sum of a triangle | त्रिभुज के कोणों का योग |  |  |  |
| angles on parallel lines | समांतर रेखाओं पर कोण |  |  |  |
| reading and summarising data | आँकड़े पढ़ना और उनका सार निकालना |  |  |  |
| fractions of a whole | पूर्ण के भिन्नात्मक भाग |  |  |  |
| prime factorisation | अभाज्य गुणनखंडन |  |  |  |
| number patterns | संख्या प्रतिरूप |  |  |  |
| roots through grouped prime factors | अभाज्य गुणनखंडों के समूह से मूल |  |  |  |
| a fraction or percentage of a quantity | किसी राशि का भिन्न या प्रतिशत |  |  |  |
| multiplying decimals | दशमलव संख्याओं का गुणा |  |  |  |
| simplifying algebraic expressions | बीजीय व्यंजकों को सरल करना |  |  |  |
| sign rules for coefficients | गुणांकों के चिह्न नियम |  |  |  |
| multiplying measurements | मापों का गुणा |  |  |  |
| triangle and quadrilateral shapes | त्रिभुज और चतुर्भुज आकृतियाँ |  |  |  |
| place value and powers of ten | स्थानीय मान और दस की घातें |  |  |  |
| negative numbers | ऋणात्मक संख्याएँ |  |  |  |
| ratios as fractions | भिन्न के रूप में अनुपात |  |  |  |
| scaling quantities | राशियों को अनुपात में बढ़ाना-घटाना |  |  |  |
| expanding products and the standard identities | गुणनफलों का प्रसार और मानक सर्वसमिकाएँ |  |  |  |
| common factors | उभयनिष्ठ गुणनखंड |  |  |  |
| reading data displays | आँकड़ों के चित्रण पढ़ना |  |  |  |
| reading scales | पैमाने पढ़ना |  |  |  |
| plotting ordered pairs | क्रमित युग्म आलेखित करना |  |  |  |
| signed differences | चिह्न सहित अंतर |  |  |  |
| linear expressions in one variable | एक चर वाले रैखिक व्यंजक |  |  |  |
| drawing a graph from a table | सारणी से आलेख बनाना |  |  |  |
| terms and coefficients | पद और गुणांक |  |  |  |
| operating on rational numbers | परिमेय संख्याओं पर संक्रियाएँ |  |  |  |
| square roots | वर्गमूल |  |  |  |
| factor patterns | गुणनखंड के प्रतिरूप |  |  |  |
| expansion identities | प्रसार की सर्वसमिकाएँ |  |  |  |
| polygon angle properties | बहुभुज के कोणों के गुण |  |  |  |
| congruent triangles | सर्वांगसम त्रिभुज |  |  |  |
| area formulae | क्षेत्रफल के सूत्र |  |  |  |
| decimal arithmetic | दशमलव अंकगणित |  |  |  |
| simple probability | सरल प्रायिकता |  |  |  |
| fractions | भिन्न |  |  |  |
| number sequences | संख्या अनुक्रम |  |  |  |
| solving for an unknown term | अज्ञात पद ज्ञात करना |  |  |  |
| powers for geometric terms | गुणोत्तर पदों के लिए घातें |  |  |  |
| prime factorisation, HCF and LCM | अभाज्य गुणनखंडन, म.स. और ल.स. |  |  |  |
| irrational numbers | अपरिमेय संख्याएँ |  |  |  |
| terms, degree and zeroes | पद, घात और शून्यक |  |  |  |
| factorising quadratics | द्विघातों का गुणनखंडन |  |  |  |
| solving a linear equation | रैखिक समीकरण हल करना |  |  |  |
| graphing a linear relation | रैखिक संबंध का आलेख |  |  |  |
| factorising a quadratic | द्विघात का गुणनखंडन |  |  |  |
| surds in the roots | मूलों में करणी |  |  |  |
| the nth term of a progression | श्रेढ़ी का n-वाँ पद |  |  |  |
| solving for an unknown | अज्ञात राशि ज्ञात करना |  |  |  |
| congruence criteria | सर्वांगसमता की कसौटियाँ |  |  |  |
| ratio and proportion | अनुपात और समानुपात |  |  |  |
| distances between points | बिंदुओं के बीच दूरियाँ |  |  |  |
| square roots in the distance formula | दूरी सूत्र में वर्गमूल |  |  |  |
| right-triangle sides through squares and roots | वर्ग और वर्गमूल से समकोण त्रिभुज की भुजाएँ |  |  |  |
| ratios of sides | भुजाओं के अनुपात |  |  |  |
| exact surd values | करणी के सटीक मान |  |  |  |
| similar right triangles share their side ratios | समरूप समकोण त्रिभुजों की भुजाओं के अनुपात समान होते हैं |  |  |  |
| ratios at 30°, 45° and 60° | 30°, 45° और 60° पर अनुपात |  |  |  |
| chord and radius properties | जीवा और त्रिज्या के गुण |  |  |  |
| circle and sector area | वृत्त और त्रिज्यखंड का क्षेत्रफल |  |  |  |
| a fraction of a full turn | पूरे चक्कर का भिन्नात्मक भाग |  |  |  |
| surface area and volume of solids | ठोसों का पृष्ठीय क्षेत्रफल और आयतन |  |  |  |
| curved areas | वक्र क्षेत्रफल |  |  |  |
| mean, median and mode | माध्य, माध्यक और बहुलक |  |  |  |
| frequency tables | बारंबारता सारणियाँ |  |  |  |
| theoretical probability | सैद्धांतिक प्रायिकता |  |  |  |
| equally likely outcomes | समप्रायिक परिणाम |  |  |  |
| the number sets N, Z, Q and R | संख्या समुच्चय N, Z, Q और R |  |  |  |
| Cartesian products and set notation | कार्तीय गुणन और समुच्चय संकेतन |  |  |  |
| input–output rules | निवेश–निर्गत नियम |  |  |  |
| graphing | आलेख बनाना |  |  |  |
| trigonometric ratios and identities | त्रिकोणमितीय अनुपात और सर्वसमिकाएँ |  |  |  |
| arc length for radian measure | रेडियन माप के लिए चाप की लंबाई |  |  |  |
| the quadratic formula and discriminant | द्विघाती सूत्र और विविक्तकर |  |  |  |
| real-number operations | वास्तविक संख्याओं पर संक्रियाएँ |  |  |  |
| lines in two variables | दो चरों वाली रेखाएँ |  |  |  |
| products and the multiplication principle | गुणनफल और गुणन का सिद्धांत |  |  |  |
| factoring and regrouping products | गुणनफलों का गुणनखंड और पुनर्समूहन |  |  |  |
| nCr values | nCr के मान |  |  |  |
| expanding (a + b)ⁿ for small n | छोटे n के लिए (a + b)ⁿ का प्रसार |  |  |  |
| laws of exponents | घातांक के नियम |  |  |  |
| nth term and sum of an AP | समांतर श्रेढ़ी का n-वाँ पद और योग |  |  |  |
| common ratio of a GP | गुणोत्तर श्रेढ़ी का सार्व अनुपात |  |  |  |
| powers | घातें |  |  |  |
| distance and section formulae | दूरी और विभाजन सूत्र |  |  |  |
| linear equations in two variables | दो चरों वाले रैखिक समीकरण |  |  |  |
| slope | ढाल |  |  |  |
| line equations and distances | रेखा के समीकरण और दूरियाँ |  |  |  |
| completing the square | पूर्ण वर्ग बनाना |  |  |  |
| distance and section formulae in two dimensions | दो विमाओं में दूरी और विभाजन सूत्र |  |  |  |
| factorising to cancel a 0/0 form | 0/0 रूप हटाने के लिए गुणनखंडन |  |  |  |
| function notation | फलन संकेतन |  |  |  |
| evaluating polynomials | बहुपदों का मान निकालना |  |  |  |
| standard trigonometric limits | मानक त्रिकोणमितीय सीमाएँ |  |  |  |
| grouped mean and median | वर्गीकृत आँकड़ों का माध्य और माध्यक |  |  |  |
| square roots for the standard deviation | मानक विचलन के लिए वर्गमूल |  |  |  |
| events as sets: union and intersection | समुच्चय के रूप में घटनाएँ: सम्मिलन और सर्वनिष्ठ |  |  |  |
| classical probability | शास्त्रीय प्रायिकता |  |  |  |
| counting outcomes | परिणामों की गिनती |  |  |  |
| domain, range and function rules | प्रांत, परिसर और फलन के नियम |  |  |  |
| set notation | समुच्चय संकेतन |  |  |  |
| trigonometric values and periodicity | त्रिकोणमितीय मान और आवर्तिता |  |  |  |
| inverse functions | प्रतिलोम फलन |  |  |  |
| systems of linear equations | रैखिक समीकरण निकाय |  |  |  |
| signed multiplication | चिह्न सहित गुणा |  |  |  |
| matrix operations | आव्यूह संक्रियाएँ |  |  |  |
| limits and derivatives | सीमा और अवकलज |  |  |  |
| trigonometric functions | त्रिकोणमितीय फलन |  |  |  |
| derivatives of inverse trigonometric functions | प्रतिलोम त्रिकोणमितीय फलनों के अवकलज |  |  |  |
| differentiation rules | अवकलन के नियम |  |  |  |
| solving f′(x) = 0 | f′(x) = 0 हल करना |  |  |  |
| derivatives to reverse | उलटने के लिए अवकलज |  |  |  |
| algebraic manipulation | बीजीय परिवर्तन |  |  |  |
| integrating trigonometric functions | त्रिकोणमितीय फलनों का समाकलन |  |  |  |
| definite integrals | निश्चित समाकल |  |  |  |
| curve shapes | वक्रों के आकार |  |  |  |
| integration techniques | समाकलन की विधियाँ |  |  |  |
| coordinates in three dimensions | त्रिविमीय निर्देशांक |  |  |  |
| cosine of an angle | कोण की कोज्या |  |  |  |
| dot and cross products | अदिश और सदिश गुणनफल |  |  |  |
| equations of lines | रेखाओं के समीकरण |  |  |  |
| feasible regions | सुसंगत क्षेत्र |  |  |  |
| intersections of lines | रेखाओं के प्रतिच्छेद |  |  |  |
| compound events | संयुक्त घटनाएँ |  |  |  |
| nCr for the binomial distribution | द्विपद बंटन के लिए nCr |  |  |  |

## Language picker

`client/src/i18n/languages.js` shows the Hindi option as **हिन्दी** (English name: Hindi).

## Legal notices (lane L7)

The four notices are documents, not strings, and lane L7 owns their text (`docs/legal/**`). L7 is rewriting them now, in #727. In each document the English text is the operative version. Review the Hindi against the English of the **same** version: the hashes below identify the version this packet was generated from. Regenerate before review if they no longer match.

| Notice | English | Hindi | English sha256 (first 16) | Hindi sha256 (first 16) | Headings EN / HI | OK? | Note |
|---|---|---|---|---|---|---|---|
| privacy | `docs/legal/privacy.md` | `docs/legal/privacy.hi.md` | `34d3ce767ac5feae` | `68aededa7310366a` | 11 / 11 |  |  |
| terms | `docs/legal/terms.md` | `docs/legal/terms.hi.md` | `18ca07f0e9d2da2b` | `59c6094eff63e662` | 10 / 10 |  |  |
| refund-policy | `docs/legal/refund-policy.md` | `docs/legal/refund-policy.hi.md` | `06a11d334c4095c5` | `592d052b625be803` | 5 / 5 |  |  |
| grievance | `docs/legal/grievance.md` | `docs/legal/grievance.hi.md` | `d93a04c1a4f05e3a` | `c4650e4d3b230aa4` | 6 / 6 |  |  |

## Files with Devanagari that are not in this packet

| File | Why it is left out |
|---|---|
| `client/src/i18n/strings.hi.js` | the catalogue itself (screens/*.md) |
| `client/src/i18n/strings.en.js` | the English catalogue; its Devanagari is the language names and glosses shown in the screens tables |
| `client/src/i18n/glossary.js` | term-matching code for ncertTerms.js; its Devanagari is in comments and search folding |
| `client/src/photo/finalAnswer.js` | words the answer reader recognises in a student's own writing; never displayed |
| `client/src/engine/checker-core.js` | the rupee abbreviation रु. the answer checker accepts before a number; never displayed |
| `client/src/tutor/captionRule.js` | number words the tutor caption guard recognises; the tutor is off at launch (D4) |
| `client/src/components/TermGloss.jsx` | Devanagari only in comments |
| `client/src/pages/Home.jsx` | Devanagari only in a comment |
| `client/src/pages/SettingsLegacy.jsx` | Devanagari only in a comment |
| `server/platform/tutor.js` | tutor prompts; the tutor is off at launch (D4) |
| `server/platform/tutorGuard.js` | tutor guard word lists; the tutor is off at launch (D4) |
