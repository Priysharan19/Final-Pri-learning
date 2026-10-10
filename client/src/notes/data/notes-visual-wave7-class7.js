// Wave 7: independently verifiable original vector-diagram practice.
import { makeInquiryVisual } from '../visualInquiryFactory.js';
const specs=[
  {
    "chapterId": "c7-triangles-current",
    "kind": "polygonArea",
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
        1,
        4
      ]
    ],
    "context": "River-bank triangle investigation 1"
  },
  {
    "chapterId": "c7-triangles-current",
    "kind": "polygonArea",
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
        2,
        5
      ]
    ],
    "context": "River-bank triangle investigation 2"
  },
  {
    "chapterId": "c7-triangles-current",
    "kind": "polygonArea",
    "vertices": [
      [
        0,
        0
      ],
      [
        7,
        0
      ],
      [
        3,
        6
      ]
    ],
    "context": "River-bank triangle investigation 3"
  },
  {
    "chapterId": "c7-triangles-current",
    "kind": "polygonArea",
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
        1,
        7
      ]
    ],
    "context": "River-bank triangle investigation 4"
  },
  {
    "chapterId": "c7-triangles-current",
    "kind": "polygonArea",
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
        2,
        8
      ]
    ],
    "context": "River-bank triangle investigation 5"
  },
  {
    "chapterId": "c7-triangles-current",
    "kind": "polygonArea",
    "vertices": [
      [
        0,
        0
      ],
      [
        10,
        0
      ],
      [
        3,
        9
      ]
    ],
    "context": "River-bank triangle investigation 6"
  },
  {
    "chapterId": "c7-triangles-current",
    "kind": "polygonArea",
    "vertices": [
      [
        0,
        0
      ],
      [
        11,
        0
      ],
      [
        1,
        10
      ]
    ],
    "context": "River-bank triangle investigation 7"
  },
  {
    "chapterId": "c7-triangles-current",
    "kind": "polygonArea",
    "vertices": [
      [
        0,
        0
      ],
      [
        12,
        0
      ],
      [
        2,
        11
      ]
    ],
    "context": "River-bank triangle investigation 8"
  },
  {
    "chapterId": "c7-geometric-twins-current",
    "kind": "transform",
    "A": [
      -3,
      -3
    ],
    "B": [
      2,
      -3
    ],
    "C": [
      -1,
      1
    ],
    "dx": 1,
    "dy": -2,
    "mode": "image",
    "context": "Isometric motion task 1"
  },
  {
    "chapterId": "c7-geometric-twins-current",
    "kind": "transform",
    "A": [
      -3,
      -2
    ],
    "B": [
      2,
      -2
    ],
    "C": [
      -1,
      2
    ],
    "dx": 2,
    "dy": -3,
    "mode": "area",
    "context": "Isometric motion task 2"
  },
  {
    "chapterId": "c7-geometric-twins-current",
    "kind": "transform",
    "A": [
      -3,
      -1
    ],
    "B": [
      2,
      -1
    ],
    "C": [
      -1,
      3
    ],
    "dx": 3,
    "dy": -4,
    "mode": "image",
    "context": "Isometric motion task 3"
  },
  {
    "chapterId": "c7-geometric-twins-current",
    "kind": "transform",
    "A": [
      -3,
      0
    ],
    "B": [
      2,
      0
    ],
    "C": [
      -1,
      4
    ],
    "dx": 4,
    "dy": -5,
    "mode": "area",
    "context": "Isometric motion task 4"
  },
  {
    "chapterId": "c7-geometric-twins-current",
    "kind": "transform",
    "A": [
      -3,
      1
    ],
    "B": [
      2,
      1
    ],
    "C": [
      -1,
      5
    ],
    "dx": 5,
    "dy": -6,
    "mode": "image",
    "context": "Isometric motion task 5"
  },
  {
    "chapterId": "c7-geometric-twins-current",
    "kind": "transform",
    "A": [
      -3,
      2
    ],
    "B": [
      2,
      2
    ],
    "C": [
      -1,
      6
    ],
    "dx": 6,
    "dy": -7,
    "mode": "area",
    "context": "Isometric motion task 6"
  },
  {
    "chapterId": "c7-geometric-twins-current",
    "kind": "transform",
    "A": [
      -3,
      3
    ],
    "B": [
      2,
      3
    ],
    "C": [
      -1,
      7
    ],
    "dx": 7,
    "dy": -8,
    "mode": "image",
    "context": "Isometric motion task 7"
  },
  {
    "chapterId": "c7-number-play-current",
    "kind": "histogram",
    "counts": [
      4,
      7,
      3,
      10,
      5
    ],
    "width": 2,
    "mode": "total",
    "context": "Histogram pattern study 1"
  },
  {
    "chapterId": "c7-number-play-current",
    "kind": "histogram",
    "counts": [
      5,
      8,
      5,
      11,
      6
    ],
    "width": 2,
    "mode": "modal",
    "context": "Histogram pattern study 2"
  },
  {
    "chapterId": "c7-number-play-current",
    "kind": "histogram",
    "counts": [
      6,
      9,
      7,
      12,
      7
    ],
    "width": 2,
    "mode": "total",
    "context": "Histogram pattern study 3"
  },
  {
    "chapterId": "c7-number-play-current",
    "kind": "histogram",
    "counts": [
      7,
      10,
      9,
      13,
      8
    ],
    "width": 2,
    "mode": "modal",
    "context": "Histogram pattern study 4"
  },
  {
    "chapterId": "c7-number-play-current",
    "kind": "histogram",
    "counts": [
      8,
      11,
      11,
      14,
      9
    ],
    "width": 2,
    "mode": "total",
    "context": "Histogram pattern study 5"
  }
];
const data={};for(const {chapterId,kind,...p} of specs)(data[chapterId]||={examples:[]}).examples.push(makeInquiryVisual(kind,p));
export default data;
