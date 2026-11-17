// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a Socratic nudge that knows the first error
//
// "Hint" after a wrong line: the engine's own Step Check names the move that
// broke the line (an ontology id, misconceptions.js). This table turns that id
// into ONE question about THAT step. Rules, pinned by client/test/slip-hint-check.mjs:
//
//   · a question, never a statement of a result: no digit, no operator, no
//     relation, no $…$ span, no value of any kind, so nothing here can state or
//     imply the final answer or the next line's result;
//   · the text is fixed per id and language, so it cannot depend on whether a
//     guess is right and is never written by a model;
//   · an id with no entry returns null and the caller keeps the existing hint
//     (the authored ladder and the line-check note).
//
// The id is the SERVER's (lineCheckEvidence), never the device's (audit D1).
// ─────────────────────────────────────────────────────────────────────────────
const H = (en, hi) => Object.freeze({ en, hi });

export const SLIP_HINTS = Object.freeze({
  'sign-on-transfer': H('When a term crosses the equals sign, what really happens to it on both sides?', 'जब कोई पद बराबर के चिह्न के पार जाता है, तो दोनों तरफ़ असल में उसके साथ क्या होता है?'),
  'one-side-only': H('Whatever you did to one side of the equation, did you do exactly the same to the other side?', 'समीकरण के एक तरफ़ आपने जो किया, क्या ठीक वही दूसरी तरफ़ भी किया?'),
  'sides-mismatched': H('Do the two sides of this line still say the same thing as the line above?', 'क्या इस पंक्ति के दोनों पक्ष अब भी वही कह रहे हैं जो ऊपर की पंक्ति कहती थी?'),
  'wrong-inverse-operation': H('Which operation undoes the one that was applied to the unknown here?', 'अज्ञात पर जो संक्रिया लगी है, उसे कौन-सी संक्रिया पलटती है?'),
  'inequality-not-reversed': H('When you multiply or divide an inequality by a negative number, what must happen to its direction?', 'असमिका को ऋणात्मक संख्या से गुणा या भाग देने पर उसकी दिशा का क्या होना चाहिए?'),
  'distribute-partial': H('When a number multiplies a bracket, which terms inside the bracket does it reach?', 'जब कोई संख्या कोष्ठक को गुणा करती है, तो वह कोष्ठक के अंदर के किन-किन पदों तक पहुँचती है?'),
  'distribute-sign': H('When a minus sign sits in front of a bracket, which terms inside does it change?', 'जब कोष्ठक के आगे ऋण का चिह्न हो, तो वह अंदर के किन पदों को बदलता है?'),
  'power-of-sum': H('Can a power be shared out over the terms of a sum? Try expanding it as a product to see.', 'क्या घात को योग के पदों में बाँटा जा सकता है? उसे गुणनफल की तरह फैलाकर देखिए।'),
  'combined-unlike-terms': H('Are the two terms you combined really the same kind of term?', 'क्या आपने जो दो पद जोड़े, वे सचमुच एक ही प्रकार के पद हैं?'),
  'negative-squared': H('When you square a negative quantity, what happens to its sign, and why?', 'ऋणात्मक राशि का वर्ग करने पर उसके चिह्न का क्या होता है, और क्यों?'),
  'power-of-power': H('When a power is raised to another power, what do the two powers do to each other?', 'जब किसी घात पर एक और घात लगती है, तो दोनों घातें आपस में क्या करती हैं?'),
  'power-product': H('When two powers of the same base are multiplied, what happens to the powers?', 'एक ही आधार वाली दो घातों को गुणा करने पर घातों का क्या होता है?'),
  'function-of-sum': H('Does a function of a sum split into the function of each part? Test it with a small case.', 'क्या योग का फलन हर भाग के फलन में बँट जाता है? किसी छोटे उदाहरण से जाँचिए।'),
  'fraction-across': H('When you add fractions, what must be true of their denominators first?', 'भिन्न जोड़ते समय पहले उनके हरों के बारे में क्या सच होना चाहिए?'),
  'cancel-over-sum': H('What must be true of something on the top before you are allowed to cancel it with the bottom?', 'ऊपर की किसी राशि को नीचे वाली से काटने से पहले उसके बारे में क्या सच होना चाहिए?'),
  'reciprocal-flip': H('What exactly does dividing by a fraction turn into?', 'भिन्न से भाग देना असल में किस क्रिया में बदल जाता है?'),
  'lost-root': H('When you cancelled or divided, could any solution have gone missing with it?', 'काटते या भाग देते समय क्या कोई हल उसके साथ खो सकता था?'),
  'divided-by-variable': H('Is it safe to divide both sides by something that could be zero?', 'क्या दोनों पक्षों को ऐसी राशि से भाग देना सुरक्षित है जो शून्य हो सकती है?'),
  'sign-flipped': H('Look at the sign on that term in the line above. Did it stay the same when you carried it down?', 'ऊपर की पंक्ति में उस पद का चिह्न देखिए। नीचे लाते समय क्या वह वही रहा?'),
  'term-dropped': H('Count the terms in the line above and in your line. Did every one of them make it across?', 'ऊपर की पंक्ति और अपनी पंक्ति के पद गिनिए। क्या हर पद आगे पहुँचा?'),
  'operator-swapped': H('Check the operation between those two parts once more. Is it the same one as in the line above?', 'उन दो भागों के बीच की संक्रिया फिर से देखिए। क्या वह ऊपर की पंक्ति वाली ही है?'),
  'arithmetic-slip': H('Every step in the method looks right. Which small calculation in this line would be worth redoing slowly?', 'विधि का हर क़दम ठीक लगता है। इस पंक्ति की कौन-सी छोटी गणना धीरे-धीरे दोबारा करने लायक़ है?'),
  'int-no-divide': H('When you integrate a power, what do you do after raising the power? Think about differentiating back.', 'किसी घात का समाकलन करते समय घात बढ़ाने के बाद आप क्या करते हैं? उलटा अवकलन करके सोचिए।'),
  'int-divide-old-power': H('After raising the power, which power should you divide by: the old one or the new one?', 'घात बढ़ाने के बाद किस घात से भाग देना है: पुरानी से या नई से?'),
  'int-wrong-divisor': H('What should the divisor be after you integrate a term? Differentiate your result to test it.', 'किसी पद का समाकलन करने के बाद भाजक क्या होना चाहिए? अपने परिणाम का अवकलन करके जाँचिए।'),
  'int-power-not-raised': H('What happens to the power of x when you integrate?', 'समाकलन करने पर x की घात का क्या होता है?'),
  'int-constant-not-integrated': H('A constant term is also being integrated. What does it become?', 'अचर पद का भी समाकलन हो रहा है। वह क्या बन जाता है?'),
  'int-differentiated': H('Are you integrating here, or have you differentiated by habit?', 'क्या यहाँ आप समाकलन कर रहे हैं, या आदत से अवकलन कर बैठे?'),
  'int-sign': H('What happens to the coefficient and its sign when you integrate? Differentiate your line to test it.', 'समाकलन करने पर गुणांक और उसके चिह्न का क्या होता है? अपनी पंक्ति का अवकलन करके जाँचिए।'),
  'int-linear-inner-not-divided': H('The inside is a linear expression. What must you do about its coefficient when you integrate?', 'अंदर रैखिक व्यंजक है। समाकलन करते समय उसके गुणांक का क्या करना होगा?'),
  'int-linear-inner-multiplied': H('For a linear inside, should its coefficient multiply or divide when you integrate?', 'अंदर रैखिक व्यंजक हो तो समाकलन में उसका गुणांक गुणा होगा या भाग?'),
  'diff-no-multiply': H('When you differentiate a power, what happens to the old power at the front?', 'किसी घात का अवकलन करने पर पुरानी घात का आगे क्या होता है?'),
  'diff-wrong-multiplier': H('Which number should come to the front when you differentiate a power?', 'घात का अवकलन करने पर कौन-सी संख्या आगे आनी चाहिए?'),
  'diff-power-not-lowered': H('What happens to the power of x when you differentiate?', 'अवकलन करने पर x की घात का क्या होता है?'),
  'diff-constant-kept': H('What is the derivative of a constant term?', 'अचर पद का अवकलज क्या होता है?'),
  'diff-integrated': H('Are you differentiating here, or have you integrated by habit?', 'क्या यहाँ आप अवकलन कर रहे हैं, या आदत से समाकलन कर बैठे?'),
  'diff-sign': H('What happens to the sign of a term when you differentiate it?', 'किसी पद का अवकलन करने पर उसके चिह्न का क्या होता है?'),
  'diff-chain-inner-missing': H('The function has something inside it. What else must you multiply by when you differentiate?', 'फलन के अंदर कुछ और है। अवकलन करते समय आपको और किससे गुणा करना होगा?')
});

/** The nudge for a misconception id in a language, or null (keep the existing hint). */
export function slipHint(id, locale = 'en') {
  const row = typeof id === 'string' && Object.hasOwn(SLIP_HINTS, id) ? SLIP_HINTS[id] : null;
  return row ? (locale === 'hi' ? row.hi : row.en) : null;
}
