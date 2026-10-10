// Class 10 NCERT-aligned worked diagram investigations; 24 original figure scenarios.
import { makeVisualExample } from '../visualQuestionFactory.js';
const specs = [
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "distance",
    "A": [
      -3,
      2
    ],
    "B": [
      3,
      10
    ],
    "context": "Distance between signal towers"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "distance",
    "A": [
      1,
      -4
    ],
    "B": [
      9,
      2
    ],
    "context": "Field surveying"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "distance",
    "A": [
      -6,
      -2
    ],
    "B": [
      -1,
      10
    ],
    "context": "Emergency route"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -8,
      4
    ],
    "B": [
      6,
      -6
    ],
    "context": "Bridge midpoint"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -7,
      -3
    ],
    "B": [
      5,
      9
    ],
    "context": "Railway junction"
  },
  {
    "chapterId": "c10-triangles",
    "kind": "triangleArea",
    "A": [
      -2,
      -1
    ],
    "B": [
      6,
      3
    ],
    "C": [
      1,
      8
    ],
    "context": "Triangle with oblique base"
  },
  {
    "chapterId": "c10-triangles",
    "kind": "triangleArea",
    "A": [
      0,
      0
    ],
    "B": [
      9,
      3
    ],
    "C": [
      3,
      9
    ],
    "context": "Triangular frame"
  },
  {
    "chapterId": "c10-triangles",
    "kind": "rightTriangle",
    "u": 7,
    "v": 24,
    "context": "Ladder and wall"
  },
  {
    "chapterId": "c10-triangles",
    "kind": "rightTriangle",
    "u": 9,
    "v": 12,
    "context": "Right triangle similarity"
  },
  {
    "chapterId": "c10-circles",
    "kind": "circleChord",
    "r": 17,
    "d": 8,
    "context": "Circular pond"
  },
  {
    "chapterId": "c10-circles",
    "kind": "circleChord",
    "r": 15,
    "d": 9,
    "context": "Museum arch"
  },
  {
    "chapterId": "c10-circles",
    "kind": "circleChord",
    "r": 25,
    "d": 7,
    "context": "Stage spotlight"
  },
  {
    "chapterId": "c10-areas-circles",
    "kind": "circleChord",
    "r": 13,
    "d": 12,
    "context": "Circular fence"
  },
  {
    "chapterId": "c10-quadratic-equations",
    "kind": "parabolaVertex",
    "a": 1,
    "h": 3,
    "k": -4,
    "context": "Quadratic turning point"
  },
  {
    "chapterId": "c10-quadratic-equations",
    "kind": "parabolaVertex",
    "a": 2,
    "h": -2,
    "k": -1,
    "context": "Upward parabola"
  },
  {
    "chapterId": "c10-polynomials",
    "kind": "parabolaVertex",
    "a": -1,
    "h": 1,
    "k": 5,
    "context": "Quadratic polynomial graph"
  },
  {
    "chapterId": "c10-polynomials",
    "kind": "parabolaVertex",
    "a": 1,
    "h": 0,
    "k": -4,
    "context": "Symmetric polynomial"
  },
  {
    "chapterId": "c10-trig-applications",
    "kind": "rightTriangle",
    "u": 12,
    "v": 16,
    "context": "Tower and shadow"
  },
  {
    "chapterId": "c10-trig-applications",
    "kind": "rightTriangle",
    "u": 20,
    "v": 21,
    "context": "Riverbank triangulation"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "barMean",
    "labels": [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday"
    ],
    "values": [
      13,
      17,
      11,
      19
    ],
    "context": "Recorded test scores"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "barSum",
    "labels": [
      "0–5",
      "5–10",
      "10–15",
      "15–20"
    ],
    "values": [
      3,
      8,
      7,
      2
    ],
    "context": "Equal-width grouped counts"
  },
  {
    "chapterId": "c10-probability",
    "kind": "barProb",
    "labels": [
      "A",
      "B",
      "C",
      "D"
    ],
    "values": [
      4,
      8,
      12,
      16
    ],
    "favourable": "C",
    "context": "Ticket draw"
  },
  {
    "chapterId": "c10-probability",
    "kind": "barProb",
    "labels": [
      "Red",
      "Blue",
      "White"
    ],
    "values": [
      7,
      9,
      4
    ],
    "favourable": "Red",
    "context": "Coloured cards"
  },
  {
    "chapterId": "c10-trigonometry",
    "kind": "rightTriangle",
    "u": 8,
    "v": 6,
    "context": "A trigonometric ratio diagram"
  }
];
const data={};for(const {chapterId,kind,...p} of specs)(data[chapterId]||={examples:[]}).examples.push(makeVisualExample(kind,p));
export default data;
