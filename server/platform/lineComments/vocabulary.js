// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · line comments · THE REVIEWED VOCABULARY
//
// A comment's prose may only use words from this module, or words that appear in the sources it may draw on
// (the question, the engine's own note for the line, the student's line, the released solution when it was
// sent). Anything else makes the comment unacceptable and the page keeps the engine's own sentence.
//
// This is an ALLOWLIST. Adding a word here is a reviewed change: it must be an ordinary marking word.
// ─────────────────────────────────────────────────────────────────────────────

const w = s => s.split(/\s+/).filter(Boolean);

// Statuses a comment may open with (constraints.js OPENERS decides which one a state may use).
export const OPENING_WORDS = w('correct close not yet check this looks');

export const FUNCTION_WORDS = w(`a an the this that these those it its they them their he she his her we our you your yours
  is are was were be been being am do does did done has have had having will would can could should may might must shall
  and or but so because since as if then when while where which who what why how than too also only just once again
  of in on at by for with without from to into onto over under above below before after between through during about against
  each every all both either neither any some none one two three four five six seven eight nine ten zero half twice
  here there now next first second third last same other another more most less least much many few
  no not yet still already even instead rather whether either per via`);

export const MARKING_WORDS = w(`line lines step steps term terms side sides sign signs bracket brackets power powers fraction fractions
  derivative derivatives integral integrals root roots limit limits value values answer answers question working work
  expression expressions equation equations expand expands expanded expanding factorise factorises factorised factorising
  factor factors differentiate differentiates differentiated differentiating integrate integrates integrated integrating
  substitute substitutes substituted substituting substitution simplify simplifies simplified simplifying solve solves solved solving
  equal equals equally gives give given giving becomes become became becoming follows follow followed following comes come came coming
  leaves leave leaving takes take taken taking gets get got putting put puts writes write written writing says say said saying
  shows show shown showing uses use used using keeps keep kept keeping moves move moved moving carries carry carried carrying
  adds add added adding subtracts subtract subtracted subtracting multiplies multiply multiplied multiplying
  divides divide divided dividing squares square squared squaring cubes cube cubed cancels cancel cancelled cancelling
  collects collect collected collecting combines combine combined combining replaces replace replaced replacing
  rewrites rewrite rewritten rewriting rearranges rearrange rearranged rearranging write apply applies applied applying
  drops drop dropped dropping total sum product difference quotient remainder number numbers digit digits integer integers decimal decimals
  constant constants variable variables unknown unknowns coefficient coefficients index indices exponent exponents
  numerator denominator reciprocal negative positive zero double triple factorisation quadratic linear cubic polynomial
  function functions gradient slope intercept curve graph axis axes stationary turning maximum minimum smallest largest
  smaller larger greater lesser bigger higher lower top bottom left right
  arithmetic algebra identity identities formula formulas rule rules law laws property properties
  correctly accurately exactly carefully clearly properly fully
  check checks checked checking compare compares compared comparing look looks looked looking see sees seen
  mean means meant meaning stand stands stood hold holds held holding work works worked
  reasoning reason reasons method approach
  carry out stays stay remains remain left kept
  start starts started starting finish finishes finished finishing end ends ended ending
  later earlier previous original whole part parts piece pieces
  half third quarter percent
  true begin begins began copy copies copied like read reads together restate restates restated full back bring brings brought down
  reduce reduces reduced separately separate away set sets setting common raise raises raising new include includes included base bases
  change changes changed changing rise run subtraction subtractions addition multiplication division required require interval intervals
  occur occurs antiderivative state states stated list lists listed obtain obtains obtained cover covers covering middle model sine cosine tangent
  describe describes describing condition conditions isolate isolates isolated baseline increase increases bracketed result results equivalent
  take takes approximately place places balanced balance remove removes removed across single inside ready own calculation calculations nothing undo undone clear clears cleared other
  make makes made making find finds found finding need needs needed
  fine good well ok okay sound acceptable valid`);

// Words a comment on a ticked or crossed line may not use unless the source says them (see allowlist.js).
export const POSITIVE_VERDICT = w('valid acceptable stands stand right fine correct good well properly okay ok sound true');
export const NEGATIVE_VERDICT = w('wrong incorrect incorrectly mistake mistakes mistaken error errors slip slips false invalid not no never cannot cant wont isnt arent wasnt werent doesnt dont didnt fails fail failed unsound flawed');
// Words about the verdict machinery or the engine itself: never in a comment.
export const MACHINERY = w('cross crossed crosses tick ticked ticks engine engines marker markers pri trust ignore ignored ignoring verified verify verifies override overridden disagree disagrees');
// Marking talk: never in a comment (a mark is the engine's, never the comment's).
export const MARKS_TALK = w('mark marks marked marking score scores scored grade grades graded credit credits lose loses lost earn earns earned award awards awarded penalty penalties penalise penalised deduct deducts deducted exam exams examiner examiners');
// Allowed only when the question, the note or the line itself says it.
export const SOURCE_ONLY = w('point points');
// A line the engine ticked only as TRUE AS WRITTEN: its comment may not speak of the line's role.
export const ROLE_WORDS = w(`start starts started starting first next move moves moved step steps method methods approach approaches choice choices
  strategy strategies sets setup leads lead leading towards toward needs need needed asks ask asking fitting fits fit sensible smart smartly rightly
  good nicely nice appropriate appropriately required require requires purpose way ways route plan idea track heading goal aim useful helpful
  sound wise logical natural expected intended proper properly suitable ideal best better exactly wanted wants want`);

// The smaller vocabulary for an arithmetic tick: it may say only that the two sides are equal and what the value is.
export const ARITHMETIC_VOCAB = w(`correct close the this that it a an is are was and of on in by to as so with each both side sides equal equals come comes
  value values arithmetic line sum total product difference number numbers written true same gives give adds add plus minus times multiplied divided
  subtracted up above below one two three four five six seven eight nine ten half twice less more than from out works hold holds left which then take away because since other`);

// Hindi: ordinary marking words (Devanagari). A Hindi comment may use these and the words of its sources.
export const HINDI_VOCAB = w(`सही यह वह है हैं था थी थे और या से को का की के में पर पंक्ति पंक्तियाँ चरण पद मान उत्तर प्रश्न हल बराबर होता होती होते
  देता देती देते मिलता मिलती मिलते आता आती आते कर करने करते करके किया गया गई गए लिखा लिखी लिखे दोनों तरफ़ ओर गणित अंकगणित संख्या योग गुणनफल
  अंतर भाग घात कोष्ठक चिह्न पद व्यंजक समीकरण अवकलज समाकलन मूल सीमा फलन बिंदु न नहीं पहले बाद अगला अगली इसलिए क्योंकि जब तब अब यहाँ ऊपर नीचे
  एक दो तीन चार पाँच छह सात आठ नौ दस शून्य जाँच देखें देखिए ध्यान रखें लगभग ठीक सिर्फ़ केवल भी तो ही कि जो जिसे उसे इसे इसमें उसमें
  निकालना निकालें निकलता निकलती बनता बनती बनते रखने रखकर रखा रखी हटाने जोड़ने घटाने गुणा भाग्य छोटा बड़ा छोटी बड़ी अधिक कम`);
