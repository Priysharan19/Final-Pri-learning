// Class 10 original plotted similarity, polynomial, statistics and coordinate inquiry problems.
import { makeInquiryVisual } from '../visualInquiryFactory.js';
const specs=[
  {
    "chapterId": "c10-triangles",
    "kind": "similarTriangles",
    "base": 6,
    "height": 8,
    "num": 1,
    "den": 2,
    "context": "Parallel segment similarity study 1"
  },
  {
    "chapterId": "c10-triangles",
    "kind": "similarTriangles",
    "base": 18,
    "height": 24,
    "num": 1,
    "den": 3,
    "context": "Parallel segment similarity study 2"
  },
  {
    "chapterId": "c10-triangles",
    "kind": "similarTriangles",
    "base": 36,
    "height": 48,
    "num": 2,
    "den": 4,
    "context": "Parallel segment similarity study 3"
  },
  {
    "chapterId": "c10-triangles",
    "kind": "similarTriangles",
    "base": 24,
    "height": 32,
    "num": 1,
    "den": 2,
    "context": "Parallel segment similarity study 4"
  },
  {
    "chapterId": "c10-triangles",
    "kind": "similarTriangles",
    "base": 9,
    "height": 12,
    "num": 1,
    "den": 3,
    "context": "Parallel segment similarity study 5"
  },
  {
    "chapterId": "c10-triangles",
    "kind": "similarTriangles",
    "base": 24,
    "height": 32,
    "num": 1,
    "den": 4,
    "context": "Parallel segment similarity study 6"
  },
  {
    "chapterId": "c10-triangles",
    "kind": "similarTriangles",
    "base": 18,
    "height": 24,
    "num": 1,
    "den": 2,
    "context": "Parallel segment similarity study 7"
  },
  {
    "chapterId": "c10-triangles",
    "kind": "similarTriangles",
    "base": 36,
    "height": 48,
    "num": 1,
    "den": 3,
    "context": "Parallel segment similarity study 8"
  },
  {
    "chapterId": "c10-triangles",
    "kind": "similarTriangles",
    "base": 12,
    "height": 16,
    "num": 3,
    "den": 4,
    "context": "Parallel segment similarity study 9"
  },
  {
    "chapterId": "c10-triangles",
    "kind": "similarTriangles",
    "base": 12,
    "height": 16,
    "num": 1,
    "den": 2,
    "context": "Parallel segment similarity study 10"
  },
  {
    "chapterId": "c10-triangles",
    "kind": "similarTriangles",
    "base": 27,
    "height": 36,
    "num": 1,
    "den": 3,
    "context": "Parallel segment similarity study 11"
  },
  {
    "chapterId": "c10-triangles",
    "kind": "similarTriangles",
    "base": 48,
    "height": 64,
    "num": 3,
    "den": 4,
    "context": "Parallel segment similarity study 12"
  },
  {
    "chapterId": "c10-triangles",
    "kind": "similarTriangles",
    "base": 6,
    "height": 8,
    "num": 1,
    "den": 2,
    "context": "Parallel segment similarity study 13"
  },
  {
    "chapterId": "c10-triangles",
    "kind": "similarTriangles",
    "base": 18,
    "height": 24,
    "num": 1,
    "den": 3,
    "context": "Parallel segment similarity study 14"
  },
  {
    "chapterId": "c10-triangles",
    "kind": "similarTriangles",
    "base": 36,
    "height": 48,
    "num": 2,
    "den": 4,
    "context": "Parallel segment similarity study 15"
  },
  {
    "chapterId": "c10-triangles",
    "kind": "similarTriangles",
    "base": 24,
    "height": 32,
    "num": 1,
    "den": 2,
    "context": "Parallel segment similarity study 16"
  },
  {
    "chapterId": "c10-triangles",
    "kind": "similarTriangles",
    "base": 9,
    "height": 12,
    "num": 1,
    "den": 3,
    "context": "Parallel segment similarity study 17"
  },
  {
    "chapterId": "c10-triangles",
    "kind": "similarTriangles",
    "base": 24,
    "height": 32,
    "num": 1,
    "den": 4,
    "context": "Parallel segment similarity study 18"
  },
  {
    "chapterId": "c10-triangles",
    "kind": "similarTriangles",
    "base": 18,
    "height": 24,
    "num": 1,
    "den": 2,
    "context": "Parallel segment similarity study 19"
  },
  {
    "chapterId": "c10-triangles",
    "kind": "similarTriangles",
    "base": 36,
    "height": 48,
    "num": 1,
    "den": 3,
    "context": "Parallel segment similarity study 20"
  },
  {
    "chapterId": "c10-quadratic-equations",
    "kind": "quadraticRoots",
    "r1": -1,
    "r2": 1,
    "a": -1,
    "context": "Parabolic turning-point investigation 1"
  },
  {
    "chapterId": "c10-polynomials",
    "kind": "quadraticRoots",
    "r1": -2,
    "r2": 4,
    "a": 1,
    "context": "Parabolic turning-point investigation 2"
  },
  {
    "chapterId": "c10-quadratic-equations",
    "kind": "quadraticRoots",
    "r1": -3,
    "r2": 2,
    "a": 1,
    "context": "Parabolic turning-point investigation 3"
  },
  {
    "chapterId": "c10-polynomials",
    "kind": "quadraticRoots",
    "r1": -4,
    "r2": 5,
    "a": 1,
    "context": "Parabolic turning-point investigation 4"
  },
  {
    "chapterId": "c10-quadratic-equations",
    "kind": "quadraticRoots",
    "r1": -5,
    "r2": 3,
    "a": -1,
    "context": "Parabolic turning-point investigation 5"
  },
  {
    "chapterId": "c10-polynomials",
    "kind": "quadraticRoots",
    "r1": -1,
    "r2": 1,
    "a": 1,
    "context": "Parabolic turning-point investigation 6"
  },
  {
    "chapterId": "c10-quadratic-equations",
    "kind": "quadraticRoots",
    "r1": -2,
    "r2": 4,
    "a": 1,
    "context": "Parabolic turning-point investigation 7"
  },
  {
    "chapterId": "c10-polynomials",
    "kind": "quadraticRoots",
    "r1": -3,
    "r2": 2,
    "a": 1,
    "context": "Parabolic turning-point investigation 8"
  },
  {
    "chapterId": "c10-quadratic-equations",
    "kind": "quadraticRoots",
    "r1": -4,
    "r2": 5,
    "a": -1,
    "context": "Parabolic turning-point investigation 9"
  },
  {
    "chapterId": "c10-polynomials",
    "kind": "quadraticRoots",
    "r1": -5,
    "r2": 3,
    "a": 1,
    "context": "Parabolic turning-point investigation 10"
  },
  {
    "chapterId": "c10-quadratic-equations",
    "kind": "quadraticRoots",
    "r1": -1,
    "r2": 1,
    "a": 1,
    "context": "Parabolic turning-point investigation 11"
  },
  {
    "chapterId": "c10-polynomials",
    "kind": "quadraticRoots",
    "r1": -2,
    "r2": 4,
    "a": 1,
    "context": "Parabolic turning-point investigation 12"
  },
  {
    "chapterId": "c10-quadratic-equations",
    "kind": "quadraticRoots",
    "r1": -3,
    "r2": 2,
    "a": -1,
    "context": "Parabolic turning-point investigation 13"
  },
  {
    "chapterId": "c10-polynomials",
    "kind": "quadraticRoots",
    "r1": -4,
    "r2": 5,
    "a": 1,
    "context": "Parabolic turning-point investigation 14"
  },
  {
    "chapterId": "c10-quadratic-equations",
    "kind": "quadraticRoots",
    "r1": -5,
    "r2": 3,
    "a": 1,
    "context": "Parabolic turning-point investigation 15"
  },
  {
    "chapterId": "c10-polynomials",
    "kind": "quadraticRoots",
    "r1": -1,
    "r2": 1,
    "a": 1,
    "context": "Parabolic turning-point investigation 16"
  },
  {
    "chapterId": "c10-quadratic-equations",
    "kind": "quadraticRoots",
    "r1": -2,
    "r2": 4,
    "a": -1,
    "context": "Parabolic turning-point investigation 17"
  },
  {
    "chapterId": "c10-polynomials",
    "kind": "quadraticRoots",
    "r1": -3,
    "r2": 2,
    "a": 1,
    "context": "Parabolic turning-point investigation 18"
  },
  {
    "chapterId": "c10-quadratic-equations",
    "kind": "quadraticRoots",
    "r1": -4,
    "r2": 5,
    "a": 1,
    "context": "Parabolic turning-point investigation 19"
  },
  {
    "chapterId": "c10-polynomials",
    "kind": "quadraticRoots",
    "r1": -5,
    "r2": 3,
    "a": 1,
    "context": "Parabolic turning-point investigation 20"
  },
  {
    "chapterId": "c10-coordinate-geometry",
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
        6,
        3
      ],
      [
        5,
        5
      ],
      [
        0,
        5
      ]
    ],
    "context": "Shoelace polygon survey 1"
  },
  {
    "chapterId": "c10-coordinate-geometry",
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
        5
      ],
      [
        5,
        7
      ],
      [
        0,
        7
      ]
    ],
    "context": "Shoelace polygon survey 2"
  },
  {
    "chapterId": "c10-coordinate-geometry",
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
        7
      ],
      [
        7,
        9
      ],
      [
        0,
        9
      ]
    ],
    "context": "Shoelace polygon survey 3"
  },
  {
    "chapterId": "c10-coordinate-geometry",
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
        9,
        9
      ],
      [
        7,
        11
      ],
      [
        0,
        11
      ]
    ],
    "context": "Shoelace polygon survey 4"
  },
  {
    "chapterId": "c10-coordinate-geometry",
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
        10,
        4
      ],
      [
        9,
        6
      ],
      [
        0,
        6
      ]
    ],
    "context": "Shoelace polygon survey 5"
  },
  {
    "chapterId": "c10-coordinate-geometry",
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
        11,
        6
      ],
      [
        9,
        8
      ],
      [
        0,
        8
      ]
    ],
    "context": "Shoelace polygon survey 6"
  },
  {
    "chapterId": "c10-coordinate-geometry",
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
        12,
        8
      ],
      [
        11,
        10
      ],
      [
        0,
        10
      ]
    ],
    "context": "Shoelace polygon survey 7"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "polygonArea",
    "vertices": [
      [
        0,
        0
      ],
      [
        13,
        0
      ],
      [
        13,
        3
      ],
      [
        11,
        5
      ],
      [
        0,
        5
      ]
    ],
    "context": "Shoelace polygon survey 8"
  },
  {
    "chapterId": "c10-coordinate-geometry",
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
        6,
        5
      ],
      [
        5,
        7
      ],
      [
        0,
        7
      ]
    ],
    "context": "Shoelace polygon survey 9"
  },
  {
    "chapterId": "c10-coordinate-geometry",
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
        7
      ],
      [
        5,
        9
      ],
      [
        0,
        9
      ]
    ],
    "context": "Shoelace polygon survey 10"
  },
  {
    "chapterId": "c10-coordinate-geometry",
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
        9
      ],
      [
        7,
        11
      ],
      [
        0,
        11
      ]
    ],
    "context": "Shoelace polygon survey 11"
  },
  {
    "chapterId": "c10-coordinate-geometry",
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
        9,
        4
      ],
      [
        7,
        6
      ],
      [
        0,
        6
      ]
    ],
    "context": "Shoelace polygon survey 12"
  },
  {
    "chapterId": "c10-coordinate-geometry",
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
        10,
        6
      ],
      [
        9,
        8
      ],
      [
        0,
        8
      ]
    ],
    "context": "Shoelace polygon survey 13"
  },
  {
    "chapterId": "c10-coordinate-geometry",
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
        11,
        8
      ],
      [
        9,
        10
      ],
      [
        0,
        10
      ]
    ],
    "context": "Shoelace polygon survey 14"
  },
  {
    "chapterId": "c10-coordinate-geometry",
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
        12,
        3
      ],
      [
        11,
        5
      ],
      [
        0,
        5
      ]
    ],
    "context": "Shoelace polygon survey 15"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "scatterLine",
    "m": -3,
    "b": -3,
    "points": [
      -1,
      0,
      1,
      2,
      3
    ],
    "mode": "intercept",
    "context": "Linear-model dataset 1"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "scatterLine",
    "m": -2,
    "b": -3,
    "points": [
      -1,
      0,
      1,
      2,
      3
    ],
    "mode": "slope",
    "context": "Linear-model dataset 2"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "scatterLine",
    "m": -1,
    "b": -2,
    "points": [
      -1,
      0,
      1,
      2,
      3
    ],
    "mode": "slope",
    "context": "Linear-model dataset 3"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "scatterLine",
    "m": 1,
    "b": -2,
    "points": [
      -1,
      0,
      1,
      2,
      3
    ],
    "mode": "intercept",
    "context": "Linear-model dataset 4"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "scatterLine",
    "m": 2,
    "b": -1,
    "points": [
      -1,
      0,
      1,
      2,
      3
    ],
    "mode": "slope",
    "context": "Linear-model dataset 5"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "scatterLine",
    "m": 3,
    "b": -1,
    "points": [
      -1,
      0,
      1,
      2,
      3
    ],
    "mode": "slope",
    "context": "Linear-model dataset 6"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "scatterLine",
    "m": -3,
    "b": 0,
    "points": [
      -1,
      0,
      1,
      2,
      3
    ],
    "mode": "intercept",
    "context": "Linear-model dataset 7"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "scatterLine",
    "m": -2,
    "b": 0,
    "points": [
      -1,
      0,
      1,
      2,
      3
    ],
    "mode": "slope",
    "context": "Linear-model dataset 8"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "scatterLine",
    "m": -1,
    "b": 1,
    "points": [
      -1,
      0,
      1,
      2,
      3
    ],
    "mode": "slope",
    "context": "Linear-model dataset 9"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "scatterLine",
    "m": 1,
    "b": 1,
    "points": [
      -1,
      0,
      1,
      2,
      3
    ],
    "mode": "intercept",
    "context": "Linear-model dataset 10"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "scatterLine",
    "m": 2,
    "b": 2,
    "points": [
      -1,
      0,
      1,
      2,
      3
    ],
    "mode": "slope",
    "context": "Linear-model dataset 11"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "scatterLine",
    "m": 3,
    "b": 2,
    "points": [
      -1,
      0,
      1,
      2,
      3
    ],
    "mode": "slope",
    "context": "Linear-model dataset 12"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "scatterLine",
    "m": -3,
    "b": 3,
    "points": [
      -1,
      0,
      1,
      2,
      3
    ],
    "mode": "intercept",
    "context": "Linear-model dataset 13"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "scatterLine",
    "m": -2,
    "b": 3,
    "points": [
      -1,
      0,
      1,
      2,
      3
    ],
    "mode": "slope",
    "context": "Linear-model dataset 14"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "scatterLine",
    "m": -1,
    "b": -3,
    "points": [
      -1,
      0,
      1,
      2,
      3
    ],
    "mode": "slope",
    "context": "Linear-model dataset 15"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "histogram",
    "counts": [
      2,
      10,
      3,
      15,
      12
    ],
    "width": 4,
    "mode": "modal",
    "context": "Grouped-statistics case 1"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "histogram",
    "counts": [
      7,
      15,
      8,
      3,
      17
    ],
    "width": 5,
    "mode": "total",
    "context": "Grouped-statistics case 2"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "histogram",
    "counts": [
      12,
      3,
      13,
      8,
      5
    ],
    "width": 6,
    "mode": "total",
    "context": "Grouped-statistics case 3"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "histogram",
    "counts": [
      17,
      8,
      18,
      13,
      10
    ],
    "width": 4,
    "mode": "modal",
    "context": "Grouped-statistics case 4"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "histogram",
    "counts": [
      5,
      13,
      6,
      18,
      15
    ],
    "width": 5,
    "mode": "total",
    "context": "Grouped-statistics case 5"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "histogram",
    "counts": [
      10,
      18,
      11,
      6,
      3
    ],
    "width": 6,
    "mode": "total",
    "context": "Grouped-statistics case 6"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "histogram",
    "counts": [
      15,
      6,
      16,
      11,
      8
    ],
    "width": 4,
    "mode": "modal",
    "context": "Grouped-statistics case 7"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "histogram",
    "counts": [
      3,
      11,
      4,
      16,
      13
    ],
    "width": 5,
    "mode": "total",
    "context": "Grouped-statistics case 8"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "histogram",
    "counts": [
      8,
      16,
      9,
      4,
      18
    ],
    "width": 6,
    "mode": "total",
    "context": "Grouped-statistics case 9"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "histogram",
    "counts": [
      13,
      4,
      14,
      9,
      6
    ],
    "width": 4,
    "mode": "modal",
    "context": "Grouped-statistics case 10"
  }
];
const output={};for(const {chapterId,kind,...p} of specs)(output[chapterId]||={examples:[]}).examples.push(makeInquiryVisual(kind,p));
export default output;
