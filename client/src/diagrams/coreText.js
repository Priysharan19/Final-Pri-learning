// Pri Learning · the core diagram kit's own words (Diagram.jsx, Interactive.jsx) in the
// reader's language, read through kitText.js (`useKitText(CORE_TEXT)`).
//
// English is en-AU and reads exactly as the kit always has (the NSW edition and the
// existing tests depend on it). Hindi is what Priyabhata shows a student reading in
// Hindi, in the terms of the NCERT Hindi-medium books: प्रवणता (gradient), अंतःखंड
// (intercept), शीर्ष (vertex), अनंतस्पर्शी (asymptote), प्रायिकता (probability), माध्यिका
// (median), चतुर्थक (quartile), सदिश (vector), समांतर/गुणोत्तर अनुक्रम, चक्रवृद्धि ब्याज …
//
// Rules for every entry:
//   · the numbers are computed and formatted by the kit (r3) and arrive in {slots};
//   · mathematics arrives in slots as KaTeX ($…$) or as the plain expression the model
//     drew, so it is never translated or retyped here;
//   · the Hindi entry has exactly the {slots} of its English entry
//     (client/test/diagram-kit-i18n-check.mjs fails otherwise).
// This file is deliberately not in the app catalogue (strings.*.js): that catalogue is in
// the marker's import tree and a kit string there would move the examiner dossier digest.

