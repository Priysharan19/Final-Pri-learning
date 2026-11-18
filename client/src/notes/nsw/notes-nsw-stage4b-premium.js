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
      [
        { say: 'Fraction of the full turn:', tex: '\\text{angle}&=\\dfrac{12}{40}\\times360^{\\circ}' },
        { tex: '&=0.3\\times360^{\\circ}' },
        { tex: '&=108^{\\circ}' }
      ],
      [
        { say: 'Total frequency:', tex: '\\text{total}&=4+9+12+5' },
        { tex: '&=30' },
        { say: 'Share in the tallest bar:', tex: '\\text{share}&=\\dfrac{12}{30}\\times100\\%' },
        { tex: '&=40\\%' }
      ],
      [
        { say: 'Number of whole marks, divided by $5$ classes:', tex: '\\dfrac{47-12+1}{5}&=\\dfrac{36}{5}' },
        { tex: '&=7.2' },
        { say: 'Width $7$ is too small, so round up to the class width:', tex: 'w&=8' },
        { say: 'Five classes of that width cover:', tex: '5\\times8&=40' },
        { say: 'Check the classes cover all $36$ marks:', tex: '40&\\ge36' },
        { say: 'Start at $10$; the last class ends at $10+40-1$:', tex: '10+5\\times8-1&=49' }
      ]
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
      [
        { say: 'Co-interior angles add to $180^\\circ$:', tex: 'x+(2x+30)&=180' },
        { say: 'Collect like terms:', tex: '3x+30&=180' },
        { say: 'Subtract $30$:', tex: '3x&=150' },
        { say: 'Divide by $3$:', tex: 'x&=50' }
      ],
      [
        { say: 'Angle sum of a polygon:', tex: '\\text{Sum}&=(10-2)\\times180^{\\circ}' },
        { tex: '&=1440^{\\circ}' },
        { say: 'Divide among $10$ equal angles:', tex: '\\text{One angle}&=1440^{\\circ}\\div10' },
        { tex: '&=144^{\\circ}' }
      ],
      [
        { say: 'Base angles are equal; angles add to $180^\\circ$:', tex: '\\text{Base angle}&=\\dfrac{180^{\\circ}-40^{\\circ}}{2}' },
        { tex: '&=70^{\\circ}' },
        { say: 'Exterior angle is the sum of the two opposite interior angles:', tex: '\\text{Exterior angle}&=40^{\\circ}+70^{\\circ}' },
        { tex: '&=110^{\\circ}' },
        { say: 'Check, angles on a straight line:', tex: '110^{\\circ}+70^{\\circ}&=180^{\\circ}' }
      ]
    ],
    check: [
      { question: 'Find the sum of the interior angles of a hexagon.', answer: '$720^\\circ$', verify: { kind: 'value', expr: '(6-2)*180', answer: '720' } },
      { question: 'The angles of a triangle are $x^\\circ$, $2x^\\circ$ and $3x^\\circ$. Find $x$.', answer: '$x=30$', verify: { kind: 'roots', f: 'x+2*x+3*x-180', answers: ['30'] } },
      { question: 'Find one exterior angle of a regular polygon with $12$ sides.', answer: '$30^\\circ$', verify: { kind: 'value', expr: '360/12', answer: '30' } }
    ]
  }
};
