// Grade 8 supplementary figure-first original worked problem collection.
import { makeAdvancedVisual } from '../visualAdvancedFactory.js';
const specs=[
  {
    "chapterId": "c8-comparing-quantities",
    "kind": "tape",
    "a": 4,
    "b": 1,
    "total": 75,
    "mode": "first",
    "context": "Discount split"
  },
  {
    "chapterId": "c8-comparing-quantities",
    "kind": "tape",
    "a": 3,
    "b": 2,
    "total": 90,
    "mode": "second",
    "context": "Retail profit proportions"
  },
  {
    "chapterId": "c8-comparing-quantities",
    "kind": "tape",
    "a": 7,
    "b": 3,
    "total": 100,
    "mode": "difference",
    "context": "Classroom spending"
  },
  {
    "chapterId": "c8-comparing-quantities",
    "kind": "tape",
    "a": 2,
    "b": 3,
    "total": 60,
    "mode": "first",
    "context": "Sales categories"
  },
  {
    "chapterId": "c8-comparing-quantities",
    "kind": "tape",
    "a": 5,
    "b": 4,
    "total": 81,
    "mode": "second",
    "context": "Two product totals"
  },
  {
    "chapterId": "c8-comparing-quantities",
    "kind": "tape",
    "a": 8,
    "b": 2,
    "total": 100,
    "mode": "first",
    "context": "Percentage model"
  },
  {
    "chapterId": "c8-proportions",
    "kind": "tape",
    "a": 3,
    "b": 5,
    "total": 64,
    "mode": "first",
    "context": "Water delivery"
  },
  {
    "chapterId": "c8-proportions",
    "kind": "tape",
    "a": 4,
    "b": 7,
    "total": 121,
    "mode": "second",
    "context": "Recipe ratios"
  },
  {
    "chapterId": "c8-proportions",
    "kind": "tape",
    "a": 6,
    "b": 5,
    "total": 132,
    "mode": "difference",
    "context": "Runner distances"
  },
  {
    "chapterId": "c8-proportions",
    "kind": "tape",
    "a": 1,
    "b": 4,
    "total": 80,
    "mode": "first",
    "context": "Scale drawing"
  },
  {
    "chapterId": "c8-proportions",
    "kind": "tape",
    "a": 7,
    "b": 6,
    "total": 169,
    "mode": "second",
    "context": "Community volunteers"
  },
  {
    "chapterId": "c8-linear-equations",
    "kind": "tape",
    "a": 3,
    "b": 4,
    "total": 70,
    "mode": "first",
    "context": "Algebraic share model"
  },
  {
    "chapterId": "c8-linear-equations",
    "kind": "tape",
    "a": 8,
    "b": 3,
    "total": 121,
    "mode": "second",
    "context": "Solving partition puzzle"
  },
  {
    "chapterId": "c8-linear-equations",
    "kind": "tape",
    "a": 5,
    "b": 2,
    "total": 98,
    "mode": "difference",
    "context": "Unknown amount partition"
  },
  {
    "chapterId": "c8-data-handling",
    "kind": "venn",
    "a": 15,
    "b": 12,
    "ab": 6,
    "out": 3,
    "mode": "union",
    "context": "Library and sports"
  },
  {
    "chapterId": "c8-data-handling",
    "kind": "venn",
    "a": 11,
    "b": 17,
    "ab": 4,
    "out": 2,
    "mode": "overlap",
    "context": "Voluntary clubs"
  },
  {
    "chapterId": "c8-data-handling",
    "kind": "venn",
    "a": 8,
    "b": 9,
    "ab": 3,
    "out": 4,
    "mode": "aTotal",
    "context": "Two preference polls"
  },
  {
    "chapterId": "c8-data-handling",
    "kind": "venn",
    "a": 22,
    "b": 13,
    "ab": 8,
    "out": 6,
    "mode": "neither",
    "context": "School electives"
  },
  {
    "chapterId": "c8-data-handling",
    "kind": "venn",
    "a": 12,
    "b": 20,
    "ab": 5,
    "out": 7,
    "mode": "union",
    "context": "Two languages"
  },
  {
    "chapterId": "c8-quadrilaterals",
    "kind": "parallel",
    "angle": 22,
    "mode": "corresponding",
    "context": "Quadrilateral parallel sides A"
  },
  {
    "chapterId": "c8-quadrilaterals",
    "kind": "parallel",
    "angle": 48,
    "mode": "supplementary",
    "context": "Adjacent-angle proof"
  },
  {
    "chapterId": "c8-quadrilaterals",
    "kind": "parallel",
    "angle": 67,
    "mode": "corresponding",
    "context": "Parallelogram diagonals"
  },
  {
    "chapterId": "c8-quadrilaterals",
    "kind": "parallel",
    "angle": 31,
    "mode": "supplementary",
    "context": "Trapezium interior angles"
  },
  {
    "chapterId": "c8-quadrilaterals",
    "kind": "parallel",
    "angle": 74,
    "mode": "corresponding",
    "context": "Parallel street layout"
  },
  {
    "chapterId": "c8-quadrilaterals",
    "kind": "parallel",
    "angle": 56,
    "mode": "supplementary",
    "context": "Alternate angles context"
  },
  {
    "chapterId": "c8-exponents",
    "kind": "placevalue",
    "digits": [
      4,
      2,
      8,
      1,
      0
    ],
    "index": 0,
    "context": "Scientific notation chart"
  },
  {
    "chapterId": "c8-exponents",
    "kind": "placevalue",
    "digits": [
      9,
      0,
      2,
      1,
      7,
      4
    ],
    "index": 2,
    "context": "Powers of ten"
  },
  {
    "chapterId": "c8-exponents",
    "kind": "placevalue",
    "digits": [
      6,
      7,
      0,
      5,
      1,
      9,
      3
    ],
    "index": 4,
    "context": "Exponential place value"
  },
  {
    "chapterId": "c8-exponents",
    "kind": "placevalue",
    "digits": [
      3,
      5,
      8,
      2,
      7,
      0
    ],
    "index": 3,
    "context": "Number exponent expansion"
  },
  {
    "chapterId": "c8-exponents",
    "kind": "placevalue",
    "digits": [
      2,
      0,
      0,
      6,
      8,
      4,
      5
    ],
    "index": 6,
    "context": "Unit-position arithmetic"
  },
  {
    "chapterId": "c8-rational-numbers",
    "kind": "interval",
    "a": -6,
    "b": 4,
    "lc": true,
    "rc": false,
    "context": "Rational line intervals"
  },
  {
    "chapterId": "c8-rational-numbers",
    "kind": "interval",
    "a": -9,
    "b": -2,
    "lc": false,
    "rc": true,
    "context": "Signed rational bounds"
  },
  {
    "chapterId": "c8-rational-numbers",
    "kind": "interval",
    "a": 0,
    "b": 9,
    "lc": true,
    "rc": true,
    "context": "Whole-number inclusion"
  },
  {
    "chapterId": "c8-rational-numbers",
    "kind": "interval",
    "a": -7,
    "b": 5,
    "lc": false,
    "rc": false,
    "context": "Open rational limits"
  },
  {
    "chapterId": "c8-rational-numbers",
    "kind": "interval",
    "a": 3,
    "b": 15,
    "lc": true,
    "rc": false,
    "context": "Upper-bound inequalities"
  },
  {
    "chapterId": "c8-rational-numbers",
    "kind": "interval",
    "a": -12,
    "b": -1,
    "lc": true,
    "rc": true,
    "context": "Negative rational range"
  },
  {
    "chapterId": "c8-rational-numbers",
    "kind": "interval",
    "a": -4,
    "b": 8,
    "lc": false,
    "rc": true,
    "context": "Interval endpoints"
  },
  {
    "chapterId": "c8-mensuration",
    "kind": "cuboid",
    "l": 3,
    "w": 4,
    "h": 5,
    "mode": "volume",
    "context": "Container A"
  },
  {
    "chapterId": "c8-mensuration",
    "kind": "cuboid",
    "l": 5,
    "w": 6,
    "h": 7,
    "mode": "surface",
    "context": "Rectangular box B"
  },
  {
    "chapterId": "c8-mensuration",
    "kind": "cuboid",
    "l": 6,
    "w": 8,
    "h": 9,
    "mode": "volume",
    "context": "Storage C"
  },
  {
    "chapterId": "c8-mensuration",
    "kind": "cuboid",
    "l": 4,
    "w": 7,
    "h": 10,
    "mode": "surface",
    "context": "Package D"
  },
  {
    "chapterId": "c8-mensuration",
    "kind": "cuboid",
    "l": 8,
    "w": 5,
    "h": 3,
    "mode": "volume",
    "context": "Tank E"
  },
  {
    "chapterId": "c8-mensuration",
    "kind": "cuboid",
    "l": 10,
    "w": 4,
    "h": 6,
    "mode": "surface",
    "context": "Shipping parcel F"
  },
  {
    "chapterId": "c8-mensuration",
    "kind": "cuboid",
    "l": 7,
    "w": 9,
    "h": 2,
    "mode": "volume",
    "context": "Construction block G"
  },
  {
    "chapterId": "c8-mensuration",
    "kind": "cuboid",
    "l": 9,
    "w": 5,
    "h": 4,
    "mode": "surface",
    "context": "Mathematical model H"
  }
];
const result={};for(const {chapterId,kind,...p} of specs)(result[chapterId]||={examples:[]}).examples.push(makeAdvancedVisual(kind,p));
export default result;
