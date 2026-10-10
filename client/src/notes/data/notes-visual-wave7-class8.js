// Grade 8 original mathematical diagram investigations, loaded only for this grade.
import { makeInvestigation } from '../visualInvestigationFactory.js';
const specs=[
  {
    "chapterId": "c8-data-handling",
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
      5,
      6
    ],
    "mode": "mode",
    "context": "Class 8 visual frequency model 1"
  },
  {
    "chapterId": "c8-data-handling",
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
      6,
      7
    ],
    "mode": "median",
    "context": "Class 8 visual frequency model 2"
  },
  {
    "chapterId": "c8-data-handling",
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
      7,
      8
    ],
    "mode": "range",
    "context": "Class 8 visual frequency model 3"
  },
  {
    "chapterId": "c8-data-handling",
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
      8,
      9
    ],
    "mode": "mode",
    "context": "Class 8 visual frequency model 4"
  },
  {
    "chapterId": "c8-data-handling",
    "kind": "dotPlot",
    "values": [
      5,
      5,
      5,
      5,
      5,
      6,
      6,
      7,
      8,
      9,
      9,
      10
    ],
    "mode": "median",
    "context": "Class 8 visual frequency model 5"
  },
  {
    "chapterId": "c8-data-handling",
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
      5,
      6
    ],
    "mode": "range",
    "context": "Class 8 visual frequency model 6"
  },
  {
    "chapterId": "c8-data-handling",
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
      6,
      7
    ],
    "mode": "mode",
    "context": "Class 8 visual frequency model 7"
  },
  {
    "chapterId": "c8-data-handling",
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
      7,
      8
    ],
    "mode": "median",
    "context": "Class 8 visual frequency model 8"
  },
  {
    "chapterId": "c8-data-handling",
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
      8,
      9
    ],
    "mode": "range",
    "context": "Class 8 visual frequency model 9"
  },
  {
    "chapterId": "c8-data-handling",
    "kind": "dotPlot",
    "values": [
      5,
      5,
      5,
      5,
      5,
      6,
      6,
      7,
      8,
      9,
      9,
      10
    ],
    "mode": "mode",
    "context": "Class 8 visual frequency model 10"
  },
  {
    "chapterId": "c8-data-handling",
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
      5,
      6
    ],
    "mode": "median",
    "context": "Class 8 visual frequency model 11"
  },
  {
    "chapterId": "c8-data-handling",
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
      6,
      7
    ],
    "mode": "range",
    "context": "Class 8 visual frequency model 12"
  },
  {
    "chapterId": "c8-data-handling",
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
      7,
      8
    ],
    "mode": "mode",
    "context": "Class 8 visual frequency model 13"
  },
  {
    "chapterId": "c8-data-handling",
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
      8,
      9
    ],
    "mode": "median",
    "context": "Class 8 visual frequency model 14"
  },
  {
    "chapterId": "c8-data-handling",
    "kind": "dotPlot",
    "values": [
      5,
      5,
      5,
      5,
      5,
      6,
      6,
      7,
      8,
      9,
      9,
      10
    ],
    "mode": "range",
    "context": "Class 8 visual frequency model 15"
  },
  {
    "chapterId": "c8-data-handling",
    "kind": "pieAngle",
    "counts": [
      3,
      4,
      5,
      6
    ],
    "index": 0,
    "mode": "count",
    "context": "Class 8 percentage circle 1"
  },
  {
    "chapterId": "c8-comparing-quantities",
    "kind": "pieAngle",
    "counts": [
      5,
      3,
      7,
      5
    ],
    "index": 1,
    "mode": "angle",
    "context": "Class 8 percentage circle 2"
  },
  {
    "chapterId": "c8-data-handling",
    "kind": "pieAngle",
    "counts": [
      8,
      6,
      6,
      10
    ],
    "index": 2,
    "mode": "count",
    "context": "Class 8 percentage circle 3"
  },
  {
    "chapterId": "c8-comparing-quantities",
    "kind": "pieAngle",
    "counts": [
      9,
      9,
      6,
      12
    ],
    "index": 3,
    "mode": "angle",
    "context": "Class 8 percentage circle 4"
  },
  {
    "chapterId": "c8-data-handling",
    "kind": "pieAngle",
    "counts": [
      12,
      8,
      10,
      10
    ],
    "index": 0,
    "mode": "count",
    "context": "Class 8 percentage circle 5"
  },
  {
    "chapterId": "c8-comparing-quantities",
    "kind": "pieAngle",
    "counts": [
      2,
      3,
      4,
      3
    ],
    "index": 1,
    "mode": "angle",
    "context": "Class 8 percentage circle 6"
  },
  {
    "chapterId": "c8-data-handling",
    "kind": "pieAngle",
    "counts": [
      4,
      6,
      8,
      6
    ],
    "index": 2,
    "mode": "count",
    "context": "Class 8 percentage circle 7"
  },
  {
    "chapterId": "c8-comparing-quantities",
    "kind": "pieAngle",
    "counts": [
      3,
      4,
      5,
      6
    ],
    "index": 3,
    "mode": "angle",
    "context": "Class 8 percentage circle 8"
  },
  {
    "chapterId": "c8-data-handling",
    "kind": "pieAngle",
    "counts": [
      5,
      3,
      7,
      5
    ],
    "index": 0,
    "mode": "count",
    "context": "Class 8 percentage circle 9"
  },
  {
    "chapterId": "c8-comparing-quantities",
    "kind": "pieAngle",
    "counts": [
      8,
      6,
      6,
      10
    ],
    "index": 1,
    "mode": "angle",
    "context": "Class 8 percentage circle 10"
  },
  {
    "chapterId": "c8-data-handling",
    "kind": "pieAngle",
    "counts": [
      9,
      9,
      6,
      12
    ],
    "index": 2,
    "mode": "count",
    "context": "Class 8 percentage circle 11"
  },
  {
    "chapterId": "c8-comparing-quantities",
    "kind": "pieAngle",
    "counts": [
      12,
      8,
      10,
      10
    ],
    "index": 3,
    "mode": "angle",
    "context": "Class 8 percentage circle 12"
  },
  {
    "chapterId": "c8-data-handling",
    "kind": "pieAngle",
    "counts": [
      2,
      3,
      4,
      3
    ],
    "index": 0,
    "mode": "count",
    "context": "Class 8 percentage circle 13"
  },
  {
    "chapterId": "c8-comparing-quantities",
    "kind": "pieAngle",
    "counts": [
      4,
      6,
      8,
      6
    ],
    "index": 1,
    "mode": "angle",
    "context": "Class 8 percentage circle 14"
  },
  {
    "chapterId": "c8-data-handling",
    "kind": "pieAngle",
    "counts": [
      3,
      4,
      5,
      6
    ],
    "index": 2,
    "mode": "count",
    "context": "Class 8 percentage circle 15"
  },
  {
    "chapterId": "c8-graphs",
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
      -1
    ],
    "axis": "y",
    "mode": "area",
    "context": "Class 8 reflected shape 1"
  },
  {
    "chapterId": "c8-quadrilaterals",
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
      1
    ],
    "axis": "x",
    "mode": "coordinate",
    "context": "Class 8 reflected shape 2"
  },
  {
    "chapterId": "c8-graphs",
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
      3
    ],
    "axis": "y",
    "mode": "coordinate",
    "context": "Class 8 reflected shape 3"
  },
  {
    "chapterId": "c8-quadrilaterals",
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
      2
    ],
    "axis": "x",
    "mode": "coordinate",
    "context": "Class 8 reflected shape 4"
  },
  {
    "chapterId": "c8-graphs",
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
    "mode": "area",
    "context": "Class 8 reflected shape 5"
  },
  {
    "chapterId": "c8-quadrilaterals",
    "kind": "reflect",
    "A": [
      0,
      -4
    ],
    "B": [
      4,
      -4
    ],
    "C": [
      1,
      1
    ],
    "axis": "x",
    "mode": "coordinate",
    "context": "Class 8 reflected shape 6"
  },
  {
    "chapterId": "c8-graphs",
    "kind": "reflect",
    "A": [
      1,
      -3
    ],
    "B": [
      6,
      -3
    ],
    "C": [
      2,
      0
    ],
    "axis": "y",
    "mode": "coordinate",
    "context": "Class 8 reflected shape 7"
  },
  {
    "chapterId": "c8-quadrilaterals",
    "kind": "reflect",
    "A": [
      -5,
      -2
    ],
    "B": [
      1,
      -2
    ],
    "C": [
      -4,
      2
    ],
    "axis": "x",
    "mode": "coordinate",
    "context": "Class 8 reflected shape 8"
  },
  {
    "chapterId": "c8-graphs",
    "kind": "reflect",
    "A": [
      -4,
      -1
    ],
    "B": [
      -1,
      -1
    ],
    "C": [
      -3,
      4
    ],
    "axis": "y",
    "mode": "area",
    "context": "Class 8 reflected shape 9"
  },
  {
    "chapterId": "c8-quadrilaterals",
    "kind": "reflect",
    "A": [
      -3,
      0
    ],
    "B": [
      1,
      0
    ],
    "C": [
      -2,
      3
    ],
    "axis": "x",
    "mode": "coordinate",
    "context": "Class 8 reflected shape 10"
  },
  {
    "chapterId": "c8-graphs",
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
      0
    ],
    "axis": "y",
    "mode": "coordinate",
    "context": "Class 8 reflected shape 11"
  },
  {
    "chapterId": "c8-quadrilaterals",
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
      2
    ],
    "axis": "x",
    "mode": "coordinate",
    "context": "Class 8 reflected shape 12"
  },
  {
    "chapterId": "c8-graphs",
    "kind": "reflect",
    "A": [
      0,
      -2
    ],
    "B": [
      3,
      -2
    ],
    "C": [
      1,
      1
    ],
    "axis": "y",
    "mode": "area",
    "context": "Class 8 reflected shape 13"
  },
  {
    "chapterId": "c8-quadrilaterals",
    "kind": "reflect",
    "A": [
      1,
      -1
    ],
    "B": [
      5,
      -1
    ],
    "C": [
      2,
      3
    ],
    "axis": "x",
    "mode": "coordinate",
    "context": "Class 8 reflected shape 14"
  },
  {
    "chapterId": "c8-graphs",
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
      5
    ],
    "axis": "y",
    "mode": "coordinate",
    "context": "Class 8 reflected shape 15"
  },
  {
    "chapterId": "c8-quadrilaterals",
    "kind": "reflect",
    "A": [
      -4,
      -4
    ],
    "B": [
      2,
      -4
    ],
    "C": [
      -3,
      -1
    ],
    "axis": "x",
    "mode": "coordinate",
    "context": "Class 8 reflected shape 16"
  },
  {
    "chapterId": "c8-graphs",
    "kind": "reflect",
    "A": [
      -3,
      -3
    ],
    "B": [
      0,
      -3
    ],
    "C": [
      -2,
      1
    ],
    "axis": "y",
    "mode": "area",
    "context": "Class 8 reflected shape 17"
  },
  {
    "chapterId": "c8-quadrilaterals",
    "kind": "reflect",
    "A": [
      -2,
      -2
    ],
    "B": [
      2,
      -2
    ],
    "C": [
      -1,
      3
    ],
    "axis": "x",
    "mode": "coordinate",
    "context": "Class 8 reflected shape 18"
  },
  {
    "chapterId": "c8-graphs",
    "kind": "reflect",
    "A": [
      -1,
      -1
    ],
    "B": [
      4,
      -1
    ],
    "C": [
      0,
      2
    ],
    "axis": "y",
    "mode": "coordinate",
    "context": "Class 8 reflected shape 19"
  },
  {
    "chapterId": "c8-quadrilaterals",
    "kind": "reflect",
    "A": [
      0,
      0
    ],
    "B": [
      6,
      0
    ],
    "C": [
      1,
      4
    ],
    "axis": "x",
    "mode": "coordinate",
    "context": "Class 8 reflected shape 20"
  },
  {
    "chapterId": "c8-graphs",
    "kind": "midpoint",
    "A": [
      -6,
      -3
    ],
    "B": [
      -3,
      -1
    ],
    "mode": "x",
    "context": "Class 8 endpoint calculation 1"
  },
  {
    "chapterId": "c8-graphs",
    "kind": "midpoint",
    "A": [
      -5,
      -1
    ],
    "B": [
      -1,
      2
    ],
    "mode": "y",
    "context": "Class 8 endpoint calculation 2"
  },
  {
    "chapterId": "c8-graphs",
    "kind": "midpoint",
    "A": [
      -4,
      1
    ],
    "B": [
      1,
      5
    ],
    "mode": "distance2",
    "context": "Class 8 endpoint calculation 3"
  },
  {
    "chapterId": "c8-graphs",
    "kind": "midpoint",
    "A": [
      -3,
      -3
    ],
    "B": [
      3,
      2
    ],
    "mode": "x",
    "context": "Class 8 endpoint calculation 4"
  },
  {
    "chapterId": "c8-graphs",
    "kind": "midpoint",
    "A": [
      -2,
      -1
    ],
    "B": [
      1,
      5
    ],
    "mode": "y",
    "context": "Class 8 endpoint calculation 5"
  },
  {
    "chapterId": "c8-graphs",
    "kind": "midpoint",
    "A": [
      -1,
      1
    ],
    "B": [
      3,
      3
    ],
    "mode": "distance2",
    "context": "Class 8 endpoint calculation 6"
  },
  {
    "chapterId": "c8-graphs",
    "kind": "midpoint",
    "A": [
      -6,
      -3
    ],
    "B": [
      -1,
      0
    ],
    "mode": "x",
    "context": "Class 8 endpoint calculation 7"
  },
  {
    "chapterId": "c8-graphs",
    "kind": "midpoint",
    "A": [
      -5,
      -1
    ],
    "B": [
      1,
      3
    ],
    "mode": "y",
    "context": "Class 8 endpoint calculation 8"
  },
  {
    "chapterId": "c8-graphs",
    "kind": "midpoint",
    "A": [
      -4,
      1
    ],
    "B": [
      -1,
      6
    ],
    "mode": "distance2",
    "context": "Class 8 endpoint calculation 9"
  },
  {
    "chapterId": "c8-graphs",
    "kind": "midpoint",
    "A": [
      -3,
      -3
    ],
    "B": [
      1,
      3
    ],
    "mode": "x",
    "context": "Class 8 endpoint calculation 10"
  },
  {
    "chapterId": "c8-graphs",
    "kind": "midpoint",
    "A": [
      -2,
      -1
    ],
    "B": [
      3,
      1
    ],
    "mode": "y",
    "context": "Class 8 endpoint calculation 11"
  },
  {
    "chapterId": "c8-graphs",
    "kind": "midpoint",
    "A": [
      -1,
      1
    ],
    "B": [
      5,
      4
    ],
    "mode": "distance2",
    "context": "Class 8 endpoint calculation 12"
  },
  {
    "chapterId": "c8-graphs",
    "kind": "midpoint",
    "A": [
      -6,
      -3
    ],
    "B": [
      -3,
      1
    ],
    "mode": "x",
    "context": "Class 8 endpoint calculation 13"
  },
  {
    "chapterId": "c8-graphs",
    "kind": "midpoint",
    "A": [
      -5,
      -1
    ],
    "B": [
      -1,
      4
    ],
    "mode": "y",
    "context": "Class 8 endpoint calculation 14"
  },
  {
    "chapterId": "c8-graphs",
    "kind": "midpoint",
    "A": [
      -4,
      1
    ],
    "B": [
      1,
      7
    ],
    "mode": "distance2",
    "context": "Class 8 endpoint calculation 15"
  },
  {
    "chapterId": "c8-data-handling",
    "kind": "stemLeaf",
    "values": [
      13,
      16,
      19,
      22,
      21,
      24,
      27,
      30,
      29,
      32,
      35
    ],
    "mode": "median",
    "context": "Class 8 ordered stem-leaf data 1"
  },
  {
    "chapterId": "c8-data-handling",
    "kind": "stemLeaf",
    "values": [
      16,
      19,
      22,
      25,
      24,
      27,
      30,
      33,
      32,
      35,
      38
    ],
    "mode": "range",
    "context": "Class 8 ordered stem-leaf data 2"
  },
  {
    "chapterId": "c8-data-handling",
    "kind": "stemLeaf",
    "values": [
      19,
      22,
      25,
      28,
      27,
      30,
      33,
      36,
      35,
      38,
      41
    ],
    "mode": "median",
    "context": "Class 8 ordered stem-leaf data 3"
  },
  {
    "chapterId": "c8-data-handling",
    "kind": "stemLeaf",
    "values": [
      22,
      25,
      28,
      31,
      30,
      33,
      36,
      39,
      38,
      41,
      44
    ],
    "mode": "range",
    "context": "Class 8 ordered stem-leaf data 4"
  },
  {
    "chapterId": "c8-data-handling",
    "kind": "stemLeaf",
    "values": [
      25,
      28,
      31,
      34,
      33,
      36,
      39,
      42,
      41,
      44,
      47
    ],
    "mode": "median",
    "context": "Class 8 ordered stem-leaf data 5"
  },
  {
    "chapterId": "c8-data-handling",
    "kind": "stemLeaf",
    "values": [
      28,
      31,
      34,
      37,
      36,
      39,
      42,
      45,
      44,
      47,
      50
    ],
    "mode": "range",
    "context": "Class 8 ordered stem-leaf data 6"
  },
  {
    "chapterId": "c8-data-handling",
    "kind": "stemLeaf",
    "values": [
      31,
      34,
      37,
      40,
      39,
      42,
      45,
      48,
      47,
      50,
      53
    ],
    "mode": "median",
    "context": "Class 8 ordered stem-leaf data 7"
  },
  {
    "chapterId": "c8-data-handling",
    "kind": "stemLeaf",
    "values": [
      34,
      37,
      40,
      43,
      42,
      45,
      48,
      51,
      50,
      53,
      56
    ],
    "mode": "range",
    "context": "Class 8 ordered stem-leaf data 8"
  },
  {
    "chapterId": "c8-data-handling",
    "kind": "stemLeaf",
    "values": [
      37,
      40,
      43,
      46,
      45,
      48,
      51,
      54,
      53,
      56,
      59
    ],
    "mode": "median",
    "context": "Class 8 ordered stem-leaf data 9"
  },
  {
    "chapterId": "c8-data-handling",
    "kind": "stemLeaf",
    "values": [
      40,
      43,
      46,
      49,
      48,
      51,
      54,
      57,
      56,
      59,
      62
    ],
    "mode": "range",
    "context": "Class 8 ordered stem-leaf data 10"
  },
  {
    "chapterId": "c8-data-handling",
    "kind": "stemLeaf",
    "values": [
      43,
      46,
      49,
      52,
      51,
      54,
      57,
      60,
      59,
      62,
      65
    ],
    "mode": "median",
    "context": "Class 8 ordered stem-leaf data 11"
  },
  {
    "chapterId": "c8-data-handling",
    "kind": "stemLeaf",
    "values": [
      46,
      49,
      52,
      55,
      54,
      57,
      60,
      63,
      62,
      65,
      68
    ],
    "mode": "range",
    "context": "Class 8 ordered stem-leaf data 12"
  },
  {
    "chapterId": "c8-data-handling",
    "kind": "stemLeaf",
    "values": [
      49,
      52,
      55,
      58,
      57,
      60,
      63,
      66,
      65,
      68,
      71
    ],
    "mode": "median",
    "context": "Class 8 ordered stem-leaf data 13"
  },
  {
    "chapterId": "c8-data-handling",
    "kind": "stemLeaf",
    "values": [
      52,
      55,
      58,
      61,
      60,
      63,
      66,
      69,
      68,
      71,
      74
    ],
    "mode": "range",
    "context": "Class 8 ordered stem-leaf data 14"
  },
  {
    "chapterId": "c8-data-handling",
    "kind": "stemLeaf",
    "values": [
      55,
      58,
      61,
      64,
      63,
      66,
      69,
      72,
      71,
      74,
      77
    ],
    "mode": "median",
    "context": "Class 8 ordered stem-leaf data 15"
  }
];
const data={};for(const {chapterId,kind,...p} of specs)(data[chapterId]||={examples:[]}).examples.push(makeInvestigation(kind,p));
export default data;
