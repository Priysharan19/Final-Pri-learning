// Original Grade 9 figure-led coordinate, real-number, probability and series reasoning.
import { makeAdvancedVisual } from '../visualAdvancedFactory.js';
const specs=[
  {
    "chapterId": "c9-number-systems",
    "kind": "interval",
    "a": -10,
    "b": 6,
    "lc": true,
    "rc": false,
    "context": "Finite integer set"
  },
  {
    "chapterId": "c9-number-systems",
    "kind": "interval",
    "a": -3,
    "b": 11,
    "lc": false,
    "rc": false,
    "context": "Two open endpoints"
  },
  {
    "chapterId": "c9-number-systems",
    "kind": "interval",
    "a": 1,
    "b": 14,
    "lc": true,
    "rc": true,
    "context": "Consecutive integers"
  },
  {
    "chapterId": "c9-number-systems",
    "kind": "interval",
    "a": -8,
    "b": -1,
    "lc": false,
    "rc": true,
    "context": "Negative rational axis"
  },
  {
    "chapterId": "c9-number-systems",
    "kind": "interval",
    "a": -5,
    "b": 9,
    "lc": true,
    "rc": false,
    "context": "Lower closed bound"
  },
  {
    "chapterId": "c9-number-systems",
    "kind": "interval",
    "a": 0,
    "b": 16,
    "lc": false,
    "rc": true,
    "context": "Nonnegative integers"
  },
  {
    "chapterId": "c9-number-systems",
    "kind": "interval",
    "a": -12,
    "b": 5,
    "lc": true,
    "rc": true,
    "context": "Rational order on a line"
  },
  {
    "chapterId": "c9-number-systems",
    "kind": "placevalue",
    "digits": [
      7,
      0,
      4,
      1,
      9,
      2
    ],
    "index": 2,
    "context": "Decimal place review"
  },
  {
    "chapterId": "c9-number-systems",
    "kind": "placevalue",
    "digits": [
      9,
      3,
      0,
      2,
      6,
      5
    ],
    "index": 4,
    "context": "Irrational approximations discussion"
  },
  {
    "chapterId": "c9-number-systems",
    "kind": "placevalue",
    "digits": [
      2,
      0,
      1,
      8,
      7,
      4
    ],
    "index": 1,
    "context": "Powers of ten in the real system"
  },
  {
    "chapterId": "c9-number-systems",
    "kind": "placevalue",
    "digits": [
      4,
      8,
      2,
      0,
      1,
      5
    ],
    "index": 3,
    "context": "Number decomposition"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "linesIntersection",
    "m1": 2,
    "m2": -1,
    "x": 1,
    "y": 3,
    "context": "Linear polynomial intersections"
  },
  {
    "chapterId": "c9-linear-polynomials",
    "kind": "linesIntersection",
    "m1": 3,
    "m2": -2,
    "x": -1,
    "y": 4,
    "context": "Two first-degree graphs"
  },
  {
    "chapterId": "c9-linear-polynomials",
    "kind": "linesIntersection",
    "m1": 1,
    "m2": -3,
    "x": 2,
    "y": -2,
    "context": "Function table meeting"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "linesIntersection",
    "m1": -2,
    "m2": 1,
    "x": 3,
    "y": 1,
    "context": "Graph of algebraic values"
  },
  {
    "chapterId": "c9-linear-polynomials",
    "kind": "linesIntersection",
    "m1": 4,
    "m2": -1,
    "x": -1,
    "y": 2,
    "context": "Road intersection"
  },
  {
    "chapterId": "c9-linear-polynomials",
    "kind": "linesIntersection",
    "m1": -1,
    "m2": 2,
    "x": 3,
    "y": -3,
    "context": "Coordinate solutions"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "linesIntersection",
    "m1": 2,
    "m2": 4,
    "x": -2,
    "y": -1,
    "context": "Opposite line gradients"
  },
  {
    "chapterId": "c9-linear-polynomials",
    "kind": "linesIntersection",
    "m1": -3,
    "m2": 1,
    "x": 1,
    "y": 2,
    "context": "Straight-line matching"
  },
  {
    "chapterId": "c9-perimeter-area",
    "kind": "betweenLines",
    "m1": 4,
    "m2": 1,
    "end": 4,
    "context": "Triangular courtyard region"
  },
  {
    "chapterId": "c9-perimeter-area",
    "kind": "betweenLines",
    "m1": 3,
    "m2": 0,
    "end": 6,
    "context": "Polygon between two rays"
  },
  {
    "chapterId": "c9-perimeter-area",
    "kind": "betweenLines",
    "m1": 5,
    "m2": 2,
    "end": 3,
    "context": "Shaded graph area"
  },
  {
    "chapterId": "c9-perimeter-area",
    "kind": "betweenLines",
    "m1": 6,
    "m2": 1,
    "end": 2,
    "context": "Survey lines area"
  },
  {
    "chapterId": "c9-perimeter-area",
    "kind": "betweenLines",
    "m1": 2,
    "m2": 0,
    "end": 8,
    "context": "Triangular fenced garden"
  },
  {
    "chapterId": "c9-perimeter-area",
    "kind": "betweenLines",
    "m1": 7,
    "m2": 3,
    "end": 4,
    "context": "Comparison of two linear profiles"
  },
  {
    "chapterId": "c9-probability",
    "kind": "venn",
    "a": 14,
    "b": 9,
    "ab": 4,
    "out": 3,
    "mode": "union",
    "context": "Outcomes in events A and B"
  },
  {
    "chapterId": "c9-probability",
    "kind": "venn",
    "a": 6,
    "b": 8,
    "ab": 2,
    "out": 5,
    "mode": "overlap",
    "context": "Sports participation"
  },
  {
    "chapterId": "c9-probability",
    "kind": "venn",
    "a": 12,
    "b": 10,
    "ab": 3,
    "out": 2,
    "mode": "aTotal",
    "context": "Results of two surveys"
  },
  {
    "chapterId": "c9-probability",
    "kind": "venn",
    "a": 7,
    "b": 5,
    "ab": 2,
    "out": 4,
    "mode": "neither",
    "context": "Two ticket categories"
  },
  {
    "chapterId": "c9-probability",
    "kind": "venn",
    "a": 18,
    "b": 12,
    "ab": 6,
    "out": 1,
    "mode": "union",
    "context": "School interests"
  },
  {
    "chapterId": "c9-probability",
    "kind": "venn",
    "a": 9,
    "b": 13,
    "ab": 4,
    "out": 6,
    "mode": "overlap",
    "context": "Preference chart"
  },
  {
    "chapterId": "c9-sequences-progressions",
    "kind": "dots",
    "rows": 3,
    "mode": "next",
    "context": "Triangular sequences I"
  },
  {
    "chapterId": "c9-sequences-progressions",
    "kind": "dots",
    "rows": 4,
    "mode": "total",
    "context": "Dot-pattern investigation II"
  },
  {
    "chapterId": "c9-sequences-progressions",
    "kind": "dots",
    "rows": 5,
    "mode": "next",
    "context": "Next-row investigation III"
  },
  {
    "chapterId": "c9-sequences-progressions",
    "kind": "dots",
    "rows": 6,
    "mode": "total",
    "context": "Finite series representation IV"
  },
  {
    "chapterId": "c9-sequences-progressions",
    "kind": "dots",
    "rows": 7,
    "mode": "next",
    "context": "Arranged dots rule V"
  },
  {
    "chapterId": "c9-circles",
    "kind": "parallel",
    "angle": 8,
    "mode": "corresponding",
    "context": "Parallel chord angle extension"
  },
  {
    "chapterId": "c9-circles",
    "kind": "parallel",
    "angle": 48,
    "mode": "supplementary",
    "context": "Secant line deduction"
  }
];
const result={};for(const {chapterId,kind,...p} of specs)(result[chapterId]||={examples:[]}).examples.push(makeAdvancedVisual(kind,p));
export default result;
