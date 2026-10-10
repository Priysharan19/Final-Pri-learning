// Class 10 source-original diagram investigations with optional network/motion enrichments.
import { makeInvestigation } from '../visualInvestigationFactory.js';
const specs=[
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -7,
      -4
    ],
    "B": [
      -3,
      -1
    ],
    "mode": "x",
    "context": "Class 10 analytic segment 1"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -6,
      -3
    ],
    "B": [
      -1,
      1
    ],
    "mode": "y",
    "context": "Class 10 analytic segment 2"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -5,
      -2
    ],
    "B": [
      1,
      3
    ],
    "mode": "distance2",
    "context": "Class 10 analytic segment 3"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -4,
      -1
    ],
    "B": [
      3,
      5
    ],
    "mode": "x",
    "context": "Class 10 analytic segment 4"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -3,
      0
    ],
    "B": [
      5,
      3
    ],
    "mode": "y",
    "context": "Class 10 analytic segment 5"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -7,
      1
    ],
    "B": [
      -3,
      5
    ],
    "mode": "distance2",
    "context": "Class 10 analytic segment 6"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -6,
      -4
    ],
    "B": [
      -1,
      1
    ],
    "mode": "x",
    "context": "Class 10 analytic segment 7"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -5,
      -3
    ],
    "B": [
      1,
      3
    ],
    "mode": "y",
    "context": "Class 10 analytic segment 8"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -4,
      -2
    ],
    "B": [
      3,
      1
    ],
    "mode": "distance2",
    "context": "Class 10 analytic segment 9"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -3,
      -1
    ],
    "B": [
      5,
      3
    ],
    "mode": "x",
    "context": "Class 10 analytic segment 10"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -7,
      0
    ],
    "B": [
      -3,
      5
    ],
    "mode": "y",
    "context": "Class 10 analytic segment 11"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -6,
      1
    ],
    "B": [
      -1,
      7
    ],
    "mode": "distance2",
    "context": "Class 10 analytic segment 12"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -5,
      -4
    ],
    "B": [
      1,
      -1
    ],
    "mode": "x",
    "context": "Class 10 analytic segment 13"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -4,
      -3
    ],
    "B": [
      3,
      1
    ],
    "mode": "y",
    "context": "Class 10 analytic segment 14"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -3,
      -2
    ],
    "B": [
      5,
      3
    ],
    "mode": "distance2",
    "context": "Class 10 analytic segment 15"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "reflect",
    "A": [
      -5,
      -4
    ],
    "B": [
      -2,
      -4
    ],
    "C": [
      -4,
      0
    ],
    "axis": "y",
    "mode": "area",
    "context": "Class 10 reflected triangle 1"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "reflect",
    "A": [
      -4,
      -3
    ],
    "B": [
      0,
      -3
    ],
    "C": [
      -3,
      2
    ],
    "axis": "x",
    "mode": "coordinate",
    "context": "Class 10 reflected triangle 2"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "reflect",
    "A": [
      -3,
      -2
    ],
    "B": [
      2,
      -2
    ],
    "C": [
      -2,
      4
    ],
    "axis": "y",
    "mode": "coordinate",
    "context": "Class 10 reflected triangle 3"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "reflect",
    "A": [
      -2,
      -1
    ],
    "B": [
      4,
      -1
    ],
    "C": [
      -1,
      6
    ],
    "axis": "x",
    "mode": "area",
    "context": "Class 10 reflected triangle 4"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "reflect",
    "A": [
      -1,
      0
    ],
    "B": [
      2,
      0
    ],
    "C": [
      0,
      4
    ],
    "axis": "y",
    "mode": "coordinate",
    "context": "Class 10 reflected triangle 5"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "reflect",
    "A": [
      -5,
      1
    ],
    "B": [
      -1,
      1
    ],
    "C": [
      -4,
      6
    ],
    "axis": "x",
    "mode": "coordinate",
    "context": "Class 10 reflected triangle 6"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "reflect",
    "A": [
      -4,
      -4
    ],
    "B": [
      1,
      -4
    ],
    "C": [
      -3,
      2
    ],
    "axis": "y",
    "mode": "area",
    "context": "Class 10 reflected triangle 7"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "reflect",
    "A": [
      -3,
      -3
    ],
    "B": [
      3,
      -3
    ],
    "C": [
      -2,
      4
    ],
    "axis": "x",
    "mode": "coordinate",
    "context": "Class 10 reflected triangle 8"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "reflect",
    "A": [
      -2,
      -2
    ],
    "B": [
      1,
      -2
    ],
    "C": [
      -1,
      2
    ],
    "axis": "y",
    "mode": "coordinate",
    "context": "Class 10 reflected triangle 9"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "reflect",
    "A": [
      -1,
      -1
    ],
    "B": [
      3,
      -1
    ],
    "C": [
      0,
      4
    ],
    "axis": "x",
    "mode": "area",
    "context": "Class 10 reflected triangle 10"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "reflect",
    "A": [
      -5,
      0
    ],
    "B": [
      0,
      0
    ],
    "C": [
      -4,
      6
    ],
    "axis": "y",
    "mode": "coordinate",
    "context": "Class 10 reflected triangle 11"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "reflect",
    "A": [
      -4,
      1
    ],
    "B": [
      2,
      1
    ],
    "C": [
      -3,
      8
    ],
    "axis": "x",
    "mode": "coordinate",
    "context": "Class 10 reflected triangle 12"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "reflect",
    "A": [
      -3,
      -4
    ],
    "B": [
      0,
      -4
    ],
    "C": [
      -2,
      0
    ],
    "axis": "y",
    "mode": "area",
    "context": "Class 10 reflected triangle 13"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "reflect",
    "A": [
      -2,
      -3
    ],
    "B": [
      2,
      -3
    ],
    "C": [
      -1,
      2
    ],
    "axis": "x",
    "mode": "coordinate",
    "context": "Class 10 reflected triangle 14"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "reflect",
    "A": [
      -1,
      -2
    ],
    "B": [
      4,
      -2
    ],
    "C": [
      0,
      4
    ],
    "axis": "y",
    "mode": "coordinate",
    "context": "Class 10 reflected triangle 15"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "motion",
    "times": [
      0,
      2,
      5,
      8
    ],
    "velocities": [
      1,
      3,
      2,
      1
    ],
    "mode": "peak",
    "context": "Optional speed-time simultaneous interpretation 1"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "motion",
    "times": [
      0,
      2,
      5,
      8
    ],
    "velocities": [
      2,
      6,
      9,
      3
    ],
    "mode": "distance",
    "context": "Optional speed-time simultaneous interpretation 2"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "motion",
    "times": [
      0,
      2,
      5,
      8
    ],
    "velocities": [
      3,
      3,
      8,
      5
    ],
    "mode": "distance",
    "context": "Optional speed-time simultaneous interpretation 3"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "motion",
    "times": [
      0,
      2,
      5,
      8
    ],
    "velocities": [
      4,
      6,
      7,
      7
    ],
    "mode": "peak",
    "context": "Optional speed-time simultaneous interpretation 4"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "motion",
    "times": [
      0,
      2,
      5,
      8
    ],
    "velocities": [
      1,
      3,
      6,
      2
    ],
    "mode": "distance",
    "context": "Optional speed-time simultaneous interpretation 5"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "motion",
    "times": [
      0,
      2,
      5,
      8
    ],
    "velocities": [
      2,
      6,
      5,
      4
    ],
    "mode": "distance",
    "context": "Optional speed-time simultaneous interpretation 6"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "motion",
    "times": [
      0,
      2,
      5,
      8
    ],
    "velocities": [
      3,
      3,
      4,
      6
    ],
    "mode": "peak",
    "context": "Optional speed-time simultaneous interpretation 7"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "motion",
    "times": [
      0,
      2,
      5,
      8
    ],
    "velocities": [
      4,
      6,
      3,
      1
    ],
    "mode": "distance",
    "context": "Optional speed-time simultaneous interpretation 8"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "motion",
    "times": [
      0,
      2,
      5,
      8
    ],
    "velocities": [
      1,
      3,
      2,
      3
    ],
    "mode": "distance",
    "context": "Optional speed-time simultaneous interpretation 9"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "motion",
    "times": [
      0,
      2,
      5,
      8
    ],
    "velocities": [
      2,
      6,
      9,
      5
    ],
    "mode": "peak",
    "context": "Optional speed-time simultaneous interpretation 10"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "motion",
    "times": [
      0,
      2,
      5,
      8
    ],
    "velocities": [
      3,
      3,
      8,
      7
    ],
    "mode": "distance",
    "context": "Optional speed-time simultaneous interpretation 11"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "motion",
    "times": [
      0,
      2,
      5,
      8
    ],
    "velocities": [
      4,
      6,
      7,
      2
    ],
    "mode": "distance",
    "context": "Optional speed-time simultaneous interpretation 12"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "motion",
    "times": [
      0,
      2,
      5,
      8
    ],
    "velocities": [
      1,
      3,
      6,
      4
    ],
    "mode": "peak",
    "context": "Optional speed-time simultaneous interpretation 13"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "motion",
    "times": [
      0,
      2,
      5,
      8
    ],
    "velocities": [
      2,
      6,
      5,
      6
    ],
    "mode": "distance",
    "context": "Optional speed-time simultaneous interpretation 14"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "motion",
    "times": [
      0,
      2,
      5,
      8
    ],
    "velocities": [
      3,
      3,
      4,
      1
    ],
    "mode": "distance",
    "context": "Optional speed-time simultaneous interpretation 15"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "motion",
    "times": [
      0,
      2,
      5,
      8
    ],
    "velocities": [
      4,
      6,
      3,
      3
    ],
    "mode": "peak",
    "context": "Optional speed-time simultaneous interpretation 16"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "motion",
    "times": [
      0,
      2,
      5,
      8
    ],
    "velocities": [
      1,
      3,
      2,
      5
    ],
    "mode": "distance",
    "context": "Optional speed-time simultaneous interpretation 17"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "motion",
    "times": [
      0,
      2,
      5,
      8
    ],
    "velocities": [
      2,
      6,
      9,
      7
    ],
    "mode": "distance",
    "context": "Optional speed-time simultaneous interpretation 18"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "motion",
    "times": [
      0,
      2,
      5,
      8
    ],
    "velocities": [
      3,
      3,
      8,
      2
    ],
    "mode": "peak",
    "context": "Optional speed-time simultaneous interpretation 19"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "motion",
    "times": [
      0,
      2,
      5,
      8
    ],
    "velocities": [
      4,
      6,
      7,
      4
    ],
    "mode": "distance",
    "context": "Optional speed-time simultaneous interpretation 20"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "dotPlot",
    "values": [
      1,
      1,
      1,
      1,
      1,
      2,
      3,
      4,
      4,
      5,
      6,
      7
    ],
    "mode": "median",
    "context": "Class 10 statistical frequency dots 1"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "dotPlot",
    "values": [
      2,
      2,
      2,
      2,
      2,
      3,
      4,
      5,
      5,
      6,
      7,
      8
    ],
    "mode": "mode",
    "context": "Class 10 statistical frequency dots 2"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "dotPlot",
    "values": [
      3,
      3,
      3,
      3,
      3,
      4,
      5,
      6,
      6,
      7,
      8,
      9
    ],
    "mode": "range",
    "context": "Class 10 statistical frequency dots 3"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "dotPlot",
    "values": [
      4,
      4,
      4,
      4,
      4,
      5,
      6,
      7,
      7,
      8,
      9,
      10
    ],
    "mode": "median",
    "context": "Class 10 statistical frequency dots 4"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "dotPlot",
    "values": [
      5,
      5,
      5,
      5,
      5,
      6,
      7,
      8,
      8,
      9,
      10,
      11
    ],
    "mode": "mode",
    "context": "Class 10 statistical frequency dots 5"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "dotPlot",
    "values": [
      1,
      1,
      1,
      1,
      1,
      2,
      3,
      4,
      4,
      5,
      6,
      7
    ],
    "mode": "range",
    "context": "Class 10 statistical frequency dots 6"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "dotPlot",
    "values": [
      2,
      2,
      2,
      2,
      2,
      3,
      4,
      5,
      5,
      6,
      7,
      8
    ],
    "mode": "median",
    "context": "Class 10 statistical frequency dots 7"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "dotPlot",
    "values": [
      3,
      3,
      3,
      3,
      3,
      4,
      5,
      6,
      6,
      7,
      8,
      9
    ],
    "mode": "mode",
    "context": "Class 10 statistical frequency dots 8"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "dotPlot",
    "values": [
      4,
      4,
      4,
      4,
      4,
      5,
      6,
      7,
      7,
      8,
      9,
      10
    ],
    "mode": "range",
    "context": "Class 10 statistical frequency dots 9"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "dotPlot",
    "values": [
      5,
      5,
      5,
      5,
      5,
      6,
      7,
      8,
      8,
      9,
      10,
      11
    ],
    "mode": "median",
    "context": "Class 10 statistical frequency dots 10"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "dotPlot",
    "values": [
      1,
      1,
      1,
      1,
      1,
      2,
      3,
      4,
      4,
      5,
      6,
      7
    ],
    "mode": "mode",
    "context": "Class 10 statistical frequency dots 11"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "dotPlot",
    "values": [
      2,
      2,
      2,
      2,
      2,
      3,
      4,
      5,
      5,
      6,
      7,
      8
    ],
    "mode": "range",
    "context": "Class 10 statistical frequency dots 12"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "dotPlot",
    "values": [
      3,
      3,
      3,
      3,
      3,
      4,
      5,
      6,
      6,
      7,
      8,
      9
    ],
    "mode": "median",
    "context": "Class 10 statistical frequency dots 13"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "dotPlot",
    "values": [
      4,
      4,
      4,
      4,
      4,
      5,
      6,
      7,
      7,
      8,
      9,
      10
    ],
    "mode": "mode",
    "context": "Class 10 statistical frequency dots 14"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "dotPlot",
    "values": [
      5,
      5,
      5,
      5,
      5,
      6,
      7,
      8,
      8,
      9,
      10,
      11
    ],
    "mode": "range",
    "context": "Class 10 statistical frequency dots 15"
  },
  {
    "chapterId": "c10-probability",
    "kind": "pieAngle",
    "counts": [
      4,
      6,
      8,
      6
    ],
    "index": 0,
    "mode": "count",
    "context": "Class 10 sector probability 1"
  },
  {
    "chapterId": "c10-probability",
    "kind": "pieAngle",
    "counts": [
      3,
      4,
      5,
      6
    ],
    "index": 1,
    "mode": "angle",
    "context": "Class 10 sector probability 2"
  },
  {
    "chapterId": "c10-probability",
    "kind": "pieAngle",
    "counts": [
      5,
      3,
      7,
      5
    ],
    "index": 2,
    "mode": "count",
    "context": "Class 10 sector probability 3"
  },
  {
    "chapterId": "c10-probability",
    "kind": "pieAngle",
    "counts": [
      8,
      6,
      6,
      10
    ],
    "index": 3,
    "mode": "angle",
    "context": "Class 10 sector probability 4"
  },
  {
    "chapterId": "c10-probability",
    "kind": "pieAngle",
    "counts": [
      9,
      9,
      6,
      12
    ],
    "index": 0,
    "mode": "count",
    "context": "Class 10 sector probability 5"
  },
  {
    "chapterId": "c10-probability",
    "kind": "pieAngle",
    "counts": [
      12,
      8,
      10,
      10
    ],
    "index": 1,
    "mode": "angle",
    "context": "Class 10 sector probability 6"
  },
  {
    "chapterId": "c10-probability",
    "kind": "pieAngle",
    "counts": [
      2,
      3,
      4,
      3
    ],
    "index": 2,
    "mode": "count",
    "context": "Class 10 sector probability 7"
  },
  {
    "chapterId": "c10-probability",
    "kind": "pieAngle",
    "counts": [
      4,
      6,
      8,
      6
    ],
    "index": 3,
    "mode": "angle",
    "context": "Class 10 sector probability 8"
  },
  {
    "chapterId": "c10-probability",
    "kind": "pieAngle",
    "counts": [
      3,
      4,
      5,
      6
    ],
    "index": 0,
    "mode": "count",
    "context": "Class 10 sector probability 9"
  },
  {
    "chapterId": "c10-probability",
    "kind": "pieAngle",
    "counts": [
      5,
      3,
      7,
      5
    ],
    "index": 1,
    "mode": "angle",
    "context": "Class 10 sector probability 10"
  },
  {
    "chapterId": "c10-probability",
    "kind": "pieAngle",
    "counts": [
      8,
      6,
      6,
      10
    ],
    "index": 2,
    "mode": "count",
    "context": "Class 10 sector probability 11"
  },
  {
    "chapterId": "c10-probability",
    "kind": "pieAngle",
    "counts": [
      9,
      9,
      6,
      12
    ],
    "index": 3,
    "mode": "angle",
    "context": "Class 10 sector probability 12"
  },
  {
    "chapterId": "c10-probability",
    "kind": "pieAngle",
    "counts": [
      12,
      8,
      10,
      10
    ],
    "index": 0,
    "mode": "count",
    "context": "Class 10 sector probability 13"
  },
  {
    "chapterId": "c10-probability",
    "kind": "pieAngle",
    "counts": [
      2,
      3,
      4,
      3
    ],
    "index": 1,
    "mode": "angle",
    "context": "Class 10 sector probability 14"
  },
  {
    "chapterId": "c10-probability",
    "kind": "pieAngle",
    "counts": [
      4,
      6,
      8,
      6
    ],
    "index": 2,
    "mode": "count",
    "context": "Class 10 sector probability 15"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "stemLeaf",
    "values": [
      16,
      19,
      22,
      22,
      25,
      28,
      28,
      31,
      34,
      34,
      37
    ],
    "mode": "median",
    "context": "Class 10 median-from-stems 1"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "stemLeaf",
    "values": [
      20,
      23,
      26,
      26,
      29,
      32,
      32,
      35,
      38,
      38,
      41
    ],
    "mode": "range",
    "context": "Class 10 median-from-stems 2"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "stemLeaf",
    "values": [
      24,
      27,
      30,
      30,
      33,
      36,
      36,
      39,
      42,
      42,
      45
    ],
    "mode": "median",
    "context": "Class 10 median-from-stems 3"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "stemLeaf",
    "values": [
      28,
      31,
      34,
      34,
      37,
      40,
      40,
      43,
      46,
      46,
      49
    ],
    "mode": "range",
    "context": "Class 10 median-from-stems 4"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "stemLeaf",
    "values": [
      32,
      35,
      38,
      38,
      41,
      44,
      44,
      47,
      50,
      50,
      53
    ],
    "mode": "median",
    "context": "Class 10 median-from-stems 5"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "stemLeaf",
    "values": [
      36,
      39,
      42,
      42,
      45,
      48,
      48,
      51,
      54,
      54,
      57
    ],
    "mode": "range",
    "context": "Class 10 median-from-stems 6"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "stemLeaf",
    "values": [
      40,
      43,
      46,
      46,
      49,
      52,
      52,
      55,
      58,
      58,
      61
    ],
    "mode": "median",
    "context": "Class 10 median-from-stems 7"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "stemLeaf",
    "values": [
      44,
      47,
      50,
      50,
      53,
      56,
      56,
      59,
      62,
      62,
      65
    ],
    "mode": "range",
    "context": "Class 10 median-from-stems 8"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "stemLeaf",
    "values": [
      48,
      51,
      54,
      54,
      57,
      60,
      60,
      63,
      66,
      66,
      69
    ],
    "mode": "median",
    "context": "Class 10 median-from-stems 9"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "stemLeaf",
    "values": [
      52,
      55,
      58,
      58,
      61,
      64,
      64,
      67,
      70,
      70,
      73
    ],
    "mode": "range",
    "context": "Class 10 median-from-stems 10"
  },
  {
    "chapterId": "c10-coordinate-geometry",
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
    "context": "Optional shortest weighted network 1"
  },
  {
    "chapterId": "c10-coordinate-geometry",
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
    "context": "Optional shortest weighted network 2"
  },
  {
    "chapterId": "c10-coordinate-geometry",
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
    "context": "Optional shortest weighted network 3"
  },
  {
    "chapterId": "c10-coordinate-geometry",
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
    "context": "Optional shortest weighted network 4"
  },
  {
    "chapterId": "c10-coordinate-geometry",
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
    "context": "Optional shortest weighted network 5"
  },
  {
    "chapterId": "c10-coordinate-geometry",
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
    "context": "Optional shortest weighted network 6"
  },
  {
    "chapterId": "c10-coordinate-geometry",
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
    "context": "Optional shortest weighted network 7"
  },
  {
    "chapterId": "c10-coordinate-geometry",
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
    "context": "Optional shortest weighted network 8"
  },
  {
    "chapterId": "c10-coordinate-geometry",
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
    "context": "Optional shortest weighted network 9"
  },
  {
    "chapterId": "c10-coordinate-geometry",
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
    "context": "Optional shortest weighted network 10"
  }
];
const data={};for(const {chapterId,kind,...p} of specs)(data[chapterId]||={examples:[]}).examples.push(makeInvestigation(kind,p));
export default data;
