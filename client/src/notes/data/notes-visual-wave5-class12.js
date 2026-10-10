// Grade 12 extended original visual maths studies: matrix layouts, probability, three-dimensional solids, calculus.
import { makeAdvancedVisual } from '../visualAdvancedFactory.js';
const specs=[
  {
    "chapterId": "c12-matrices",
    "kind": "matrix",
    "entries": [
      2,
      3,
      1,
      4
    ],
    "mode": "det",
    "context": "Matrix method A"
  },
  {
    "chapterId": "c12-matrices",
    "kind": "matrix",
    "entries": [
      5,
      -1,
      2,
      6
    ],
    "mode": "trace",
    "context": "Matrix diagonal B"
  },
  {
    "chapterId": "c12-matrices",
    "kind": "matrix",
    "entries": [
      4,
      0,
      -2,
      7
    ],
    "mode": "rowSum",
    "context": "Top-row sum C"
  },
  {
    "chapterId": "c12-matrices",
    "kind": "matrix",
    "entries": [
      1,
      5,
      3,
      2
    ],
    "mode": "det",
    "context": "Matrix method D"
  },
  {
    "chapterId": "c12-matrices",
    "kind": "matrix",
    "entries": [
      7,
      3,
      0,
      4
    ],
    "mode": "trace",
    "context": "Diagonal extraction E"
  },
  {
    "chapterId": "c12-matrices",
    "kind": "matrix",
    "entries": [
      -2,
      6,
      8,
      1
    ],
    "mode": "rowSum",
    "context": "Signed row addition F"
  },
  {
    "chapterId": "c12-matrices",
    "kind": "matrix",
    "entries": [
      3,
      4,
      -1,
      5
    ],
    "mode": "det",
    "context": "Determinant review G"
  },
  {
    "chapterId": "c12-matrices",
    "kind": "matrix",
    "entries": [
      2,
      -5,
      7,
      6
    ],
    "mode": "trace",
    "context": "Matrix invariants H"
  },
  {
    "chapterId": "c12-matrices",
    "kind": "matrix",
    "entries": [
      8,
      4,
      3,
      1
    ],
    "mode": "rowSum",
    "context": "Matrix component sum I"
  },
  {
    "chapterId": "c12-matrices",
    "kind": "matrix",
    "entries": [
      6,
      2,
      3,
      8
    ],
    "mode": "det",
    "context": "Two by two operation J"
  },
  {
    "chapterId": "c12-matrices",
    "kind": "matrix",
    "entries": [
      9,
      -3,
      2,
      -4
    ],
    "mode": "trace",
    "context": "Negative diagonal K"
  },
  {
    "chapterId": "c12-matrices",
    "kind": "matrix",
    "entries": [
      4,
      7,
      6,
      2
    ],
    "mode": "rowSum",
    "context": "Row vector extraction L"
  },
  {
    "chapterId": "c12-determinants",
    "kind": "matrix",
    "entries": [
      4,
      7,
      2,
      3
    ],
    "mode": "det",
    "context": "Determinant X"
  },
  {
    "chapterId": "c12-determinants",
    "kind": "matrix",
    "entries": [
      1,
      3,
      5,
      -2
    ],
    "mode": "det",
    "context": "Cofactor sign Y"
  },
  {
    "chapterId": "c12-determinants",
    "kind": "matrix",
    "entries": [
      -3,
      2,
      4,
      6
    ],
    "mode": "det",
    "context": "Signed matrix Z"
  },
  {
    "chapterId": "c12-determinants",
    "kind": "matrix",
    "entries": [
      7,
      -1,
      2,
      5
    ],
    "mode": "det",
    "context": "Area scaling A"
  },
  {
    "chapterId": "c12-determinants",
    "kind": "matrix",
    "entries": [
      8,
      3,
      1,
      9
    ],
    "mode": "det",
    "context": "Determinant product B"
  },
  {
    "chapterId": "c12-determinants",
    "kind": "matrix",
    "entries": [
      6,
      4,
      5,
      3
    ],
    "mode": "det",
    "context": "Zero determinant C"
  },
  {
    "chapterId": "c12-determinants",
    "kind": "matrix",
    "entries": [
      -2,
      9,
      3,
      -1
    ],
    "mode": "det",
    "context": "Linear transformation D"
  },
  {
    "chapterId": "c12-determinants",
    "kind": "matrix",
    "entries": [
      5,
      0,
      -4,
      7
    ],
    "mode": "det",
    "context": "Triangular matrix E"
  },
  {
    "chapterId": "c12-determinants",
    "kind": "matrix",
    "entries": [
      2,
      -5,
      -3,
      4
    ],
    "mode": "det",
    "context": "Signed determinant F"
  },
  {
    "chapterId": "c12-probability",
    "kind": "tree",
    "a": 1,
    "ad": 2,
    "sa": 2,
    "sad": 3,
    "sb": 1,
    "sbd": 5,
    "mode": "total",
    "context": "Two-stage experiment A"
  },
  {
    "chapterId": "c12-probability",
    "kind": "tree",
    "a": 3,
    "ad": 8,
    "sa": 1,
    "sad": 3,
    "sb": 2,
    "sbd": 5,
    "mode": "joint",
    "context": "Probability of conjunction B"
  },
  {
    "chapterId": "c12-probability",
    "kind": "tree",
    "a": 2,
    "ad": 5,
    "sa": 3,
    "sad": 4,
    "sb": 1,
    "sbd": 6,
    "mode": "total",
    "context": "Mixed conditional distributions C"
  },
  {
    "chapterId": "c12-probability",
    "kind": "tree",
    "a": 4,
    "ad": 7,
    "sa": 2,
    "sad": 5,
    "sb": 3,
    "sbd": 8,
    "mode": "joint",
    "context": "Branch probability D"
  },
  {
    "chapterId": "c12-probability",
    "kind": "tree",
    "a": 5,
    "ad": 9,
    "sa": 4,
    "sad": 7,
    "sb": 2,
    "sbd": 3,
    "mode": "total",
    "context": "Bayes setup E"
  },
  {
    "chapterId": "c12-probability",
    "kind": "tree",
    "a": 2,
    "ad": 3,
    "sa": 3,
    "sad": 5,
    "sb": 1,
    "sbd": 4,
    "mode": "joint",
    "context": "Conditional joint F"
  },
  {
    "chapterId": "c12-probability",
    "kind": "tree",
    "a": 1,
    "ad": 4,
    "sa": 2,
    "sad": 7,
    "sb": 3,
    "sbd": 5,
    "mode": "total",
    "context": "Rare-category draw G"
  },
  {
    "chapterId": "c12-probability",
    "kind": "tree",
    "a": 3,
    "ad": 10,
    "sa": 4,
    "sad": 9,
    "sb": 5,
    "sbd": 8,
    "mode": "joint",
    "context": "Unequal priors H"
  },
  {
    "chapterId": "c12-probability",
    "kind": "tree",
    "a": 5,
    "ad": 8,
    "sa": 3,
    "sad": 4,
    "sb": 1,
    "sbd": 2,
    "mode": "total",
    "context": "Probabilistic forecast I"
  },
  {
    "chapterId": "c12-probability",
    "kind": "tree",
    "a": 2,
    "ad": 7,
    "sa": 1,
    "sad": 5,
    "sb": 3,
    "sbd": 8,
    "mode": "joint",
    "context": "A path of two events J"
  },
  {
    "chapterId": "c12-3d-geometry",
    "kind": "cuboid",
    "l": 3,
    "w": 4,
    "h": 12,
    "mode": "diagonal",
    "context": "Space diagonal A"
  },
  {
    "chapterId": "c12-3d-geometry",
    "kind": "cuboid",
    "l": 2,
    "w": 3,
    "h": 6,
    "mode": "diagonal",
    "context": "Spatial Pythagoras B"
  },
  {
    "chapterId": "c12-3d-geometry",
    "kind": "cuboid",
    "l": 8,
    "w": 9,
    "h": 12,
    "mode": "diagonal",
    "context": "Right-angled box C"
  },
  {
    "chapterId": "c12-3d-geometry",
    "kind": "cuboid",
    "l": 1,
    "w": 2,
    "h": 2,
    "mode": "diagonal",
    "context": "Small 3D box D"
  },
  {
    "chapterId": "c12-3d-geometry",
    "kind": "cuboid",
    "l": 9,
    "w": 12,
    "h": 20,
    "mode": "diagonal",
    "context": "Long diagonal E"
  },
  {
    "chapterId": "c12-3d-geometry",
    "kind": "cuboid",
    "l": 8,
    "w": 6,
    "h": 7,
    "mode": "volume",
    "context": "Solid volume F"
  },
  {
    "chapterId": "c12-3d-geometry",
    "kind": "cuboid",
    "l": 5,
    "w": 7,
    "h": 9,
    "mode": "surface",
    "context": "3D face areas G"
  },
  {
    "chapterId": "c12-3d-geometry",
    "kind": "cuboid",
    "l": 11,
    "w": 4,
    "h": 6,
    "mode": "volume",
    "context": "Spatial measurements H"
  },
  {
    "chapterId": "c12-3d-geometry",
    "kind": "cuboid",
    "l": 9,
    "w": 8,
    "h": 5,
    "mode": "surface",
    "context": "Packaging I"
  },
  {
    "chapterId": "c12-3d-geometry",
    "kind": "cuboid",
    "l": 6,
    "w": 7,
    "h": 12,
    "mode": "volume",
    "context": "3D region J"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "betweenLines",
    "m1": 5,
    "m2": 1,
    "end": 4,
    "context": "Signed area between two graphs A"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "betweenLines",
    "m1": 4,
    "m2": 2,
    "end": 6,
    "context": "Integrating the graph difference B"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "betweenLines",
    "m1": 7,
    "m2": 3,
    "end": 2,
    "context": "Shaded linear strip C"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "betweenLines",
    "m1": 6,
    "m2": 0,
    "end": 5,
    "context": "Region under two lines D"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "betweenLines",
    "m1": 3,
    "m2": 1,
    "end": 8,
    "context": "Calculus region E"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "betweenLines",
    "m1": 8,
    "m2": 2,
    "end": 3,
    "context": "Definite integral geometry F"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "betweenLines",
    "m1": 9,
    "m2": 4,
    "end": 4,
    "context": "Geometric evaluation G"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "betweenLines",
    "m1": 4,
    "m2": 1,
    "end": 7,
    "context": "Between-lines area H"
  },
  {
    "chapterId": "c12-integrals",
    "kind": "betweenLines",
    "m1": 2,
    "m2": 0,
    "end": 4,
    "context": "Direct integration with geometry A"
  },
  {
    "chapterId": "c12-integrals",
    "kind": "betweenLines",
    "m1": 3,
    "m2": 1,
    "end": 6,
    "context": "Triangle under a line B"
  },
  {
    "chapterId": "c12-integrals",
    "kind": "betweenLines",
    "m1": 5,
    "m2": 2,
    "end": 4,
    "context": "Fundamental-theorem visualization C"
  },
  {
    "chapterId": "c12-integrals",
    "kind": "betweenLines",
    "m1": 7,
    "m2": 1,
    "end": 2,
    "context": "Riemann accumulation D"
  },
  {
    "chapterId": "c12-integrals",
    "kind": "betweenLines",
    "m1": 4,
    "m2": 2,
    "end": 8,
    "context": "Areas from integrals E"
  },
  {
    "chapterId": "c12-inverse-trigonometric",
    "kind": "unitcircle",
    "deg": 30,
    "component": "cos",
    "context": "Unit-circle prerequisite A"
  },
  {
    "chapterId": "c12-inverse-trigonometric",
    "kind": "unitcircle",
    "deg": 45,
    "component": "sin",
    "context": "Exact inverse-trig domain groundwork B"
  },
  {
    "chapterId": "c12-inverse-trigonometric",
    "kind": "unitcircle",
    "deg": 60,
    "component": "cos",
    "context": "Reference angle mapping C"
  },
  {
    "chapterId": "c12-inverse-trigonometric",
    "kind": "unitcircle",
    "deg": 120,
    "component": "sin",
    "context": "Principal branch discussion D"
  },
  {
    "chapterId": "c12-inverse-trigonometric",
    "kind": "unitcircle",
    "deg": 135,
    "component": "cos",
    "context": "Trigonometry inversion E"
  },
  {
    "chapterId": "c12-inverse-trigonometric",
    "kind": "unitcircle",
    "deg": 150,
    "component": "sin",
    "context": "Angle-sign diagram F"
  },
  {
    "chapterId": "c12-continuity-differentiability",
    "kind": "linesIntersection",
    "m1": 1,
    "m2": 3,
    "x": 2,
    "y": 1,
    "context": "Function continuity crossing A"
  },
  {
    "chapterId": "c12-continuity-differentiability",
    "kind": "linesIntersection",
    "m1": 2,
    "m2": -1,
    "x": 1,
    "y": 4,
    "context": "Intersection of continuous lines B"
  },
  {
    "chapterId": "c12-continuity-differentiability",
    "kind": "linesIntersection",
    "m1": 3,
    "m2": 1,
    "x": -2,
    "y": 2,
    "context": "Crossing affine functions C"
  },
  {
    "chapterId": "c12-continuity-differentiability",
    "kind": "linesIntersection",
    "m1": -1,
    "m2": 2,
    "x": 3,
    "y": -1,
    "context": "Matching function outputs D"
  },
  {
    "chapterId": "c12-continuity-differentiability",
    "kind": "linesIntersection",
    "m1": 4,
    "m2": -2,
    "x": 0,
    "y": 5,
    "context": "Equality of differentiable functions E"
  }
];
const output={};for(const {chapterId,kind,...p} of specs)(output[chapterId]||={examples:[]}).examples.push(makeAdvancedVisual(kind,p));
export default output;