const en = {
  // Words typeset inside a KaTeX label (\text{…}).
  'tex.area': 'area',
  'tex.sum': 'sum',
  'tex.secant': 'secant',
  'tex.tangent': 'tangent',
  'common.reset': 'Reset',
  'common.total': 'Total',

  'function.title': 'Graph of a function',
  'function.axes': 'Axes: {xv} from {xmin} to {xmax}, {yv} from {ymin} to {ymax}.',
  'function.curveNamed': 'Curve {name}: {yv} = {expr}.',
  'function.curve': 'A curve: {yv} = {expr}.',
  'function.shade': 'The area between it and the {xv}-axis from {xv} = {from} to {xv} = {to} is shaded.',
  'function.yIntercept': 'It crosses the {yv}-axis at {y}.',
  'function.xIntercepts': 'It crosses the {xv}-axis at {xv} = {xs}.',
  'function.asymptoteVertical': 'Vertical asymptote {xv} = {value}.',
  'function.asymptoteHorizontal': 'Horizontal line {yv} = {value}.',

  'unitCircle.title': 'The unit circle',
  'unitCircle.desc': 'A point on the unit circle at {deg} degrees: cosine {cos}, sine {sin}{tan}.',
  'unitCircle.tan': ', tangent {tan}',
  'unitCircle.tanUndefined': ', tangent undefined',
  'unitCircle.quadrant': 'Quadrant {quadrant}, reference angle {reference} degrees.',
  'unitCircle.onAxis': 'Quadrant on an axis, reference angle {reference} degrees.',

  'trig.title': 'Graph of y = {a}{fn}({b}(x - {c})) + {d}',
  'trig.desc': 'A {fn} curve with amplitude {amplitude}, period {period} radians, shifted {c} right and {d} up.',
  'trig.noAmplitude': 'none',

  'triangle.title': 'A triangle',
  'triangle.desc': 'Triangle ABC with sides a = {a}, b = {b}, c = {c}; angles A = {A}°, B = {B}°, C = {C}°{right}; area {area}.',
  'triangle.right': ', a right angle at {vertex}',

  'polygon.title': 'A regular polygon with {n} sides',
  'polygon.desc': 'A regular polygon with {n} sides each of length {side}; each interior angle is {interior}°, each exterior angle {exterior}°, and the interior angles add to {sum}°.',

  'circle.centre': 'Angle at the centre is twice the angle at the circumference',
  'circle.segment': 'Angles in the same segment are equal',
  'circle.semicircle': 'The angle in a semicircle is a right angle',
  'circle.cyclic': 'Opposite angles of a cyclic quadrilateral add to 180°',
  'circle.tangent': 'A tangent is perpendicular to the radius at the point of contact',
  'circle.desc': '{theorem}. Marked angles: {marks}.',
  'circle.mark': '{value}° at {at}',

  'numberLine.title': 'A number line',
  'numberLine.open': 'Open point at {value}.',
  'numberLine.closed': 'Closed point at {value}.',
  'numberLine.shaded': 'Shaded from {from} to {to}.',
  'numberLine.left': 'the left',
  'numberLine.right': 'the right',
  'numberLine.notIncluded': '{value} (not included)',
  'numberLine.empty': 'An empty number line.',

  'tree.title': 'A probability tree',
  'tree.desc': 'A probability tree. {outcomes}. The outcomes add to {total}.',
  'tree.then': ' then ',

  'venn.title': 'A Venn diagram',
  'venn.desc': 'A Venn diagram of {sets} sets. {regions}, outside: {outside}. Total {total}.',

  'table.caption': 'Two-way table with row and column totals',

  'histogram.title': 'A histogram',
  'histogram.desc': 'A histogram of {total} values in {bins} bins: {bars}.',
  'histogram.bar': '{from} to {to}: {count}',

  'boxPlot.title': 'A box plot',
  'boxPlot.desc': 'A box plot: minimum {min}, lower quartile {q1}, median {median}, upper quartile {q3}, maximum {max}; range {range}, interquartile range {iqr}.',

  'normal.title': 'The normal distribution',
  'normal.desc': 'A normal curve with mean {mu} and standard deviation {sigma}. The shaded area from z = {za} (x = {xa}) to z = {zb} (x = {xb}) is {area}, which is {percent}% of the distribution.',

  'vector.title': 'Vectors',
  'vector.one': 'Vector {label} = ({dx}, {dy}), magnitude {magnitude}, direction {angle}°.',
  'vector.resultant': 'Resultant = ({dx}, {dy}), magnitude {magnitude}.',

  'sequence.title': 'A sequence',
  'sequence.arithmetic': 'The first {n} terms of a arithmetic sequence starting at {first} with common difference {step}: {terms}. Their sum is {total}.',
  'sequence.geometric': 'The first {n} terms of a geometric sequence starting at {first} with common ratio {step}: {terms}. Their sum is {total}.',

  'compound.title': 'Compound interest',
  'compound.descOne': 'A {cur}{principal} investment at {rate}% per year compounded {perYear} time a year grows to {cur}{final} after {years} years, earning {cur}{interest} in interest; simple interest would give {cur}{simple}.',
  'compound.descMany': 'A {cur}{principal} investment at {rate}% per year compounded {perYear} times a year grows to {cur}{final} after {years} years, earning {cur}{interest} in interest; simple interest would give {cur}{simple}.',

  'timeline.title': 'A timeline of payments',
  'timeline.desc': 'A timeline of {count} payments over {end} years: {events}. Net {net}.',
  'timeline.receive': 'receive {cur}{amount} at year {t}',
  'timeline.pay': 'pay {cur}{amount} at year {t}',

  'secantTangent.title': 'A secant and a tangent',
  'secantTangent.desc': 'The curve y = {expr}. The secant through x = {x0} and x = {x1} has gradient {secant}; the tangent at x = {x0} has gradient {tangent}.',

  'riemann.title': 'Riemann rectangles',
  'riemann.desc': '{n} {mode}-point rectangles under y = {expr} from x = {a} to x = {b}, each of width {width}. Their total area is {sum}; the area under the curve is {area}.',
  'riemann.mode.left': 'left',
  'riemann.mode.mid': 'mid',
  'riemann.mode.right': 'right',

  'network.title': 'A network',
  'network.summary': 'A network of {nodes} nodes and {edges} edges.',
  'network.summaryDirected': 'A directed network of {nodes} nodes and {edges} edges.',
  'network.edge': '{from} joined to {to}{label}.',
  'network.edgeDirected': '{from} to {to}{label}.',
  'network.route': 'The route {path} is highlighted{total}.',
  'network.routeTotal': ', with total {total}',

  'scatter.title': 'A scatterplot',
  'scatter.points': 'A scatterplot of {n} points: {points}.',
  'scatter.fit': 'A line of best fit (least squares) with gradient {m} and y-intercept {c} is drawn.',
  'scatter.line': 'A line with gradient {m} and y-intercept {c} is drawn.',
  'scatter.r': 'The correlation coefficient is {r}.',

  'solid.rectPrism': 'rectangular prism',
  'solid.cylinder': 'cylinder',
  'solid.cone': 'cone',
  'solid.sphere': 'sphere',
  'solid.hemisphere': 'hemisphere',
  'solid.pyramid': 'rectangular pyramid',
  'solid.title': 'A {name}',
  'solid.desc': 'A {name}: {dims}. Its volume is {volume} cubic units.',
  'solid.dims.rectPrism': 'length {l}, width {w}, height {h}',
  'solid.dims.pyramid': 'base {l} by {w}, height {h}',
  'solid.dims.cylinder': 'radius {r}, height {h}',
  'solid.dims.cone': 'radius {r}, height {h}',
  'solid.dims.sphere': 'radius {r}',
  'solid.dims.hemisphere': 'radius {r}',

  // Interactive.jsx
  'transform.titleLinear': 'Change the gradient and the intercept',
  'transform.title': 'Transform y = {name}',
  'transform.graphLinear': 'The line y = mx + c',
  'transform.graph': 'Graph of y = {name} and its transformation',
  'transform.readoutLinear': '{tex}: gradient {m} (it rises {rise} for each 1 across{falling}), crossing the y-axis at {k}.',
  'transform.falling': ', falling',
  'transform.readout': '{tex}: stretch {stretch}{reflectX}; horizontal scale {scale}{reflectY}; shift {h} right and {k} up.',
  'transform.reflectX': ' and reflect in the x-axis',
  'transform.reflectY': ' and reflect in the y-axis',
  'transform.noScale': 'none',
  'transform.a': 'a (vertical stretch)',
  'transform.b': 'b (horizontal)',
  'transform.h': 'h (shift right)',
  'transform.k': 'k (shift up)',

  'unitCircleDrag.title': 'Drag the point around the unit circle',
  'unitCircleDrag.graph': 'The unit circle with a movable point',
  'unitCircleDrag.readout': '{angle}: {cos}, {sin}, {tan}. {where}',
  'unitCircleDrag.tanUndefined': '{tan} is undefined',
  'unitCircleDrag.quadrant': 'Quadrant {quadrant}; reference angle {reference}°.',
  'unitCircleDrag.onAxis': 'On an axis.',
  'unitCircleDrag.slider': 'Angle θ (degrees)',
  'unitCircleDrag.presets': 'Common angles',
  'unitCircleDrag.handle': 'Point on the unit circle',
  'unitCircleDrag.valueText': '{deg} degrees, cosine {cos}, sine {sin}',

  'secantToTangent.title': 'Move the secant towards the tangent',
  'secantToTangent.readout': 'Second point at {x1} ({h}): secant gradient {secant}; tangent gradient at {x0} is {tangent}. As {limit} the secant gradient approaches the tangent\'s.',
  'secantToTangent.slider': 'h (distance to the second point)',
  'secantToTangent.toTangent': 'Move to the tangent',

  'riemannSlider.title': 'Add rectangles under the curve',
  'riemannSlider.readout': '{n} {mode}-point rectangles: total area {sum}; the area under the curve is {area} (difference {error}). More rectangles fit the curve more closely.',
  'riemannSlider.slider': 'n (number of rectangles)',
  'riemannSlider.group': 'Where each rectangle meets the curve',
  'riemannSlider.left': 'Left endpoint',
  'riemannSlider.mid': 'Midpoint',
  'riemannSlider.right': 'Right endpoint',

  'normalZ.title': 'Shade the area between two z-scores',
  'normalZ.readout': '{prob}, which is {percent}% of the distribution. About 68%, 95% and 99.7% lie within 1, 2 and 3 standard deviations of the mean.',
  'normalZ.lower': 'Lower z',
  'normalZ.upper': 'Upper z',
  'normalZ.group': 'Within k standard deviations',
  'normalZ.sd': '±{k} SD',

  'compoundExplorer.title': 'Compound interest by rate and time',
  'compoundExplorer.readout': '{principal} at {rate} per year, compounded {often}, grows to {final} in {time}: interest {interest} (simple interest would give {simple}).',
  'compoundExplorer.yearly': 'yearly',
  'compoundExplorer.timesAYear': '{n} times a year',
  'compoundExplorer.year': '{n} year',
  'compoundExplorer.years': '{n} years',
  'compoundExplorer.rate': 'Rate (% per year)',
  'compoundExplorer.time': 'Time (years)',
  'compoundExplorer.group': 'Compounding periods per year',
  'compoundExplorer.p1': 'Yearly',
  'compoundExplorer.p2': 'Half-yearly',
  'compoundExplorer.p4': 'Quarterly',
  'compoundExplorer.p12': 'Monthly'
};

