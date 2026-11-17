// Pri Learning · diagram pack "space": the components. Kinds and specs: ./space.kinds.js.
//
// Static: argand (complex numbers on an Argand diagram), matrix2d (the unit square and its
// image), space3d (points, vectors, lines and planes in cabinet projection). Interactive
// (Notes only): argandExplorer, vectorExplorer, matrixTransform, solidExplorer.
// Every number drawn or said comes from the pure models in space.kinds.js; every word comes
// from TEXT below (en-AU and Hindi) through useKitText; mathematics is KaTeX in both.
import React, { useId, useMemo, useState } from 'react';
import { MathText } from '../../lib/latex.jsx';
import { Figure, Tex, Defs } from '../Diagram.jsx';
import { Slider } from '../Interactive.jsx';
import { useKitText } from '../kitText.js';
import {
  argandModel, argandExplorerModel, argandExplorerStart, argandMode, vectorExplorerModel, colTex, matrixModel, space3dModel,
  solidExplorerModel, SOLID_DIMS, SOLID_DEFAULTS, piTex, sf3, num, ratTex, coordText
} from './space.kinds.js';

// ── Words ────────────────────────────────────────────────────────────────────
export const TEXT = Object.freeze({
  en: {
    // argand
    'argand.title': 'An Argand diagram',
    'argand.axes': 'The real axis runs across and the imaginary axis up, both through the origin at the same scale.',
    'argand.point': '{label} = {value}.',
    'argand.pointModArg': '{label} = {value}: modulus {mod}, argument {arg} radians.',
    'argand.product': 'Multiplying z = {z} by w = {w} gives zw = {zw}: the moduli multiply and the arguments add.',
    'argand.roots': 'The {n} roots of z to the power {n} equal to 1 lie on the unit circle at arguments {args} radians; they are the vertices of a regular polygon with {n} sides.',
    // argandExplorer
    'argandX.title.polar': 'Move z in polar form',
    'argandX.title.multiply': 'Multiply z by a fixed w',
    'argandX.title.roots': 'The roots of unity',
    'argandX.r': 'Modulus r',
    'argandX.theta': 'Argument θ',
    'argandX.n': 'Number of roots n',
    'argandX.polar': '{eq}: modulus ${r}$, argument ${arg}$.',
    'argandX.multiply': '{mods} and {args}{wrap}. So {zw}.',
    'argandX.wrap': ', which is ${p}$ as a principal value (take away $2\\pi$)',
    'argandX.wrapUp': ', which is ${p}$ as a principal value (add $2\\pi$)',
    'argandX.roots': 'The {n} roots of $z^{{n}}=1$ have arguments {list}. Neighbouring roots are ${gap}$ apart, so they are the vertices of a regular polygon with {n} sides.',
    // vectorExplorer
    'vector.title.sum': 'Add two vectors',
    'vector.title.difference': 'Subtract one vector from another',
    'vector.title.scalar': 'Multiply a vector by a scalar',
    'vector.title.dot': 'The dot product and the angle between',
    'vector.title.projection': 'Project one vector onto another',
    'vector.figure': 'Vectors a and b on a grid',
    'vector.ax': 'a: x-component', 'vector.ay': 'a: y-component', 'vector.bx': 'b: x-component', 'vector.by': 'b: y-component', 'vector.k': 'Scalar k',
    'vector.modes': 'What to show',
    'vector.mode.sum': 'Sum', 'vector.mode.difference': 'Difference', 'vector.mode.scalar': 'Scalar multiple', 'vector.mode.dot': 'Dot product', 'vector.mode.projection': 'Projection',
    'vector.sum': '{eq}: $\\mathbf{b}$ starts where $\\mathbf{a}$ ends (tip to tail), and the same vector is the diagonal of the parallelogram. {mag}.',
    'vector.difference': '{eq}: the vector from the tip of $\\mathbf{b}$ to the tip of $\\mathbf{a}$, because $\\mathbf{b}+(\\mathbf{a}-\\mathbf{b})=\\mathbf{a}$. {mag}.',
    'vector.scalar.same': '{eq}: the same direction as $\\mathbf{a}$ and ${k}$ times as long. {mag}.',
    'vector.scalar.opposite': '{eq}: the opposite direction to $\\mathbf{a}$ and ${k}$ times as long. {mag}.',
    'vector.scalar.zero': '{eq}: multiplying by $0$ gives the zero vector.',
    'vector.dot': '{eq}. {mags}, so {cos} and {theta}.',
    'vector.dot.perp': '{eq}, so the vectors are perpendicular: $\\theta=90^\\circ$.',
    'vector.zero': 'A zero vector has no direction, so there is no angle between the vectors. {eq}.',
    'vector.projection': 'The scalar projection of $\\mathbf{a}$ on $\\mathbf{b}$ is {sp}. The vector projection is {vp}, the foot of the perpendicular from the tip of $\\mathbf{a}$.',
    'vector.desc.sum': 'a = {a} and b = {b}, drawn tip to tail; a + b = {r}, length {m}.',
    'vector.desc.difference': 'a = {a} and b = {b} from the origin; a − b = {r}, from the tip of b to the tip of a, length {m}.',
    'vector.desc.scalar': 'a = {a} and {k}a = {r}, length {m}.',
    'vector.desc.dot': 'a = {a} and b = {b}; a · b = {dot}; the angle between them is {deg} degrees.',
    'vector.desc.projection': 'a = {a} and b = {b}; the scalar projection of a on b is {sp} and the vector projection is {vp}.',
    'vector.desc.noangle': 'a = {a} and b = {b}; one of them is the zero vector, so there is no angle between them.',
    // matrix
    'matrix.title': 'A matrix maps the unit square',
    'matrix.desc': 'The matrix M with rows ({a}, {b}) and ({c}, {d}) sends i = (1, 0) to ({a}, {c}) and j = (0, 1) to ({b}, {d}), so the unit square becomes the parallelogram with vertices (0, 0), ({a}, {c}), ({ab}, {cd}) and ({b}, {d}). det M = {det}, so its area is {area}.',
    'matrix.kept': 'Orientation is kept.',
    'matrix.reversed': 'Orientation is reversed because det M is negative.',
    'matrix.collapsed': 'The square collapses onto a line or a point because det M is 0.',
    'matrixX.title': 'Change the matrix, watch the square',
    'matrixX.a': 'a (row 1, column 1)', 'matrixX.b': 'b (row 1, column 2)', 'matrixX.c': 'c (row 2, column 1)', 'matrixX.d': 'd (row 2, column 2)',
    'matrixX.presets': 'Example matrices',
    'matrixX.identity': 'Identity', 'matrixX.rotate': 'Rotate 90°', 'matrixX.reflect': 'Reflect in y = x', 'matrixX.shear': 'Shear', 'matrixX.enlarge': 'Enlarge by 2',
    'matrixX.readout': '$M={m}$ sends $\\mathbf{i}$ to ${mi}$ and $\\mathbf{j}$ to ${mj}$. $\\det M=ad-bc={calc}={det}$, so the image of the unit square has area $|\\det M|={area}$. {orient}',
    'matrixX.kept': 'Orientation is kept: turning from $M\\mathbf{i}$ to $M\\mathbf{j}$ is still anticlockwise.',
    'matrixX.reversed': 'Orientation is reversed ($\\det M<0$): turning from $M\\mathbf{i}$ to $M\\mathbf{j}$ is now clockwise.',
    'matrixX.collapsed': 'The square collapses ($\\det M=0$), so $M$ has no inverse.',
    'reset': 'Reset',
    // space3d
    'space3d.title': 'Points and vectors in three dimensions',
    'space3d.axes': 'Three-dimensional axes in oblique projection: x towards you, y to the right, z up, from the origin O.',
    'space3d.point': 'Point {label} at {coords}; a dashed line drops to ({x}, {y}, 0) in the xy-plane.',
    'space3d.pointFlat': 'Point {label} at {coords}, in the xy-plane.',
    'space3d.vector': 'Vector {label} from {from} to {to}: components {comp}, length {mag}.',
    'space3d.line': 'Line {label} through {point} with direction {dir}.',
    'space3d.plane': 'Plane {label} {eq}, drawn where it crosses the box of the axes{cuts}.',
    'space3d.cuts': '; it meets the axes at {list}',
    // solidExplorer
    'solid.rectPrism': 'rectangular prism', 'solid.cylinder': 'cylinder', 'solid.cone': 'cone', 'solid.sphere': 'sphere', 'solid.pyramid': 'rectangular pyramid', 'solid.hemisphere': 'hemisphere',
    'solidX.title': 'Volume and surface area of a {shape}',
    'solidX.figure': 'A {shape}',
    'solidX.l': 'Length l', 'solidX.w': 'Width w', 'solidX.h': 'Height h', 'solidX.r': 'Radius r',
    'solidX.dim.l': 'length {v}', 'solidX.dim.w': 'width {v}', 'solidX.dim.h': 'height {v}', 'solidX.dim.r': 'radius {v}',
    'solidX.desc': 'A {shape} with {dims}. Its volume is {V} cubic units and its surface area is {S} square units.',
    'solidX.readout': 'Volume: {V}. Surface area: {S}.',
    'solidX.slant': 'Slant height: {L}.',
    'solidX.hemi': 'The curved surface is $2\\pi r^2$, half a sphere\'s, and the flat base adds $\\pi r^2$.',
    'solidX.pyramid': 'Each triangular face has a slant height: ${sl}$ on the sides of length $l$ and ${sw}$ on the sides of length $w$.'
  },
  hi: {
    'argand.title': 'आर्गण्ड आरेख',
    'argand.axes': 'वास्तविक अक्ष क्षैतिज और काल्पनिक अक्ष ऊर्ध्वाधर है; दोनों मूल बिंदु से समान पैमाने पर गुज़रते हैं।',
    'argand.point': '{label} = {value}।',
    'argand.pointModArg': '{label} = {value}: मापांक {mod}, कोणांक {arg} रेडियन।',
    'argand.product': 'z = {z} को w = {w} से गुणा करने पर zw = {zw} मिलता है: मापांक गुणा होते हैं और कोणांक जुड़ते हैं।',
    'argand.roots': 'z की घात {n} = 1 के {n} मूल इकाई वृत्त पर कोणांक {args} रेडियन पर हैं; वे {n} भुजाओं वाले सम बहुभुज के शीर्ष हैं।',
    'argandX.title.polar': 'ध्रुवीय रूप में z को बदलिए',
    'argandX.title.multiply': 'z को एक स्थिर w से गुणा कीजिए',
    'argandX.title.roots': 'इकाई के मूल',
    'argandX.r': 'मापांक r',
    'argandX.theta': 'कोणांक θ',
    'argandX.n': 'मूलों की संख्या n',
    'argandX.polar': '{eq}: मापांक ${r}$, कोणांक ${arg}$।',
    'argandX.multiply': '{mods} और {args}{wrap}। इसलिए {zw}।',
    'argandX.wrap': ', जो मुख्य मान के रूप में ${p}$ है ($2\\pi$ घटाइए)',
    'argandX.wrapUp': ', जो मुख्य मान के रूप में ${p}$ है ($2\\pi$ जोड़िए)',
    'argandX.roots': '$z^{{n}}=1$ के {n} मूलों के कोणांक {list} हैं। पास-पास के मूल ${gap}$ की दूरी पर हैं, इसलिए वे {n} भुजाओं वाले सम बहुभुज के शीर्ष हैं।',
    'vector.title.sum': 'दो सदिशों को जोड़िए',
    'vector.title.difference': 'एक सदिश को दूसरे से घटाइए',
    'vector.title.scalar': 'सदिश को अदिश से गुणा कीजिए',
    'vector.title.dot': 'अदिश गुणनफल और बीच का कोण',
    'vector.title.projection': 'एक सदिश का दूसरे पर प्रक्षेप',
    'vector.figure': 'ग्रिड पर सदिश a और b',
    'vector.ax': 'a: x-घटक', 'vector.ay': 'a: y-घटक', 'vector.bx': 'b: x-घटक', 'vector.by': 'b: y-घटक', 'vector.k': 'अदिश k',
    'vector.modes': 'क्या दिखाएँ',
    'vector.mode.sum': 'योग', 'vector.mode.difference': 'अंतर', 'vector.mode.scalar': 'अदिश गुणज', 'vector.mode.dot': 'अदिश गुणनफल', 'vector.mode.projection': 'प्रक्षेप',
    'vector.sum': '{eq}: $\\mathbf{b}$ वहाँ से शुरू होता है जहाँ $\\mathbf{a}$ समाप्त होता है (शीर्ष से पुच्छ), और यही सदिश समांतर चतुर्भुज का विकर्ण है। {mag}।',
    'vector.difference': '{eq}: $\\mathbf{b}$ के शीर्ष से $\\mathbf{a}$ के शीर्ष तक का सदिश, क्योंकि $\\mathbf{b}+(\\mathbf{a}-\\mathbf{b})=\\mathbf{a}$। {mag}।',
    'vector.scalar.same': '{eq}: $\\mathbf{a}$ की ही दिशा में और ${k}$ गुना लंबा। {mag}।',
    'vector.scalar.opposite': '{eq}: $\\mathbf{a}$ की विपरीत दिशा में और ${k}$ गुना लंबा। {mag}।',
    'vector.scalar.zero': '{eq}: $0$ से गुणा करने पर शून्य सदिश मिलता है।',
    'vector.dot': '{eq}। {mags}, इसलिए {cos} और {theta}।',
    'vector.dot.perp': '{eq}, इसलिए सदिश लंबवत हैं: $\\theta=90^\\circ$।',
    'vector.zero': 'शून्य सदिश की कोई दिशा नहीं होती, इसलिए सदिशों के बीच कोई कोण नहीं है। {eq}।',
    'vector.projection': '$\\mathbf{b}$ पर $\\mathbf{a}$ का अदिश प्रक्षेप {sp} है। सदिश प्रक्षेप {vp} है, जो $\\mathbf{a}$ के शीर्ष से डाले गए लंब का पाद है।',
    'vector.desc.sum': 'a = {a} और b = {b}, शीर्ष से पुच्छ तक बनाए गए; a + b = {r}, लंबाई {m}।',
    'vector.desc.difference': 'मूल बिंदु से a = {a} और b = {b}; a − b = {r}, b के शीर्ष से a के शीर्ष तक, लंबाई {m}।',
    'vector.desc.scalar': 'a = {a} और {k}a = {r}, लंबाई {m}।',
    'vector.desc.dot': 'a = {a} और b = {b}; a · b = {dot}; उनके बीच का कोण {deg} डिग्री है।',
    'vector.desc.projection': 'a = {a} और b = {b}; b पर a का अदिश प्रक्षेप {sp} और सदिश प्रक्षेप {vp} है।',
    'vector.desc.noangle': 'a = {a} और b = {b}; इनमें से एक शून्य सदिश है, इसलिए उनके बीच कोई कोण नहीं है।',
    'matrix.title': 'आव्यूह इकाई वर्ग को बदलता है',
    'matrix.desc': 'पंक्तियों ({a}, {b}) और ({c}, {d}) वाला आव्यूह M, i = (1, 0) को ({a}, {c}) पर और j = (0, 1) को ({b}, {d}) पर भेजता है, इसलिए इकाई वर्ग शीर्षों (0, 0), ({a}, {c}), ({ab}, {cd}) और ({b}, {d}) वाला समांतर चतुर्भुज बन जाता है। det M = {det}, इसलिए उसका क्षेत्रफल {area} है।',
    'matrix.kept': 'अभिविन्यास वही रहता है।',
    'matrix.reversed': 'अभिविन्यास उलट जाता है क्योंकि det M ऋणात्मक है।',
    'matrix.collapsed': 'det M = 0 होने से वर्ग एक रेखा या बिंदु पर सिमट जाता है।',
    'matrixX.title': 'आव्यूह बदलिए, वर्ग को देखिए',
    'matrixX.a': 'a (पंक्ति 1, स्तंभ 1)', 'matrixX.b': 'b (पंक्ति 1, स्तंभ 2)', 'matrixX.c': 'c (पंक्ति 2, स्तंभ 1)', 'matrixX.d': 'd (पंक्ति 2, स्तंभ 2)',
    'matrixX.presets': 'उदाहरण आव्यूह',
    'matrixX.identity': 'तत्समक', 'matrixX.rotate': '90° घुमाव', 'matrixX.reflect': 'y = x में परावर्तन', 'matrixX.shear': 'अपरूपण', 'matrixX.enlarge': '2 गुना बड़ा',
    'matrixX.readout': '$M={m}$, $\\mathbf{i}$ को ${mi}$ पर और $\\mathbf{j}$ को ${mj}$ पर भेजता है। $\\det M=ad-bc={calc}={det}$, इसलिए इकाई वर्ग के प्रतिबिंब का क्षेत्रफल $|\\det M|={area}$ है। {orient}',
    'matrixX.kept': 'अभिविन्यास वही रहता है: $M\\mathbf{i}$ से $M\\mathbf{j}$ की ओर घूमना अब भी वामावर्त है।',
    'matrixX.reversed': 'अभिविन्यास उलट जाता है ($\\det M<0$): $M\\mathbf{i}$ से $M\\mathbf{j}$ की ओर घूमना अब दक्षिणावर्त है।',
    'matrixX.collapsed': 'वर्ग सिमट जाता है ($\\det M=0$), इसलिए $M$ का व्युत्क्रम नहीं है।',
    'reset': 'पहले जैसा करें',
    'space3d.title': 'त्रिविम में बिंदु और सदिश',
    'space3d.axes': 'तिर्यक प्रक्षेप में त्रिविमीय अक्ष: x आपकी ओर, y दाईं ओर, z ऊपर, मूल बिंदु O से।',
    'space3d.point': 'बिंदु {label} = {coords}; एक टूटी रेखा xy-तल में ({x}, {y}, 0) तक गिरती है।',
    'space3d.pointFlat': 'बिंदु {label} = {coords}, xy-तल में।',
    'space3d.vector': 'सदिश {label}, {from} से {to} तक: घटक {comp}, लंबाई {mag}।',
    'space3d.line': 'रेखा {label}, {point} से होकर, दिशा {dir}।',
    'space3d.plane': 'तल {label} {eq}, जहाँ वह अक्षों के बक्से को काटता है वहाँ तक बनाया गया{cuts}।',
    'space3d.cuts': '; यह अक्षों से {list} पर मिलता है',
    'solid.rectPrism': 'घनाभ', 'solid.cylinder': 'बेलन', 'solid.cone': 'शंकु', 'solid.sphere': 'गोला', 'solid.pyramid': 'आयताकार पिरामिड', 'solid.hemisphere': 'अर्धगोला',
    'solidX.title': '{shape} का आयतन और पृष्ठीय क्षेत्रफल',
    'solidX.figure': 'एक {shape}',
    'solidX.l': 'लंबाई l', 'solidX.w': 'चौड़ाई w', 'solidX.h': 'ऊँचाई h', 'solidX.r': 'त्रिज्या r',
    'solidX.dim.l': 'लंबाई {v}', 'solidX.dim.w': 'चौड़ाई {v}', 'solidX.dim.h': 'ऊँचाई {v}', 'solidX.dim.r': 'त्रिज्या {v}',
    'solidX.desc': '{dims} वाला {shape}। इसका आयतन {V} घन इकाई और पृष्ठीय क्षेत्रफल {S} वर्ग इकाई है।',
    'solidX.readout': 'आयतन: {V}। पृष्ठीय क्षेत्रफल: {S}।',
    'solidX.slant': 'तिर्यक ऊँचाई: {L}।',
    'solidX.hemi': 'वक्र पृष्ठ $2\\pi r^2$ है, गोले का आधा, और समतल आधार $\\pi r^2$ जोड़ता है।',
    'solidX.pyramid': 'हर त्रिभुजाकार फलक की एक तिर्यक ऊँचाई है: $l$ लंबाई वाली भुजाओं पर ${sl}$ और $w$ लंबाई वाली भुजाओं पर ${sw}$।'
  }
});

