// Grade 7 original SVG-backed visual investigations, optional extension contexts identified.
import { makeInvestigation } from '../visualInvestigationFactory.js';
const specs=[
  {
    "chapterId": "c7-large-numbers-current",
    "kind": "dotPlot",
    "values": [
      1,
      1,
      1,
      1,
      2,
      3,
      3,
      4,
      5,
      5,
      5,
      5,
      6
    ],
    "mode": "range",
    "context": "Class 7 stacked observations 1"
  },
  {
    "chapterId": "c7-number-play-current",
    "kind": "dotPlot",
    "values": [
      2,
      2,
      2,
      2,
      3,
      4,
      4,
      5,
      6,
      6,
      6,
      6,
      7
    ],
    "mode": "median",
    "context": "Class 7 stacked observations 2"
  },
  {
    "chapterId": "c7-number-play-current",
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
      7,
      7,
      7,
      8
    ],
    "mode": "mode",
    "context": "Class 7 stacked observations 3"
  },
  {
    "chapterId": "c7-large-numbers-current",
    "kind": "dotPlot",
    "values": [
      4,
      4,
      4,
      4,
      5,
      6,
      6,
      7,
      8,
      8,
      8,
      8,
      9
    ],
    "mode": "range",
    "context": "Class 7 stacked observations 4"
  },
  {
    "chapterId": "c7-number-play-current",
    "kind": "dotPlot",
    "values": [
      5,
      5,
      5,
      5,
      6,
      7,
      7,
      8,
      9,
      9,
      9,
      9,
      10
    ],
    "mode": "median",
    "context": "Class 7 stacked observations 5"
  },
  {
    "chapterId": "c7-number-play-current",
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
      5,
      5,
      5,
      6
    ],
    "mode": "mode",
    "context": "Class 7 stacked observations 6"
  },
  {
    "chapterId": "c7-large-numbers-current",
    "kind": "dotPlot",
    "values": [
      2,
      2,
      2,
      2,
      3,
      4,
      4,
      5,
      6,
      6,
      6,
      6,
      7
    ],
    "mode": "range",
    "context": "Class 7 stacked observations 7"
  },
  {
    "chapterId": "c7-number-play-current",
    "kind": "dotPlot",
    "values": [
      3,
      3,
      3,
      3,
      4,
      5,
      5,
      6,
      7,
      7,
      7,
      7,
      8
    ],
    "mode": "median",
    "context": "Class 7 stacked observations 8"
  },
  {
    "chapterId": "c7-number-play-current",
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
      8,
      8,
      8,
      9
    ],
    "mode": "mode",
    "context": "Class 7 stacked observations 9"
  },
  {
    "chapterId": "c7-large-numbers-current",
    "kind": "dotPlot",
    "values": [
      5,
      5,
      5,
      5,
      6,
      7,
      7,
      8,
      9,
      9,
      9,
      9,
      10
    ],
    "mode": "range",
    "context": "Class 7 stacked observations 10"
  },
  {
    "chapterId": "c7-number-play-current",
    "kind": "dotPlot",
    "values": [
      1,
      1,
      1,
      1,
      2,
      3,
      3,
      4,
      5,
      5,
      5,
      5,
      6
    ],
    "mode": "median",
    "context": "Class 7 stacked observations 11"
  },
  {
    "chapterId": "c7-number-play-current",
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
      6,
      6,
      6,
      7
    ],
    "mode": "mode",
    "context": "Class 7 stacked observations 12"
  },
  {
    "chapterId": "c7-large-numbers-current",
    "kind": "dotPlot",
    "values": [
      3,
      3,
      3,
      3,
      4,
      5,
      5,
      6,
      7,
      7,
      7,
      7,
      8
    ],
    "mode": "range",
    "context": "Class 7 stacked observations 13"
  },
  {
    "chapterId": "c7-number-play-current",
    "kind": "dotPlot",
    "values": [
      4,
      4,
      4,
      4,
      5,
      6,
      6,
      7,
      8,
      8,
      8,
      8,
      9
    ],
    "mode": "median",
    "context": "Class 7 stacked observations 14"
  },
  {
    "chapterId": "c7-number-play-current",
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
      9,
      9,
      9,
      10
    ],
    "mode": "mode",
    "context": "Class 7 stacked observations 15"
  },
  {
    "chapterId": "c7-large-numbers-current",
    "kind": "dotPlot",
    "values": [
      1,
      1,
      1,
      1,
      2,
      3,
      3,
      4,
      5,
      5,
      5,
      5,
      6
    ],
    "mode": "range",
    "context": "Class 7 stacked observations 16"
  },
  {
    "chapterId": "c7-number-play-current",
    "kind": "dotPlot",
    "values": [
      2,
      2,
      2,
      2,
      3,
      4,
      4,
      5,
      6,
      6,
      6,
      6,
      7
    ],
    "mode": "median",
    "context": "Class 7 stacked observations 17"
  },
  {
    "chapterId": "c7-number-play-current",
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
      7,
      7,
      7,
      8
    ],
    "mode": "mode",
    "context": "Class 7 stacked observations 18"
  },
  {
    "chapterId": "c7-common-ground-current",
    "kind": "pieAngle",
    "counts": [
      2,
      3,
      4,
      3
    ],
    "index": 0,
    "mode": "count",
    "context": "Class 7 proportion sectors 1"
  },
  {
    "chapterId": "c7-fractions-current",
    "kind": "pieAngle",
    "counts": [
      4,
      6,
      8,
      6
    ],
    "index": 1,
    "mode": "angle",
    "context": "Class 7 proportion sectors 2"
  },
  {
    "chapterId": "c7-common-ground-current",
    "kind": "pieAngle",
    "counts": [
      3,
      4,
      5,
      6
    ],
    "index": 2,
    "mode": "angle",
    "context": "Class 7 proportion sectors 3"
  },
  {
    "chapterId": "c7-fractions-current",
    "kind": "pieAngle",
    "counts": [
      5,
      3,
      7,
      5
    ],
    "index": 3,
    "mode": "count",
    "context": "Class 7 proportion sectors 4"
  },
  {
    "chapterId": "c7-common-ground-current",
    "kind": "pieAngle",
    "counts": [
      8,
      6,
      6,
      10
    ],
    "index": 0,
    "mode": "angle",
    "context": "Class 7 proportion sectors 5"
  },
  {
    "chapterId": "c7-fractions-current",
    "kind": "pieAngle",
    "counts": [
      9,
      9,
      6,
      12
    ],
    "index": 1,
    "mode": "angle",
    "context": "Class 7 proportion sectors 6"
  },
  {
    "chapterId": "c7-common-ground-current",
    "kind": "pieAngle",
    "counts": [
      12,
      8,
      10,
      10
    ],
    "index": 2,
    "mode": "count",
    "context": "Class 7 proportion sectors 7"
  },
  {
    "chapterId": "c7-fractions-current",
    "kind": "pieAngle",
    "counts": [
      2,
      3,
      4,
      3
    ],
    "index": 3,
    "mode": "angle",
    "context": "Class 7 proportion sectors 8"
  },
  {
    "chapterId": "c7-common-ground-current",
    "kind": "pieAngle",
    "counts": [
      4,
      6,
      8,
      6
    ],
    "index": 0,
    "mode": "angle",
    "context": "Class 7 proportion sectors 9"
  },
  {
    "chapterId": "c7-fractions-current",
    "kind": "pieAngle",
    "counts": [
      3,
      4,
      5,
      6
    ],
    "index": 1,
    "mode": "count",
    "context": "Class 7 proportion sectors 10"
  },
  {
    "chapterId": "c7-common-ground-current",
    "kind": "pieAngle",
    "counts": [
      5,
      3,
      7,
      5
    ],
    "index": 2,
    "mode": "angle",
    "context": "Class 7 proportion sectors 11"
  },
  {
    "chapterId": "c7-fractions-current",
    "kind": "pieAngle",
    "counts": [
      8,
      6,
      6,
      10
    ],
    "index": 3,
    "mode": "angle",
    "context": "Class 7 proportion sectors 12"
  },
  {
    "chapterId": "c7-common-ground-current",
    "kind": "pieAngle",
    "counts": [
      9,
      9,
      6,
      12
    ],
    "index": 0,
    "mode": "count",
    "context": "Class 7 proportion sectors 13"
  },
  {
    "chapterId": "c7-fractions-current",
    "kind": "pieAngle",
    "counts": [
      12,
      8,
      10,
      10
    ],
    "index": 1,
    "mode": "angle",
    "context": "Class 7 proportion sectors 14"
  },
  {
    "chapterId": "c7-common-ground-current",
    "kind": "pieAngle",
    "counts": [
      2,
      3,
      4,
      3
    ],
    "index": 2,
    "mode": "angle",
    "context": "Class 7 proportion sectors 15"
  },
  {
    "chapterId": "c7-connecting-dots-current",
    "kind": "midpoint",
    "A": [
      -6,
      -3
    ],
    "B": [
      -4,
      -1
    ],
    "mode": "x",
    "context": "Class 7 grid segment 1"
  },
  {
    "chapterId": "c7-connecting-dots-current",
    "kind": "midpoint",
    "A": [
      -5,
      -2
    ],
    "B": [
      -2,
      3
    ],
    "mode": "y",
    "context": "Class 7 grid segment 2"
  },
  {
    "chapterId": "c7-connecting-dots-current",
    "kind": "midpoint",
    "A": [
      -4,
      -1
    ],
    "B": [
      0,
      2
    ],
    "mode": "distance2",
    "context": "Class 7 grid segment 3"
  },
  {
    "chapterId": "c7-connecting-dots-current",
    "kind": "midpoint",
    "A": [
      -3,
      -3
    ],
    "B": [
      2,
      3
    ],
    "mode": "x",
    "context": "Class 7 grid segment 4"
  },
  {
    "chapterId": "c7-connecting-dots-current",
    "kind": "midpoint",
    "A": [
      -2,
      -2
    ],
    "B": [
      0,
      2
    ],
    "mode": "y",
    "context": "Class 7 grid segment 5"
  },
  {
    "chapterId": "c7-connecting-dots-current",
    "kind": "midpoint",
    "A": [
      -6,
      -1
    ],
    "B": [
      -3,
      1
    ],
    "mode": "distance2",
    "context": "Class 7 grid segment 6"
  },
  {
    "chapterId": "c7-connecting-dots-current",
    "kind": "midpoint",
    "A": [
      -5,
      -3
    ],
    "B": [
      -1,
      2
    ],
    "mode": "x",
    "context": "Class 7 grid segment 7"
  },
  {
    "chapterId": "c7-connecting-dots-current",
    "kind": "midpoint",
    "A": [
      -4,
      -2
    ],
    "B": [
      1,
      1
    ],
    "mode": "y",
    "context": "Class 7 grid segment 8"
  },
  {
    "chapterId": "c7-connecting-dots-current",
    "kind": "midpoint",
    "A": [
      -3,
      -1
    ],
    "B": [
      -1,
      5
    ],
    "mode": "distance2",
    "context": "Class 7 grid segment 9"
  },
  {
    "chapterId": "c7-connecting-dots-current",
    "kind": "midpoint",
    "A": [
      -2,
      -3
    ],
    "B": [
      1,
      1
    ],
    "mode": "x",
    "context": "Class 7 grid segment 10"
  },
  {
    "chapterId": "c7-connecting-dots-current",
    "kind": "midpoint",
    "A": [
      -6,
      -2
    ],
    "B": [
      -2,
      0
    ],
    "mode": "y",
    "context": "Class 7 grid segment 11"
  },
  {
    "chapterId": "c7-connecting-dots-current",
    "kind": "midpoint",
    "A": [
      -5,
      -1
    ],
    "B": [
      0,
      4
    ],
    "mode": "distance2",
    "context": "Class 7 grid segment 12"
  },
  {
    "chapterId": "c7-connecting-dots-current",
    "kind": "midpoint",
    "A": [
      -4,
      -3
    ],
    "B": [
      -2,
      0
    ],
    "mode": "x",
    "context": "Class 7 grid segment 13"
  },
  {
    "chapterId": "c7-connecting-dots-current",
    "kind": "midpoint",
    "A": [
      -3,
      -2
    ],
    "B": [
      0,
      4
    ],
    "mode": "y",
    "context": "Class 7 grid segment 14"
  },
  {
    "chapterId": "c7-geometric-twins-current",
    "kind": "reflect",
    "A": [
      1,
      1
    ],
    "B": [
      3,
      1
    ],
    "C": [
      2,
      3
    ],
    "axis": "y",
    "mode": "area",
    "context": "Class 7 mirror geometry 1"
  },
  {
    "chapterId": "c7-geometric-twins-current",
    "kind": "reflect",
    "A": [
      2,
      2
    ],
    "B": [
      5,
      2
    ],
    "C": [
      3,
      5
    ],
    "axis": "x",
    "mode": "coordinate",
    "context": "Class 7 mirror geometry 2"
  },
  {
    "chapterId": "c7-geometric-twins-current",
    "kind": "reflect",
    "A": [
      3,
      3
    ],
    "B": [
      7,
      3
    ],
    "C": [
      4,
      7
    ],
    "axis": "y",
    "mode": "coordinate",
    "context": "Class 7 mirror geometry 3"
  },
  {
    "chapterId": "c7-geometric-twins-current",
    "kind": "reflect",
    "A": [
      4,
      1
    ],
    "B": [
      6,
      1
    ],
    "C": [
      5,
      6
    ],
    "axis": "x",
    "mode": "area",
    "context": "Class 7 mirror geometry 4"
  },
  {
    "chapterId": "c7-geometric-twins-current",
    "kind": "reflect",
    "A": [
      1,
      2
    ],
    "B": [
      4,
      2
    ],
    "C": [
      2,
      4
    ],
    "axis": "y",
    "mode": "coordinate",
    "context": "Class 7 mirror geometry 5"
  },
  {
    "chapterId": "c7-geometric-twins-current",
    "kind": "reflect",
    "A": [
      2,
      3
    ],
    "B": [
      6,
      3
    ],
    "C": [
      3,
      6
    ],
    "axis": "x",
    "mode": "coordinate",
    "context": "Class 7 mirror geometry 6"
  },
  {
    "chapterId": "c7-geometric-twins-current",
    "kind": "reflect",
    "A": [
      3,
      1
    ],
    "B": [
      5,
      1
    ],
    "C": [
      4,
      5
    ],
    "axis": "y",
    "mode": "area",
    "context": "Class 7 mirror geometry 7"
  },
  {
    "chapterId": "c7-geometric-twins-current",
    "kind": "reflect",
    "A": [
      4,
      2
    ],
    "B": [
      7,
      2
    ],
    "C": [
      5,
      7
    ],
    "axis": "x",
    "mode": "coordinate",
    "context": "Class 7 mirror geometry 8"
  },
  {
    "chapterId": "c7-geometric-twins-current",
    "kind": "reflect",
    "A": [
      1,
      3
    ],
    "B": [
      5,
      3
    ],
    "C": [
      2,
      5
    ],
    "axis": "y",
    "mode": "coordinate",
    "context": "Class 7 mirror geometry 9"
  },
  {
    "chapterId": "c7-geometric-twins-current",
    "kind": "reflect",
    "A": [
      2,
      1
    ],
    "B": [
      4,
      1
    ],
    "C": [
      3,
      4
    ],
    "axis": "x",
    "mode": "area",
    "context": "Class 7 mirror geometry 10"
  },
  {
    "chapterId": "c7-geometric-twins-current",
    "kind": "reflect",
    "A": [
      3,
      2
    ],
    "B": [
      6,
      2
    ],
    "C": [
      4,
      6
    ],
    "axis": "y",
    "mode": "coordinate",
    "context": "Class 7 mirror geometry 11"
  },
  {
    "chapterId": "c7-geometric-twins-current",
    "kind": "reflect",
    "A": [
      4,
      3
    ],
    "B": [
      8,
      3
    ],
    "C": [
      5,
      8
    ],
    "axis": "x",
    "mode": "coordinate",
    "context": "Class 7 mirror geometry 12"
  },
  {
    "chapterId": "c7-number-play-current",
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
      38
    ],
    "mode": "median",
    "context": "Optional stem-leaf number pattern 1"
  },
  {
    "chapterId": "c7-number-play-current",
    "kind": "stemLeaf",
    "values": [
      22,
      25,
      28,
      28,
      31,
      34,
      34,
      37,
      40
    ],
    "mode": "range",
    "context": "Optional stem-leaf number pattern 2"
  },
  {
    "chapterId": "c7-number-play-current",
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
      42
    ],
    "mode": "median",
    "context": "Optional stem-leaf number pattern 3"
  },
  {
    "chapterId": "c7-number-play-current",
    "kind": "stemLeaf",
    "values": [
      26,
      29,
      32,
      32,
      35,
      38,
      38,
      41,
      44
    ],
    "mode": "range",
    "context": "Optional stem-leaf number pattern 4"
  },
  {
    "chapterId": "c7-number-play-current",
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
      46
    ],
    "mode": "median",
    "context": "Optional stem-leaf number pattern 5"
  },
  {
    "chapterId": "c7-number-play-current",
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
      48
    ],
    "mode": "range",
    "context": "Optional stem-leaf number pattern 6"
  },
  {
    "chapterId": "c7-number-play-current",
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
      50
    ],
    "mode": "median",
    "context": "Optional stem-leaf number pattern 7"
  },
  {
    "chapterId": "c7-number-play-current",
    "kind": "stemLeaf",
    "values": [
      34,
      37,
      40,
      40,
      43,
      46,
      46,
      49,
      52
    ],
    "mode": "range",
    "context": "Optional stem-leaf number pattern 8"
  },
  {
    "chapterId": "c7-number-play-current",
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
      54
    ],
    "mode": "median",
    "context": "Optional stem-leaf number pattern 9"
  },
  {
    "chapterId": "c7-number-play-current",
    "kind": "stemLeaf",
    "values": [
      38,
      41,
      44,
      44,
      47,
      50,
      50,
      53,
      56
    ],
    "mode": "range",
    "context": "Optional stem-leaf number pattern 10"
  },
  {
    "chapterId": "c7-number-play-current",
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
      58
    ],
    "mode": "median",
    "context": "Optional stem-leaf number pattern 11"
  }
];
const data={};for(const {chapterId,kind,...p} of specs)(data[chapterId]||={examples:[]}).examples.push(makeInvestigation(kind,p));
export default data;
