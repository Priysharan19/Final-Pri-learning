// Grade 11 original visual studies: analytic graphs, sets, unit circle and probability trees.
import { makeAdvancedVisual } from '../visualAdvancedFactory.js';
const specs=[
  {
    "chapterId": "c11-sets",
    "kind": "venn",
    "a": 12,
    "b": 18,
    "ab": 5,
    "out": 3,
    "mode": "union",
    "context": "Union cardinality A"
  },
  {
    "chapterId": "c11-sets",
    "kind": "venn",
    "a": 7,
    "b": 14,
    "ab": 6,
    "out": 2,
    "mode": "overlap",
    "context": "Set intersection B"
  },
  {
    "chapterId": "c11-sets",
    "kind": "venn",
    "a": 9,
    "b": 13,
    "ab": 4,
    "out": 7,
    "mode": "aTotal",
    "context": "Set complement C"
  },
  {
    "chapterId": "c11-sets",
    "kind": "venn",
    "a": 16,
    "b": 8,
    "ab": 3,
    "out": 5,
    "mode": "neither",
    "context": "Universe elements D"
  },
  {
    "chapterId": "c11-sets",
    "kind": "venn",
    "a": 21,
    "b": 17,
    "ab": 9,
    "out": 4,
    "mode": "union",
    "context": "Disjoint region accounting E"
  },
  {
    "chapterId": "c11-sets",
    "kind": "venn",
    "a": 8,
    "b": 11,
    "ab": 3,
    "out": 6,
    "mode": "overlap",
    "context": "Two societies F"
  },
  {
    "chapterId": "c11-sets",
    "kind": "venn",
    "a": 19,
    "b": 14,
    "ab": 8,
    "out": 1,
    "mode": "aTotal",
    "context": "Set algebra G"
  },
  {
    "chapterId": "c11-sets",
    "kind": "venn",
    "a": 14,
    "b": 12,
    "ab": 5,
    "out": 3,
    "mode": "neither",
    "context": "Venn universe H"
  },
  {
    "chapterId": "c11-trig-functions",
    "kind": "unitcircle",
    "deg": 0,
    "component": "cos",
    "context": "Reference-unit-circle point 1"
  },
  {
    "chapterId": "c11-trig-functions",
    "kind": "unitcircle",
    "deg": 30,
    "component": "sin",
    "context": "Reference-unit-circle point 2"
  },
  {
    "chapterId": "c11-complex-numbers",
    "kind": "unitcircle",
    "deg": 45,
    "component": "cos",
    "context": "Optional Argand rotation 3"
  },
  {
    "chapterId": "c11-trig-functions",
    "kind": "unitcircle",
    "deg": 60,
    "component": "sin",
    "context": "Reference-unit-circle point 4"
  },
  {
    "chapterId": "c11-trig-functions",
    "kind": "unitcircle",
    "deg": 90,
    "component": "cos",
    "context": "Reference-unit-circle point 5"
  },
  {
    "chapterId": "c11-trig-functions",
    "kind": "unitcircle",
    "deg": 120,
    "component": "sin",
    "context": "Reference-unit-circle point 6"
  },
  {
    "chapterId": "c11-complex-numbers",
    "kind": "unitcircle",
    "deg": 135,
    "component": "cos",
    "context": "Optional Argand rotation 7"
  },
  {
    "chapterId": "c11-trig-functions",
    "kind": "unitcircle",
    "deg": 150,
    "component": "sin",
    "context": "Reference-unit-circle point 8"
  },
  {
    "chapterId": "c11-trig-functions",
    "kind": "unitcircle",
    "deg": 180,
    "component": "cos",
    "context": "Reference-unit-circle point 9"
  },
  {
    "chapterId": "c11-trig-functions",
    "kind": "unitcircle",
    "deg": 210,
    "component": "sin",
    "context": "Reference-unit-circle point 10"
  },
  {
    "chapterId": "c11-complex-numbers",
    "kind": "unitcircle",
    "deg": 225,
    "component": "cos",
    "context": "Optional Argand rotation 11"
  },
  {
    "chapterId": "c11-trig-functions",
    "kind": "unitcircle",
    "deg": 240,
    "component": "sin",
    "context": "Reference-unit-circle point 12"
  },
  {
    "chapterId": "c11-trig-functions",
    "kind": "unitcircle",
    "deg": 270,
    "component": "cos",
    "context": "Reference-unit-circle point 13"
  },
  {
    "chapterId": "c11-trig-functions",
    "kind": "unitcircle",
    "deg": 300,
    "component": "sin",
    "context": "Reference-unit-circle point 14"
  },
  {
    "chapterId": "c11-complex-numbers",
    "kind": "unitcircle",
    "deg": 315,
    "component": "cos",
    "context": "Optional Argand rotation 15"
  },
  {
    "chapterId": "c11-trig-functions",
    "kind": "unitcircle",
    "deg": 330,
    "component": "sin",
    "context": "Reference-unit-circle point 16"
  },
  {
    "chapterId": "c11-linear-inequalities",
    "kind": "interval",
    "a": -6,
    "b": 7,
    "lc": true,
    "rc": false,
    "context": "One-variable interval A"
  },
  {
    "chapterId": "c11-linear-inequalities",
    "kind": "interval",
    "a": -10,
    "b": 2,
    "lc": false,
    "rc": false,
    "context": "Strict compound inequality B"
  },
  {
    "chapterId": "c11-linear-inequalities",
    "kind": "interval",
    "a": -4,
    "b": 12,
    "lc": true,
    "rc": true,
    "context": "Closed bounds C"
  },
  {
    "chapterId": "c11-linear-inequalities",
    "kind": "interval",
    "a": -8,
    "b": 3,
    "lc": false,
    "rc": true,
    "context": "Endpoint reasoning D"
  },
  {
    "chapterId": "c11-linear-inequalities",
    "kind": "interval",
    "a": 1,
    "b": 20,
    "lc": true,
    "rc": false,
    "context": "Linear inequality set E"
  },
  {
    "chapterId": "c11-linear-inequalities",
    "kind": "interval",
    "a": -14,
    "b": -2,
    "lc": false,
    "rc": true,
    "context": "Negative intervals F"
  },
  {
    "chapterId": "c11-linear-inequalities",
    "kind": "interval",
    "a": 2,
    "b": 9,
    "lc": true,
    "rc": true,
    "context": "Compound bound G"
  },
  {
    "chapterId": "c11-linear-inequalities",
    "kind": "interval",
    "a": -9,
    "b": 10,
    "lc": false,
    "rc": false,
    "context": "Open solution interval H"
  },
  {
    "chapterId": "c11-linear-inequalities",
    "kind": "interval",
    "a": 0,
    "b": 15,
    "lc": false,
    "rc": true,
    "context": "Nonzero integer range I"
  },
  {
    "chapterId": "c11-straight-lines",
    "kind": "linesIntersection",
    "m1": 2,
    "m2": 4,
    "x": -3,
    "y": 2,
    "context": "Parallel family comparison"
  },
  {
    "chapterId": "c11-straight-lines",
    "kind": "linesIntersection",
    "m1": 3,
    "m2": -1,
    "x": 0,
    "y": 5,
    "context": "Intersection of oblique lines"
  },
  {
    "chapterId": "c11-straight-lines",
    "kind": "linesIntersection",
    "m1": -2,
    "m2": 4,
    "x": 2,
    "y": -2,
    "context": "Vector graph crossing"
  },
  {
    "chapterId": "c11-straight-lines",
    "kind": "linesIntersection",
    "m1": 1,
    "m2": -3,
    "x": -1,
    "y": 4,
    "context": "Negative slope intersection"
  },
  {
    "chapterId": "c11-straight-lines",
    "kind": "linesIntersection",
    "m1": 5,
    "m2": -2,
    "x": 3,
    "y": -3,
    "context": "Steep lines meeting"
  },
  {
    "chapterId": "c11-straight-lines",
    "kind": "linesIntersection",
    "m1": -1,
    "m2": 2,
    "x": 1,
    "y": -1,
    "context": "Solution of linear graphs"
  },
  {
    "chapterId": "c11-straight-lines",
    "kind": "linesIntersection",
    "m1": 4,
    "m2": 1,
    "x": -2,
    "y": 5,
    "context": "Coordinate intersection"
  },
  {
    "chapterId": "c11-straight-lines",
    "kind": "linesIntersection",
    "m1": -3,
    "m2": 2,
    "x": 2,
    "y": 0,
    "context": "Symmetric line crossing"
  },
  {
    "chapterId": "c11-permutations-combinations",
    "kind": "dots",
    "rows": 5,
    "mode": "total",
    "context": "Committee arrangement dots A"
  },
  {
    "chapterId": "c11-permutations-combinations",
    "kind": "dots",
    "rows": 6,
    "mode": "next",
    "context": "Selection sequence B"
  },
  {
    "chapterId": "c11-permutations-combinations",
    "kind": "dots",
    "rows": 7,
    "mode": "total",
    "context": "Handshakes construction C"
  },
  {
    "chapterId": "c11-binomial-theorem",
    "kind": "dots",
    "rows": 4,
    "mode": "total",
    "context": "Binomial coefficient triangular arrangement A"
  },
  {
    "chapterId": "c11-binomial-theorem",
    "kind": "dots",
    "rows": 8,
    "mode": "next",
    "context": "Pascal-style dots B"
  },
  {
    "chapterId": "c11-sequences-series",
    "kind": "dots",
    "rows": 3,
    "mode": "next",
    "context": "Sequence sigma identity A"
  },
  {
    "chapterId": "c11-sequences-series",
    "kind": "dots",
    "rows": 5,
    "mode": "total",
    "context": "Arithmetic summation B"
  },
  {
    "chapterId": "c11-sequences-series",
    "kind": "dots",
    "rows": 8,
    "mode": "next",
    "context": "Growing array C"
  },
  {
    "chapterId": "c11-sequences-series",
    "kind": "dots",
    "rows": 9,
    "mode": "total",
    "context": "Counting numbers D"
  },
  {
    "chapterId": "c11-3d-introduction",
    "kind": "cuboid",
    "l": 3,
    "w": 4,
    "h": 12,
    "mode": "diagonal",
    "context": "3D vector diagonal A"
  },
  {
    "chapterId": "c11-3d-introduction",
    "kind": "cuboid",
    "l": 2,
    "w": 3,
    "h": 6,
    "mode": "diagonal",
    "context": "Space geometry B"
  },
  {
    "chapterId": "c11-3d-introduction",
    "kind": "cuboid",
    "l": 5,
    "w": 7,
    "h": 9,
    "mode": "volume",
    "context": "3D solids volume C"
  },
  {
    "chapterId": "c11-3d-introduction",
    "kind": "cuboid",
    "l": 6,
    "w": 8,
    "h": 24,
    "mode": "diagonal",
    "context": "Spatial Pythagoras D"
  },
  {
    "chapterId": "c11-probability",
    "kind": "tree",
    "a": 1,
    "ad": 2,
    "sa": 1,
    "sad": 3,
    "sb": 2,
    "sbd": 3,
    "mode": "total",
    "context": "Probability event tree A"
  },
  {
    "chapterId": "c11-probability",
    "kind": "tree",
    "a": 3,
    "ad": 5,
    "sa": 1,
    "sad": 4,
    "sb": 2,
    "sbd": 5,
    "mode": "joint",
    "context": "Two-stage probability B"
  },
  {
    "chapterId": "c11-probability",
    "kind": "tree",
    "a": 2,
    "ad": 7,
    "sa": 3,
    "sad": 4,
    "sb": 1,
    "sbd": 2,
    "mode": "total",
    "context": "Independent path study C"
  },
  {
    "chapterId": "c11-probability",
    "kind": "tree",
    "a": 4,
    "ad": 9,
    "sa": 2,
    "sad": 3,
    "sb": 3,
    "sbd": 7,
    "mode": "joint",
    "context": "Conditional study D"
  },
  {
    "chapterId": "c11-probability",
    "kind": "tree",
    "a": 1,
    "ad": 3,
    "sa": 2,
    "sad": 5,
    "sb": 1,
    "sbd": 4,
    "mode": "total",
    "context": "Two branches E"
  },
  {
    "chapterId": "c11-probability",
    "kind": "tree",
    "a": 2,
    "ad": 5,
    "sa": 3,
    "sad": 8,
    "sb": 5,
    "sbd": 8,
    "mode": "joint",
    "context": "Bayesian groundwork F"
  }
];
const output={};for(const {chapterId,kind,...p} of specs)(output[chapterId]||={examples:[]}).examples.push(makeAdvancedVisual(kind,p));
export default output;