// ── Shared drawing pieces ────────────────────────────────────────────────────
const poly = pts => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
const plain = tex => String(tex).replace(/\\(mathbf|operatorname|mathrm|text)\{([^}]*)\}/g, '$2').replace(/\\omega/g, 'ω').replace(/\\Pi/g, 'Π').replace(/\\pi/g, 'π').replace(/\\[a-zA-Z]+/g, '').replace(/[{}\\]/g, '').replace(/\^/g, '^');
const plus = t => (String(t).startsWith('-') ? t : `+${t}`);
const paren = v => (v < 0 ? `(${ratTex(v)})` : ratTex(v));

function PlaneAxes({ m }) {
  const f = m.frame; const [ox, oy] = m.origin;
  return (
    <g className="dg-axes">
      {m.xTicks.map(t => <line key={`gx${t.value}`} className="dg-grid" x1={t.px} x2={t.px} y1={f.top} y2={f.bottom} />)}
      {m.yTicks.map(t => <line key={`gy${t.value}`} className="dg-grid" x1={f.left} x2={f.right} y1={t.px} y2={t.px} />)}
      <line className="dg-axis" x1={f.left} x2={f.right} y1={oy} y2={oy} markerEnd="url(#dg-arrow)" />
      <line className="dg-axis" x1={ox} x2={ox} y1={f.bottom} y2={f.top} markerEnd="url(#dg-arrow)" />
      {m.tickLabels.map(t => <Tex key={`t${t.x}-${t.y}`} x={t.x} y={t.y} tex={t.tex} w={t.w} h={t.h} className="dg-small" />)}
    </g>
  );
}
const Labels = ({ labels, className = '' }) => labels.map((l, i) => <Tex key={`lb${i}`} x={l.x} y={l.y} tex={l.tex} w={l.w} h={l.h} className={className} />);
const Arrow = ({ a, b, tone = 'part' }) => <line className={`dg-vector is-${tone}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} markerEnd="url(#dg-arrow-s)" />;

/** The interactive shell: a titled section, the figure, the controls and a polite live region. */
function Shell({ title, children, controls, readout, className = '' }) {
  const id = useId();
  return (
    <section className={`dgi ${className}`} aria-labelledby={`${id}-h`} data-diagram-interactive>
      <h4 className="dgi-title" id={`${id}-h`}>{title}</h4>
      {children}
      <div className="dgi-controls">{controls}</div>
      <p className="dgi-readout" role="status" aria-live="polite"><MathText text={readout} /></p>
    </section>
  );
}

// ── argand ───────────────────────────────────────────────────────────────────
/** An explorer's spec drawn statically: the z (or the roots) it starts from. */
function argandStaticSpec(spec) {
  const explorer = spec.mode != null || spec.initial != null;
  const mode = argandMode(spec);
  if ((spec.points && spec.points.length) || spec.roots) return explorer && mode === 'polar' && spec.modArg == null ? { ...spec, modArg: true } : spec;
  const st = argandExplorerStart(spec);
  if (mode === 'roots') return { ...spec, roots: st.n };
  const t = (st.k * Math.PI) / 12;
  return { ...spec, points: [{ re: st.r * Math.cos(t), im: st.r * Math.sin(t), label: 'z' }], modArg: mode === 'polar' ? true : spec.modArg };
}
export function argandDescription(m, tk) {
  const parts = [tk('argand.axes')];
  m.points.forEach(p => parts.push(p.marked
    ? tk('argand.pointModArg', { label: plain(p.label), value: p.valueText, mod: p.modulus.text, arg: p.argTex.text })
    : tk('argand.point', { label: plain(p.label), value: p.valueText })));
  if (m.product) { const [z, w, zw] = [m.points[0], m.points.find(p => p.role === 'w'), m.points.find(p => p.role === 'product')]; parts.push(tk('argand.product', { z: z.valueText, w: w.valueText, zw: zw.valueText })); }
  if (m.roots) parts.push(tk('argand.roots', { n: m.roots.n, args: m.roots.points.map(q => q.argTex.text).join(', ') }));
  return parts.join(' ');
}
function ArgandFigure({ m, title, caption = null }) {
  const tk = useKitText(TEXT);
  return (
    <Figure width={m.frame.width} height={m.frame.height} title={title || tk('argand.title')} description={argandDescription(m, tk)} caption={caption} className="dg-square">
      <Defs />
      <PlaneAxes m={m} />
      {m.roots && <g>
        <circle className="dg-curve is-secondary" cx={m.roots.circle.c[0]} cy={m.roots.circle.c[1]} r={m.roots.circle.r} fill="none" />
        {m.roots.n > 2 && <path className="dg-shape" d={`${poly(m.roots.points.map(q => q.px))} Z`} />}
        {m.roots.points.map(q => <circle key={`r${q.k}`} className="dg-dot is-key" cx={q.px[0]} cy={q.px[1]} r="4.5" />)}
      </g>}
      {m.marks.map((k, i) => <g key={`mk${i}`}><line className="dg-curve is-secondary" x1={k.segment[0][0]} y1={k.segment[0][1]} x2={k.segment[1][0]} y2={k.segment[1][1]} /><path className="dg-arc" d={poly(k.arc)} /></g>)}
      {m.product && m.points.filter(p => p.role !== 'point' || p.index === 0).map(p => <line key={`pv${p.index}`} className={`dg-vector ${p.role === 'product' ? 'is-resultant' : 'is-part'}`} x1={m.origin[0]} y1={m.origin[1]} x2={p.px[0]} y2={p.px[1]} />)}
      {m.points.map(p => <circle key={`p${p.index}`} className={`dg-dot${p.role === 'product' ? ' is-key' : ''}`} cx={p.px[0]} cy={p.px[1]} r="4.5" />)}
      <Labels labels={m.labels} />
    </Figure>
  );
}
export function Argand({ title = null, caption = null, ...spec }) {
  const m = useMemo(() => argandModel(argandStaticSpec(spec)), [JSON.stringify(spec)]); // eslint-disable-line react-hooks/exhaustive-deps
  return <ArgandFigure m={m} title={title} caption={caption} />;
}

export function ArgandExplorer({ title = null, ...spec }) {
  const tk = useKitText(TEXT);
  const mode = argandMode(spec);
  const start = useMemo(() => argandExplorerStart(spec), [JSON.stringify(spec)]); // eslint-disable-line react-hooks/exhaustive-deps
  const [st, setSt] = useState(start);
  const x = argandExplorerModel(spec, st);
  const set = k => v => setSt(s => ({ ...s, [k]: v }));
  const thetaText = k => piTex((k * Math.PI) / 12).text;
  let readout;
  if (mode === 'polar') {
    const a = x.z.arg.tex; const r = ratTex(st.r);
    const trig = `${r === '1' ? '' : r}\\left(\\cos${a === '0' ? ' 0' : a}+i\\sin${a === '0' ? ' 0' : a}\\right)`;
    readout = tk('argandX.polar', { eq: `$z=${trig}${x.z.value.exact ? '=' : '\\approx '}${x.z.value.tex}$`, r, arg: a });
  } else if (mode === 'multiply') {
    const wl = x.w.label;
    const mods = `$|z${wl}|=|z|\\,|${wl}|=${ratTex(st.r)}\\times${x.w.modulus.exact ? x.w.modulus.tex : num(x.w.modulus.value)}=${x.zw.modulus.tex}$`;
    const bothExact = x.z.arg.exact && x.w.arg.exact;
    const args = bothExact
      ? `$\\arg z+\\arg ${wl}=${x.z.arg.tex}${plus(x.w.arg.tex)}=${x.zw.argSum.tex}$`
      : `$\\arg z+\\arg ${wl}\\approx${sf3(x.z.argValue)}${plus(String(sf3(x.w.argValue)))}=${sf3(x.zw.argSumValue)}$`;
    const p = x.zw.principal.exact ? x.zw.principal.tex : `\\approx${sf3(x.zw.principalValue)}`;
    const wrap = x.zw.wrapped ? tk(x.zw.argSumValue > 0 ? 'argandX.wrap' : 'argandX.wrapUp', { p }) : '';
    readout = tk('argandX.multiply', { mods, args, wrap, zw: `$z${wl}${x.zw.value.exact ? '=' : '\\approx '}${x.zw.value.tex}$` });
  } else {
    readout = tk('argandX.roots', { n: st.n, list: x.roots.map(q => `$${q.argTex.exact ? '' : '\\approx '}${q.argTex.tex.replace('\\approx', '')}$`).join(', '), gap: x.interior.tex });
  }
  const controls = mode === 'roots'
    ? <Slider label={tk('argandX.n')} min={2} max={12} step={1} value={st.n} onChange={set('n')} name="n" />
    : <>
      <Slider label={tk('argandX.r')} min={0.5} max={4} step={0.5} value={st.r} onChange={set('r')} name="r" />
      <Slider label={tk('argandX.theta')} min={-11} max={12} step={1} value={st.k} onChange={set('k')} format={thetaText} name="theta" />
    </>;
  return (
    <Shell title={title || tk(`argandX.title.${mode}`)} readout={readout} className="dg-square"
      controls={<>{controls}<div className="dgi-buttons"><button type="button" onClick={() => setSt(start)}>{tk('reset')}</button></div></>}>
      <ArgandFigure m={x.drawing} />
    </Shell>
  );
}

// ── vectorExplorer ───────────────────────────────────────────────────────────
const VMODES = ['sum', 'difference', 'scalar', 'dot', 'projection'];
const vText = v => `(${v.map(c => num(c)).join(', ')})`;
export function vectorDescription(m, tk) {
  const f = m.facts; const a = vText(f.a); const b = vText(f.b);
  if (f.mode === 'sum' || f.mode === 'difference' || f.mode === 'scalar') return tk(`vector.desc.${f.mode}`, { a, b, r: vText(f.result), m: f.magResult.text, k: num(f.k) });
  if (!f.angle) return tk('vector.desc.noangle', { a, b });
  if (f.mode === 'dot') return tk('vector.desc.dot', { a, b, dot: f.dot, deg: f.angle.deg });
  return tk('vector.desc.projection', { a, b, sp: f.scalarProjection.text, vp: vText(f.foot.map(v => sf3(v))) });
}
export function vectorReadout(m, tk) {
  const f = m.facts; const A = colTex(f.a); const B = colTex(f.b);
  const mag = (name, s) => `$|${name}|=${s.exact ? '' : '\\approx '}${s.tex.replace('\\approx', '')}$`;
  if (f.mode === 'sum') return tk('vector.sum', { eq: `$\\mathbf{a}+\\mathbf{b}=${A}+${B}=${colTex(f.result)}$`, mag: mag('\\mathbf{a}+\\mathbf{b}', f.magResult) });
  if (f.mode === 'difference') return tk('vector.difference', { eq: `$\\mathbf{a}-\\mathbf{b}=${A}-${B}=${colTex(f.result)}$`, mag: mag('\\mathbf{a}-\\mathbf{b}', f.magResult) });
  if (f.mode === 'scalar') {
    const kt = f.k === 1 ? '' : f.k === -1 ? '-' : ratTex(f.k);
    const eq = `$${kt}\\mathbf{a}=${f.k === 1 ? '' : f.k === -1 ? '-' : ratTex(f.k)}${A}=${colTex(f.result)}$`;
    if (f.k === 0 || (!f.a[0] && !f.a[1])) return tk('vector.scalar.zero', { eq });
    return tk(f.k > 0 ? 'vector.scalar.same' : 'vector.scalar.opposite', { eq, k: ratTex(Math.abs(f.k)), mag: `$|${kt}\\mathbf{a}|=${ratTex(Math.abs(f.k))}\\,|\\mathbf{a}|=${f.magResult.tex}$` });
  }
  const dotEq = `$\\mathbf{a}\\cdot\\mathbf{b}=${paren(f.a[0])}\\times${paren(f.b[0])}+${paren(f.a[1])}\\times${paren(f.b[1])}=${f.dot}$`;
  if (!f.angle) return tk('vector.zero', { eq: dotEq });
  if (f.mode === 'dot') {
    if (f.dot === 0) return tk('vector.dot.perp', { eq: dotEq });
    return tk('vector.dot', { eq: dotEq, mags: `$|\\mathbf{a}|=${f.magA.tex}$, $|\\mathbf{b}|=${f.magB.tex}$`, cos: `$\\cos\\theta=\\dfrac{\\mathbf{a}\\cdot\\mathbf{b}}{|\\mathbf{a}|\\,|\\mathbf{b}|}=${f.cos.tex}$`, theta: `$\\theta${f.angle.exact ? '=' : '\\approx'}${f.angle.deg}^\\circ$` });
  }
  return tk('vector.projection', { sp: `$\\dfrac{\\mathbf{a}\\cdot\\mathbf{b}}{|\\mathbf{b}|}=\\dfrac{${f.dot}}{${f.magB.tex}}=${f.scalarProjection.tex}$`, vp: `$\\dfrac{\\mathbf{a}\\cdot\\mathbf{b}}{|\\mathbf{b}|^2}\\,\\mathbf{b}=${f.footTex}$` });
}
function VectorFigure({ m, tk }) {
  return (
    <Figure width={m.frame.width} height={m.frame.height} title={tk('vector.figure')} description={vectorDescription(m, tk)} className="dg-square">
      <Defs />
      <PlaneAxes m={m} />
      {m.line && <line className="dg-curve is-secondary" x1={m.line[0][0]} y1={m.line[0][1]} x2={m.line[1][0]} y2={m.line[1][1]} />}
      {m.dashed.map(([u, v], i) => <line key={`d${i}`} className="dg-hidden" x1={u[0]} y1={u[1]} x2={v[0]} y2={v[1]} />)}
      {m.arc && <path className="dg-arc" d={poly(m.arc.pts)} />}
      {m.arrows.map((r, i) => <Arrow key={`a${i}`} a={r.px[0]} b={r.px[1]} tone={r.tone === 'result' ? 'resultant' : 'part'} />)}
      <Labels labels={m.labels} />
    </Figure>
  );
}
export function VectorExplorer({ a = [3, 1], b = [1, 2], mode: initialMode = 'sum', k: initialK = 2, title = null }) {
  const tk = useKitText(TEXT);
  const [A, setA] = useState(a); const [B, setB] = useState(b); const [mode, setMode] = useState(initialMode); const [k, setK] = useState(initialK);
  const m = vectorExplorerModel({ a: A, b: B, mode, k });
  const reset = () => { setA(a); setB(b); setMode(initialMode); setK(initialK); };
  const comp = (vec, set, i) => v => set(vec.map((c, j) => (j === i ? v : c)));
  return (
    <Shell title={title || tk(`vector.title.${mode}`)} readout={vectorReadout(m, tk)} className="dg-square"
      controls={<>
        <Slider label={tk('vector.ax')} min={-5} max={5} step={1} value={A[0]} onChange={comp(A, setA, 0)} name="ax" />
        <Slider label={tk('vector.ay')} min={-5} max={5} step={1} value={A[1]} onChange={comp(A, setA, 1)} name="ay" />
        {mode !== 'scalar' && <Slider label={tk('vector.bx')} min={-5} max={5} step={1} value={B[0]} onChange={comp(B, setB, 0)} name="bx" />}
        {mode !== 'scalar' && <Slider label={tk('vector.by')} min={-5} max={5} step={1} value={B[1]} onChange={comp(B, setB, 1)} name="by" />}
        {mode === 'scalar' && <Slider label={tk('vector.k')} min={-3} max={3} step={0.5} value={k} onChange={setK} name="k" />}
        <div className="dgi-buttons" role="group" aria-label={tk('vector.modes')}>
          {VMODES.map(v => <button key={v} type="button" aria-pressed={mode === v} onClick={() => setMode(v)}>{tk(`vector.mode.${v}`)}</button>)}
          <button type="button" onClick={reset}>{tk('reset')}</button>
        </div>
      </>}>
      <VectorFigure m={m} tk={tk} />
    </Shell>
  );
}

// ── matrix2d / matrixTransform ───────────────────────────────────────────────
export function matrixDescription(m, tk) {
  const [[a, b], [c, d]] = m.m;
  return `${tk('matrix.desc', { a: num(a), b: num(b), c: num(c), d: num(d), ab: num(a + b), cd: num(c + d), det: num(m.det), area: num(m.area) })} ${tk(`matrix.${m.orientation}`)}`;
}
function MatrixFigure({ m, title, caption = null }) {
  const tk = useKitText(TEXT);
  return (
    <Figure width={m.frame.width} height={m.frame.height} title={title || tk('matrix.title')} description={matrixDescription(m, tk)} caption={caption} className="dg-square">
      <Defs />
      <PlaneAxes m={m} />
      <path className="dg-shape" d={`${poly(m.image)} Z`} />
      <path className="dg-hidden" d={`${poly(m.square)} Z`} />
      {m.arrows.map((r, i) => <Arrow key={`m${i}`} a={r.px[0]} b={r.px[1]} tone={r.tone === 'image' ? 'resultant' : 'part'} />)}
      <Labels labels={m.labels} />
    </Figure>
  );
}
export function Matrix2d({ title = null, caption = null, m = [[2, 1], [1, 3]] }) {
  const model = useMemo(() => matrixModel({ m }), [JSON.stringify(m)]); // eslint-disable-line react-hooks/exhaustive-deps
  return <MatrixFigure m={model} title={title} caption={caption} />;
}
const PRESETS = { identity: [[1, 0], [0, 1]], rotate: [[0, -1], [1, 0]], reflect: [[0, 1], [1, 0]], shear: [[1, 1], [0, 1]], enlarge: [[2, 0], [0, 2]] };
export function matrixReadout(model, tk) {
  const [[a, b], [c, d]] = model.m;
  return tk('matrixX.readout', {
    m: model.mTex, mi: `\\begin{pmatrix}${ratTex(a)}\\\\${ratTex(c)}\\end{pmatrix}`, mj: `\\begin{pmatrix}${ratTex(b)}\\\\${ratTex(d)}\\end{pmatrix}`,
    calc: `${paren(a)}\\times${paren(d)}-${paren(b)}\\times${paren(c)}`, det: ratTex(model.det), area: ratTex(model.area), orient: tk(`matrixX.${model.orientation}`)
  });
}
export function MatrixTransform({ m = [[2, 1], [1, 3]], title = null }) {
  const tk = useKitText(TEXT);
  const [M, setM] = useState(m);
  const model = matrixModel({ m: M });
  const entry = (i, j) => v => setM(M.map((row, r) => row.map((x, s) => (r === i && s === j ? v : x))));
  const same = P => P.every((row, i) => row.every((v, j) => v === M[i][j]));
  return (
    <Shell title={title || tk('matrixX.title')} readout={matrixReadout(model, tk)} className="dg-square"
      controls={<>
        {[['a', 0, 0], ['b', 0, 1], ['c', 1, 0], ['d', 1, 1]].map(([n, i, j]) => <Slider key={n} label={tk(`matrixX.${n}`)} min={-3} max={3} step={0.5} value={M[i][j]} onChange={entry(i, j)} name={n} />)}
        <div className="dgi-buttons" role="group" aria-label={tk('matrixX.presets')}>
          {Object.entries(PRESETS).map(([k, P]) => <button key={k} type="button" aria-pressed={same(P)} onClick={() => setM(P)}>{tk(`matrixX.${k}`)}</button>)}
          <button type="button" onClick={() => setM(m)}>{tk('reset')}</button>
        </div>
      </>}>
      <MatrixFigure m={model} />
    </Shell>
  );
}

// ── space3d ──────────────────────────────────────────────────────────────────
export function space3dDescription(m, tk) {
  const parts = [tk('space3d.axes')];
  m.points.forEach(p => parts.push(tk(p.z === 0 ? 'space3d.pointFlat' : 'space3d.point', { label: plain(p.label), coords: coordText([p.x, p.y, p.z]), x: num(p.x), y: num(p.y) })));
  m.vectors.forEach(v => parts.push(tk('space3d.vector', { label: v.label ? plain(v.label) : '', from: coordText(v.from), to: coordText(v.to), comp: coordText(v.components), mag: v.magnitude.text }).replace('  ', ' ')));
  m.lines.forEach(l => parts.push(tk('space3d.line', { label: l.label ? plain(l.label) : '', point: coordText(l.point), dir: coordText(l.dir) }).replace('  ', ' ')));
  m.planes.forEach(q => parts.push(tk('space3d.plane', { label: q.label ? plain(q.label) : '', eq: plain(q.eqTex).replace(/([=+-])/g, ' $1 ').replace(/^ - /, '-'), cuts: q.intercepts.length ? tk('space3d.cuts', { list: q.intercepts.map(c => `${c.axis} = ${num(c.value)}`).join(', ') }) : '' }).replace('  ', ' ')));
  return parts.join(' ');
}
export function Space3d({ title = null, caption = null, points = [], vectors = [], lines = [], planes = [], box = false }) {
  const tk = useKitText(TEXT);
  const m = useMemo(() => space3dModel({ points, vectors, lines, planes, box }), [JSON.stringify([points, vectors, lines, planes, box])]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Figure width={m.width} height={m.height} title={title || tk('space3d.title')} description={space3dDescription(m, tk)} caption={caption} className="dg-square">
      <Defs />
      {m.planes.map(q => q.polygon.length > 2 && <path key={`pl${q.i}`} className="dg-shape is-plane" d={`${poly(q.polygon)} Z`} />)}
      <g className="dg-axes">
        {m.axes.map(a => <line key={a.name} className="dg-axis" x1={a.from[0]} y1={a.from[1]} x2={a.to[0]} y2={a.to[1]} markerEnd="url(#dg-arrow)" />)}
        {m.axes.flatMap(a => a.ticks.map(t => <circle key={`${a.name}${t.value}`} className="dg-tick-dot" cx={t.px[0]} cy={t.px[1]} r="1.8" />))}
      </g>
      {m.points.flatMap((p, i) => p.drops.map(([u, v], j) => <line key={`dr${i}-${j}`} className="dg-hidden" x1={u[0]} y1={u[1]} x2={v[0]} y2={v[1]} />))}
      {m.lines.map(l => l.segment && <line key={`ln${l.i}`} className="dg-curve is-secondary" x1={l.segment[0][0]} y1={l.segment[0][1]} x2={l.segment[1][0]} y2={l.segment[1][1]} />)}
      {m.vectors.map(v => <Arrow key={`v${v.i}`} a={v.px[0]} b={v.px[1]} tone="resultant" />)}
      {m.points.map((p, i) => <circle key={`p${i}`} className="dg-dot is-key" cx={p.px[0]} cy={p.px[1]} r="4.5" />)}
      <Labels labels={m.labels} />
    </Figure>
  );
}

// ── solidExplorer ────────────────────────────────────────────────────────────
export function solidDescription(x, tk) {
  const shape = tk(`solid.${x.shape}`);
  const dims = SOLID_DIMS[x.shape].map(d => tk(`solidX.dim.${d}`, { v: num(x.dims[d]) })).join(', ');
  return tk('solidX.desc', { shape, dims, V: Number(x.measures.V).toFixed(2), S: Number(x.measures.S).toFixed(2) });
}
export function solidReadout(x, tk) {
  const ms = x.measures;
  const extra = x.shape === 'cone' ? ` ${tk('solidX.slant', { L: `$${ms.Ltex}$` })}` : x.shape === 'hemisphere' ? ` ${tk('solidX.hemi')}` : x.shape === 'pyramid' ? ` ${tk('solidX.pyramid', { sl: `s_l=${ms.slantL.exact ? ms.slantL.tex : `\\approx${num(ms.slantL.value)}`}`, sw: `s_w=${ms.slantW.exact ? ms.slantW.tex : `\\approx${num(ms.slantW.value)}`}` })}` : '';
  return `${tk('solidX.readout', { V: `$${ms.Vtex}$`, S: `$${ms.Stex}$` })}${extra}`;
}
export function SolidExplorer({ shape = 'cone', title = null, ...dimsIn }) {
  const tk = useKitText(TEXT);
  const start = Object.fromEntries(SOLID_DIMS[shape].map(d => [d, dimsIn[d] ?? SOLID_DEFAULTS[d]]));
  const [dims, setDims] = useState(start);
  const x = solidExplorerModel({ shape, ...dims });
  const g = x.drawing; const name = tk(`solid.${shape}`);
  return (
    <Shell title={title || tk('solidX.title', { shape: name })} readout={solidReadout(x, tk)} className="dg-square"
      controls={<>
        {SOLID_DIMS[shape].map(d => <Slider key={d} label={tk(`solidX.${d}`)} min={0.5} max={12} step={0.5} value={dims[d]} onChange={v => setDims(s => ({ ...s, [d]: v }))} name={d} />)}
        <div className="dgi-buttons"><button type="button" onClick={() => setDims(start)}>{tk('reset')}</button></div>
      </>}>
      <Figure width={g.width} height={g.height} title={tk('solidX.figure', { shape: name })} description={solidDescription(x, tk)} className="dg-square">
        {g.hidden.map((pts, i) => <path key={`h${i}`} className="dg-hidden" d={poly(pts)} />)}
        {g.solid.map((pts, i) => <path key={`s${i}`} className="dg-solid" d={poly(pts)} />)}
        {g.marks.map((k, i) => <line key={`m${i}`} className="dg-hidden is-mark" x1={k.from[0]} y1={k.from[1]} x2={k.to[0]} y2={k.to[1]} />)}
        {g.labels.map((l, i) => <Tex key={`l${i}`} x={l.at[0]} y={l.at[1]} tex={l.tex} w={44} h={20} className="dg-small" />)}
      </Figure>
    </Shell>
  );
}

export const STATIC_COMPONENTS = Object.freeze({ argand: Argand, matrix2d: Matrix2d, space3d: Space3d });
export const INTERACTIVE_COMPONENTS = Object.freeze({ argandExplorer: ArgandExplorer, vectorExplorer: VectorExplorer, matrixTransform: MatrixTransform, solidExplorer: SolidExplorer });
