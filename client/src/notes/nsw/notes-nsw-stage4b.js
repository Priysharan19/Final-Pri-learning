// Pri Learning · NSW Notes · Stage 4 (Years 7 and 8), second band
//
// Original revision writing for two further NSW Mathematics K–10 Syllabus (2022)
// focus areas: data classification and visualisation, and properties of
// geometrical figures. Written for Pri Learning; it is not an official NESA
// publication and quotes no syllabus text. Keyed by the lower-case outcome code
// of the focus area (a reference only). en-AU spelling. Every worked example's
// answer is re-derived by the deterministic engine in
// client/test/nsw-notes-bands-check.mjs.
export default {
  'ma4-dat-c-01': {
    summary: 'Data classification and visualisation is about deciding what kind of data you have, organising it in a frequency table, and choosing a graph that shows its shape honestly, from dot plots and histograms to sector graphs.',
    prereqs: ['ma4-frc-c-01'],
    concepts: [
      { title: 'Kinds of data', body: 'Categorical data names a group, such as favourite sport or eye colour. Numerical data is a count or a measurement. A count (shoe size, goals scored) is discrete; a measurement (height, time) is continuous and can take any value in a range.' },
      { title: 'Frequency tables and class intervals', body: 'A frequency table lists each value, or each class interval, with the number of times it occurs. Equal class intervals keep a graph fair. The class width is $\\dfrac{\\text{range}}{\\text{number of classes}}$, rounded up to a convenient number.' },
      { title: 'Choosing and reading a graph', body: 'A column graph compares categories, a dot plot or stem-and-leaf plot shows every value in a small data set, a histogram shows the shape of a large numerical set, and a sector graph shows parts of a whole. The scale, the axis labels and the title must let a reader recover the data.' }
    ],
    definitions: [
      { term: 'Frequency', meaning: 'The number of times a value, or a value in a class interval, occurs in a data set. The frequencies add to the total number of data values.' },
      { term: 'Sector graph', meaning: 'A circle divided into sectors whose angles are proportional to the frequencies, so a category with a fraction $f$ of the data has a sector angle of $f\\times360^\\circ$.' }
    ],
    formulas: [
      { label: 'Sector angle', tex: '\\text{angle}=\\frac{\\text{frequency}}{\\text{total}}\\times360^{\\circ}' },
      { label: 'Percentage of the data', tex: '\\text{percentage}=\\frac{\\text{frequency}}{\\text{total}}\\times100\\%' }
    ],
    points: [
      { front: 'Is the number of siblings categorical or numerical?', back: 'Numerical, and discrete, because it is a count.' },
      { front: 'Is the time taken to run $100$ m discrete or continuous?', back: 'Continuous, because a time can take any value in a range.' },
      { front: 'How many degrees do all the sectors of a sector graph add to?', back: '$360^\\circ$.' },
      { front: 'What does a stem-and-leaf plot keep that a histogram loses?', back: 'The individual data values.' },
      { front: 'Why must the class intervals in a histogram be equal?', back: 'So the height of a bar can be compared fairly with the height of another.' }
    ],
    mistakes: [
      { wrong: 'A column graph has a vertical axis starting at $50$ instead of $0$, so a difference of $5$ looks enormous.', right: 'A column graph starts at zero, or the break in the scale is shown clearly. Bar lengths then match the values.' },
      { wrong: 'Sector angles are found by dividing $360$ by the frequency.', right: 'Divide the frequency by the total first, then multiply by $360^\\circ$: for $12$ out of $40$ the angle is $\\tfrac{12}{40}\\times360^\\circ=108^\\circ$.' },
      { wrong: 'Using class intervals $0$–$10$, $10$–$30$, $30$–$40$ in one histogram.', right: 'Make every interval the same width, such as $0$–$10$, $10$–$20$, $20$–$30$, $30$–$40$, and say which end belongs to which class.' }
    ],
    examples: [
      {
        question: 'In a survey of $40$ students, $12$ walk to school. What angle represents walking on a sector graph?',
        steps: ['The fraction who walk is $\\tfrac{12}{40}$.', 'Multiply by the full turn: $\\tfrac{12}{40}\\times360^\\circ=108^\\circ$.'],
        answer: '$108^\\circ$',
        verify: { kind: 'value', expr: '12/40*360', answer: '108' }
      },
      {
        question: 'A histogram has bars of frequency $4$, $9$, $12$ and $5$ over equal classes. What percentage of the data lies in the tallest bar?',
        steps: ['The total frequency is $4+9+12+5=30$.', 'The tallest bar has $12$ values, so the share is $\\tfrac{12}{30}\\times100\\%=40\\%$.'],
        answer: '$40\\%$',
        verify: { kind: 'values', pairs: [['4+9+12+5', '30'], ['12/30*100', '40']] }
      },
      {
        question: 'The marks in a test range from $12$ to $47$. A teacher wants $5$ equal classes covering the data. What class width works, and what are the classes?',
        steps: ['The marks $12,13,\\ldots,47$ are $47-12+1=36$ whole numbers, and $\\tfrac{36}{5}=7.2$, so a width of $7$ is too small.', 'Round up to a width of $8$: five classes cover $5\\times8=40$ values.', 'Starting at $10$, the classes are $10$–$17$, $18$–$25$, $26$–$33$, $34$–$41$, $42$–$49$, and every mark from $12$ to $47$ lies in exactly one of them.'],
        answer: 'Width $8$, starting at $10$.',
        verify: { kind: 'values', pairs: [['47-12+1', '36'], ['5*8', '40'], ['10+5*8-1', '49']] }
      }
    ]
  },

  'ma4-geo-c-01': {
    summary: 'Properties of geometrical figures covers the angle facts for lines, triangles, quadrilaterals and polygons, and the conditions that make two triangles congruent. Each fact is a reason you can quote in a geometric argument.',
    prereqs: ['ma4-alg-c-01'],
    concepts: [
      { title: 'Angles at a point and on parallel lines', body: 'Angles on a straight line add to $180^\\circ$ and angles at a point add to $360^\\circ$. Vertically opposite angles are equal. A transversal of two parallel lines makes equal corresponding angles, equal alternate angles and co-interior angles that add to $180^\\circ$.' },
      { title: 'Triangles and quadrilaterals', body: 'The angles of a triangle add to $180^\\circ$, and an exterior angle equals the sum of the two opposite interior angles. The base angles of an isosceles triangle are equal. The angles of a quadrilateral add to $360^\\circ$.' },
      { title: 'Polygons and congruence', body: 'A polygon with $n$ sides has interior angles adding to $(n-2)\\times180^\\circ$, and its exterior angles add to $360^\\circ$. Two triangles are congruent when they satisfy SSS, SAS, AAS or RHS.' }
    ],
    definitions: [
      { term: 'Congruent figures', meaning: 'Figures that have exactly the same shape and size, so one fits onto the other after a slide, turn or flip.' },
      { term: 'Regular polygon', meaning: 'A polygon whose sides are all equal and whose angles are all equal.' }
    ],
    formulas: [
      { label: 'Angle sum of a triangle', tex: 'a+b+c=180^{\\circ}' },
      { label: 'Angle sum of an $n$-sided polygon', tex: '(n-2)\\times180^{\\circ}' },
      { label: 'Interior angle of a regular $n$-gon', tex: '\\frac{(n-2)\\times180^{\\circ}}{n}=180^{\\circ}-\\frac{360^{\\circ}}{n}' }
    ],
    points: [
      { front: 'Co-interior angles between parallel lines add to what?', back: '$180^\\circ$.' },
      { front: 'Name the four congruence tests for triangles.', back: 'SSS, SAS, AAS and RHS.' },
      { front: 'What is the angle sum of a pentagon?', back: '$(5-2)\\times180^\\circ=540^\\circ$.' },
      { front: 'What do the exterior angles of any convex polygon add to?', back: '$360^\\circ$.' },
      { front: 'What are the diagonals of a rhombus like?', back: 'They bisect each other at right angles and bisect the angles of the rhombus.' }
    ],
    mistakes: [
      { wrong: 'Alternate angles are always equal.', right: 'They are equal only when the two lines cut by the transversal are parallel. Without parallel lines the equality has to be proved another way.' },
      { wrong: 'AAA proves two triangles congruent.', right: 'Equal angles give triangles of the same shape, not necessarily the same size. Congruence needs a side, as in AAS.' },
      { wrong: 'The angle sum of a hexagon is $6\\times180^\\circ$.', right: 'Split from one vertex into $n-2$ triangles: $(6-2)\\times180^\\circ=720^\\circ$.' }
    ],
    examples: [
      {
        question: 'Two parallel lines are cut by a transversal. Two co-interior angles are $x^\\circ$ and $(2x+30)^\\circ$. Find $x$.',
        steps: ['Co-interior angles between parallel lines add to $180^\\circ$: $x+(2x+30)=180$.', 'So $3x=150$ and $x=50$.', 'The angles are $50^\\circ$ and $130^\\circ$, which add to $180^\\circ$.'],
        answer: '$x=50$',
        verify: { kind: 'roots', f: 'x+(2*x+30)-180', answers: ['50'] }
      },
      {
        question: 'Find the sum of the interior angles of a decagon, and the size of one interior angle of a regular decagon.',
        steps: ['A decagon has $n=10$ sides, so the sum is $(10-2)\\times180^\\circ=1440^\\circ$.', 'A regular decagon has $10$ equal angles: $1440^\\circ\\div10=144^\\circ$.'],
        answer: 'Sum $1440^\\circ$; each angle $144^\\circ$',
        verify: { kind: 'values', pairs: [['(10-2)*180', '1440'], ['1440/10', '144'], ['180-360/10', '144']] }
      },
      {
        question: 'An isosceles triangle has an apex angle of $40^\\circ$. Find each base angle and the exterior angle at a base vertex.',
        steps: ['The base angles are equal and the three angles add to $180^\\circ$: $\\tfrac{180-40}{2}=70$.', 'The exterior angle at a base vertex equals the sum of the other two interior angles: $40+70=110$.', 'Check: the exterior angle and the interior angle on a straight line, $110+70=180$.'],
        answer: 'Base angles $70^\\circ$; exterior angle $110^\\circ$',
        verify: { kind: 'values', pairs: [['(180-40)/2', '70'], ['40+70', '110'], ['110+70', '180']] }
      }
    ]
  }
};
