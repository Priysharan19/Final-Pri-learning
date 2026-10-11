// Grade 12 figure-first calculus, feasible regions, vectors and statistics studies.
import { makeVisualExample } from '../visualQuestionFactory.js';
const specs = [
  {
    "chapterId": "c12-integrals",
    "kind": "integralArea",
    "m": 2,
    "end": 4,
    "context": "Area beneath a linear graph"
  },
  {
    "chapterId": "c12-integrals",
    "kind": "integralArea",
    "m": 3,
    "end": 2,
    "context": "Definite integral of a line"
  },
  {
    "chapterId": "c12-integrals",
    "kind": "integralArea",
    "m": 1,
    "end": 6,
    "context": "Linear accumulation"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "integralArea",
    "m": 4,
    "end": 3,
    "context": "Triangular accumulated area"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "integralArea",
    "m": 5,
    "end": 2,
    "context": "Shaded first-quadrant region"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "integralArea",
    "m": 2,
    "end": 7,
    "context": "Area between the line and x-axis"
  },
  {
    "chapterId": "c12-linear-programming",
    "kind": "lpMax",
    "vertices": [
      [
        0,
        0
      ],
      [
        6,
        0
      ],
      [
        4,
        4
      ],
      [
        0,
        7
      ]
    ],
    "objective": [
      3,
      2
    ],
    "context": "Workshop output"
  },
  {
    "chapterId": "c12-linear-programming",
    "kind": "lpMax",
    "vertices": [
      [
        0,
        0
      ],
      [
        5,
        0
      ],
      [
        4,
        5
      ],
      [
        0,
        6
      ]
    ],
    "objective": [
      2,
      3
    ],
    "context": "Production mix"
  },
  {
    "chapterId": "c12-linear-programming",
    "kind": "lpMax",
    "vertices": [
      [
        0,
        0
      ],
      [
        8,
        0
      ],
      [
        5,
        3
      ],
      [
        0,
        8
      ]
    ],
    "objective": [
      4,
      1
    ],
    "context": "Profit region"
  },
  {
    "chapterId": "c12-linear-programming",
    "kind": "lpMax",
    "vertices": [
      [
        0,
        0
      ],
      [
        9,
        0
      ],
      [
        5,
        6
      ],
      [
        0,
        7
      ]
    ],
    "objective": [
      2,
      5
    ],
    "context": "Resource allocation"
  },
  {
    "chapterId": "c12-linear-programming",
    "kind": "lpMax",
    "vertices": [
      [
        0,
        0
      ],
      [
        6,
        0
      ],
      [
        3,
        4
      ],
      [
        0,
        6
      ]
    ],
    "objective": [
      5,
      4
    ],
    "context": "Factory planning"
  },
  {
    "chapterId": "c12-linear-programming",
    "kind": "lpMax",
    "vertices": [
      [
        0,
        0
      ],
      [
        4,
        0
      ],
      [
        2,
        5
      ],
      [
        0,
        8
      ]
    ],
    "objective": [
      3,
      1
    ],
    "context": "Constrained advertising"
  },
  {
    "chapterId": "c12-vector-algebra",
    "kind": "vectors",
    "u": [
      5,
      1
    ],
    "v": [
      -1,
      3
    ],
    "context": "Two position vectors"
  },
  {
    "chapterId": "c12-vector-algebra",
    "kind": "vectors",
    "u": [
      3,
      -4
    ],
    "v": [
      4,
      3
    ],
    "context": "Perpendicular arrows"
  },
  {
    "chapterId": "c12-vector-algebra",
    "kind": "vectors",
    "u": [
      2,
      6
    ],
    "v": [
      -5,
      1
    ],
    "context": "Opposing horizontal components"
  },
  {
    "chapterId": "c12-vector-algebra",
    "kind": "vectors",
    "u": [
      -4,
      -3
    ],
    "v": [
      6,
      -2
    ],
    "context": "Negative vector components"
  },
  {
    "chapterId": "c12-applications-derivatives",
    "kind": "parabolaVertex",
    "a": -2,
    "h": 3,
    "k": 8,
    "context": "A profit maximum"
  },
  {
    "chapterId": "c12-applications-derivatives",
    "kind": "parabolaVertex",
    "a": 2,
    "h": -1,
    "k": -6,
    "context": "A cost minimum"
  },
  {
    "chapterId": "c12-applications-derivatives",
    "kind": "parabolaVertex",
    "a": -1,
    "h": 4,
    "k": 9,
    "context": "A projected height maximum"
  },
  {
    "chapterId": "c12-applications-derivatives",
    "kind": "parabolaVertex",
    "a": 1,
    "h": -4,
    "k": 2,
    "context": "A squared distance minimum"
  },
  {
    "chapterId": "c12-probability",
    "kind": "barProb",
    "labels": [
      "D1",
      "D2",
      "D3"
    ],
    "values": [
      6,
      9,
      15
    ],
    "favourable": "D3",
    "context": "Discrete sample distribution"
  },
  {
    "chapterId": "c12-probability",
    "kind": "barProb",
    "labels": [
      "A",
      "B",
      "C",
      "D"
    ],
    "values": [
      4,
      12,
      6,
      8
    ],
    "favourable": "B",
    "context": "Conditional selection model"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "lineIntercept",
    "m": -2,
    "b": -4,
    "context": "Range of a linear map"
  },
  {
    "chapterId": "c12-vector-algebra",
    "kind": "vectors",
    "u": [
      6,
      2
    ],
    "v": [
      -3,
      5
    ],
    "context": "Planar displacement-vector components"
  }
];
const data={};for(const {chapterId,kind,...p} of specs)(data[chapterId]||={examples:[]}).examples.push(makeVisualExample(kind,p));
export default data;
