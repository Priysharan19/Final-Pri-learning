// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · line comments · THE REVIEWED TEMPLATE CATALOGUE
//
// A model never writes a sentence. It names a template from this catalogue for a line the engine has already
// ticked or crossed, and fills the template's slots. The server renders the sentence from the template and the
// validated slots (structured.js). Every sentence a student can see from this feature is in this file, in English
// and Hindi, reviewed as a whole.
//
//   enum slots (action, rule, relation, feature): ids from the fixed lists below, never text
//   maths slots (result, value, expected, written): ONE `$…$` span, accepted only if it is literally an expression of
//       line N, the engine's note for line N, or the line directly above (structured.js)
//
// Which templates a line may use depends on the ENGINE's state for it:
//   verified / from-question  the verified and "given" templates
//   arithmetic                EQUALITY templates only ("both sides come to …"): the engine checked only that the line is
//                             true as written, so no template can say anything about the line's role
//   first-error               the cross templates, which only restate what the engine's own note supplies
// ─────────────────────────────────────────────────────────────────────────────

export const ACTIONS = Object.freeze({
  expanded_brackets: ['expanded the brackets', 'कोष्ठक खोलकर'],
  factorised: ['factorised', 'गुणनखंड करके'],
  collected_like_terms: ['collected like terms', 'समान पद जोड़कर'],
  used_chain_rule: ['used the chain rule', 'शृंखला नियम लगाकर'],
  used_product_rule: ['used the product rule', 'गुणन नियम लगाकर'],
  used_quotient_rule: ['used the quotient rule', 'भागफल नियम लगाकर'],
  used_power_rule: ['used the power rule', 'घात नियम लगाकर'],
  substituted_limits: ['substituted the limits', 'सीमाएँ रखकर'],
  substituted_value: ['substituted the value', 'मान रखकर'],
  took_logs: ['took logs of both sides', 'दोनों तरफ़ लघुगणक लेकर'],
  completed_square: ['completed the square', 'पूर्ण वर्ग बनाकर'],
  used_quadratic_formula: ['used the quadratic formula', 'द्विघात सूत्र लगाकर'],
  divided_both_sides: ['divided both sides', 'दोनों तरफ़ भाग देकर'],
  multiplied_both_sides: ['multiplied both sides', 'दोनों तरफ़ गुणा करके'],
  added_to_both_sides: ['added to both sides', 'दोनों तरफ़ जोड़कर'],
  subtracted_from_both_sides: ['subtracted from both sides', 'दोनों तरफ़ घटाकर'],
  simplified: ['simplified', 'सरल करके'],
  cancelled_common_factor: ['cancelled the common factor', 'उभयनिष्ठ गुणनखंड काटकर'],
  differentiated: ['differentiated each term', 'हर पद का अवकलन करके'],
  integrated: ['integrated each term', 'हर पद का समाकलन करके'],
  squared_both_sides: ['squared both sides', 'दोनों तरफ़ वर्ग करके'],
  took_square_root: ['took the square root of both sides', 'दोनों तरफ़ वर्गमूल लेकर'],
  rearranged: ['rearranged the equation', 'समीकरण को पुनः व्यवस्थित करके'],
  combined_fractions: ['combined the fractions', 'भिन्नों को जोड़कर'],
  used_common_denominator: ['used a common denominator', 'उभयनिष्ठ हर लेकर'],
  used_difference_of_squares: ['used the difference of two squares', 'दो वर्गों का अंतर लगाकर'],
  used_index_laws: ['used the index laws', 'घातांक नियम लगाकर']
});

export const RULES = Object.freeze({
  expanding_brackets: ['Expanding the brackets', 'कोष्ठक खोलना'],
  factorising: ['Factorising', 'गुणनखंड करना'],
  collecting_like_terms: ['Collecting like terms', 'समान पद जोड़ना'],
  chain_rule: ['The chain rule', 'शृंखला नियम'],
  product_rule: ['The product rule', 'गुणन नियम'],
  quotient_rule: ['The quotient rule', 'भागफल नियम'],
  power_rule: ['The power rule', 'घात नियम'],
  quadratic_formula: ['The quadratic formula', 'द्विघात सूत्र'],
  completing_square: ['Completing the square', 'पूर्ण वर्ग बनाना'],
  difference_of_squares: ['The difference of two squares', 'दो वर्गों का अंतर'],
  index_laws: ['The index laws', 'घातांक नियम'],
  substituting_limits: ['Substituting the limits', 'सीमाएँ रखना'],
  taking_logs: ['Taking logs of both sides', 'दोनों तरफ़ लघुगणक लेना'],
  dividing_both_sides: ['Dividing both sides', 'दोनों तरफ़ भाग देना'],
  subtracting_from_both_sides: ['Subtracting from both sides', 'दोनों तरफ़ घटाना'],
  adding_to_both_sides: ['Adding to both sides', 'दोनों तरफ़ जोड़ना'],
  differentiating: ['Differentiating each term', 'हर पद का अवकलन'],
  integrating: ['Integrating each term', 'हर पद का समाकलन'],
  simplifying: ['Simplifying', 'सरल करना'],
  common_denominator: ['Using a common denominator', 'उभयनिष्ठ हर लेना']
});

