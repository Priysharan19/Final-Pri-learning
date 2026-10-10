// Wave 7: independently verifiable original vector-diagram practice.
import { makeInquiryVisual } from '../visualInquiryFactory.js';
const specs=[
  {
    "chapterId": "c12-vector-algebra",
    "kind": "vectorArea",
    "u": [
      3,
      1
    ],
    "v": [
      -2,
      4
    ],
    "context": "Determinant geometry 1"
  },
  {
    "chapterId": "c12-vector-algebra",
    "kind": "vectorArea",
    "u": [
      4,
      2
    ],
    "v": [
      -3,
      5
    ],
    "context": "Determinant geometry 2"
  },
  {
    "chapterId": "c12-vector-algebra",
    "kind": "vectorArea",
    "u": [
      5,
      3
    ],
    "v": [
      -2,
      6
    ],
    "context": "Determinant geometry 3"
  },
  {
    "chapterId": "c12-vector-algebra",
    "kind": "vectorArea",
    "u": [
      6,
      1
    ],
    "v": [
      -3,
      7
    ],
    "context": "Determinant geometry 4"
  },
  {
    "chapterId": "c12-vector-algebra",
    "kind": "vectorArea",
    "u": [
      7,
      2
    ],
    "v": [
      -2,
      8
    ],
    "context": "Determinant geometry 5"
  },
  {
    "chapterId": "c12-vector-algebra",
    "kind": "vectorArea",
    "u": [
      8,
      3
    ],
    "v": [
      -3,
      9
    ],
    "context": "Determinant geometry 6"
  },
  {
    "chapterId": "c12-vector-algebra",
    "kind": "vectorArea",
    "u": [
      9,
      1
    ],
    "v": [
      -2,
      10
    ],
    "context": "Determinant geometry 7"
  },
  {
    "chapterId": "c12-vector-algebra",
    "kind": "vectorArea",
    "u": [
      10,
      2
    ],
    "v": [
      -3,
      11
    ],
    "context": "Determinant geometry 8"
  },
  {
    "chapterId": "c12-continuity-differentiability",
    "kind": "piecewise",
    "left": -6,
    "right": 5,
    "mode": "jump",
    "context": "Jump-limit chart 1"
  },
  {
    "chapterId": "c12-continuity-differentiability",
    "kind": "piecewise",
    "left": -5,
    "right": 6,
    "mode": "function",
    "context": "Jump-limit chart 2"
  },
  {
    "chapterId": "c12-continuity-differentiability",
    "kind": "piecewise",
    "left": -4,
    "right": 7,
    "mode": "jump",
    "context": "Jump-limit chart 3"
  },
  {
    "chapterId": "c12-continuity-differentiability",
    "kind": "piecewise",
    "left": -3,
    "right": 8,
    "mode": "function",
    "context": "Jump-limit chart 4"
  },
  {
    "chapterId": "c12-continuity-differentiability",
    "kind": "piecewise",
    "left": -2,
    "right": 9,
    "mode": "jump",
    "context": "Jump-limit chart 5"
  },
  {
    "chapterId": "c12-continuity-differentiability",
    "kind": "piecewise",
    "left": -1,
    "right": 10,
    "mode": "function",
    "context": "Jump-limit chart 6"
  },
  {
    "chapterId": "c12-differential-equations",
    "kind": "exponential",
    "base": 2,
    "power": 1,
    "context": "Exponential growth model 1"
  },
  {
    "chapterId": "c12-differential-equations",
    "kind": "exponential",
    "base": 3,
    "power": 2,
    "context": "Exponential growth model 2"
  },
  {
    "chapterId": "c12-differential-equations",
    "kind": "exponential",
    "base": 4,
    "power": 3,
    "context": "Exponential growth model 3"
  },
  {
    "chapterId": "c12-differential-equations",
    "kind": "exponential",
    "base": 2,
    "power": 1,
    "context": "Exponential growth model 4"
  },
  {
    "chapterId": "c12-differential-equations",
    "kind": "exponential",
    "base": 3,
    "power": 2,
    "context": "Exponential growth model 5"
  },
  {
    "chapterId": "c12-differential-equations",
    "kind": "exponential",
    "base": 4,
    "power": 3,
    "context": "Exponential growth model 6"
  }
];
const data={};for(const {chapterId,kind,...p} of specs)(data[chapterId]||={examples:[]}).examples.push(makeInquiryVisual(kind,p));
export default data;
