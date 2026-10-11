// Grade 11 original proofs-from-figures; optional extension contexts remain explicitly labelled.
import { makeInvestigation } from '../visualInvestigationFactory.js';
const specs=[
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "tangent",
    "a": 1,
    "h": -3,
    "k": -5,
    "x0": -2,
    "context": "Class 11 tangent-gradient investigation 1"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "tangent",
    "a": -1,
    "h": -2,
    "k": -2,
    "x0": 0,
    "context": "Class 11 tangent-gradient investigation 2"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "tangent",
    "a": 2,
    "h": -1,
    "k": 1,
    "x0": 2,
    "context": "Class 11 tangent-gradient investigation 3"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "tangent",
    "a": -2,
    "h": 0,
    "k": 4,
    "x0": 4,
    "context": "Class 11 tangent-gradient investigation 4"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "tangent",
    "a": 3,
    "h": 1,
    "k": -4,
    "x0": 2,
    "context": "Class 11 tangent-gradient investigation 5"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "tangent",
    "a": 1,
    "h": 2,
    "k": -1,
    "x0": 4,
    "context": "Class 11 tangent-gradient investigation 6"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "tangent",
    "a": -1,
    "h": -3,
    "k": 2,
    "x0": 0,
    "context": "Class 11 tangent-gradient investigation 7"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "tangent",
    "a": 2,
    "h": -2,
    "k": 5,
    "x0": 2,
    "context": "Class 11 tangent-gradient investigation 8"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "tangent",
    "a": -2,
    "h": -1,
    "k": -3,
    "x0": 0,
    "context": "Class 11 tangent-gradient investigation 9"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "tangent",
    "a": 3,
    "h": 0,
    "k": 0,
    "x0": 2,
    "context": "Class 11 tangent-gradient investigation 10"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "tangent",
    "a": 1,
    "h": 1,
    "k": 3,
    "x0": 4,
    "context": "Class 11 tangent-gradient investigation 11"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "tangent",
    "a": -1,
    "h": 2,
    "k": -5,
    "x0": 6,
    "context": "Class 11 tangent-gradient investigation 12"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "tangent",
    "a": 2,
    "h": -3,
    "k": -2,
    "x0": -2,
    "context": "Class 11 tangent-gradient investigation 13"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "tangent",
    "a": -2,
    "h": -2,
    "k": 1,
    "x0": 0,
    "context": "Class 11 tangent-gradient investigation 14"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "tangent",
    "a": 3,
    "h": -1,
    "k": 4,
    "x0": 2,
    "context": "Class 11 tangent-gradient investigation 15"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "tangent",
    "a": 1,
    "h": 0,
    "k": -4,
    "x0": 4,
    "context": "Class 11 tangent-gradient investigation 16"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "tangent",
    "a": -1,
    "h": 1,
    "k": -1,
    "x0": 2,
    "context": "Class 11 tangent-gradient investigation 17"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "tangent",
    "a": 2,
    "h": 2,
    "k": 2,
    "x0": 4,
    "context": "Class 11 tangent-gradient investigation 18"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "tangent",
    "a": -2,
    "h": -3,
    "k": 5,
    "x0": 0,
    "context": "Class 11 tangent-gradient investigation 19"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "tangent",
    "a": 3,
    "h": -2,
    "k": -3,
    "x0": 2,
    "context": "Class 11 tangent-gradient investigation 20"
  },
  {
    "chapterId": "c11-conic-sections",
    "kind": "ellipse",
    "a": 5,
    "b": 2,
    "mode": "focal",
    "context": "Class 11 ellipse focal geometry 1"
  },
  {
    "chapterId": "c11-conic-sections",
    "kind": "ellipse",
    "a": 6,
    "b": 3,
    "mode": "area",
    "context": "Class 11 ellipse focal geometry 2"
  },
  {
    "chapterId": "c11-conic-sections",
    "kind": "ellipse",
    "a": 7,
    "b": 4,
    "mode": "focal",
    "context": "Class 11 ellipse focal geometry 3"
  },
  {
    "chapterId": "c11-conic-sections",
    "kind": "ellipse",
    "a": 8,
    "b": 5,
    "mode": "area",
    "context": "Class 11 ellipse focal geometry 4"
  },
  {
    "chapterId": "c11-conic-sections",
    "kind": "ellipse",
    "a": 9,
    "b": 2,
    "mode": "focal",
    "context": "Class 11 ellipse focal geometry 5"
  },
  {
    "chapterId": "c11-conic-sections",
    "kind": "ellipse",
    "a": 10,
    "b": 3,
    "mode": "area",
    "context": "Class 11 ellipse focal geometry 6"
  },
  {
    "chapterId": "c11-conic-sections",
    "kind": "ellipse",
    "a": 11,
    "b": 4,
    "mode": "focal",
    "context": "Class 11 ellipse focal geometry 7"
  },
  {
    "chapterId": "c11-conic-sections",
    "kind": "ellipse",
    "a": 12,
    "b": 5,
    "mode": "area",
    "context": "Class 11 ellipse focal geometry 8"
  },
  {
    "chapterId": "c11-conic-sections",
    "kind": "ellipse",
    "a": 5,
    "b": 2,
    "mode": "focal",
    "context": "Class 11 ellipse focal geometry 9"
  },
  {
    "chapterId": "c11-conic-sections",
    "kind": "ellipse",
    "a": 6,
    "b": 3,
    "mode": "area",
    "context": "Class 11 ellipse focal geometry 10"
  },
  {
    "chapterId": "c11-conic-sections",
    "kind": "ellipse",
    "a": 7,
    "b": 4,
    "mode": "focal",
    "context": "Class 11 ellipse focal geometry 11"
  },
  {
    "chapterId": "c11-conic-sections",
    "kind": "ellipse",
    "a": 8,
    "b": 5,
    "mode": "area",
    "context": "Class 11 ellipse focal geometry 12"
  },
  {
    "chapterId": "c11-conic-sections",
    "kind": "ellipse",
    "a": 9,
    "b": 2,
    "mode": "focal",
    "context": "Class 11 ellipse focal geometry 13"
  },
  {
    "chapterId": "c11-conic-sections",
    "kind": "ellipse",
    "a": 10,
    "b": 3,
    "mode": "area",
    "context": "Class 11 ellipse focal geometry 14"
  },
  {
    "chapterId": "c11-conic-sections",
    "kind": "ellipse",
    "a": 11,
    "b": 4,
    "mode": "focal",
    "context": "Class 11 ellipse focal geometry 15"
  },
  {
    "chapterId": "c11-relations-functions",
    "kind": "inverseLine",
    "m": 1,
    "b": -4,
    "x0": -3,
    "context": "Optional reflected function graph 1"
  },
  {
    "chapterId": "c11-relations-functions",
    "kind": "inverseLine",
    "m": 2,
    "b": -3,
    "x0": -2,
    "context": "Optional reflected function graph 2"
  },
  {
    "chapterId": "c11-relations-functions",
    "kind": "inverseLine",
    "m": 3,
    "b": -2,
    "x0": -1,
    "context": "Optional reflected function graph 3"
  },
  {
    "chapterId": "c11-relations-functions",
    "kind": "inverseLine",
    "m": 4,
    "b": -1,
    "x0": 0,
    "context": "Optional reflected function graph 4"
  },
  {
    "chapterId": "c11-relations-functions",
    "kind": "inverseLine",
    "m": 1,
    "b": 0,
    "x0": 1,
    "context": "Optional reflected function graph 5"
  },
  {
    "chapterId": "c11-relations-functions",
    "kind": "inverseLine",
    "m": 2,
    "b": 1,
    "x0": 2,
    "context": "Optional reflected function graph 6"
  },
  {
    "chapterId": "c11-relations-functions",
    "kind": "inverseLine",
    "m": 3,
    "b": 2,
    "x0": -3,
    "context": "Optional reflected function graph 7"
  },
  {
    "chapterId": "c11-relations-functions",
    "kind": "inverseLine",
    "m": 4,
    "b": 3,
    "x0": -2,
    "context": "Optional reflected function graph 8"
  },
  {
    "chapterId": "c11-relations-functions",
    "kind": "inverseLine",
    "m": 1,
    "b": 4,
    "x0": -1,
    "context": "Optional reflected function graph 9"
  },
  {
    "chapterId": "c11-relations-functions",
    "kind": "inverseLine",
    "m": 2,
    "b": -4,
    "x0": 0,
    "context": "Optional reflected function graph 10"
  },
  {
    "chapterId": "c11-relations-functions",
    "kind": "inverseLine",
    "m": 3,
    "b": -3,
    "x0": 1,
    "context": "Optional reflected function graph 11"
  },
  {
    "chapterId": "c11-relations-functions",
    "kind": "inverseLine",
    "m": 4,
    "b": -2,
    "x0": 2,
    "context": "Optional reflected function graph 12"
  },
  {
    "chapterId": "c11-relations-functions",
    "kind": "inverseLine",
    "m": 1,
    "b": -1,
    "x0": -3,
    "context": "Optional reflected function graph 13"
  },
  {
    "chapterId": "c11-relations-functions",
    "kind": "inverseLine",
    "m": 2,
    "b": 0,
    "x0": -2,
    "context": "Optional reflected function graph 14"
  },
  {
    "chapterId": "c11-relations-functions",
    "kind": "inverseLine",
    "m": 3,
    "b": 1,
    "x0": -1,
    "context": "Optional reflected function graph 15"
  },
  {
    "chapterId": "c11-statistics",
    "kind": "twoBox",
    "a": [
      -5,
      -3,
      0,
      4,
      8
    ],
    "b": [
      -4,
      -1,
      1,
      6,
      12
    ],
    "mode": "iqrDiff",
    "context": "Class 11 comparative quartile diagram 1"
  },
  {
    "chapterId": "c11-statistics",
    "kind": "twoBox",
    "a": [
      -4,
      -2,
      1,
      5,
      9
    ],
    "b": [
      -3,
      0,
      2,
      7,
      13
    ],
    "mode": "medianGap",
    "context": "Class 11 comparative quartile diagram 2"
  },
  {
    "chapterId": "c11-statistics",
    "kind": "twoBox",
    "a": [
      -3,
      -1,
      2,
      6,
      10
    ],
    "b": [
      -2,
      1,
      3,
      8,
      14
    ],
    "mode": "rangeDiff",
    "context": "Class 11 comparative quartile diagram 3"
  },
  {
    "chapterId": "c11-statistics",
    "kind": "twoBox",
    "a": [
      -2,
      0,
      3,
      7,
      11
    ],
    "b": [
      -1,
      2,
      4,
      9,
      15
    ],
    "mode": "iqrDiff",
    "context": "Class 11 comparative quartile diagram 4"
  },
  {
    "chapterId": "c11-statistics",
    "kind": "twoBox",
    "a": [
      -1,
      1,
      4,
      8,
      12
    ],
    "b": [
      0,
      3,
      5,
      10,
      16
    ],
    "mode": "medianGap",
    "context": "Class 11 comparative quartile diagram 5"
  },
  {
    "chapterId": "c11-statistics",
    "kind": "twoBox",
    "a": [
      0,
      2,
      5,
      9,
      13
    ],
    "b": [
      1,
      4,
      6,
      11,
      17
    ],
    "mode": "rangeDiff",
    "context": "Class 11 comparative quartile diagram 6"
  },
  {
    "chapterId": "c11-statistics",
    "kind": "twoBox",
    "a": [
      1,
      3,
      6,
      10,
      14
    ],
    "b": [
      2,
      5,
      7,
      12,
      18
    ],
    "mode": "iqrDiff",
    "context": "Class 11 comparative quartile diagram 7"
  },
  {
    "chapterId": "c11-statistics",
    "kind": "twoBox",
    "a": [
      2,
      4,
      7,
      11,
      15
    ],
    "b": [
      3,
      6,
      8,
      13,
      19
    ],
    "mode": "medianGap",
    "context": "Class 11 comparative quartile diagram 8"
  },
  {
    "chapterId": "c11-statistics",
    "kind": "twoBox",
    "a": [
      -5,
      -3,
      0,
      4,
      8
    ],
    "b": [
      -4,
      -1,
      1,
      6,
      12
    ],
    "mode": "rangeDiff",
    "context": "Class 11 comparative quartile diagram 9"
  },
  {
    "chapterId": "c11-statistics",
    "kind": "twoBox",
    "a": [
      -4,
      -2,
      1,
      5,
      9
    ],
    "b": [
      -3,
      0,
      2,
      7,
      13
    ],
    "mode": "iqrDiff",
    "context": "Class 11 comparative quartile diagram 10"
  },
  {
    "chapterId": "c11-statistics",
    "kind": "twoBox",
    "a": [
      -3,
      -1,
      2,
      6,
      10
    ],
    "b": [
      -2,
      1,
      3,
      8,
      14
    ],
    "mode": "medianGap",
    "context": "Class 11 comparative quartile diagram 11"
  },
  {
    "chapterId": "c11-statistics",
    "kind": "twoBox",
    "a": [
      -2,
      0,
      3,
      7,
      11
    ],
    "b": [
      -1,
      2,
      4,
      9,
      15
    ],
    "mode": "rangeDiff",
    "context": "Class 11 comparative quartile diagram 12"
  },
  {
    "chapterId": "c11-statistics",
    "kind": "twoBox",
    "a": [
      -1,
      1,
      4,
      8,
      12
    ],
    "b": [
      0,
      3,
      5,
      10,
      16
    ],
    "mode": "iqrDiff",
    "context": "Class 11 comparative quartile diagram 13"
  },
  {
    "chapterId": "c11-statistics",
    "kind": "twoBox",
    "a": [
      0,
      2,
      5,
      9,
      13
    ],
    "b": [
      1,
      4,
      6,
      11,
      17
    ],
    "mode": "medianGap",
    "context": "Class 11 comparative quartile diagram 14"
  },
  {
    "chapterId": "c11-statistics",
    "kind": "twoBox",
    "a": [
      1,
      3,
      6,
      10,
      14
    ],
    "b": [
      2,
      5,
      7,
      12,
      18
    ],
    "mode": "rangeDiff",
    "context": "Class 11 comparative quartile diagram 15"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "motion",
    "times": [
      0,
      2,
      4,
      7
    ],
    "velocities": [
      2,
      3,
      1,
      2
    ],
    "mode": "peak",
    "context": "Optional speed integration picture 1"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "motion",
    "times": [
      0,
      2,
      4,
      7
    ],
    "velocities": [
      3,
      5,
      4,
      6
    ],
    "mode": "distance",
    "context": "Optional speed integration picture 2"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "motion",
    "times": [
      0,
      2,
      4,
      7
    ],
    "velocities": [
      4,
      7,
      7,
      2
    ],
    "mode": "distance",
    "context": "Optional speed integration picture 3"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "motion",
    "times": [
      0,
      2,
      4,
      7
    ],
    "velocities": [
      5,
      3,
      3,
      6
    ],
    "mode": "peak",
    "context": "Optional speed integration picture 4"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "motion",
    "times": [
      0,
      2,
      4,
      7
    ],
    "velocities": [
      2,
      5,
      6,
      2
    ],
    "mode": "distance",
    "context": "Optional speed integration picture 5"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "motion",
    "times": [
      0,
      2,
      4,
      7
    ],
    "velocities": [
      3,
      7,
      2,
      6
    ],
    "mode": "distance",
    "context": "Optional speed integration picture 6"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "motion",
    "times": [
      0,
      2,
      4,
      7
    ],
    "velocities": [
      4,
      3,
      5,
      2
    ],
    "mode": "peak",
    "context": "Optional speed integration picture 7"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "motion",
    "times": [
      0,
      2,
      4,
      7
    ],
    "velocities": [
      5,
      5,
      1,
      6
    ],
    "mode": "distance",
    "context": "Optional speed integration picture 8"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "motion",
    "times": [
      0,
      2,
      4,
      7
    ],
    "velocities": [
      2,
      7,
      4,
      2
    ],
    "mode": "distance",
    "context": "Optional speed integration picture 9"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "motion",
    "times": [
      0,
      2,
      4,
      7
    ],
    "velocities": [
      3,
      3,
      7,
      6
    ],
    "mode": "peak",
    "context": "Optional speed integration picture 10"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "motion",
    "times": [
      0,
      2,
      4,
      7
    ],
    "velocities": [
      4,
      5,
      3,
      2
    ],
    "mode": "distance",
    "context": "Optional speed integration picture 11"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "motion",
    "times": [
      0,
      2,
      4,
      7
    ],
    "velocities": [
      5,
      7,
      6,
      6
    ],
    "mode": "distance",
    "context": "Optional speed integration picture 12"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "motion",
    "times": [
      0,
      2,
      4,
      7
    ],
    "velocities": [
      2,
      3,
      2,
      2
    ],
    "mode": "peak",
    "context": "Optional speed integration picture 13"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "motion",
    "times": [
      0,
      2,
      4,
      7
    ],
    "velocities": [
      3,
      5,
      5,
      6
    ],
    "mode": "distance",
    "context": "Optional speed integration picture 14"
  },
  {
    "chapterId": "c11-limits-derivatives",
    "kind": "motion",
    "times": [
      0,
      2,
      4,
      7
    ],
    "velocities": [
      4,
      7,
      1,
      2
    ],
    "mode": "distance",
    "context": "Optional speed integration picture 15"
  },
  {
    "chapterId": "c11-statistics",
    "kind": "dotPlot",
    "values": [
      1,
      1,
      1,
      1,
      1,
      2,
      2,
      3,
      4,
      5,
      6,
      7
    ],
    "mode": "mode",
    "context": "Class 11 observational analysis 1"
  },
  {
    "chapterId": "c11-statistics",
    "kind": "dotPlot",
    "values": [
      2,
      2,
      2,
      2,
      2,
      3,
      3,
      4,
      5,
      6,
      7,
      8
    ],
    "mode": "range",
    "context": "Class 11 observational analysis 2"
  },
  {
    "chapterId": "c11-statistics",
    "kind": "dotPlot",
    "values": [
      3,
      3,
      3,
      3,
      3,
      4,
      4,
      5,
      6,
      7,
      8,
      9
    ],
    "mode": "median",
    "context": "Class 11 observational analysis 3"
  },
  {
    "chapterId": "c11-statistics",
    "kind": "dotPlot",
    "values": [
      4,
      4,
      4,
      4,
      4,
      5,
      5,
      6,
      7,
      8,
      9,
      10
    ],
    "mode": "mode",
    "context": "Class 11 observational analysis 4"
  },
  {
    "chapterId": "c11-statistics",
    "kind": "dotPlot",
    "values": [
      1,
      1,
      1,
      1,
      1,
      2,
      2,
      3,
      4,
      5,
      6,
      7
    ],
    "mode": "range",
    "context": "Class 11 observational analysis 5"
  },
  {
    "chapterId": "c11-statistics",
    "kind": "dotPlot",
    "values": [
      2,
      2,
      2,
      2,
      2,
      3,
      3,
      4,
      5,
      6,
      7,
      8
    ],
    "mode": "median",
    "context": "Class 11 observational analysis 6"
  },
  {
    "chapterId": "c11-statistics",
    "kind": "dotPlot",
    "values": [
      3,
      3,
      3,
      3,
      3,
      4,
      4,
      5,
      6,
      7,
      8,
      9
    ],
    "mode": "mode",
    "context": "Class 11 observational analysis 7"
  },
  {
    "chapterId": "c11-statistics",
    "kind": "dotPlot",
    "values": [
      4,
      4,
      4,
      4,
      4,
      5,
      5,
      6,
      7,
      8,
      9,
      10
    ],
    "mode": "range",
    "context": "Class 11 observational analysis 8"
  },
  {
    "chapterId": "c11-statistics",
    "kind": "dotPlot",
    "values": [
      1,
      1,
      1,
      1,
      1,
      2,
      2,
      3,
      4,
      5,
      6,
      7
    ],
    "mode": "median",
    "context": "Class 11 observational analysis 9"
  },
  {
    "chapterId": "c11-statistics",
    "kind": "dotPlot",
    "values": [
      2,
      2,
      2,
      2,
      2,
      3,
      3,
      4,
      5,
      6,
      7,
      8
    ],
    "mode": "mode",
    "context": "Class 11 observational analysis 10"
  },
  {
    "chapterId": "c11-statistics",
    "kind": "dotPlot",
    "values": [
      3,
      3,
      3,
      3,
      3,
      4,
      4,
      5,
      6,
      7,
      8,
      9
    ],
    "mode": "range",
    "context": "Class 11 observational analysis 11"
  },
  {
    "chapterId": "c11-statistics",
    "kind": "dotPlot",
    "values": [
      4,
      4,
      4,
      4,
      4,
      5,
      5,
      6,
      7,
      8,
      9,
      10
    ],
    "mode": "median",
    "context": "Class 11 observational analysis 12"
  },
  {
    "chapterId": "c11-statistics",
    "kind": "dotPlot",
    "values": [
      1,
      1,
      1,
      1,
      1,
      2,
      2,
      3,
      4,
      5,
      6,
      7
    ],
    "mode": "mode",
    "context": "Class 11 observational analysis 13"
  },
  {
    "chapterId": "c11-statistics",
    "kind": "dotPlot",
    "values": [
      2,
      2,
      2,
      2,
      2,
      3,
      3,
      4,
      5,
      6,
      7,
      8
    ],
    "mode": "range",
    "context": "Class 11 observational analysis 14"
  },
  {
    "chapterId": "c11-statistics",
    "kind": "dotPlot",
    "values": [
      3,
      3,
      3,
      3,
      3,
      4,
      4,
      5,
      6,
      7,
      8,
      9
    ],
    "mode": "median",
    "context": "Class 11 observational analysis 15"
  },
  {
    "chapterId": "c11-permutations-combinations",
    "kind": "network",
    "weights": [
      9,
      2,
      7,
      8,
      9,
      3,
      5
    ],
    "context": "Optional finite-network minimum 1"
  },
  {
    "chapterId": "c11-permutations-combinations",
    "kind": "network",
    "weights": [
      12,
      3,
      12,
      12,
      2,
      10,
      2
    ],
    "context": "Optional finite-network minimum 2"
  },
  {
    "chapterId": "c11-permutations-combinations",
    "kind": "network",
    "weights": [
      2,
      10,
      2,
      10,
      12,
      2,
      13
    ],
    "context": "Optional finite-network minimum 3"
  },
  {
    "chapterId": "c11-permutations-combinations",
    "kind": "network",
    "weights": [
      12,
      1,
      2,
      1,
      12,
      11,
      1
    ],
    "context": "Optional finite-network minimum 4"
  },
  {
    "chapterId": "c11-permutations-combinations",
    "kind": "network",
    "weights": [
      1,
      13,
      15,
      1,
      1,
      1,
      15
    ],
    "context": "Optional finite-network minimum 5"
  },
  {
    "chapterId": "c11-permutations-combinations",
    "kind": "network",
    "weights": [
      2,
      10,
      9,
      2,
      8,
      11,
      2
    ],
    "context": "Optional finite-network minimum 6"
  },
  {
    "chapterId": "c11-permutations-combinations",
    "kind": "network",
    "weights": [
      9,
      2,
      7,
      8,
      9,
      3,
      5
    ],
    "context": "Optional finite-network minimum 7"
  },
  {
    "chapterId": "c11-permutations-combinations",
    "kind": "network",
    "weights": [
      12,
      3,
      12,
      12,
      2,
      10,
      2
    ],
    "context": "Optional finite-network minimum 8"
  },
  {
    "chapterId": "c11-permutations-combinations",
    "kind": "network",
    "weights": [
      2,
      10,
      2,
      10,
      12,
      2,
      13
    ],
    "context": "Optional finite-network minimum 9"
  },
  {
    "chapterId": "c11-permutations-combinations",
    "kind": "network",
    "weights": [
      12,
      1,
      2,
      1,
      12,
      11,
      1
    ],
    "context": "Optional finite-network minimum 10"
  },
  {
    "chapterId": "c11-permutations-combinations",
    "kind": "network",
    "weights": [
      1,
      13,
      15,
      1,
      1,
      1,
      15
    ],
    "context": "Optional finite-network minimum 11"
  },
  {
    "chapterId": "c11-permutations-combinations",
    "kind": "network",
    "weights": [
      2,
      10,
      9,
      2,
      8,
      11,
      2
    ],
    "context": "Optional finite-network minimum 12"
  },
  {
    "chapterId": "c11-permutations-combinations",
    "kind": "network",
    "weights": [
      9,
      2,
      7,
      8,
      9,
      3,
      5
    ],
    "context": "Optional finite-network minimum 13"
  },
  {
    "chapterId": "c11-permutations-combinations",
    "kind": "network",
    "weights": [
      12,
      3,
      12,
      12,
      2,
      10,
      2
    ],
    "context": "Optional finite-network minimum 14"
  },
  {
    "chapterId": "c11-permutations-combinations",
    "kind": "network",
    "weights": [
      2,
      10,
      2,
      10,
      12,
      2,
      13
    ],
    "context": "Optional finite-network minimum 15"
  },
  {
    "chapterId": "c11-probability",
    "kind": "pieAngle",
    "counts": [
      2,
      3,
      4,
      3
    ],
    "index": 0,
    "mode": "count",
    "context": "Class 11 outcome sectors 1"
  },
  {
    "chapterId": "c11-probability",
    "kind": "pieAngle",
    "counts": [
      4,
      6,
      8,
      6
    ],
    "index": 1,
    "mode": "angle",
    "context": "Class 11 outcome sectors 2"
  },
  {
    "chapterId": "c11-probability",
    "kind": "pieAngle",
    "counts": [
      3,
      4,
      5,
      6
    ],
    "index": 2,
    "mode": "count",
    "context": "Class 11 outcome sectors 3"
  },
  {
    "chapterId": "c11-probability",
    "kind": "pieAngle",
    "counts": [
      5,
      3,
      7,
      5
    ],
    "index": 3,
    "mode": "angle",
    "context": "Class 11 outcome sectors 4"
  },
  {
    "chapterId": "c11-probability",
    "kind": "pieAngle",
    "counts": [
      8,
      6,
      6,
      10
    ],
    "index": 0,
    "mode": "count",
    "context": "Class 11 outcome sectors 5"
  },
  {
    "chapterId": "c11-probability",
    "kind": "pieAngle",
    "counts": [
      9,
      9,
      6,
      12
    ],
    "index": 1,
    "mode": "angle",
    "context": "Class 11 outcome sectors 6"
  },
  {
    "chapterId": "c11-probability",
    "kind": "pieAngle",
    "counts": [
      12,
      8,
      10,
      10
    ],
    "index": 2,
    "mode": "count",
    "context": "Class 11 outcome sectors 7"
  },
  {
    "chapterId": "c11-probability",
    "kind": "pieAngle",
    "counts": [
      2,
      3,
      4,
      3
    ],
    "index": 3,
    "mode": "angle",
    "context": "Class 11 outcome sectors 8"
  },
  {
    "chapterId": "c11-probability",
    "kind": "pieAngle",
    "counts": [
      4,
      6,
      8,
      6
    ],
    "index": 0,
    "mode": "count",
    "context": "Class 11 outcome sectors 9"
  },
  {
    "chapterId": "c11-probability",
    "kind": "pieAngle",
    "counts": [
      3,
      4,
      5,
      6
    ],
    "index": 1,
    "mode": "angle",
    "context": "Class 11 outcome sectors 10"
  }
];
const data={};for(const {chapterId,kind,...p} of specs)(data[chapterId]||={examples:[]}).examples.push(makeInvestigation(kind,p));
export default data;
