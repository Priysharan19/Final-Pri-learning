// Original Class 9 diagrams and optional counting explorations; no copied paper figures.
import { makeInquiryVisual } from '../visualInquiryFactory.js';
const specs=[
  {
    "chapterId": "c9-perimeter-area",
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
        2,
        4
      ],
      [
        -3,
        4
      ]
    ],
    "context": "Shaded parallelogram 1"
  },
  {
    "chapterId": "c9-perimeter-area",
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
        4,
        7
      ],
      [
        -2,
        7
      ]
    ],
    "context": "Shaded parallelogram 2"
  },
  {
    "chapterId": "c9-perimeter-area",
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
        6,
        10
      ],
      [
        -1,
        10
      ]
    ],
    "context": "Shaded parallelogram 3"
  },
  {
    "chapterId": "c9-perimeter-area",
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
        8,
        5
      ],
      [
        0,
        5
      ]
    ],
    "context": "Shaded parallelogram 4"
  },
  {
    "chapterId": "c9-perimeter-area",
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
        10,
        8
      ],
      [
        1,
        8
      ]
    ],
    "context": "Shaded parallelogram 5"
  },
  {
    "chapterId": "c9-perimeter-area",
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
        12,
        11
      ],
      [
        2,
        11
      ]
    ],
    "context": "Shaded parallelogram 6"
  },
  {
    "chapterId": "c9-perimeter-area",
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
        14,
        6
      ],
      [
        3,
        6
      ]
    ],
    "context": "Shaded parallelogram 7"
  },
  {
    "chapterId": "c9-perimeter-area",
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
        9,
        9
      ],
      [
        -3,
        9
      ]
    ],
    "context": "Shaded parallelogram 8"
  },
  {
    "chapterId": "c9-perimeter-area",
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
        3,
        4
      ],
      [
        -2,
        4
      ]
    ],
    "context": "Shaded parallelogram 9"
  },
  {
    "chapterId": "c9-perimeter-area",
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
        5,
        7
      ],
      [
        -1,
        7
      ]
    ],
    "context": "Shaded parallelogram 10"
  },
  {
    "chapterId": "c9-perimeter-area",
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
        7,
        10
      ],
      [
        0,
        10
      ]
    ],
    "context": "Shaded parallelogram 11"
  },
  {
    "chapterId": "c9-perimeter-area",
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
        9,
        5
      ],
      [
        1,
        5
      ]
    ],
    "context": "Shaded parallelogram 12"
  },
  {
    "chapterId": "c9-perimeter-area",
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
        11,
        8
      ],
      [
        2,
        8
      ]
    ],
    "context": "Shaded parallelogram 13"
  },
  {
    "chapterId": "c9-perimeter-area",
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
        13,
        11
      ],
      [
        3,
        11
      ]
    ],
    "context": "Shaded parallelogram 14"
  },
  {
    "chapterId": "c9-perimeter-area",
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
        8,
        6
      ],
      [
        -3,
        6
      ]
    ],
    "context": "Shaded parallelogram 15"
  },
  {
    "chapterId": "c9-perimeter-area",
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
        10,
        9
      ],
      [
        -2,
        9
      ]
    ],
    "context": "Shaded parallelogram 16"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "transform",
    "A": [
      -4,
      -5
    ],
    "B": [
      -2,
      -5
    ],
    "C": [
      -3,
      -2
    ],
    "dx": -1,
    "dy": 1,
    "mode": "area",
    "context": "Rigid translation on Cartesian axes 1"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "transform",
    "A": [
      -3,
      -4
    ],
    "B": [
      0,
      -4
    ],
    "C": [
      -2,
      0
    ],
    "dx": -2,
    "dy": 2,
    "mode": "image",
    "context": "Rigid translation on Cartesian axes 2"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "transform",
    "A": [
      -2,
      -3
    ],
    "B": [
      2,
      -3
    ],
    "C": [
      -1,
      2
    ],
    "dx": -3,
    "dy": 3,
    "mode": "image",
    "context": "Rigid translation on Cartesian axes 3"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "transform",
    "A": [
      -1,
      -2
    ],
    "B": [
      4,
      -2
    ],
    "C": [
      0,
      4
    ],
    "dx": -4,
    "dy": 1,
    "mode": "area",
    "context": "Rigid translation on Cartesian axes 4"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "transform",
    "A": [
      0,
      -5
    ],
    "B": [
      6,
      -5
    ],
    "C": [
      1,
      2
    ],
    "dx": -1,
    "dy": 2,
    "mode": "image",
    "context": "Rigid translation on Cartesian axes 5"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "transform",
    "A": [
      1,
      -4
    ],
    "B": [
      3,
      -4
    ],
    "C": [
      2,
      4
    ],
    "dx": -2,
    "dy": 3,
    "mode": "image",
    "context": "Rigid translation on Cartesian axes 6"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "transform",
    "A": [
      -4,
      -3
    ],
    "B": [
      -1,
      -3
    ],
    "C": [
      -3,
      6
    ],
    "dx": -3,
    "dy": 1,
    "mode": "area",
    "context": "Rigid translation on Cartesian axes 7"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "transform",
    "A": [
      -3,
      -2
    ],
    "B": [
      1,
      -2
    ],
    "C": [
      -2,
      1
    ],
    "dx": -4,
    "dy": 2,
    "mode": "image",
    "context": "Rigid translation on Cartesian axes 8"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "transform",
    "A": [
      -2,
      -5
    ],
    "B": [
      3,
      -5
    ],
    "C": [
      -1,
      -1
    ],
    "dx": -1,
    "dy": 3,
    "mode": "image",
    "context": "Rigid translation on Cartesian axes 9"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "transform",
    "A": [
      -1,
      -4
    ],
    "B": [
      5,
      -4
    ],
    "C": [
      0,
      1
    ],
    "dx": -2,
    "dy": 1,
    "mode": "area",
    "context": "Rigid translation on Cartesian axes 10"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "transform",
    "A": [
      0,
      -3
    ],
    "B": [
      2,
      -3
    ],
    "C": [
      1,
      3
    ],
    "dx": -3,
    "dy": 2,
    "mode": "image",
    "context": "Rigid translation on Cartesian axes 11"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "transform",
    "A": [
      1,
      -2
    ],
    "B": [
      4,
      -2
    ],
    "C": [
      2,
      5
    ],
    "dx": -4,
    "dy": 3,
    "mode": "image",
    "context": "Rigid translation on Cartesian axes 12"
  },
  {
    "chapterId": "c9-probability",
    "kind": "histogram",
    "counts": [
      2,
      10,
      20,
      11,
      4
    ],
    "width": 5,
    "mode": "modal",
    "context": "Experimental outcome frequency 1"
  },
  {
    "chapterId": "c9-probability",
    "kind": "histogram",
    "counts": [
      13,
      21,
      10,
      22,
      15,
      10
    ],
    "width": 5,
    "mode": "total",
    "context": "Experimental outcome frequency 2"
  },
  {
    "chapterId": "c9-probability",
    "kind": "histogram",
    "counts": [
      3,
      11,
      21,
      12,
      5
    ],
    "width": 5,
    "mode": "total",
    "context": "Experimental outcome frequency 3"
  },
  {
    "chapterId": "c9-probability",
    "kind": "histogram",
    "counts": [
      14,
      22,
      11,
      2,
      16,
      11
    ],
    "width": 5,
    "mode": "modal",
    "context": "Experimental outcome frequency 4"
  },
  {
    "chapterId": "c9-probability",
    "kind": "histogram",
    "counts": [
      4,
      12,
      22,
      13,
      6
    ],
    "width": 5,
    "mode": "total",
    "context": "Experimental outcome frequency 5"
  },
  {
    "chapterId": "c9-probability",
    "kind": "histogram",
    "counts": [
      15,
      2,
      12,
      3,
      17,
      12
    ],
    "width": 5,
    "mode": "total",
    "context": "Experimental outcome frequency 6"
  },
  {
    "chapterId": "c9-probability",
    "kind": "histogram",
    "counts": [
      5,
      13,
      2,
      14,
      7
    ],
    "width": 5,
    "mode": "modal",
    "context": "Experimental outcome frequency 7"
  },
  {
    "chapterId": "c9-probability",
    "kind": "histogram",
    "counts": [
      16,
      3,
      13,
      4,
      18,
      13
    ],
    "width": 5,
    "mode": "total",
    "context": "Experimental outcome frequency 8"
  },
  {
    "chapterId": "c9-probability",
    "kind": "histogram",
    "counts": [
      6,
      14,
      3,
      15,
      8
    ],
    "width": 5,
    "mode": "total",
    "context": "Experimental outcome frequency 9"
  },
  {
    "chapterId": "c9-probability",
    "kind": "histogram",
    "counts": [
      17,
      4,
      14,
      5,
      19,
      14
    ],
    "width": 5,
    "mode": "modal",
    "context": "Experimental outcome frequency 10"
  },
  {
    "chapterId": "c9-probability",
    "kind": "histogram",
    "counts": [
      7,
      15,
      4,
      16,
      9
    ],
    "width": 5,
    "mode": "total",
    "context": "Experimental outcome frequency 11"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "scatterLine",
    "m": -4,
    "b": -7,
    "points": [
      0,
      1,
      2,
      3,
      4
    ],
    "mode": "intercept",
    "context": "Linear data plot 1"
  },
  {
    "chapterId": "c9-linear-polynomials",
    "kind": "scatterLine",
    "m": -3,
    "b": -7,
    "points": [
      0,
      1,
      2,
      3,
      4
    ],
    "mode": "slope",
    "context": "Linear data plot 2"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "scatterLine",
    "m": -2,
    "b": -6,
    "points": [
      0,
      1,
      2,
      3,
      4
    ],
    "mode": "slope",
    "context": "Linear data plot 3"
  },
  {
    "chapterId": "c9-linear-polynomials",
    "kind": "scatterLine",
    "m": -1,
    "b": -6,
    "points": [
      0,
      1,
      2,
      3,
      4
    ],
    "mode": "intercept",
    "context": "Linear data plot 4"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "scatterLine",
    "m": 1,
    "b": -5,
    "points": [
      0,
      1,
      2,
      3,
      4
    ],
    "mode": "slope",
    "context": "Linear data plot 5"
  },
  {
    "chapterId": "c9-linear-polynomials",
    "kind": "scatterLine",
    "m": 2,
    "b": -5,
    "points": [
      0,
      1,
      2,
      3,
      4
    ],
    "mode": "slope",
    "context": "Linear data plot 6"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "scatterLine",
    "m": 3,
    "b": -4,
    "points": [
      0,
      1,
      2,
      3,
      4
    ],
    "mode": "intercept",
    "context": "Linear data plot 7"
  },
  {
    "chapterId": "c9-linear-polynomials",
    "kind": "scatterLine",
    "m": 4,
    "b": -4,
    "points": [
      0,
      1,
      2,
      3,
      4
    ],
    "mode": "slope",
    "context": "Linear data plot 8"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "scatterLine",
    "m": -4,
    "b": -3,
    "points": [
      0,
      1,
      2,
      3,
      4
    ],
    "mode": "slope",
    "context": "Linear data plot 9"
  },
  {
    "chapterId": "c9-linear-polynomials",
    "kind": "scatterLine",
    "m": -3,
    "b": -3,
    "points": [
      0,
      1,
      2,
      3,
      4
    ],
    "mode": "intercept",
    "context": "Linear data plot 10"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "scatterLine",
    "m": -2,
    "b": -2,
    "points": [
      0,
      1,
      2,
      3,
      4
    ],
    "mode": "slope",
    "context": "Linear data plot 11"
  },
  {
    "chapterId": "c9-linear-polynomials",
    "kind": "scatterLine",
    "m": -1,
    "b": -2,
    "points": [
      0,
      1,
      2,
      3,
      4
    ],
    "mode": "slope",
    "context": "Linear data plot 12"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "scatterLine",
    "m": 1,
    "b": -1,
    "points": [
      0,
      1,
      2,
      3,
      4
    ],
    "mode": "intercept",
    "context": "Linear data plot 13"
  },
  {
    "chapterId": "c9-linear-polynomials",
    "kind": "scatterLine",
    "m": 2,
    "b": -1,
    "points": [
      0,
      1,
      2,
      3,
      4
    ],
    "mode": "slope",
    "context": "Linear data plot 14"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "scatterLine",
    "m": 3,
    "b": 0,
    "points": [
      0,
      1,
      2,
      3,
      4
    ],
    "mode": "slope",
    "context": "Linear data plot 15"
  },
  {
    "chapterId": "c9-linear-polynomials",
    "kind": "scatterLine",
    "m": 4,
    "b": 0,
    "points": [
      0,
      1,
      2,
      3,
      4
    ],
    "mode": "intercept",
    "context": "Linear data plot 16"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "scatterLine",
    "m": -4,
    "b": 1,
    "points": [
      0,
      1,
      2,
      3,
      4
    ],
    "mode": "slope",
    "context": "Linear data plot 17"
  },
  {
    "chapterId": "c9-linear-polynomials",
    "kind": "scatterLine",
    "m": -3,
    "b": 1,
    "points": [
      0,
      1,
      2,
      3,
      4
    ],
    "mode": "slope",
    "context": "Linear data plot 18"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "scatterLine",
    "m": -2,
    "b": 2,
    "points": [
      0,
      1,
      2,
      3,
      4
    ],
    "mode": "intercept",
    "context": "Linear data plot 19"
  },
  {
    "chapterId": "c9-linear-polynomials",
    "kind": "scatterLine",
    "m": -1,
    "b": 2,
    "points": [
      0,
      1,
      2,
      3,
      4
    ],
    "mode": "slope",
    "context": "Linear data plot 20"
  },
  {
    "chapterId": "c9-sequences-progressions",
    "kind": "latticePaths",
    "east": 2,
    "north": 2,
    "context": "Optional paths in rectangular number patterns 1"
  },
  {
    "chapterId": "c9-sequences-progressions",
    "kind": "latticePaths",
    "east": 3,
    "north": 4,
    "context": "Optional paths in rectangular number patterns 2"
  },
  {
    "chapterId": "c9-sequences-progressions",
    "kind": "latticePaths",
    "east": 4,
    "north": 6,
    "context": "Optional paths in rectangular number patterns 3"
  },
  {
    "chapterId": "c9-sequences-progressions",
    "kind": "latticePaths",
    "east": 5,
    "north": 3,
    "context": "Optional paths in rectangular number patterns 4"
  },
  {
    "chapterId": "c9-sequences-progressions",
    "kind": "latticePaths",
    "east": 2,
    "north": 5,
    "context": "Optional paths in rectangular number patterns 5"
  },
  {
    "chapterId": "c9-sequences-progressions",
    "kind": "latticePaths",
    "east": 3,
    "north": 2,
    "context": "Optional paths in rectangular number patterns 6"
  }
];
const out={};for(const {chapterId,kind,...p} of specs)(out[chapterId]||={examples:[]}).examples.push(makeInquiryVisual(kind,p));
export default out;