const hi = {
  'tex.area': 'क्षेत्रफल',
  'tex.sum': 'योग',
  'tex.secant': 'छेदक रेखा',
  'tex.tangent': 'स्पर्श रेखा',
  'common.reset': 'पहले जैसा करें',
  'common.total': 'कुल',

  'function.title': 'एक फलन का आलेख',
  'function.axes': 'अक्ष: {xv} का मान {xmin} से {xmax} तक, {yv} का मान {ymin} से {ymax} तक।',
  'function.curveNamed': 'वक्र {name}: {yv} = {expr}।',
  'function.curve': 'एक वक्र: {yv} = {expr}।',
  'function.shade': 'इस वक्र और {xv}-अक्ष के बीच {xv} = {from} से {xv} = {to} तक का क्षेत्र छायांकित है।',
  'function.yIntercept': 'यह {yv}-अक्ष को {y} पर काटता है।',
  'function.xIntercepts': 'यह {xv}-अक्ष को {xv} = {xs} पर काटता है।',
  'function.asymptoteVertical': 'ऊर्ध्वाधर अनंतस्पर्शी {xv} = {value}।',
  'function.asymptoteHorizontal': 'क्षैतिज रेखा {yv} = {value}।',

  'unitCircle.title': 'इकाई वृत्त',
  'unitCircle.desc': 'इकाई वृत्त पर {deg} अंश के कोण पर एक बिंदु: cos का मान {cos}, sin का मान {sin}{tan}।',
  'unitCircle.tan': ', tan का मान {tan}',
  'unitCircle.tanUndefined': ', tan अपरिभाषित',
  'unitCircle.quadrant': 'चतुर्थांश {quadrant}, संदर्भ कोण {reference} अंश।',
  'unitCircle.onAxis': 'बिंदु एक अक्ष पर है, संदर्भ कोण {reference} अंश।',

  'trig.title': 'y = {a}{fn}({b}(x - {c})) + {d} का आलेख',
  'trig.desc': 'एक {fn} वक्र: आयाम {amplitude}, आवर्त {period} रेडियन, {c} दाईं ओर और {d} ऊपर खिसकाया गया।',
  'trig.noAmplitude': 'कोई नहीं',

  'triangle.title': 'एक त्रिभुज',
  'triangle.desc': 'त्रिभुज ABC, जिसकी भुजाएँ a = {a}, b = {b}, c = {c}; कोण A = {A}°, B = {B}°, C = {C}°{right}; क्षेत्रफल {area}।',
  'triangle.right': ', शीर्ष {vertex} पर समकोण',

  'polygon.title': '{n} भुजाओं वाला एक सम बहुभुज',
  'polygon.desc': '{n} भुजाओं वाला एक सम बहुभुज, जिसकी प्रत्येक भुजा की लंबाई {side} है; प्रत्येक अंतः कोण {interior}° और प्रत्येक बाह्य कोण {exterior}° है, और अंतः कोणों का योग {sum}° है।',

  'circle.centre': 'केंद्र पर बना कोण परिधि पर बने कोण का दोगुना होता है',
  'circle.segment': 'एक ही वृत्तखंड में बने कोण बराबर होते हैं',
  'circle.semicircle': 'अर्धवृत्त में बना कोण समकोण होता है',
  'circle.cyclic': 'चक्रीय चतुर्भुज के सम्मुख कोणों का योग 180° होता है',
  'circle.tangent': 'स्पर्श रेखा स्पर्श बिंदु पर त्रिज्या पर लंब होती है',
  'circle.desc': '{theorem}। अंकित कोण: {marks}।',
  'circle.mark': 'शीर्ष {at} पर {value}°',

  'numberLine.title': 'एक संख्या रेखा',
  'numberLine.open': '{value} पर खुला बिंदु।',
  'numberLine.closed': '{value} पर बंद बिंदु।',
  'numberLine.shaded': '{from} से {to} तक छायांकित।',
  'numberLine.left': 'बाएँ छोर',
  'numberLine.right': 'दाएँ छोर',
  'numberLine.notIncluded': '{value} (सम्मिलित नहीं)',
  'numberLine.empty': 'एक खाली संख्या रेखा।',

  'tree.title': 'एक प्रायिकता वृक्ष आरेख',
  'tree.desc': 'एक प्रायिकता वृक्ष आरेख। {outcomes}। सभी परिणामों की प्रायिकताओं का योग {total} है।',
  'tree.then': ' फिर ',

  'venn.title': 'एक वेन आरेख',
  'venn.desc': '{sets} समुच्चयों का एक वेन आरेख। {regions}, बाहर: {outside}। कुल {total}।',

  'table.caption': 'पंक्तियों और स्तंभों के योग सहित द्वि-मार्गी सारणी',

  'histogram.title': 'एक आयतचित्र',
  'histogram.desc': '{bins} वर्ग-अंतरालों में {total} मानों का एक आयतचित्र: {bars}।',
  'histogram.bar': '{from} से {to}: {count}',

  'boxPlot.title': 'एक बॉक्स आलेख',
  'boxPlot.desc': 'एक बॉक्स आलेख: न्यूनतम {min}, निम्न चतुर्थक {q1}, माध्यिका {median}, उच्च चतुर्थक {q3}, अधिकतम {max}; परिसर {range}, अंतर्चतुर्थक परिसर {iqr}।',

  'normal.title': 'प्रसामान्य बंटन',
  'normal.desc': 'माध्य {mu} और मानक विचलन {sigma} वाला एक प्रसामान्य वक्र। z = {za} (x = {xa}) से z = {zb} (x = {xb}) तक छायांकित क्षेत्रफल {area} है, जो बंटन का {percent}% है।',

  'vector.title': 'सदिश',
  'vector.one': 'सदिश {label} = ({dx}, {dy}), परिमाण {magnitude}, दिशा {angle}°।',
  'vector.resultant': 'परिणामी सदिश = ({dx}, {dy}), परिमाण {magnitude}।',

  'sequence.title': 'एक अनुक्रम',
  'sequence.arithmetic': '{first} से आरंभ होने वाले, सार्व अंतर {step} वाले एक समांतर अनुक्रम के पहले {n} पद: {terms}। इनका योग {total} है।',
  'sequence.geometric': '{first} से आरंभ होने वाले, सार्व अनुपात {step} वाले एक गुणोत्तर अनुक्रम के पहले {n} पद: {terms}। इनका योग {total} है।',

  'compound.title': 'चक्रवृद्धि ब्याज',
  'compound.descOne': '{cur}{principal} का निवेश {rate}% वार्षिक दर पर, वर्ष में {perYear} बार चक्रवृद्धि होकर {years} वर्षों में {cur}{final} हो जाता है, यानी {cur}{interest} ब्याज; साधारण ब्याज पर यह {cur}{simple} होता।',
  'compound.descMany': '{cur}{principal} का निवेश {rate}% वार्षिक दर पर, वर्ष में {perYear} बार चक्रवृद्धि होकर {years} वर्षों में {cur}{final} हो जाता है, यानी {cur}{interest} ब्याज; साधारण ब्याज पर यह {cur}{simple} होता।',

  'timeline.title': 'भुगतानों की समय-रेखा',
  'timeline.desc': '{end} वर्षों में {count} भुगतानों की समय-रेखा: {events}। शुद्ध राशि {net}।',
  'timeline.receive': 'वर्ष {t} पर {cur}{amount} प्राप्त',
  'timeline.pay': 'वर्ष {t} पर {cur}{amount} का भुगतान',

  'secantTangent.title': 'एक छेदक रेखा और एक स्पर्श रेखा',
  'secantTangent.desc': 'वक्र y = {expr}। x = {x0} और x = {x1} से होकर जाने वाली छेदक रेखा की प्रवणता {secant} है; x = {x0} पर स्पर्श रेखा की प्रवणता {tangent} है।',

  'riemann.title': 'रीमान आयत',
  'riemann.desc': 'y = {expr} के नीचे x = {a} से x = {b} तक {n} आयत ({mode} वाले), प्रत्येक की चौड़ाई {width}। इनका कुल क्षेत्रफल {sum} है; वक्र के नीचे का क्षेत्रफल {area} है।',
  'riemann.mode.left': 'बाएँ सिरे',
  'riemann.mode.mid': 'मध्य-बिंदु',
  'riemann.mode.right': 'दाएँ सिरे',

  'network.title': 'एक नेटवर्क',
  'network.summary': '{nodes} शीर्षों और {edges} कोरों वाला एक नेटवर्क।',
  'network.summaryDirected': '{nodes} शीर्षों और {edges} कोरों वाला एक दिष्ट नेटवर्क।',
  'network.edge': '{from} और {to} के बीच कोर{label}।',
  'network.edgeDirected': '{from} से {to} की ओर कोर{label}।',
  'network.route': 'मार्ग {path} चिह्नित है{total}।',
  'network.routeTotal': ', जिसका कुल भार {total} है',

  'scatter.title': 'एक प्रकीर्ण आलेख',
  'scatter.points': '{n} बिंदुओं का एक प्रकीर्ण आलेख: {points}।',
  'scatter.fit': 'प्रवणता {m} और y-अंतःखंड {c} वाली सर्वोत्तम आसंजन रेखा (न्यूनतम वर्ग विधि से) खींची गई है।',
  'scatter.line': 'प्रवणता {m} और y-अंतःखंड {c} वाली एक रेखा खींची गई है।',
  'scatter.r': 'सहसंबंध गुणांक {r} है।',

  'solid.rectPrism': 'घनाभ',
  'solid.cylinder': 'बेलन',
  'solid.cone': 'शंकु',
  'solid.sphere': 'गोला',
  'solid.hemisphere': 'अर्धगोला',
  'solid.pyramid': 'आयताकार आधार वाला पिरामिड',
  'solid.title': '{name}',
  'solid.desc': '{name}: {dims}। इसका आयतन {volume} घन इकाई है।',
  'solid.dims.rectPrism': 'लंबाई {l}, चौड़ाई {w}, ऊँचाई {h}',
  'solid.dims.pyramid': 'आधार की लंबाई {l} और चौड़ाई {w}, ऊँचाई {h}',
  'solid.dims.cylinder': 'त्रिज्या {r}, ऊँचाई {h}',
  'solid.dims.cone': 'त्रिज्या {r}, ऊँचाई {h}',
  'solid.dims.sphere': 'त्रिज्या {r}',
  'solid.dims.hemisphere': 'त्रिज्या {r}',

  'transform.titleLinear': 'प्रवणता और अंतःखंड बदलिए',
  'transform.title': 'y = {name} का रूपांतरण कीजिए',
  'transform.graphLinear': 'रेखा y = mx + c',
  'transform.graph': 'y = {name} और उसके रूपांतरण का आलेख',
  'transform.readoutLinear': '{tex}: प्रवणता {m} (दाईं ओर प्रत्येक 1 चलने पर ऊँचाई {rise} बदलती है{falling}), रेखा y-अक्ष को {k} पर काटती है।',
  'transform.falling': ', रेखा नीचे की ओर जाती है',
  'transform.readout': '{tex}: ऊर्ध्वाधर खिंचाव {stretch}{reflectX}; क्षैतिज पैमाना {scale}{reflectY}; {h} दाईं ओर और {k} ऊपर खिसकाव।',
  'transform.reflectX': ' और x-अक्ष में परावर्तन',
  'transform.reflectY': ' और y-अक्ष में परावर्तन',
  'transform.noScale': 'कोई नहीं',
  'transform.a': 'a (ऊर्ध्वाधर खिंचाव)',
  'transform.b': 'b (क्षैतिज)',
  'transform.h': 'h (दाईं ओर खिसकाव)',
  'transform.k': 'k (ऊपर की ओर खिसकाव)',

  'unitCircleDrag.title': 'बिंदु को इकाई वृत्त पर खिसकाइए',
  'unitCircleDrag.graph': 'खिसकाए जा सकने वाले बिंदु के साथ इकाई वृत्त',
  'unitCircleDrag.readout': '{angle}: {cos}, {sin}, {tan}। {where}',
  'unitCircleDrag.tanUndefined': '{tan} अपरिभाषित है',
  'unitCircleDrag.quadrant': 'चतुर्थांश {quadrant}; संदर्भ कोण {reference}°।',
  'unitCircleDrag.onAxis': 'बिंदु एक अक्ष पर है।',
  'unitCircleDrag.slider': 'कोण θ (अंश में)',
  'unitCircleDrag.presets': 'प्रचलित कोण',
  'unitCircleDrag.handle': 'इकाई वृत्त पर बिंदु',
  'unitCircleDrag.valueText': '{deg} अंश, cos का मान {cos}, sin का मान {sin}',

  'secantToTangent.title': 'छेदक रेखा को स्पर्श रेखा की ओर ले जाइए',
  'secantToTangent.readout': 'दूसरा बिंदु {x1} पर ({h}): छेदक रेखा की प्रवणता {secant}; {x0} पर स्पर्श रेखा की प्रवणता {tangent} है। जैसे-जैसे {limit}, छेदक रेखा की प्रवणता स्पर्श रेखा की प्रवणता के निकट पहुँचती है।',
  'secantToTangent.slider': 'h (दूसरे बिंदु तक की दूरी)',
  'secantToTangent.toTangent': 'स्पर्श रेखा तक ले जाएँ',

  'riemannSlider.title': 'वक्र के नीचे आयत जोड़िए',
  'riemannSlider.readout': '{n} आयत ({mode} वाले): कुल क्षेत्रफल {sum}; वक्र के नीचे का क्षेत्रफल {area} है (अंतर {error})। आयत जितने अधिक होंगे, वे वक्र के उतने ही निकट होंगे।',
  'riemannSlider.slider': 'n (आयतों की संख्या)',
  'riemannSlider.group': 'प्रत्येक आयत वक्र से कहाँ मिलता है',
  'riemannSlider.left': 'बायाँ सिरा',
  'riemannSlider.mid': 'मध्य-बिंदु',
  'riemannSlider.right': 'दायाँ सिरा',

  'normalZ.title': 'दो z-प्राप्तांकों के बीच का क्षेत्रफल छायांकित कीजिए',
  'normalZ.readout': '{prob}, जो बंटन का {percent}% है। लगभग 68%, 95% और 99.7% मान माध्य से 1, 2 और 3 मानक विचलन के भीतर होते हैं।',
  'normalZ.lower': 'निचला z',
  'normalZ.upper': 'ऊपरी z',
  'normalZ.group': 'माध्य से k मानक विचलन के भीतर',
  'normalZ.sd': '±{k} मानक विचलन',

  'compoundExplorer.title': 'दर और समय के अनुसार चक्रवृद्धि ब्याज',
  'compoundExplorer.readout': '{principal}, {rate} वार्षिक दर पर, {often} चक्रवृद्धि होकर {time} में {final} हो जाता है: ब्याज {interest} (साधारण ब्याज पर यह {simple} होता)।',
  'compoundExplorer.yearly': 'वार्षिक',
  'compoundExplorer.timesAYear': 'वर्ष में {n} बार',
  'compoundExplorer.year': '{n} वर्ष',
  'compoundExplorer.years': '{n} वर्ष',
  'compoundExplorer.rate': 'दर (% प्रति वर्ष)',
  'compoundExplorer.time': 'समय (वर्ष)',
  'compoundExplorer.group': 'वर्ष में चक्रवृद्धि कितनी बार',
  'compoundExplorer.p1': 'वार्षिक',
  'compoundExplorer.p2': 'अर्धवार्षिक',
  'compoundExplorer.p4': 'तिमाही',
  'compoundExplorer.p12': 'मासिक'
};

export const CORE_TEXT = Object.freeze({ en: Object.freeze(en), hi: Object.freeze(hi) });
export default CORE_TEXT;