// "This {relation} the line above."  (the Hindi text is the whole predicate)
export const RELATIONS = Object.freeze({
  equals: ['equals', 'के बराबर है'],
  simplifies: ['simplifies', 'को सरल करती है'],
  expands: ['expands', 'को खोलती है'],
  factorises: ['factorises', 'के गुणनखंड करती है'],
  rearranges: ['rearranges', 'को पुनः व्यवस्थित करती है'],
  restates: ['restates', 'को दोहराती है'],
  differentiates: ['differentiates', 'का अवकलन है'],
  integrates: ['integrates', 'का समाकलन है']
});

export const FEATURES = Object.freeze({
  sign: ['sign', 'चिह्न'],
  coefficient: ['coefficient', 'गुणांक'],
  constant_term: ['constant term', 'अचर पद'],
  power: ['power', 'घात'],
  bracket: ['bracket', 'कोष्ठक'],
  numerator: ['numerator', 'अंश'],
  denominator: ['denominator', 'हर'],
  index: ['index', 'घातांक'],
  root: ['root', 'मूल'],
  value: ['value', 'मान']
});

export const ENUM_SLOTS = Object.freeze({ action: ACTIONS, rule: RULES, relation: RELATIONS, feature: FEATURES });
export const MATHS_SLOTS = Object.freeze(['result', 'value', 'expected', 'written']);
export const SLOT_KEYS = Object.freeze([...Object.keys(ENUM_SLOTS), ...MATHS_SLOTS]);

const T = (states, slots, en, hi, kind = 'explains-correct') => Object.freeze({ states, slots, en, hi, kind });
const TICK = ['verified'];

