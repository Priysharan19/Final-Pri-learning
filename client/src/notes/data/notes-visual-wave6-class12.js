// Original Class 12 inquiry visual studies. Quartile and sine prerequisites clearly optional.
import { makeInquiryVisual } from '../visualInquiryFactory.js';
const specs=[
  {
    "chapterId": "c12-vector-algebra",
    "kind": "vectorArea",
    "u": [
      2,
      -2
    ],
    "v": [
      -3,
      2
    ],
    "context": "Vector determinant area 1"
  },
  {
    "chapterId": "c12-vector-algebra",
    "kind": "vectorArea",
    "u": [
      3,
      -1
    ],
    "v": [
      -2,
      4
    ],
    "context": "Vector determinant area 2"
  },
  {
    "chapterId": "c12-vector-algebra",
    "kind": "vectorArea",
    "u": [
      4,
      0
    ],
    "v": [
      -1,
      6
    ],
    "context": "Vector determinant area 3"
  },
  {
    "chapterId": "c12-vector-algebra",
    "kind": "vectorArea",
    "u": [
      5,
      1
    ],
    "v": [
      0,
      3
    ],
    "context": "Vector determinant area 4"
  },
  {
    "chapterId": "c12-vector-algebra",
    "kind": "vectorArea",
    "u": [
      6,
      -2
    ],
    "v": [
      -3,
      5
    ],
    "context": "Vector determinant area 5"
  },
  {
    "chapterId": "c12-vector-algebra",
    "kind": "vectorArea",
    "u": [
      2,
      -1
    ],
    "v": [
      -2,
      2
    ],
    "context": "Vector determinant area 6"
  },
  {
    "chapterId": "c12-vector-algebra",
    "kind": "vectorArea",
    "u": [
      3,
      0
    ],
    "v": [
      -1,
      4
    ],
    "context": "Vector determinant area 7"
  },
  {
    "chapterId": "c12-vector-algebra",
    "kind": "vectorArea",
    "u": [
      4,
      1
    ],
    "v": [
      0,
      6
    ],
    "context": "Vector determinant area 8"
  },
  {
    "chapterId": "c12-vector-algebra",
    "kind": "vectorArea",
    "u": [
      5,
      -2
    ],
    "v": [
      -3,
      3
    ],
    "context": "Vector determinant area 9"
  },
  {
    "chapterId": "c12-vector-algebra",
    "kind": "vectorArea",
    "u": [
      6,
      -1
    ],
    "v": [
      -2,
      5
    ],
    "context": "Vector determinant area 10"
  },
  {
    "chapterId": "c12-vector-algebra",
    "kind": "vectorArea",
    "u": [
      2,
      0
    ],
    "v": [
      -1,
      2
    ],
    "context": "Vector determinant area 11"
  },
  {
    "chapterId": "c12-vector-algebra",
    "kind": "vectorArea",
    "u": [
      3,
      1
    ],
    "v": [
      0,
      4
    ],
    "context": "Vector determinant area 12"
  },
  {
    "chapterId": "c12-vector-algebra",
    "kind": "vectorArea",
    "u": [
      4,
      -2
    ],
    "v": [
      -3,
      6
    ],
    "context": "Vector determinant area 13"
  },
  {
    "chapterId": "c12-vector-algebra",
    "kind": "vectorArea",
    "u": [
      5,
      -1
    ],
    "v": [
      -2,
      3
    ],
    "context": "Vector determinant area 14"
  },
  {
    "chapterId": "c12-vector-algebra",
    "kind": "vectorArea",
    "u": [
      6,
      0
    ],
    "v": [
      -1,
      5
    ],
    "context": "Vector determinant area 15"
  },
  {
    "chapterId": "c12-vector-algebra",
    "kind": "vectorArea",
    "u": [
      2,
      1
    ],
    "v": [
      0,
      2
    ],
    "context": "Vector determinant area 16"
  },
  {
    "chapterId": "c12-vector-algebra",
    "kind": "vectorArea",
    "u": [
      3,
      -2
    ],
    "v": [
      -3,
      4
    ],
    "context": "Vector determinant area 17"
  },
  {
    "chapterId": "c12-vector-algebra",
    "kind": "vectorArea",
    "u": [
      4,
      -1
    ],
    "v": [
      -2,
      6
    ],
    "context": "Vector determinant area 18"
  },
  {
    "chapterId": "c12-vector-algebra",
    "kind": "vectorArea",
    "u": [
      5,
      0
    ],
    "v": [
      -1,
      3
    ],
    "context": "Vector determinant area 19"
  },
  {
    "chapterId": "c12-vector-algebra",
    "kind": "vectorArea",
    "u": [
      6,
      1
    ],
    "v": [
      0,
      5
    ],
    "context": "Vector determinant area 20"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "piecewise",
    "left": -6,
    "right": 3,
    "mode": "function",
    "context": "Endpoint and continuity graph 1"
  },
  {
    "chapterId": "c12-continuity-differentiability",
    "kind": "piecewise",
    "left": -5,
    "right": 6,
    "mode": "jump",
    "context": "Endpoint and continuity graph 2"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "piecewise",
    "left": -4,
    "right": 3,
    "mode": "jump",
    "context": "Endpoint and continuity graph 3"
  },
  {
    "chapterId": "c12-continuity-differentiability",
    "kind": "piecewise",
    "left": -3,
    "right": 6,
    "mode": "function",
    "context": "Endpoint and continuity graph 4"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "piecewise",
    "left": -2,
    "right": 3,
    "mode": "jump",
    "context": "Endpoint and continuity graph 5"
  },
  {
    "chapterId": "c12-continuity-differentiability",
    "kind": "piecewise",
    "left": -1,
    "right": 6,
    "mode": "jump",
    "context": "Endpoint and continuity graph 6"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "piecewise",
    "left": 0,
    "right": 3,
    "mode": "function",
    "context": "Endpoint and continuity graph 7"
  },
  {
    "chapterId": "c12-continuity-differentiability",
    "kind": "piecewise",
    "left": 1,
    "right": 6,
    "mode": "jump",
    "context": "Endpoint and continuity graph 8"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "piecewise",
    "left": -6,
    "right": 3,
    "mode": "jump",
    "context": "Endpoint and continuity graph 9"
  },
  {
    "chapterId": "c12-continuity-differentiability",
    "kind": "piecewise",
    "left": -5,
    "right": 6,
    "mode": "function",
    "context": "Endpoint and continuity graph 10"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "piecewise",
    "left": -4,
    "right": 3,
    "mode": "jump",
    "context": "Endpoint and continuity graph 11"
  },
  {
    "chapterId": "c12-continuity-differentiability",
    "kind": "piecewise",
    "left": -3,
    "right": 6,
    "mode": "jump",
    "context": "Endpoint and continuity graph 12"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "piecewise",
    "left": -2,
    "right": 3,
    "mode": "function",
    "context": "Endpoint and continuity graph 13"
  },
  {
    "chapterId": "c12-continuity-differentiability",
    "kind": "piecewise",
    "left": -1,
    "right": 6,
    "mode": "jump",
    "context": "Endpoint and continuity graph 14"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "piecewise",
    "left": 0,
    "right": 3,
    "mode": "jump",
    "context": "Endpoint and continuity graph 15"
  },
  {
    "chapterId": "c12-continuity-differentiability",
    "kind": "piecewise",
    "left": 1,
    "right": 6,
    "mode": "function",
    "context": "Endpoint and continuity graph 16"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "piecewise",
    "left": -6,
    "right": 3,
    "mode": "jump",
    "context": "Endpoint and continuity graph 17"
  },
  {
    "chapterId": "c12-continuity-differentiability",
    "kind": "piecewise",
    "left": -5,
    "right": 6,
    "mode": "jump",
    "context": "Endpoint and continuity graph 18"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "piecewise",
    "left": -4,
    "right": 3,
    "mode": "function",
    "context": "Endpoint and continuity graph 19"
  },
  {
    "chapterId": "c12-continuity-differentiability",
    "kind": "piecewise",
    "left": -3,
    "right": 6,
    "mode": "jump",
    "context": "Endpoint and continuity graph 20"
  },
  {
    "chapterId": "c12-inverse-trigonometric",
    "kind": "trigWave",
    "amp": 1,
    "k": 1,
    "mode": "peaks",
    "context": "Optional trig waveform prerequisite 1"
  },
  {
    "chapterId": "c12-inverse-trigonometric",
    "kind": "trigWave",
    "amp": 3,
    "k": 2,
    "mode": "amplitude",
    "context": "Optional trig waveform prerequisite 2"
  },
  {
    "chapterId": "c12-inverse-trigonometric",
    "kind": "trigWave",
    "amp": 5,
    "k": 3,
    "mode": "peaks",
    "context": "Optional trig waveform prerequisite 3"
  },
  {
    "chapterId": "c12-inverse-trigonometric",
    "kind": "trigWave",
    "amp": 2,
    "k": 4,
    "mode": "amplitude",
    "context": "Optional trig waveform prerequisite 4"
  },
  {
    "chapterId": "c12-inverse-trigonometric",
    "kind": "trigWave",
    "amp": 4,
    "k": 1,
    "mode": "peaks",
    "context": "Optional trig waveform prerequisite 5"
  },
  {
    "chapterId": "c12-inverse-trigonometric",
    "kind": "trigWave",
    "amp": 1,
    "k": 2,
    "mode": "amplitude",
    "context": "Optional trig waveform prerequisite 6"
  },
  {
    "chapterId": "c12-inverse-trigonometric",
    "kind": "trigWave",
    "amp": 3,
    "k": 3,
    "mode": "peaks",
    "context": "Optional trig waveform prerequisite 7"
  },
  {
    "chapterId": "c12-inverse-trigonometric",
    "kind": "trigWave",
    "amp": 5,
    "k": 4,
    "mode": "amplitude",
    "context": "Optional trig waveform prerequisite 8"
  },
  {
    "chapterId": "c12-inverse-trigonometric",
    "kind": "trigWave",
    "amp": 2,
    "k": 1,
    "mode": "peaks",
    "context": "Optional trig waveform prerequisite 9"
  },
  {
    "chapterId": "c12-inverse-trigonometric",
    "kind": "trigWave",
    "amp": 4,
    "k": 2,
    "mode": "amplitude",
    "context": "Optional trig waveform prerequisite 10"
  },
  {
    "chapterId": "c12-inverse-trigonometric",
    "kind": "trigWave",
    "amp": 1,
    "k": 3,
    "mode": "peaks",
    "context": "Optional trig waveform prerequisite 11"
  },
  {
    "chapterId": "c12-inverse-trigonometric",
    "kind": "trigWave",
    "amp": 3,
    "k": 4,
    "mode": "amplitude",
    "context": "Optional trig waveform prerequisite 12"
  },
  {
    "chapterId": "c12-inverse-trigonometric",
    "kind": "trigWave",
    "amp": 5,
    "k": 1,
    "mode": "peaks",
    "context": "Optional trig waveform prerequisite 13"
  },
  {
    "chapterId": "c12-inverse-trigonometric",
    "kind": "trigWave",
    "amp": 2,
    "k": 2,
    "mode": "amplitude",
    "context": "Optional trig waveform prerequisite 14"
  },
  {
    "chapterId": "c12-differential-equations",
    "kind": "exponential",
    "base": 2,
    "power": 1,
    "context": "Exponential solution profile 1"
  },
  {
    "chapterId": "c12-differential-equations",
    "kind": "exponential",
    "base": 3,
    "power": 3,
    "context": "Exponential solution profile 2"
  },
  {
    "chapterId": "c12-differential-equations",
    "kind": "exponential",
    "base": 4,
    "power": 2,
    "context": "Exponential solution profile 3"
  },
  {
    "chapterId": "c12-differential-equations",
    "kind": "exponential",
    "base": 2,
    "power": 1,
    "context": "Exponential solution profile 4"
  },
  {
    "chapterId": "c12-differential-equations",
    "kind": "exponential",
    "base": 3,
    "power": 3,
    "context": "Exponential solution profile 5"
  },
  {
    "chapterId": "c12-differential-equations",
    "kind": "exponential",
    "base": 4,
    "power": 2,
    "context": "Exponential solution profile 6"
  },
  {
    "chapterId": "c12-differential-equations",
    "kind": "exponential",
    "base": 2,
    "power": 1,
    "context": "Exponential solution profile 7"
  },
  {
    "chapterId": "c12-differential-equations",
    "kind": "exponential",
    "base": 3,
    "power": 3,
    "context": "Exponential solution profile 8"
  },
  {
    "chapterId": "c12-differential-equations",
    "kind": "exponential",
    "base": 4,
    "power": 2,
    "context": "Exponential solution profile 9"
  },
  {
    "chapterId": "c12-differential-equations",
    "kind": "exponential",
    "base": 2,
    "power": 1,
    "context": "Exponential solution profile 10"
  },
  {
    "chapterId": "c12-differential-equations",
    "kind": "exponential",
    "base": 3,
    "power": 3,
    "context": "Exponential solution profile 11"
  },
  {
    "chapterId": "c12-differential-equations",
    "kind": "exponential",
    "base": 4,
    "power": 2,
    "context": "Exponential solution profile 12"
  },
  {
    "chapterId": "c12-probability",
    "kind": "boxPlot",
    "min": -6,
    "q1": -3,
    "med": 0,
    "q3": 2,
    "max": 5,
    "mode": "iqr",
    "context": "Optional distribution summary 1"
  },
  {
    "chapterId": "c12-probability",
    "kind": "boxPlot",
    "min": -5,
    "q1": -1,
    "med": 2,
    "q3": 5,
    "max": 8,
    "mode": "range",
    "context": "Optional distribution summary 2"
  },
  {
    "chapterId": "c12-probability",
    "kind": "boxPlot",
    "min": -4,
    "q1": -1,
    "med": 2,
    "q3": 6,
    "max": 9,
    "mode": "iqr",
    "context": "Optional distribution summary 3"
  },
  {
    "chapterId": "c12-probability",
    "kind": "boxPlot",
    "min": -3,
    "q1": 1,
    "med": 4,
    "q3": 6,
    "max": 9,
    "mode": "range",
    "context": "Optional distribution summary 4"
  },
  {
    "chapterId": "c12-probability",
    "kind": "boxPlot",
    "min": -2,
    "q1": 1,
    "med": 4,
    "q3": 7,
    "max": 10,
    "mode": "iqr",
    "context": "Optional distribution summary 5"
  },
  {
    "chapterId": "c12-probability",
    "kind": "boxPlot",
    "min": -1,
    "q1": 3,
    "med": 6,
    "q3": 10,
    "max": 13,
    "mode": "range",
    "context": "Optional distribution summary 6"
  },
  {
    "chapterId": "c12-probability",
    "kind": "boxPlot",
    "min": 0,
    "q1": 3,
    "med": 6,
    "q3": 8,
    "max": 11,
    "mode": "iqr",
    "context": "Optional distribution summary 7"
  },
  {
    "chapterId": "c12-probability",
    "kind": "boxPlot",
    "min": 1,
    "q1": 5,
    "med": 8,
    "q3": 11,
    "max": 14,
    "mode": "range",
    "context": "Optional distribution summary 8"
  },
  {
    "chapterId": "c12-probability",
    "kind": "boxPlot",
    "min": 2,
    "q1": 5,
    "med": 8,
    "q3": 12,
    "max": 15,
    "mode": "iqr",
    "context": "Optional distribution summary 9"
  },
  {
    "chapterId": "c12-probability",
    "kind": "boxPlot",
    "min": 3,
    "q1": 7,
    "med": 10,
    "q3": 12,
    "max": 15,
    "mode": "range",
    "context": "Optional distribution summary 10"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "scatterLine",
    "m": -4,
    "b": -7,
    "points": [
      -2,
      -1,
      0,
      2,
      4
    ],
    "mode": "intercept",
    "context": "Function graph from samples 1"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "scatterLine",
    "m": -2,
    "b": -7,
    "points": [
      -2,
      -1,
      0,
      2,
      4
    ],
    "mode": "slope",
    "context": "Function graph from samples 2"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "scatterLine",
    "m": -1,
    "b": -6,
    "points": [
      -2,
      -1,
      0,
      2,
      4
    ],
    "mode": "slope",
    "context": "Function graph from samples 3"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "scatterLine",
    "m": 1,
    "b": -6,
    "points": [
      -2,
      -1,
      0,
      2,
      4
    ],
    "mode": "intercept",
    "context": "Function graph from samples 4"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "scatterLine",
    "m": 2,
    "b": -5,
    "points": [
      -2,
      -1,
      0,
      2,
      4
    ],
    "mode": "slope",
    "context": "Function graph from samples 5"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "scatterLine",
    "m": 3,
    "b": -5,
    "points": [
      -2,
      -1,
      0,
      2,
      4
    ],
    "mode": "slope",
    "context": "Function graph from samples 6"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "scatterLine",
    "m": 4,
    "b": -4,
    "points": [
      -2,
      -1,
      0,
      2,
      4
    ],
    "mode": "intercept",
    "context": "Function graph from samples 7"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "scatterLine",
    "m": -4,
    "b": -4,
    "points": [
      -2,
      -1,
      0,
      2,
      4
    ],
    "mode": "slope",
    "context": "Function graph from samples 8"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "scatterLine",
    "m": -2,
    "b": -3,
    "points": [
      -2,
      -1,
      0,
      2,
      4
    ],
    "mode": "slope",
    "context": "Function graph from samples 9"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "scatterLine",
    "m": -1,
    "b": -3,
    "points": [
      -2,
      -1,
      0,
      2,
      4
    ],
    "mode": "intercept",
    "context": "Function graph from samples 10"
  },
  {
    "chapterId": "c12-probability",
    "kind": "latticePaths",
    "east": 2,
    "north": 1,
    "context": "Combinatorial path probability setup 1"
  },
  {
    "chapterId": "c12-probability",
    "kind": "latticePaths",
    "east": 3,
    "north": 4,
    "context": "Combinatorial path probability setup 2"
  },
  {
    "chapterId": "c12-probability",
    "kind": "latticePaths",
    "east": 4,
    "north": 1,
    "context": "Combinatorial path probability setup 3"
  },
  {
    "chapterId": "c12-probability",
    "kind": "latticePaths",
    "east": 5,
    "north": 4,
    "context": "Combinatorial path probability setup 4"
  },
  {
    "chapterId": "c12-probability",
    "kind": "latticePaths",
    "east": 6,
    "north": 1,
    "context": "Combinatorial path probability setup 5"
  },
  {
    "chapterId": "c12-probability",
    "kind": "latticePaths",
    "east": 2,
    "north": 4,
    "context": "Combinatorial path probability setup 6"
  },
  {
    "chapterId": "c12-probability",
    "kind": "latticePaths",
    "east": 3,
    "north": 1,
    "context": "Combinatorial path probability setup 7"
  },
  {
    "chapterId": "c12-probability",
    "kind": "latticePaths",
    "east": 4,
    "north": 4,
    "context": "Combinatorial path probability setup 8"
  },
  {
    "chapterId": "c12-probability",
    "kind": "latticePaths",
    "east": 5,
    "north": 1,
    "context": "Combinatorial path probability setup 9"
  },
  {
    "chapterId": "c12-probability",
    "kind": "latticePaths",
    "east": 6,
    "north": 4,
    "context": "Combinatorial path probability setup 10"
  },
  {
    "chapterId": "c12-applications-derivatives",
    "kind": "quadraticRoots",
    "r1": -3,
    "r2": 3,
    "a": 1,
    "context": "Graphical stationary point model 1"
  },
  {
    "chapterId": "c12-applications-derivatives",
    "kind": "quadraticRoots",
    "r1": -2,
    "r2": 4,
    "a": -1,
    "context": "Graphical stationary point model 2"
  },
  {
    "chapterId": "c12-applications-derivatives",
    "kind": "quadraticRoots",
    "r1": -1,
    "r2": 3,
    "a": 1,
    "context": "Graphical stationary point model 3"
  },
  {
    "chapterId": "c12-applications-derivatives",
    "kind": "quadraticRoots",
    "r1": 0,
    "r2": 4,
    "a": -1,
    "context": "Graphical stationary point model 4"
  }
];
const result={};for(const {chapterId,kind,...p} of specs)(result[chapterId]||={examples:[]}).examples.push(makeInquiryVisual(kind,p));
export default result;
