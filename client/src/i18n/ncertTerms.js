// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the NCERT Ganit term bridge.
//
// WHY THIS EXISTS, AND WHY IT IS NOT A TRANSLATION.
//
// Around 79% of Class 9–10 students study in a non-English medium, and almost
// all of them sit the exam in English: JEE Main 2024's January session took
// 40,256 Hindi candidates against ~12.3 lakh overall, and NEET UG 2025 ran 80%
// English against 14.4% Hindi. JEE Advanced — the gate to the IITs — offers
// English and Hindi and nothing else.
//
// More decisive than any of those numbers: nobody ever sits a monolingual
// non-English paper. Choosing Hindi gives a BILINGUAL paper, English and Hindi
// together, toggleable mid-exam, and NTA's own rule is that where a translation
// is ambiguous the English is final. A student drilled on a Hindi-only
// rendering of a question has been prepared for a paper that does not exist.
//
// So this is not a translation layer for mathematics, and adding one would be
// a mistake rather than an omission. It is a gloss: the English term stays
// exactly where it was, authoritative and always visible, and the NCERT Hindi
// term appears beside it on request. That is the same shape as the real paper,
// and it is the thing a Hindi-medium student actually needs — they know
// समुच्चय and they will meet "set" in the exam hall.
//
// PROVENANCE. Every entry carries where it came from, and nothing is here that
// was not found in NCERT's own Hindi mathematics textbooks:
//
//   'page'   — read off a rendered page of an NCERT Hindi PDF.
//   'title'  — a chapter or section title on such a page.
//   'corpus' — counted in the extracted text; `n` is the number of occurrences
//              across the sampled chapters (Classes 7–12, ncert.nic.in).
//
// A term with no source does not ship. When a chapter name contains no term
// from this file, it simply gets no gloss — an honest blank rather than a
// guess. That is why "Arithmetic Progressions" is absent: its Hindi title was
// not among the pages sampled, and inventing one would be exactly the failure
// this file is supposed to prevent.
//
// WHAT DELIBERATELY HAS NO HINDI. sin, cos, tan, lim, log, dx and the unit
// symbols are printed in Latin in NCERT's own Hindi editions — the page reads
// `sin A = कोण A की सम्मुख भुजा / कर्ण`, Hindi words around Latin operators. So
// are JEE, NCERT and CBSE. Glossing those would be inventing a convention the
// textbook does not use.
//
// This module is data only and imports nothing, so it splits cleanly into its
// own chunk and an install that never turns the bridge on never fetches it.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * English term → NCERT Hindi, with where it was found.
 *
 * `also` lists extra English spellings that should match the same entry. It is
 * for genuine alternates ("maths"/"mathematics"), never for near-misses.
 */
