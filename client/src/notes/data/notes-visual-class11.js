// Class 11 original plotted line, quadratic and vector reasoning exercises.
import { makeVisualExample } from '../visualQuestionFactory.js';
const specs = [
  {
    "chapterId": "c11-straight-lines",
    "kind": "gradient",
    "A": [
      -5,
      -4
    ],
    "B": [
      1,
      8
    ],
    "context": "Slope of a rising line"
  },
  {
    "chapterId": "c11-straight-lines",
    "kind": "gradient",
    "A": [
      -7,
      6
    ],
    "B": [
      5,
      -3
    ],
    "context": "Slope of a descending line"
  },
  {
    "chapterId": "c11-straight-lines",
    "kind": "gradient",
    "A": [
      0,
      5
    ],
    "B": [
      5,
      0
    ],
    "context": "Equal intercept geometry"
  },
  {
    "chapterId": "c11-straight-lines",
    "kind": "gradient",
    "A": [
      -6,
      2
    ],
    "B": [
      6,
      8
    ],
    "context": "Shallow ascent"
  },
  {
    "chapterId": "c11-straight-lines",
    "kind": "lineIntercept",
    "m": 2,
    "b": -1,
    "context": "Straight-line translation"
  },
  {
    "chapterId": "c11-straight-lines",
    "kind": "lineIntercept",
    "m": -2,
    "b": 5,
    "context": "Line crossing the y-axis"
  },
  {
    "chapterId": "c11-straight-lines",
    "kind": "lineIntercept",
    "m": 1,
    "b": -4,
    "context": "First-degree function"
  },
  {
    "chapterId": "c11-straight-lines",
    "kind": "distance",
    "A": [
      -2,
      5
    ],
    "B": [
      4,
      -3
    ],
    "context": "Line segment magnitude"
  },
  {
    "chapterId": "c11-conic-sections",
    "kind": "parabolaVertex",
    "a": 1,
    "h": 2,
    "k": -2,
    "context": "Shifted parabola"
  },
  {
    "chapterId": "c11-conic-sections",
    "kind": "parabolaVertex",
    "a": -1,
    "h": -3,
    "k": 4,
    "context": "Downward conic"
  },
  {
    "chapterId": "c11-conic-sections",
    "kind": "parabolaVertex",
    "a": 2,
    "h": 1,
    "k": 0,
    "context": "Narrow upward curve"
  },
  {
    "chapterId": "c11-conic-sections",
    "kind": "parabolaVertex",
    "a": -2,
    "h": 2,
    "k": 6,
    "context": "Maximum height model"
  },
  {
    "chapterId": "c11-conic-sections",
    "kind": "circleChord",
    "r": 25,
    "d": 15,
    "context": "Circle as a geometric conic"
  },
  {
    "chapterId": "c11-3d-introduction",
    "kind": "vectors",
    "u": [
      3,
      4
    ],
    "v": [
      -2,
      5
    ],
    "context": "Vector projection groundwork"
  },
  {
    "chapterId": "c11-3d-introduction",
    "kind": "vectors",
    "u": [
      -4,
      1
    ],
    "v": [
      2,
      6
    ],
    "context": "Vectors from origin"
  },
  {
    "chapterId": "c11-3d-introduction",
    "kind": "vectors",
    "u": [
      5,
      -2
    ],
    "v": [
      3,
      4
    ],
    "context": "Orthogonality check"
  },
  {
    "chapterId": "c11-relations-functions",
    "kind": "lineIntercept",
    "m": 3,
    "b": 2,
    "context": "Function intercept"
  },
  {
    "chapterId": "c11-relations-functions",
    "kind": "lineIntercept",
    "m": -1,
    "b": -3,
    "context": "Linear function output"
  },
  {
    "chapterId": "c11-statistics",
    "kind": "barMean",
    "labels": [
      "T1",
      "T2",
      "T3",
      "T4",
      "T5"
    ],
    "values": [
      7,
      9,
      10,
      11,
      13
    ],
    "context": "Repeated measurements"
  },
  {
    "chapterId": "c11-statistics",
    "kind": "barDifference",
    "labels": [
      "East",
      "West",
      "North"
    ],
    "values": [
      35,
      22,
      28
    ],
    "context": "Experimental samples"
  },
  {
    "chapterId": "c11-statistics",
    "kind": "barSum",
    "labels": [
      "L",
      "M",
      "H"
    ],
    "values": [
      16,
      24,
      8
    ],
    "context": "Frequency classification"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "parabolaVertex",
    "a": 1,
    "h": -2,
    "k": -3,
    "context": "A derivative turning point"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "parabolaVertex",
    "a": -1,
    "h": 0,
    "k": 5,
    "context": "Stationary maximum"
  },
  {
    "chapterId": "c11-probability",
    "kind": "barProb",
    "labels": [
      "1",
      "2",
      "3",
      "4"
    ],
    "values": [
      2,
      5,
      3,
      10
    ],
    "favourable": "4",
    "context": "Experimental discrete distribution"
  },
  {
    "chapterId": "c11-sequences-series",
    "kind": "barDifference",
    "labels": [
      "n=1",
      "n=2",
      "n=3",
      "n=4"
    ],
    "values": [
      4,
      8,
      16,
      32
    ],
    "context": "A recorded geometric growth pattern"
  }
];
const data={};for(const {chapterId,kind,...p} of specs)(data[chapterId]||={examples:[]}).examples.push(makeVisualExample(kind,p));
export default data;
