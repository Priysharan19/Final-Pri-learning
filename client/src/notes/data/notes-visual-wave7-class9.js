// Class 9 figure-led original learning investigations.
import { makeInvestigation } from '../visualInvestigationFactory.js';
const specs=[
  {
    "chapterId": "c9-probability",
    "kind": "dotPlot",
    "values": [
      0,
      0,
      0,
      0,
      0,
      1,
      2,
      2,
      3,
      4,
      5,
      6
    ],
    "mode": "median",
    "context": "Class 9 recorded outcomes 1"
  },
  {
    "chapterId": "c9-probability",
    "kind": "dotPlot",
    "values": [
      1,
      1,
      1,
      1,
      1,
      2,
      3,
      3,
      4,
      5,
      6,
      7
    ],
    "mode": "mode",
    "context": "Class 9 recorded outcomes 2"
  },
  {
    "chapterId": "c9-probability",
    "kind": "dotPlot",
    "values": [
      2,
      2,
      2,
      2,
      2,
      3,
      4,
      4,
      5,
      6,
      7,
      8
    ],
    "mode": "range",
    "context": "Class 9 recorded outcomes 3"
  },
  {
    "chapterId": "c9-probability",
    "kind": "dotPlot",
    "values": [
      3,
      3,
      3,
      3,
      3,
      4,
      5,
      5,
      6,
      7,
      8,
      9
    ],
    "mode": "median",
    "context": "Class 9 recorded outcomes 4"
  },
  {
    "chapterId": "c9-probability",
    "kind": "dotPlot",
    "values": [
      4,
      4,
      4,
      4,
      4,
      5,
      6,
      6,
      7,
      8,
      9,
      10
    ],
    "mode": "mode",
    "context": "Class 9 recorded outcomes 5"
  },
  {
    "chapterId": "c9-probability",
    "kind": "dotPlot",
    "values": [
      5,
      5,
      5,
      5,
      5,
      6,
      7,
      7,
      8,
      9,
      10,
      11
    ],
    "mode": "range",
    "context": "Class 9 recorded outcomes 6"
  },
  {
    "chapterId": "c9-probability",
    "kind": "dotPlot",
    "values": [
      0,
      0,
      0,
      0,
      0,
      1,
      2,
      2,
      3,
      4,
      5,
      6
    ],
    "mode": "median",
    "context": "Class 9 recorded outcomes 7"
  },
  {
    "chapterId": "c9-probability",
    "kind": "dotPlot",
    "values": [
      1,
      1,
      1,
      1,
      1,
      2,
      3,
      3,
      4,
      5,
      6,
      7
    ],
    "mode": "mode",
    "context": "Class 9 recorded outcomes 8"
  },
  {
    "chapterId": "c9-probability",
    "kind": "dotPlot",
    "values": [
      2,
      2,
      2,
      2,
      2,
      3,
      4,
      4,
      5,
      6,
      7,
      8
    ],
    "mode": "range",
    "context": "Class 9 recorded outcomes 9"
  },
  {
    "chapterId": "c9-probability",
    "kind": "dotPlot",
    "values": [
      3,
      3,
      3,
      3,
      3,
      4,
      5,
      5,
      6,
      7,
      8,
      9
    ],
    "mode": "median",
    "context": "Class 9 recorded outcomes 10"
  },
  {
    "chapterId": "c9-probability",
    "kind": "dotPlot",
    "values": [
      4,
      4,
      4,
      4,
      4,
      5,
      6,
      6,
      7,
      8,
      9,
      10
    ],
    "mode": "mode",
    "context": "Class 9 recorded outcomes 11"
  },
  {
    "chapterId": "c9-probability",
    "kind": "dotPlot",
    "values": [
      5,
      5,
      5,
      5,
      5,
      6,
      7,
      7,
      8,
      9,
      10,
      11
    ],
    "mode": "range",
    "context": "Class 9 recorded outcomes 12"
  },
  {
    "chapterId": "c9-probability",
    "kind": "dotPlot",
    "values": [
      0,
      0,
      0,
      0,
      0,
      1,
      2,
      2,
      3,
      4,
      5,
      6
    ],
    "mode": "median",
    "context": "Class 9 recorded outcomes 13"
  },
  {
    "chapterId": "c9-probability",
    "kind": "dotPlot",
    "values": [
      1,
      1,
      1,
      1,
      1,
      2,
      3,
      3,
      4,
      5,
      6,
      7
    ],
    "mode": "mode",
    "context": "Class 9 recorded outcomes 14"
  },
  {
    "chapterId": "c9-probability",
    "kind": "dotPlot",
    "values": [
      2,
      2,
      2,
      2,
      2,
      3,
      4,
      4,
      5,
      6,
      7,
      8
    ],
    "mode": "range",
    "context": "Class 9 recorded outcomes 15"
  },
  {
    "chapterId": "c9-probability",
    "kind": "pieAngle",
    "counts": [
      8,
      6,
      6,
      10
    ],
    "index": 0,
    "mode": "count",
    "context": "Class 9 experimental sectors 1"
  },
  {
    "chapterId": "c9-probability",
    "kind": "pieAngle",
    "counts": [
      9,
      9,
      6,
      12
    ],
    "index": 1,
    "mode": "angle",
    "context": "Class 9 experimental sectors 2"
  },
  {
    "chapterId": "c9-probability",
    "kind": "pieAngle",
    "counts": [
      12,
      8,
      10,
      10
    ],
    "index": 2,
    "mode": "count",
    "context": "Class 9 experimental sectors 3"
  },
  {
    "chapterId": "c9-probability",
    "kind": "pieAngle",
    "counts": [
      2,
      3,
      4,
      3
    ],
    "index": 3,
    "mode": "angle",
    "context": "Class 9 experimental sectors 4"
  },
  {
    "chapterId": "c9-probability",
    "kind": "pieAngle",
    "counts": [
      4,
      6,
      8,
      6
    ],
    "index": 0,
    "mode": "count",
    "context": "Class 9 experimental sectors 5"
  },
  {
    "chapterId": "c9-probability",
    "kind": "pieAngle",
    "counts": [
      3,
      4,
      5,
      6
    ],
    "index": 1,
    "mode": "angle",
    "context": "Class 9 experimental sectors 6"
  },
  {
    "chapterId": "c9-probability",
    "kind": "pieAngle",
    "counts": [
      5,
      3,
      7,
      5
    ],
    "index": 2,
    "mode": "count",
    "context": "Class 9 experimental sectors 7"
  },
  {
    "chapterId": "c9-probability",
    "kind": "pieAngle",
    "counts": [
      8,
      6,
      6,
      10
    ],
    "index": 3,
    "mode": "angle",
    "context": "Class 9 experimental sectors 8"
  },
  {
    "chapterId": "c9-probability",
    "kind": "pieAngle",
    "counts": [
      9,
      9,
      6,
      12
    ],
    "index": 0,
    "mode": "count",
    "context": "Class 9 experimental sectors 9"
  },
  {
    "chapterId": "c9-probability",
    "kind": "pieAngle",
    "counts": [
      12,
      8,
      10,
      10
    ],
    "index": 1,
    "mode": "angle",
    "context": "Class 9 experimental sectors 10"
  },
  {
    "chapterId": "c9-probability",
    "kind": "pieAngle",
    "counts": [
      2,
      3,
      4,
      3
    ],
    "index": 2,
    "mode": "count",
    "context": "Class 9 experimental sectors 11"
  },
  {
    "chapterId": "c9-probability",
    "kind": "pieAngle",
    "counts": [
      4,
      6,
      8,
      6
    ],
    "index": 3,
    "mode": "angle",
    "context": "Class 9 experimental sectors 12"
  },
  {
    "chapterId": "c9-probability",
    "kind": "pieAngle",
    "counts": [
      3,
      4,
      5,
      6
    ],
    "index": 0,
    "mode": "count",
    "context": "Class 9 experimental sectors 13"
  },
  {
    "chapterId": "c9-probability",
    "kind": "pieAngle",
    "counts": [
      5,
      3,
      7,
      5
    ],
    "index": 1,
    "mode": "angle",
    "context": "Class 9 experimental sectors 14"
  },
  {
    "chapterId": "c9-probability",
    "kind": "pieAngle",
    "counts": [
      8,
      6,
      6,
      10
    ],
    "index": 2,
    "mode": "count",
    "context": "Class 9 experimental sectors 15"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "reflect",
    "A": [
      -5,
      -5
    ],
    "B": [
      -2,
      -5
    ],
    "C": [
      -4,
      -2
    ],
    "axis": "y",
    "mode": "area",
    "context": "Class 9 Cartesian reflection 1"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "reflect",
    "A": [
      -4,
      -4
    ],
    "B": [
      0,
      -4
    ],
    "C": [
      -3,
      0
    ],
    "axis": "x",
    "mode": "coordinate",
    "context": "Class 9 Cartesian reflection 2"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "reflect",
    "A": [
      -3,
      -3
    ],
    "B": [
      2,
      -3
    ],
    "C": [
      -2,
      2
    ],
    "axis": "y",
    "mode": "coordinate",
    "context": "Class 9 Cartesian reflection 3"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "reflect",
    "A": [
      -2,
      -2
    ],
    "B": [
      4,
      -2
    ],
    "C": [
      -1,
      4
    ],
    "axis": "x",
    "mode": "coordinate",
    "context": "Class 9 Cartesian reflection 4"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "reflect",
    "A": [
      -1,
      -5
    ],
    "B": [
      6,
      -5
    ],
    "C": [
      0,
      2
    ],
    "axis": "y",
    "mode": "area",
    "context": "Class 9 Cartesian reflection 5"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "reflect",
    "A": [
      0,
      -4
    ],
    "B": [
      3,
      -4
    ],
    "C": [
      1,
      -1
    ],
    "axis": "x",
    "mode": "coordinate",
    "context": "Class 9 Cartesian reflection 6"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "reflect",
    "A": [
      1,
      -3
    ],
    "B": [
      5,
      -3
    ],
    "C": [
      2,
      1
    ],
    "axis": "y",
    "mode": "coordinate",
    "context": "Class 9 Cartesian reflection 7"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "reflect",
    "A": [
      -5,
      -2
    ],
    "B": [
      0,
      -2
    ],
    "C": [
      -4,
      3
    ],
    "axis": "x",
    "mode": "coordinate",
    "context": "Class 9 Cartesian reflection 8"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "reflect",
    "A": [
      -4,
      -5
    ],
    "B": [
      2,
      -5
    ],
    "C": [
      -3,
      1
    ],
    "axis": "y",
    "mode": "area",
    "context": "Class 9 Cartesian reflection 9"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "reflect",
    "A": [
      -3,
      -4
    ],
    "B": [
      4,
      -4
    ],
    "C": [
      -2,
      3
    ],
    "axis": "x",
    "mode": "coordinate",
    "context": "Class 9 Cartesian reflection 10"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "reflect",
    "A": [
      -2,
      -3
    ],
    "B": [
      1,
      -3
    ],
    "C": [
      -1,
      0
    ],
    "axis": "y",
    "mode": "coordinate",
    "context": "Class 9 Cartesian reflection 11"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "reflect",
    "A": [
      -1,
      -2
    ],
    "B": [
      3,
      -2
    ],
    "C": [
      0,
      2
    ],
    "axis": "x",
    "mode": "coordinate",
    "context": "Class 9 Cartesian reflection 12"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "reflect",
    "A": [
      0,
      -5
    ],
    "B": [
      5,
      -5
    ],
    "C": [
      1,
      0
    ],
    "axis": "y",
    "mode": "area",
    "context": "Class 9 Cartesian reflection 13"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "reflect",
    "A": [
      1,
      -4
    ],
    "B": [
      7,
      -4
    ],
    "C": [
      2,
      2
    ],
    "axis": "x",
    "mode": "coordinate",
    "context": "Class 9 Cartesian reflection 14"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "reflect",
    "A": [
      -5,
      -3
    ],
    "B": [
      2,
      -3
    ],
    "C": [
      -4,
      4
    ],
    "axis": "y",
    "mode": "coordinate",
    "context": "Class 9 Cartesian reflection 15"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "reflect",
    "A": [
      -4,
      -2
    ],
    "B": [
      -1,
      -2
    ],
    "C": [
      -3,
      1
    ],
    "axis": "x",
    "mode": "coordinate",
    "context": "Class 9 Cartesian reflection 16"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "reflect",
    "A": [
      -3,
      -5
    ],
    "B": [
      1,
      -5
    ],
    "C": [
      -2,
      -1
    ],
    "axis": "y",
    "mode": "area",
    "context": "Class 9 Cartesian reflection 17"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "reflect",
    "A": [
      -2,
      -4
    ],
    "B": [
      3,
      -4
    ],
    "C": [
      -1,
      1
    ],
    "axis": "x",
    "mode": "coordinate",
    "context": "Class 9 Cartesian reflection 18"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "reflect",
    "A": [
      -1,
      -3
    ],
    "B": [
      5,
      -3
    ],
    "C": [
      0,
      3
    ],
    "axis": "y",
    "mode": "coordinate",
    "context": "Class 9 Cartesian reflection 19"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "reflect",
    "A": [
      0,
      -2
    ],
    "B": [
      7,
      -2
    ],
    "C": [
      1,
      5
    ],
    "axis": "x",
    "mode": "coordinate",
    "context": "Class 9 Cartesian reflection 20"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -8,
      -5
    ],
    "B": [
      -4,
      -2
    ],
    "mode": "x",
    "context": "Class 9 distance-midpoint graph 1"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -7,
      -4
    ],
    "B": [
      -2,
      0
    ],
    "mode": "y",
    "context": "Class 9 distance-midpoint graph 2"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -6,
      -3
    ],
    "B": [
      0,
      2
    ],
    "mode": "distance2",
    "context": "Class 9 distance-midpoint graph 3"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -5,
      -2
    ],
    "B": [
      2,
      4
    ],
    "mode": "x",
    "context": "Class 9 distance-midpoint graph 4"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -4,
      -1
    ],
    "B": [
      4,
      6
    ],
    "mode": "y",
    "context": "Class 9 distance-midpoint graph 5"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -3,
      0
    ],
    "B": [
      6,
      3
    ],
    "mode": "distance2",
    "context": "Class 9 distance-midpoint graph 6"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -2,
      -5
    ],
    "B": [
      2,
      -1
    ],
    "mode": "x",
    "context": "Class 9 distance-midpoint graph 7"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -8,
      -4
    ],
    "B": [
      -3,
      1
    ],
    "mode": "y",
    "context": "Class 9 distance-midpoint graph 8"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -7,
      -3
    ],
    "B": [
      -1,
      3
    ],
    "mode": "distance2",
    "context": "Class 9 distance-midpoint graph 9"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -6,
      -2
    ],
    "B": [
      1,
      5
    ],
    "mode": "x",
    "context": "Class 9 distance-midpoint graph 10"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -5,
      -1
    ],
    "B": [
      3,
      2
    ],
    "mode": "y",
    "context": "Class 9 distance-midpoint graph 11"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -4,
      0
    ],
    "B": [
      5,
      4
    ],
    "mode": "distance2",
    "context": "Class 9 distance-midpoint graph 12"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -3,
      -5
    ],
    "B": [
      1,
      0
    ],
    "mode": "x",
    "context": "Class 9 distance-midpoint graph 13"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -2,
      -4
    ],
    "B": [
      3,
      2
    ],
    "mode": "y",
    "context": "Class 9 distance-midpoint graph 14"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -8,
      -3
    ],
    "B": [
      -2,
      4
    ],
    "mode": "distance2",
    "context": "Class 9 distance-midpoint graph 15"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -7,
      -2
    ],
    "B": [
      0,
      1
    ],
    "mode": "x",
    "context": "Class 9 distance-midpoint graph 16"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -6,
      -1
    ],
    "B": [
      2,
      3
    ],
    "mode": "y",
    "context": "Class 9 distance-midpoint graph 17"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -5,
      0
    ],
    "B": [
      4,
      5
    ],
    "mode": "distance2",
    "context": "Class 9 distance-midpoint graph 18"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -4,
      -5
    ],
    "B": [
      0,
      1
    ],
    "mode": "x",
    "context": "Class 9 distance-midpoint graph 19"
  },
  {
    "chapterId": "c9-coordinate-geometry",
    "kind": "midpoint",
    "A": [
      -3,
      -4
    ],
    "B": [
      2,
      3
    ],
    "mode": "y",
    "context": "Class 9 distance-midpoint graph 20"
  },
  {
    "chapterId": "c9-probability",
    "kind": "stemLeaf",
    "values": [
      18,
      21,
      24,
      24,
      27,
      30,
      30,
      33,
      36,
      36
    ],
    "mode": "range",
    "context": "Class 9 sample table 1"
  },
  {
    "chapterId": "c9-probability",
    "kind": "stemLeaf",
    "values": [
      21,
      24,
      27,
      27,
      30,
      33,
      33,
      36,
      39,
      39
    ],
    "mode": "median",
    "context": "Class 9 sample table 2"
  },
  {
    "chapterId": "c9-probability",
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
      42
    ],
    "mode": "range",
    "context": "Class 9 sample table 3"
  },
  {
    "chapterId": "c9-probability",
    "kind": "stemLeaf",
    "values": [
      27,
      30,
      33,
      33,
      36,
      39,
      39,
      42,
      45,
      45
    ],
    "mode": "median",
    "context": "Class 9 sample table 4"
  },
  {
    "chapterId": "c9-probability",
    "kind": "stemLeaf",
    "values": [
      30,
      33,
      36,
      36,
      39,
      42,
      42,
      45,
      48,
      48
    ],
    "mode": "range",
    "context": "Class 9 sample table 5"
  },
  {
    "chapterId": "c9-probability",
    "kind": "stemLeaf",
    "values": [
      33,
      36,
      39,
      39,
      42,
      45,
      45,
      48,
      51,
      51
    ],
    "mode": "median",
    "context": "Class 9 sample table 6"
  },
  {
    "chapterId": "c9-probability",
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
      54
    ],
    "mode": "range",
    "context": "Class 9 sample table 7"
  },
  {
    "chapterId": "c9-probability",
    "kind": "stemLeaf",
    "values": [
      39,
      42,
      45,
      45,
      48,
      51,
      51,
      54,
      57,
      57
    ],
    "mode": "median",
    "context": "Class 9 sample table 8"
  },
  {
    "chapterId": "c9-probability",
    "kind": "stemLeaf",
    "values": [
      42,
      45,
      48,
      48,
      51,
      54,
      54,
      57,
      60,
      60
    ],
    "mode": "range",
    "context": "Class 9 sample table 9"
  },
  {
    "chapterId": "c9-probability",
    "kind": "stemLeaf",
    "values": [
      45,
      48,
      51,
      51,
      54,
      57,
      57,
      60,
      63,
      63
    ],
    "mode": "median",
    "context": "Class 9 sample table 10"
  },
  {
    "chapterId": "c9-linear-polynomials",
    "kind": "motion",
    "times": [
      0,
      2,
      5,
      8
    ],
    "velocities": [
      2,
      3,
      1,
      2
    ],
    "mode": "peak",
    "context": "Optional speed-time graph exploration 1"
  },
  {
    "chapterId": "c9-linear-polynomials",
    "kind": "motion",
    "times": [
      0,
      2,
      5,
      8
    ],
    "velocities": [
      3,
      5,
      4,
      6
    ],
    "mode": "distance",
    "context": "Optional speed-time graph exploration 2"
  },
  {
    "chapterId": "c9-linear-polynomials",
    "kind": "motion",
    "times": [
      0,
      2,
      5,
      8
    ],
    "velocities": [
      4,
      7,
      7,
      4
    ],
    "mode": "peak",
    "context": "Optional speed-time graph exploration 3"
  },
  {
    "chapterId": "c9-linear-polynomials",
    "kind": "motion",
    "times": [
      0,
      2,
      5,
      8
    ],
    "velocities": [
      5,
      3,
      3,
      2
    ],
    "mode": "distance",
    "context": "Optional speed-time graph exploration 4"
  },
  {
    "chapterId": "c9-linear-polynomials",
    "kind": "motion",
    "times": [
      0,
      2,
      5,
      8
    ],
    "velocities": [
      2,
      5,
      6,
      6
    ],
    "mode": "peak",
    "context": "Optional speed-time graph exploration 5"
  },
  {
    "chapterId": "c9-linear-polynomials",
    "kind": "motion",
    "times": [
      0,
      2,
      5,
      8
    ],
    "velocities": [
      3,
      7,
      2,
      4
    ],
    "mode": "distance",
    "context": "Optional speed-time graph exploration 6"
  },
  {
    "chapterId": "c9-linear-polynomials",
    "kind": "motion",
    "times": [
      0,
      2,
      5,
      8
    ],
    "velocities": [
      4,
      3,
      5,
      2
    ],
    "mode": "peak",
    "context": "Optional speed-time graph exploration 7"
  },
  {
    "chapterId": "c9-linear-polynomials",
    "kind": "motion",
    "times": [
      0,
      2,
      5,
      8
    ],
    "velocities": [
      5,
      5,
      1,
      6
    ],
    "mode": "distance",
    "context": "Optional speed-time graph exploration 8"
  },
  {
    "chapterId": "c9-linear-polynomials",
    "kind": "motion",
    "times": [
      0,
      2,
      5,
      8
    ],
    "velocities": [
      2,
      7,
      4,
      4
    ],
    "mode": "peak",
    "context": "Optional speed-time graph exploration 9"
  },
  {
    "chapterId": "c9-linear-polynomials",
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
      7,
      2
    ],
    "mode": "distance",
    "context": "Optional speed-time graph exploration 10"
  }
];
const data={};for(const {chapterId,kind,...p} of specs)(data[chapterId]||={examples:[]}).examples.push(makeInvestigation(kind,p));
export default data;