export default [
  // ── Number ─────────────────────────────────────────────────────────────────
  { en: 'mathematics', hi: 'गणित', src: 'corpus', n: 377, also: ['maths', 'math'] },
  { en: 'number', hi: 'संख्या', src: 'corpus', n: 1091, also: ['numbers'] },
  { en: 'real number', hi: 'वास्तविक संख्या', src: 'title', also: ['real numbers'] },
  { en: 'integer', hi: 'पूर्णांक', src: 'title', also: ['integers'] },
  { en: 'rational number', hi: 'परिमेय संख्या', src: 'title', n: 85, also: ['rational numbers'] },
  { en: 'fraction', hi: 'भिन्न', src: 'title', n: 76, also: ['fractions'] },
  { en: 'decimal', hi: 'दशमलव', src: 'title', n: 67, also: ['decimals'] },

  // ── Algebra ────────────────────────────────────────────────────────────────
  { en: 'algebra', hi: 'बीजगणित', src: 'corpus', n: 25 },
  { en: 'equation', hi: 'समीकरण', src: 'corpus', n: 112, also: ['equations'] },
  { en: 'linear equation', hi: 'रैखिक समीकरण', src: 'title', also: ['linear equations'] },
  { en: 'quadratic equation', hi: 'द्विघात समीकरण', src: 'title', n: 72, also: ['quadratic equations'] },
  { en: 'polynomial', hi: 'बहुपद', src: 'title', n: 92, also: ['polynomials'] },
  { en: 'expression', hi: 'व्यंजक', src: 'page', also: ['expressions'] },
  { en: 'variable', hi: 'चर', src: 'corpus', n: 44, also: ['variables'] },
  { en: 'constant', hi: 'अचर', src: 'corpus', n: 9 },
  { en: 'coefficient', hi: 'गुणांक', src: 'corpus', n: 11, also: ['coefficients'] },

  // ── Functions and coordinates ──────────────────────────────────────────────
  { en: 'function', hi: 'फलन', src: 'corpus', n: 707, also: ['functions'] },
  { en: 'relation', hi: 'संबंध', src: 'corpus', n: 112, also: ['relations'] },
  { en: 'domain', hi: 'प्रांत', src: 'corpus', n: 38 },
  { en: 'codomain', hi: 'सहप्रांत', src: 'corpus', n: 8 },
  { en: 'range', hi: 'परिसर', src: 'corpus', n: 32 },
  { en: 'graph', hi: 'आलेख', src: 'page', n: 64, also: ['graphs'] },
  { en: 'axis', hi: 'अक्ष', src: 'corpus', n: 145, also: ['axes'] },
  { en: 'coordinate', hi: 'निर्देशांक', src: 'corpus', n: 91, also: ['coordinates'] },
  { en: 'cartesian', hi: 'कार्तीय', src: 'page' },
  // Attested spaced 33 times against joined once, so the spaced form is used.
  { en: 'origin', hi: 'मूल बिंदु', src: 'corpus', n: 33 },
  // ढाल is a straight line's slope; प्रवणता appears in the calculus prose for
  // the gradient of a tangent. ढाल is the safe default for a school app.
  { en: 'slope', hi: 'ढाल', src: 'corpus', n: 81 },

  // ── Geometry and mensuration ───────────────────────────────────────────────
  { en: 'geometry', hi: 'ज्यामिति', src: 'corpus', n: 25 },
  { en: 'triangle', hi: 'त्रिभुज', src: 'title', n: 216, also: ['triangles'] },
  { en: 'right triangle', hi: 'समकोण त्रिभुज', src: 'page' },
  { en: 'circle', hi: 'वृत्त', src: 'title', also: ['circles'] },
  { en: 'angle', hi: 'कोण', src: 'corpus', n: 357, also: ['angles'] },
  { en: 'acute angle', hi: 'न्यून कोण', src: 'page' },
  { en: 'area', hi: 'क्षेत्रफल', src: 'page', also: ['areas'] },
  { en: 'perimeter', hi: 'परिमाप', src: 'title' },
  { en: 'volume', hi: 'आयतन', src: 'page', n: 39, also: ['volumes'] },
  { en: 'surface area', hi: 'पृष्ठीय क्षेत्रफल', src: 'title', also: ['surface areas'] },
  { en: 'radius', hi: 'त्रिज्या', src: 'page' },
  { en: 'diameter', hi: 'व्यास', src: 'page' },
  { en: 'height', hi: 'ऊँचाई', src: 'page' },
  { en: 'cuboid', hi: 'घनाभ', src: 'page' },
  { en: 'cylinder', hi: 'बेलन', src: 'page' },
  { en: 'cone', hi: 'शंकु', src: 'page' },
  { en: 'sphere', hi: 'गोला', src: 'page' },
  { en: 'hemisphere', hi: 'अर्धगोला', src: 'page' },

  // ── Trigonometry ───────────────────────────────────────────────────────────
  // sin, cos and tan are absent on purpose: NCERT's Hindi pages print them in
  // Latin, so there is nothing to gloss them with.
  { en: 'trigonometry', hi: 'त्रिकोणमिति', src: 'title' },
  { en: 'trigonometric ratio', hi: 'त्रिकोणमितीय अनुपात', src: 'page', also: ['trigonometric ratios'] },
  { en: 'ratio', hi: 'अनुपात', src: 'corpus', n: 112, also: ['ratios'] },
  { en: 'proportion', hi: 'समानुपात', src: 'corpus', n: 17, also: ['proportions'] },
  { en: 'percentage', hi: 'प्रतिशत', src: 'corpus', n: 148, also: ['percent'] },
  { en: 'hypotenuse', hi: 'कर्ण', src: 'page' },
  { en: 'opposite side', hi: 'सम्मुख भुजा', src: 'page' },
  { en: 'adjacent side', hi: 'संलग्न भुजा', src: 'page' },

  // ── Calculus ───────────────────────────────────────────────────────────────
  { en: 'calculus', hi: 'कलन', src: 'page' },
  { en: 'differential calculus', hi: 'अवकल गणित', src: 'page' },
  { en: 'integral calculus', hi: 'समाकलन गणित', src: 'page' },
  { en: 'derivative', hi: 'अवकलज', src: 'corpus', n: 137, also: ['derivatives'] },
  { en: 'differentiation', hi: 'अवकलन', src: 'page' },
  { en: 'differentiable', hi: 'अवकलनीय', src: 'page' },
  { en: 'integral', hi: 'समाकलन', src: 'title', also: ['integrals', 'integration'] },
  { en: 'indefinite integral', hi: 'अनिश्चित समाकलन', src: 'page' },
  { en: 'limit', hi: 'सीमा', src: 'corpus', n: 186, also: ['limits'] },
  { en: 'continuity', hi: 'संततता', src: 'corpus', n: 116 },
  { en: 'continuous', hi: 'संतत', src: 'page' },
  { en: 'chain rule', hi: 'श्रृंखला-नियम', src: 'page' },
  { en: 'tangent', hi: 'स्पर्श रेखा', src: 'page', also: ['tangent line'] },

  // ── Probability and statistics ─────────────────────────────────────────────
  { en: 'probability', hi: 'प्रायिकता', src: 'corpus', n: 295 },
  { en: 'statistics', hi: 'सांख्यिकी', src: 'title', n: 47 },
  { en: 'mean', hi: 'माध्य', src: 'corpus', n: 303 },
  { en: 'median', hi: 'माध्यक', src: 'corpus', n: 48 },
  { en: 'mode', hi: 'बहुलक', src: 'corpus', n: 58 },
  { en: 'event', hi: 'घटना', src: 'page', also: ['events'] },
  { en: 'sample space', hi: 'प्रतिदर्श समष्टि', src: 'page' },
  { en: 'outcome', hi: 'परिणाम', src: 'page', also: ['outcomes'] },
  { en: 'data', hi: 'आँकड़े', src: 'page' },
  { en: 'frequency distribution', hi: 'बारंबारता बंटन', src: 'page' },

  // ── Sets ───────────────────────────────────────────────────────────────────
  // सम्मिलन and सर्वनिष्ठ are NCERT's own words for union and intersection but
  // are unusual outside the textbook — students say "union" out loud. Showing
  // both, which is what this bridge does, is exactly the right handling.
  { en: 'set', hi: 'समुच्चय', src: 'corpus', n: 681, also: ['sets'] },
  { en: 'subset', hi: 'उपसमुच्चय', src: 'page', also: ['subsets'] },
  { en: 'union', hi: 'सम्मिलन', src: 'page', n: 14 },
  { en: 'intersection', hi: 'सर्वनिष्ठ', src: 'page', n: 12 },
  { en: 'element', hi: 'अवयव', src: 'corpus', n: 82, also: ['elements'] },
  { en: 'empty set', hi: 'रिक्त समुच्चय', src: 'corpus', n: 22 },
  { en: 'finite', hi: 'परिमित', src: 'page' },
  { en: 'infinite', hi: 'अपरिमित', src: 'page' },
  { en: 'interval', hi: 'अंतराल', src: 'page', also: ['intervals'] },

  // ── Proof ──────────────────────────────────────────────────────────────────
  // "Proof" as a standalone noun is absent: NCERT uses the verb सिद्ध कीजिए and
  // never labels a block उपपत्ति, so there is nothing verified to gloss it with.
  { en: 'theorem', hi: 'प्रमेय', src: 'corpus', n: 139, also: ['theorems'] },
  { en: 'formula', hi: 'सूत्र', src: 'corpus', n: 66, also: ['formulae', 'formulas'] },
  { en: 'identity', hi: 'सर्वसमिका', src: 'page', n: 19, also: ['identities'] },

  // ── The furniture of a textbook ────────────────────────────────────────────
  { en: 'chapter', hi: 'अध्याय', src: 'page', also: ['chapters'] },
  // NCERT's word for a numbered exercise is प्रश्नावली, not अभ्यास — अभ्यास is
  // the act of practising, which is why the app's Practice tab uses that one.
  { en: 'exercise', hi: 'प्रश्नावली', src: 'title', n: 68, also: ['exercises'] },
  { en: 'question', hi: 'प्रश्न', src: 'page', also: ['questions'] },
  { en: 'solution', hi: 'हल', src: 'page', also: ['solutions'] },
  { en: 'answer', hi: 'उत्तर', src: 'page', also: ['answers'] },
  { en: 'example', hi: 'उदाहरण', src: 'corpus', n: 551, also: ['examples'] },
  { en: 'summary', hi: 'सारांश', src: 'corpus', n: 21 },
  { en: 'figure', hi: 'आकृति', src: 'corpus', n: 549, also: ['figures'] },
  { en: 'table', hi: 'सारणी', src: 'corpus', n: 176, also: ['tables'] },
  { en: 'hint', hi: 'संकेत', src: 'page', also: ['hints'] },
  { en: 'method', hi: 'विधि', src: 'corpus', n: 36, also: ['methods'] }
];
