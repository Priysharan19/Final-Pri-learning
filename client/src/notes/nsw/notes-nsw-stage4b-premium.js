// Pri Learning · NSW Notes · Stage 4 · second band · the premium layer.
//
// What sits beside notes-nsw-stage4b.js for each topic, keyed by the same id:
//   examiners  what a marker looks for in a full-mark answer (short, specific)
//   diagrams   specs for diagrams/DiagramFromSpec, drawn from the SAME numbers as the text
//   working    one aligned display block per worked example, in the same order as `examples`
//   check      self-check questions; every answer is re-derived by the engine
// Original writing for Pri Learning; not an official NESA publication. en-AU spelling.
export default {
  'ma4-dat-c-01': {
    examiners: [
      'The kind of data is named correctly and justified: a count is discrete, a measurement is continuous, a group name is categorical.',
      'A sector angle is the fraction of the total multiplied by $360^\\circ$, and the angles are checked to add to $360^\\circ$.',
      'Every graph has a title, labelled axes with a scale that starts at zero (or a marked break), and equal class intervals.'
    ],
    diagrams: [
      { title: 'A histogram of $30$ values', spec: { kind: 'histogram', bins: { edges: [0, 10, 20, 30, 40], counts: [4, 9, 12, 5] } }, note: 'The bars have heights $4$, $9$, $12$ and $5$, so the total is $30$. The tallest bar holds $12$ values, which is $40\\%$ of the data.' }
    ],
    working: [
      '\\begin{aligned}\\text{angle}&=\\frac{12}{40}\\times360^{\\circ}\\\\&=0.3\\times360^{\\circ}\\\\&=108^{\\circ}\\end{aligned}',
      '\\begin{aligned}\\text{total}&=4+9+12+5=30\\\\\\text{share}&=\\frac{12}{30}\\times100\\%=40\\%\\end{aligned}',
      '\\begin{aligned}\\frac{36}{5}&=7.2\\ \\to\\ \\text{width }8\\\\5\\times8&=40\\ge36\\\\\\text{classes}&:\\ 10\\text{–}17,\\ 18\\text{–}25,\\ \\ldots,\\ 42\\text{–}49\\end{aligned}'
    ],
    check: [
      { question: 'In a survey of $60$ people, $15$ prefer tea. What is the sector angle for tea?', answer: '$90^\\circ$', verify: { kind: 'value', expr: '15/60*360', answer: '90' } },
      { question: 'A sector of $72^\\circ$ on a sector graph represents a group in a survey of $50$ people. How many people are in the group?', answer: '$10$', verify: { kind: 'value', expr: '72/360*50', answer: '10' } },
      { question: 'A frequency table has frequencies $6$, $11$, $9$ and $4$. What percentage of the data has frequency $9$?', answer: '$30\\%$', verify: { kind: 'values', pairs: [['6+11+9+4', '30'], ['9/30*100', '30']] } }
    ]
  },

  'ma4-geo-c-01': {
    examiners: [
      'Each step of an angle calculation gives its reason in words, such as "co-interior angles, parallel lines", "angle sum of a triangle" or "exterior angle of a triangle".',
      'A parallel-line fact is used only after the lines are stated to be parallel.',
      'A congruence proof names the matching vertices in order and states the test used (SSS, SAS, AAS or RHS), never AAA.'
    ],
    diagrams: [
      { title: 'A regular decagon', spec: { kind: 'polygon', n: 10, side: 1 }, note: 'Ten sides: the interior angles add to $1440^\\circ$, so each interior angle is $144^\\circ$ and each exterior angle is $36^\\circ$.' },
      { title: 'An isosceles triangle with a $40^\\circ$ apex', spec: { kind: 'triangle', a: 5, b: 5, C: 40 }, note: 'Two equal sides meet at the apex angle of $40^\\circ$. The other two angles are equal, $\\tfrac{180-40}{2}=70$ degrees each.' }
    ],
    working: [
      '\\begin{aligned}x+(2x+30)&=180&&\\text{(co-interior angles, parallel lines)}\\\\3x&=150\\\\x&=50\\end{aligned}',
      '\\begin{aligned}\\text{Sum}&=(10-2)\\times180^{\\circ}=1440^{\\circ}\\\\\\text{One angle}&=1440^{\\circ}\\div10=144^{\\circ}\\end{aligned}',
      '\\begin{aligned}\\text{Base angle}&=\\frac{180^{\\circ}-40^{\\circ}}{2}=70^{\\circ}\\\\\\text{Exterior angle}&=40^{\\circ}+70^{\\circ}=110^{\\circ}\\end{aligned}'
    ],
    check: [
      { question: 'Find the sum of the interior angles of a hexagon.', answer: '$720^\\circ$', verify: { kind: 'value', expr: '(6-2)*180', answer: '720' } },
      { question: 'The angles of a triangle are $x^\\circ$, $2x^\\circ$ and $3x^\\circ$. Find $x$.', answer: '$x=30$', verify: { kind: 'roots', f: 'x+2*x+3*x-180', answers: ['30'] } },
      { question: 'Find one exterior angle of a regular polygon with $12$ sides.', answer: '$30^\\circ$', verify: { kind: 'value', expr: '360/12', answer: '30' } }
    ]
  }
};
