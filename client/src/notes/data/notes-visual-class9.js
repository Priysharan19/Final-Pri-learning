// Original plotted NCERT Grade 9 mathematical reading and deduction tasks.
import { makeVisualExample } from '../visualQuestionFactory.js';
const specs = [
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -8,
      2
    ],
    "B": [
      6,
      -4
    ],
    "context": "Survey coordinates"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -3,
      -5
    ],
    "B": [
      7,
      9
    ],
    "context": "Two landmarks"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      1,
      7
    ],
    "B": [
      9,
      -3
    ],
    "context": "Park trail"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "gradient",
    "A": [
      -4,
      -3
    ],
    "B": [
      2,
      9
    ],
    "context": "A rising road"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "gradient",
    "A": [
      -6,
      8
    ],
    "B": [
      2,
      -4
    ],
    "context": "A descending trail"
  },
  {
    "chapterId": "c9-linear-polynomials",
    "kind": "gradient",
    "A": [
      -2,
      7
    ],
    "B": [
      4,
      -5
    ],
    "context": "A plotted linear polynomial"
  },
  {
    "chapterId": "c9-linear-polynomials",
    "kind": "lineIntercept",
    "m": 2,
    "b": 3,
    "context": "Graph of a growing quantity"
  },
  {
    "chapterId": "c9-linear-polynomials",
    "kind": "lineIntercept",
    "m": -1,
    "b": 4,
    "context": "Declining balance"
  },
  {
    "chapterId": "c9-linear-polynomials",
    "kind": "lineIntercept",
    "m": 3,
    "b": -2,
    "context": "A transformed line"
  },
  {
    "chapterId": "c9-perimeter-area",
    "kind": "triangleArea",
    "A": [
      -2,
      1
    ],
    "B": [
      6,
      1
    ],
    "C": [
      1,
      7
    ],
    "context": "Triangular courtyard"
  },
  {
    "chapterId": "c9-perimeter-area",
    "kind": "triangleArea",
    "A": [
      0,
      0
    ],
    "B": [
      8,
      2
    ],
    "C": [
      3,
      7
    ],
    "context": "Surveyed field"
  },
  {
    "chapterId": "c9-perimeter-area",
    "kind": "rightTriangle",
    "u": 5,
    "v": 12,
    "context": "Roof section"
  },
  {
    "chapterId": "c9-perimeter-area",
    "kind": "rightTriangle",
    "u": 8,
    "v": 15,
    "context": "Staircase profile"
  },
  {
    "chapterId": "c9-circles",
    "kind": "circleChord",
    "r": 5,
    "d": 3,
    "context": "Wheel chord"
  },
  {
    "chapterId": "c9-circles",
    "kind": "circleChord",
    "r": 10,
    "d": 6,
    "context": "Circular window"
  },
  {
    "chapterId": "c9-circles",
    "kind": "circleChord",
    "r": 13,
    "d": 5,
    "context": "Round stage"
  },
  {
    "chapterId": "c9-probability",
    "kind": "barProb",
    "labels": [
      "Red",
      "Green",
      "Blue"
    ],
    "values": [
      9,
      4,
      7
    ],
    "favourable": "Blue",
    "context": "Random colour selection"
  },
  {
    "chapterId": "c9-probability",
    "kind": "barProb",
    "labels": [
      "A",
      "B",
      "C",
      "D"
    ],
    "values": [
      8,
      12,
      10,
      6
    ],
    "favourable": "D",
    "context": "Spinner outcomes"
  },
  {
    "chapterId": "c9-sequences-progressions",
    "kind": "barDifference",
    "labels": [
      "Day1",
      "Day2",
      "Day3",
      "Day4",
      "Day5"
    ],
    "values": [
      3,
      5,
      8,
      13,
      21
    ],
    "context": "Recorded sequence"
  },
  {
    "chapterId": "c9-sequences-progressions",
    "kind": "barSum",
    "labels": [
      "I",
      "II",
      "III"
    ],
    "values": [
      9,
      18,
      27
    ],
    "context": "Arranged tiles"
  },
  {
    "chapterId": "c9-algebraic-identities",
    "kind": "parabolaVertex",
    "a": 1,
    "h": 2,
    "k": -3,
    "context": "Square-completion visual"
  },
  {
    "chapterId": "c9-algebraic-identities",
    "kind": "parabolaVertex",
    "a": 1,
    "h": -1,
    "k": 2,
    "context": "Shifted square graph"
  }
];
const data={};for(const {chapterId,kind,...p} of specs)(data[chapterId]||={examples:[]}).examples.push(makeVisualExample(kind,p));
export default data;