// id → { states, slots, en, hi, kind }. No em dashes. A sentence opens with the engine's own word for the state.
export const TEMPLATES = Object.freeze({
  // ── verified ticks (named rule, or matched to the question's own solution) ──
  'ver.action_result': T(TICK, ['action', 'result'], 'Correct. You {action} to get {result}.', 'सही। {action} आपने {result} पाया।'),
  'ver.rule_result': T(TICK, ['rule', 'result'], 'Correct. {rule} gives {result}.', 'सही। {rule} से {result} मिलता है।'),
  'ver.relation_above': T(TICK, ['relation'], 'Correct. This {relation} the line above.', 'सही। यह पंक्ति ऊपर वाली पंक्ति {relation}।'),
  'ver.relation_result': T(TICK, ['relation', 'result'], 'Correct. This {relation} the line above, giving {result}.', 'सही। यह पंक्ति ऊपर वाली पंक्ति {relation}, और {result} मिलता है।'),
  'ver.result': T(TICK, ['result'], 'Correct. This line comes to {result}.', 'सही। यह पंक्ति {result} तक पहुँचती है।'),
  'ver.action': T(TICK, ['action'], 'Correct. You {action} here.', 'सही। यहाँ {action} आपने सही कदम लिया।'),
  'ver.rule': T(TICK, ['rule'], 'Correct. {rule} is used here.', 'सही। यहाँ {rule} का उपयोग हुआ है।'),
  'ver.same_as_above': T(TICK, ['result'], 'Correct. This is the line above, written another way: {result}.', 'सही। यह ऊपर वाली पंक्ति ही है, दूसरे रूप में: {result}।'),
  'ver.carries': T(TICK, ['feature'], 'Correct. The {feature} carries over from the line above.', 'सही। {feature} ऊपर वाली पंक्ति से आगे आया है।'),
  'ver.action_from_above': T(TICK, ['action', 'result'], 'Correct. From the line above, you {action} and reach {result}.', 'सही। ऊपर वाली पंक्ति से {action} आप {result} तक पहुँचे।'),
  'ver.substituting': T(TICK, ['result'], 'Correct. Substituting gives {result}.', 'सही। मान रखने पर {result} मिलता है।'),
  'ver.equation': T(TICK, ['result'], 'Correct. This equation reads {result}.', 'सही। यह समीकरण {result} है।'),
  'ver.balanced': T(TICK, ['action'], 'Correct. You {action}, so both sides stay equal.', 'सही। {action} आपने दोनों तरफ़ बराबर रखा।'),
  // ── lines that restate the question ──
  'giv.restates': T(['from-question'], [], 'Correct. This restates the question.', 'सही। यह पंक्ति प्रश्न को दोहराती है।'),
  'giv.restates_expr': T(['from-question'], ['result'], 'Correct. This restates the question: {result}.', 'सही। यह पंक्ति प्रश्न को दोहराती है: {result}।'),
  'giv.copy': T(['from-question'], [], 'Correct. This is the expression the question gives.', 'सही। यह वही व्यंजक है जो प्रश्न में दिया है।'),
  'giv.same': T(['from-question'], [], 'Correct. This line is the question’s own expression.', 'सही। यह पंक्ति प्रश्न का अपना व्यंजक है।'),
  // ── arithmetic (true as written): EQUALITY templates only ──
  'ari.both_sides': T(['arithmetic'], ['value'], 'Both sides come to {value}.', 'दोनों तरफ़ {value} आता है।'),
  'ari.equals_above': T(['arithmetic'], ['value'], 'This equals the line above: {value}.', 'यह ऊपर वाली पंक्ति के बराबर है: {value}।'),
  'ari.written_value': T(['arithmetic'], ['written', 'value'], 'Both sides are equal: {written} comes to {value}.', 'दोनों तरफ़ बराबर हैं: {written} का मान {value} है।'),
  'ari.value': T(['arithmetic'], ['value'], 'The value is {value}.', 'मान {value} है।'),
  // ── the first error: restates what the engine's own note supplies ──
  'x.not_follow': T(['first-error'], ['expected', 'written'], 'This line does not follow. The line above gives {expected}, but this line has {written}.', 'यह पंक्ति आगे नहीं बनती। ऊपर वाली पंक्ति से {expected} मिलता है, पर इस पंक्ति में {written} है।', 'explains-error'),
  'x.check_feature': T(['first-error'], ['feature', 'written', 'expected'], 'Check the {feature} here: {written} should be {expected}.', 'यहाँ {feature} जाँचें: {written} की जगह {expected} होना चाहिए।', 'explains-error'),
  'x.should_be': T(['first-error'], ['written', 'expected'], 'Not yet. {written} should be {expected} here.', 'अभी नहीं। यहाँ {written} की जगह {expected} होना चाहिए।', 'explains-error'),
  'x.use_instead': T(['first-error'], ['expected', 'written'], 'Close. Use {expected} here instead of {written}.', 'लगभग। यहाँ {written} की जगह {expected} लें।', 'explains-error'),
  'x.should_give': T(['first-error'], ['expected'], 'Not yet. This line should give {expected}.', 'अभी नहीं। इस पंक्ति से {expected} मिलना चाहिए।', 'explains-error'),
  'x.check_line': T(['first-error'], [], 'Check this line again against the line above.', 'इस पंक्ति को ऊपर वाली पंक्ति से फिर मिलाकर देखें।', 'explains-error'),
  'x.check_feature_only': T(['first-error'], ['feature'], 'Check the {feature} on this line.', 'इस पंक्ति में {feature} जाँचें।', 'explains-error'),
  'x.written_only': T(['first-error'], ['written'], 'Not yet. Look again at {written} on this line.', 'अभी नहीं। इस पंक्ति में {written} को फिर देखें।', 'explains-error'),
  'x.expected_above': T(['first-error'], ['expected'], 'Not yet. Following on from the line above, this line should have {expected}.', 'अभी नहीं। ऊपर वाली पंक्ति के बाद इस पंक्ति में {expected} होना चाहिए।', 'explains-error'),
  'x.feature_expected': T(['first-error'], ['feature', 'expected'], 'Check the {feature} here: it should be {expected}.', 'यहाँ {feature} जाँचें: वह {expected} होना चाहिए।', 'explains-error')
});
export const TEMPLATE_IDS = Object.freeze(Object.keys(TEMPLATES));
