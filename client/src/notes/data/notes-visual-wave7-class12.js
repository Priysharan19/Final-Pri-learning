// Grade 12 figure-backed study collection. Out-of-syllabus graph theory and statistics are marked optional.
import { makeInvestigation } from '../visualInvestigationFactory.js';
const specs=[
  {
    "chapterId": "c12-applications-derivatives",
    "kind": "tangent",
    "a": -3,
    "h": -4,
    "k": -5,
    "x0": -3,
    "context": "Class 12 differential tangent 1"
  },
  {
    "chapterId": "c12-applications-derivatives",
    "kind": "tangent",
    "a": -2,
    "h": -3,
    "k": -2,
    "x0": -1,
    "context": "Class 12 differential tangent 2"
  },
  {
    "chapterId": "c12-applications-derivatives",
    "kind": "tangent",
    "a": -1,
    "h": -2,
    "k": 1,
    "x0": 1,
    "context": "Class 12 differential tangent 3"
  },
  {
    "chapterId": "c12-applications-derivatives",
    "kind": "tangent",
    "a": 1,
    "h": -1,
    "k": 4,
    "x0": 3,
    "context": "Class 12 differential tangent 4"
  },
  {
    "chapterId": "c12-applications-derivatives",
    "kind": "tangent",
    "a": 2,
    "h": 0,
    "k": -5,
    "x0": 1,
    "context": "Class 12 differential tangent 5"
  },
  {
    "chapterId": "c12-applications-derivatives",
    "kind": "tangent",
    "a": 3,
    "h": 1,
    "k": -2,
    "x0": 3,
    "context": "Class 12 differential tangent 6"
  },
  {
    "chapterId": "c12-applications-derivatives",
    "kind": "tangent",
    "a": -3,
    "h": 2,
    "k": 1,
    "x0": 5,
    "context": "Class 12 differential tangent 7"
  },
  {
    "chapterId": "c12-applications-derivatives",
    "kind": "tangent",
    "a": -2,
    "h": 3,
    "k": 4,
    "x0": 7,
    "context": "Class 12 differential tangent 8"
  },
  {
    "chapterId": "c12-applications-derivatives",
    "kind": "tangent",
    "a": -1,
    "h": -4,
    "k": -5,
    "x0": -3,
    "context": "Class 12 differential tangent 9"
  },
  {
    "chapterId": "c12-applications-derivatives",
    "kind": "tangent",
    "a": 1,
    "h": -3,
    "k": -2,
    "x0": -1,
    "context": "Class 12 differential tangent 10"
  },
  {
    "chapterId": "c12-applications-derivatives",
    "kind": "tangent",
    "a": 2,
    "h": -2,
    "k": 1,
    "x0": 1,
    "context": "Class 12 differential tangent 11"
  },
  {
    "chapterId": "c12-applications-derivatives",
    "kind": "tangent",
    "a": 3,
    "h": -1,
    "k": 4,
    "x0": 3,
    "context": "Class 12 differential tangent 12"
  },
  {
    "chapterId": "c12-applications-derivatives",
    "kind": "tangent",
    "a": -3,
    "h": 0,
    "k": -5,
    "x0": 1,
    "context": "Class 12 differential tangent 13"
  },
  {
    "chapterId": "c12-applications-derivatives",
    "kind": "tangent",
    "a": -2,
    "h": 1,
    "k": -2,
    "x0": 3,
    "context": "Class 12 differential tangent 14"
  },
  {
    "chapterId": "c12-applications-derivatives",
    "kind": "tangent",
    "a": -1,
    "h": 2,
    "k": 1,
    "x0": 5,
    "context": "Class 12 differential tangent 15"
  },
  {
    "chapterId": "c12-applications-derivatives",
    "kind": "tangent",
    "a": 1,
    "h": 3,
    "k": 4,
    "x0": 7,
    "context": "Class 12 differential tangent 16"
  },
  {
    "chapterId": "c12-applications-derivatives",
    "kind": "tangent",
    "a": 2,
    "h": -4,
    "k": -5,
    "x0": -3,
    "context": "Class 12 differential tangent 17"
  },
  {
    "chapterId": "c12-applications-derivatives",
    "kind": "tangent",
    "a": 3,
    "h": -3,
    "k": -2,
    "x0": -1,
    "context": "Class 12 differential tangent 18"
  },
  {
    "chapterId": "c12-applications-derivatives",
    "kind": "tangent",
    "a": -3,
    "h": -2,
    "k": 1,
    "x0": 1,
    "context": "Class 12 differential tangent 19"
  },
  {
    "chapterId": "c12-applications-derivatives",
    "kind": "tangent",
    "a": -2,
    "h": -1,
    "k": 4,
    "x0": 3,
    "context": "Class 12 differential tangent 20"
  },
  {
    "chapterId": "c12-applications-derivatives",
    "kind": "tangent",
    "a": -1,
    "h": 0,
    "k": -5,
    "x0": 1,
    "context": "Class 12 differential tangent 21"
  },
  {
    "chapterId": "c12-applications-derivatives",
    "kind": "tangent",
    "a": 1,
    "h": 1,
    "k": -2,
    "x0": 3,
    "context": "Class 12 differential tangent 22"
  },
  {
    "chapterId": "c12-applications-derivatives",
    "kind": "tangent",
    "a": 2,
    "h": 2,
    "k": 1,
    "x0": 5,
    "context": "Class 12 differential tangent 23"
  },
  {
    "chapterId": "c12-applications-derivatives",
    "kind": "tangent",
    "a": 3,
    "h": 3,
    "k": 4,
    "x0": 7,
    "context": "Class 12 differential tangent 24"
  },
  {
    "chapterId": "c12-applications-derivatives",
    "kind": "tangent",
    "a": -3,
    "h": -4,
    "k": -5,
    "x0": -3,
    "context": "Class 12 differential tangent 25"
  },
  {
    "chapterId": "c12-probability",
    "kind": "twoBox",
    "a": [
      -4,
      -1,
      2,
      5,
      9
    ],
    "b": [
      -3,
      1,
      3,
      8,
      13
    ],
    "mode": "iqrDiff",
    "context": "Optional probability distribution quartiles 1"
  },
  {
    "chapterId": "c12-probability",
    "kind": "twoBox",
    "a": [
      -3,
      0,
      3,
      6,
      10
    ],
    "b": [
      -2,
      2,
      4,
      9,
      14
    ],
    "mode": "medianGap",
    "context": "Optional probability distribution quartiles 2"
  },
  {
    "chapterId": "c12-probability",
    "kind": "twoBox",
    "a": [
      -2,
      1,
      4,
      7,
      11
    ],
    "b": [
      -1,
      3,
      5,
      10,
      15
    ],
    "mode": "rangeDiff",
    "context": "Optional probability distribution quartiles 3"
  },
  {
    "chapterId": "c12-probability",
    "kind": "twoBox",
    "a": [
      -1,
      2,
      5,
      8,
      12
    ],
    "b": [
      0,
      4,
      6,
      11,
      16
    ],
    "mode": "iqrDiff",
    "context": "Optional probability distribution quartiles 4"
  },
  {
    "chapterId": "c12-probability",
    "kind": "twoBox",
    "a": [
      0,
      3,
      6,
      9,
      13
    ],
    "b": [
      1,
      5,
      7,
      12,
      17
    ],
    "mode": "medianGap",
    "context": "Optional probability distribution quartiles 5"
  },
  {
    "chapterId": "c12-probability",
    "kind": "twoBox",
    "a": [
      1,
      4,
      7,
      10,
      14
    ],
    "b": [
      2,
      6,
      8,
      13,
      18
    ],
    "mode": "rangeDiff",
    "context": "Optional probability distribution quartiles 6"
  },
  {
    "chapterId": "c12-probability",
    "kind": "twoBox",
    "a": [
      2,
      5,
      8,
      11,
      15
    ],
    "b": [
      3,
      7,
      9,
      14,
      19
    ],
    "mode": "iqrDiff",
    "context": "Optional probability distribution quartiles 7"
  },
  {
    "chapterId": "c12-probability",
    "kind": "twoBox",
    "a": [
      -4,
      -1,
      2,
      5,
      9
    ],
    "b": [
      -3,
      1,
      3,
      8,
      13
    ],
    "mode": "medianGap",
    "context": "Optional probability distribution quartiles 8"
  },
  {
    "chapterId": "c12-probability",
    "kind": "twoBox",
    "a": [
      -3,
      0,
      3,
      6,
      10
    ],
    "b": [
      -2,
      2,
      4,
      9,
      14
    ],
    "mode": "rangeDiff",
    "context": "Optional probability distribution quartiles 9"
  },
  {
    "chapterId": "c12-probability",
    "kind": "twoBox",
    "a": [
      -2,
      1,
      4,
      7,
      11
    ],
    "b": [
      -1,
      3,
      5,
      10,
      15
    ],
    "mode": "iqrDiff",
    "context": "Optional probability distribution quartiles 10"
  },
  {
    "chapterId": "c12-probability",
    "kind": "twoBox",
    "a": [
      -1,
      2,
      5,
      8,
      12
    ],
    "b": [
      0,
      4,
      6,
      11,
      16
    ],
    "mode": "medianGap",
    "context": "Optional probability distribution quartiles 11"
  },
  {
    "chapterId": "c12-probability",
    "kind": "twoBox",
    "a": [
      0,
      3,
      6,
      9,
      13
    ],
    "b": [
      1,
      5,
      7,
      12,
      17
    ],
    "mode": "rangeDiff",
    "context": "Optional probability distribution quartiles 12"
  },
  {
    "chapterId": "c12-probability",
    "kind": "twoBox",
    "a": [
      1,
      4,
      7,
      10,
      14
    ],
    "b": [
      2,
      6,
      8,
      13,
      18
    ],
    "mode": "iqrDiff",
    "context": "Optional probability distribution quartiles 13"
  },
  {
    "chapterId": "c12-probability",
    "kind": "twoBox",
    "a": [
      2,
      5,
      8,
      11,
      15
    ],
    "b": [
      3,
      7,
      9,
      14,
      19
    ],
    "mode": "medianGap",
    "context": "Optional probability distribution quartiles 14"
  },
  {
    "chapterId": "c12-probability",
    "kind": "twoBox",
    "a": [
      -4,
      -1,
      2,
      5,
      9
    ],
    "b": [
      -3,
      1,
      3,
      8,
      13
    ],
    "mode": "rangeDiff",
    "context": "Optional probability distribution quartiles 15"
  },
  {
    "chapterId": "c12-probability",
    "kind": "twoBox",
    "a": [
      -3,
      0,
      3,
      6,
      10
    ],
    "b": [
      -2,
      2,
      4,
      9,
      14
    ],
    "mode": "iqrDiff",
    "context": "Optional probability distribution quartiles 16"
  },
  {
    "chapterId": "c12-probability",
    "kind": "twoBox",
    "a": [
      -2,
      1,
      4,
      7,
      11
    ],
    "b": [
      -1,
      3,
      5,
      10,
      15
    ],
    "mode": "medianGap",
    "context": "Optional probability distribution quartiles 17"
  },
  {
    "chapterId": "c12-probability",
    "kind": "twoBox",
    "a": [
      -1,
      2,
      5,
      8,
      12
    ],
    "b": [
      0,
      4,
      6,
      11,
      16
    ],
    "mode": "rangeDiff",
    "context": "Optional probability distribution quartiles 18"
  },
  {
    "chapterId": "c12-probability",
    "kind": "twoBox",
    "a": [
      0,
      3,
      6,
      9,
      13
    ],
    "b": [
      1,
      5,
      7,
      12,
      17
    ],
    "mode": "iqrDiff",
    "context": "Optional probability distribution quartiles 19"
  },
  {
    "chapterId": "c12-probability",
    "kind": "twoBox",
    "a": [
      1,
      4,
      7,
      10,
      14
    ],
    "b": [
      2,
      6,
      8,
      13,
      18
    ],
    "mode": "medianGap",
    "context": "Optional probability distribution quartiles 20"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "motion",
    "times": [
      0,
      3,
      6,
      9
    ],
    "velocities": [
      1,
      3,
      2,
      1
    ],
    "mode": "peak",
    "context": "Class 12 definite-integral motion area 1"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "motion",
    "times": [
      0,
      3,
      6,
      9
    ],
    "velocities": [
      2,
      5,
      5,
      5
    ],
    "mode": "distance",
    "context": "Class 12 definite-integral motion area 2"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "motion",
    "times": [
      0,
      3,
      6,
      9
    ],
    "velocities": [
      3,
      7,
      8,
      2
    ],
    "mode": "distance",
    "context": "Class 12 definite-integral motion area 3"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "motion",
    "times": [
      0,
      3,
      6,
      9
    ],
    "velocities": [
      4,
      3,
      3,
      6
    ],
    "mode": "distance",
    "context": "Class 12 definite-integral motion area 4"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "motion",
    "times": [
      0,
      3,
      6,
      9
    ],
    "velocities": [
      5,
      5,
      6,
      3
    ],
    "mode": "peak",
    "context": "Class 12 definite-integral motion area 5"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "motion",
    "times": [
      0,
      3,
      6,
      9
    ],
    "velocities": [
      1,
      7,
      9,
      7
    ],
    "mode": "distance",
    "context": "Class 12 definite-integral motion area 6"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "motion",
    "times": [
      0,
      3,
      6,
      9
    ],
    "velocities": [
      2,
      3,
      4,
      4
    ],
    "mode": "distance",
    "context": "Class 12 definite-integral motion area 7"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "motion",
    "times": [
      0,
      3,
      6,
      9
    ],
    "velocities": [
      3,
      5,
      7,
      1
    ],
    "mode": "distance",
    "context": "Class 12 definite-integral motion area 8"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "motion",
    "times": [
      0,
      3,
      6,
      9
    ],
    "velocities": [
      4,
      7,
      2,
      5
    ],
    "mode": "peak",
    "context": "Class 12 definite-integral motion area 9"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "motion",
    "times": [
      0,
      3,
      6,
      9
    ],
    "velocities": [
      5,
      3,
      5,
      2
    ],
    "mode": "distance",
    "context": "Class 12 definite-integral motion area 10"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "motion",
    "times": [
      0,
      3,
      6,
      9
    ],
    "velocities": [
      1,
      5,
      8,
      6
    ],
    "mode": "distance",
    "context": "Class 12 definite-integral motion area 11"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "motion",
    "times": [
      0,
      3,
      6,
      9
    ],
    "velocities": [
      2,
      7,
      3,
      3
    ],
    "mode": "distance",
    "context": "Class 12 definite-integral motion area 12"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "motion",
    "times": [
      0,
      3,
      6,
      9
    ],
    "velocities": [
      3,
      3,
      6,
      7
    ],
    "mode": "peak",
    "context": "Class 12 definite-integral motion area 13"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "motion",
    "times": [
      0,
      3,
      6,
      9
    ],
    "velocities": [
      4,
      5,
      9,
      4
    ],
    "mode": "distance",
    "context": "Class 12 definite-integral motion area 14"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "motion",
    "times": [
      0,
      3,
      6,
      9
    ],
    "velocities": [
      5,
      7,
      4,
      1
    ],
    "mode": "distance",
    "context": "Class 12 definite-integral motion area 15"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "motion",
    "times": [
      0,
      3,
      6,
      9
    ],
    "velocities": [
      1,
      3,
      7,
      5
    ],
    "mode": "distance",
    "context": "Class 12 definite-integral motion area 16"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "motion",
    "times": [
      0,
      3,
      6,
      9
    ],
    "velocities": [
      2,
      5,
      2,
      2
    ],
    "mode": "peak",
    "context": "Class 12 definite-integral motion area 17"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "motion",
    "times": [
      0,
      3,
      6,
      9
    ],
    "velocities": [
      3,
      7,
      5,
      6
    ],
    "mode": "distance",
    "context": "Class 12 definite-integral motion area 18"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "motion",
    "times": [
      0,
      3,
      6,
      9
    ],
    "velocities": [
      4,
      3,
      8,
      3
    ],
    "mode": "distance",
    "context": "Class 12 definite-integral motion area 19"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "motion",
    "times": [
      0,
      3,
      6,
      9
    ],
    "velocities": [
      5,
      5,
      3,
      7
    ],
    "mode": "distance",
    "context": "Class 12 definite-integral motion area 20"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "inverseLine",
    "m": 1,
    "b": -5,
    "x0": -3,
    "context": "Inverse map reflected across diagonal 1"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "inverseLine",
    "m": 2,
    "b": -2,
    "x0": -2,
    "context": "Inverse map reflected across diagonal 2"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "inverseLine",
    "m": 3,
    "b": 1,
    "x0": -1,
    "context": "Inverse map reflected across diagonal 3"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "inverseLine",
    "m": 4,
    "b": 4,
    "x0": 0,
    "context": "Inverse map reflected across diagonal 4"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "inverseLine",
    "m": 1,
    "b": -4,
    "x0": 1,
    "context": "Inverse map reflected across diagonal 5"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "inverseLine",
    "m": 2,
    "b": -1,
    "x0": 2,
    "context": "Inverse map reflected across diagonal 6"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "inverseLine",
    "m": 3,
    "b": 2,
    "x0": 3,
    "context": "Inverse map reflected across diagonal 7"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "inverseLine",
    "m": 4,
    "b": 5,
    "x0": -3,
    "context": "Inverse map reflected across diagonal 8"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "inverseLine",
    "m": 1,
    "b": -3,
    "x0": -2,
    "context": "Inverse map reflected across diagonal 9"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "inverseLine",
    "m": 2,
    "b": 0,
    "x0": -1,
    "context": "Inverse map reflected across diagonal 10"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "inverseLine",
    "m": 3,
    "b": 3,
    "x0": 0,
    "context": "Inverse map reflected across diagonal 11"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "inverseLine",
    "m": 4,
    "b": -5,
    "x0": 1,
    "context": "Inverse map reflected across diagonal 12"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "inverseLine",
    "m": 1,
    "b": -2,
    "x0": 2,
    "context": "Inverse map reflected across diagonal 13"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "inverseLine",
    "m": 2,
    "b": 1,
    "x0": 3,
    "context": "Inverse map reflected across diagonal 14"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "inverseLine",
    "m": 3,
    "b": 4,
    "x0": -3,
    "context": "Inverse map reflected across diagonal 15"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "inverseLine",
    "m": 4,
    "b": -4,
    "x0": -2,
    "context": "Inverse map reflected across diagonal 16"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "inverseLine",
    "m": 1,
    "b": -1,
    "x0": -1,
    "context": "Inverse map reflected across diagonal 17"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "inverseLine",
    "m": 2,
    "b": 2,
    "x0": 0,
    "context": "Inverse map reflected across diagonal 18"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "inverseLine",
    "m": 3,
    "b": 5,
    "x0": 1,
    "context": "Inverse map reflected across diagonal 19"
  },
  {
    "chapterId": "c12-relations-functions",
    "kind": "inverseLine",
    "m": 4,
    "b": -3,
    "x0": 2,
    "context": "Inverse map reflected across diagonal 20"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "ellipse",
    "a": 5,
    "b": 2,
    "mode": "focal",
    "context": "Optional ellipse integral geometry 1"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "ellipse",
    "a": 6,
    "b": 3,
    "mode": "area",
    "context": "Optional ellipse integral geometry 2"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "ellipse",
    "a": 7,
    "b": 4,
    "mode": "focal",
    "context": "Optional ellipse integral geometry 3"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "ellipse",
    "a": 8,
    "b": 5,
    "mode": "area",
    "context": "Optional ellipse integral geometry 4"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "ellipse",
    "a": 9,
    "b": 2,
    "mode": "focal",
    "context": "Optional ellipse integral geometry 5"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "ellipse",
    "a": 10,
    "b": 3,
    "mode": "area",
    "context": "Optional ellipse integral geometry 6"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "ellipse",
    "a": 11,
    "b": 4,
    "mode": "focal",
    "context": "Optional ellipse integral geometry 7"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "ellipse",
    "a": 12,
    "b": 5,
    "mode": "area",
    "context": "Optional ellipse integral geometry 8"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "ellipse",
    "a": 5,
    "b": 2,
    "mode": "focal",
    "context": "Optional ellipse integral geometry 9"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "ellipse",
    "a": 6,
    "b": 3,
    "mode": "area",
    "context": "Optional ellipse integral geometry 10"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "ellipse",
    "a": 7,
    "b": 4,
    "mode": "focal",
    "context": "Optional ellipse integral geometry 11"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "ellipse",
    "a": 8,
    "b": 5,
    "mode": "area",
    "context": "Optional ellipse integral geometry 12"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "ellipse",
    "a": 9,
    "b": 2,
    "mode": "focal",
    "context": "Optional ellipse integral geometry 13"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "ellipse",
    "a": 10,
    "b": 3,
    "mode": "area",
    "context": "Optional ellipse integral geometry 14"
  },
  {
    "chapterId": "c12-applications-integrals",
    "kind": "ellipse",
    "a": 11,
    "b": 4,
    "mode": "focal",
    "context": "Optional ellipse integral geometry 15"
  },
  {
    "chapterId": "c12-linear-programming",
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
    "context": "Optional discrete resource network 1"
  },
  {
    "chapterId": "c12-linear-programming",
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
    "context": "Optional discrete resource network 2"
  },
  {
    "chapterId": "c12-linear-programming",
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
    "context": "Optional discrete resource network 3"
  },
  {
    "chapterId": "c12-linear-programming",
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
    "context": "Optional discrete resource network 4"
  },
  {
    "chapterId": "c12-linear-programming",
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
    "context": "Optional discrete resource network 5"
  },
  {
    "chapterId": "c12-linear-programming",
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
    "context": "Optional discrete resource network 6"
  },
  {
    "chapterId": "c12-linear-programming",
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
    "context": "Optional discrete resource network 7"
  },
  {
    "chapterId": "c12-linear-programming",
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
    "context": "Optional discrete resource network 8"
  },
  {
    "chapterId": "c12-linear-programming",
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
    "context": "Optional discrete resource network 9"
  },
  {
    "chapterId": "c12-linear-programming",
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
    "context": "Optional discrete resource network 10"
  },
  {
    "chapterId": "c12-linear-programming",
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
    "context": "Optional discrete resource network 11"
  },
  {
    "chapterId": "c12-linear-programming",
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
    "context": "Optional discrete resource network 12"
  },
  {
    "chapterId": "c12-linear-programming",
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
    "context": "Optional discrete resource network 13"
  },
  {
    "chapterId": "c12-linear-programming",
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
    "context": "Optional discrete resource network 14"
  },
  {
    "chapterId": "c12-linear-programming",
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
    "context": "Optional discrete resource network 15"
  },
  {
    "chapterId": "c12-probability",
    "kind": "pieAngle",
    "counts": [
      5,
      3,
      7,
      5
    ],
    "index": 0,
    "mode": "count",
    "context": "Class 12 event distribution sectors 1"
  },
  {
    "chapterId": "c12-probability",
    "kind": "pieAngle",
    "counts": [
      8,
      6,
      6,
      10
    ],
    "index": 1,
    "mode": "angle",
    "context": "Class 12 event distribution sectors 2"
  },
  {
    "chapterId": "c12-probability",
    "kind": "pieAngle",
    "counts": [
      9,
      9,
      6,
      12
    ],
    "index": 2,
    "mode": "count",
    "context": "Class 12 event distribution sectors 3"
  },
  {
    "chapterId": "c12-probability",
    "kind": "pieAngle",
    "counts": [
      12,
      8,
      10,
      10
    ],
    "index": 3,
    "mode": "angle",
    "context": "Class 12 event distribution sectors 4"
  },
  {
    "chapterId": "c12-probability",
    "kind": "pieAngle",
    "counts": [
      2,
      3,
      4,
      3
    ],
    "index": 0,
    "mode": "count",
    "context": "Class 12 event distribution sectors 5"
  },
  {
    "chapterId": "c12-probability",
    "kind": "pieAngle",
    "counts": [
      4,
      6,
      8,
      6
    ],
    "index": 1,
    "mode": "angle",
    "context": "Class 12 event distribution sectors 6"
  },
  {
    "chapterId": "c12-probability",
    "kind": "pieAngle",
    "counts": [
      3,
      4,
      5,
      6
    ],
    "index": 2,
    "mode": "count",
    "context": "Class 12 event distribution sectors 7"
  },
  {
    "chapterId": "c12-probability",
    "kind": "pieAngle",
    "counts": [
      5,
      3,
      7,
      5
    ],
    "index": 3,
    "mode": "angle",
    "context": "Class 12 event distribution sectors 8"
  },
  {
    "chapterId": "c12-probability",
    "kind": "pieAngle",
    "counts": [
      8,
      6,
      6,
      10
    ],
    "index": 0,
    "mode": "count",
    "context": "Class 12 event distribution sectors 9"
  },
  {
    "chapterId": "c12-probability",
    "kind": "pieAngle",
    "counts": [
      9,
      9,
      6,
      12
    ],
    "index": 1,
    "mode": "angle",
    "context": "Class 12 event distribution sectors 10"
  },
  {
    "chapterId": "c12-probability",
    "kind": "pieAngle",
    "counts": [
      12,
      8,
      10,
      10
    ],
    "index": 2,
    "mode": "count",
    "context": "Class 12 event distribution sectors 11"
  },
  {
    "chapterId": "c12-probability",
    "kind": "pieAngle",
    "counts": [
      2,
      3,
      4,
      3
    ],
    "index": 3,
    "mode": "angle",
    "context": "Class 12 event distribution sectors 12"
  },
  {
    "chapterId": "c12-probability",
    "kind": "pieAngle",
    "counts": [
      4,
      6,
      8,
      6
    ],
    "index": 0,
    "mode": "count",
    "context": "Class 12 event distribution sectors 13"
  },
  {
    "chapterId": "c12-probability",
    "kind": "pieAngle",
    "counts": [
      3,
      4,
      5,
      6
    ],
    "index": 1,
    "mode": "angle",
    "context": "Class 12 event distribution sectors 14"
  },
  {
    "chapterId": "c12-probability",
    "kind": "pieAngle",
    "counts": [
      5,
      3,
      7,
      5
    ],
    "index": 2,
    "mode": "count",
    "context": "Class 12 event distribution sectors 15"
  },
  {
    "chapterId": "c12-probability",
    "kind": "pieAngle",
    "counts": [
      8,
      6,
      6,
      10
    ],
    "index": 3,
    "mode": "angle",
    "context": "Class 12 event distribution sectors 16"
  },
  {
    "chapterId": "c12-probability",
    "kind": "pieAngle",
    "counts": [
      9,
      9,
      6,
      12
    ],
    "index": 0,
    "mode": "count",
    "context": "Class 12 event distribution sectors 17"
  },
  {
    "chapterId": "c12-probability",
    "kind": "pieAngle",
    "counts": [
      12,
      8,
      10,
      10
    ],
    "index": 1,
    "mode": "angle",
    "context": "Class 12 event distribution sectors 18"
  },
  {
    "chapterId": "c12-probability",
    "kind": "pieAngle",
    "counts": [
      2,
      3,
      4,
      3
    ],
    "index": 2,
    "mode": "count",
    "context": "Class 12 event distribution sectors 19"
  },
  {
    "chapterId": "c12-probability",
    "kind": "pieAngle",
    "counts": [
      4,
      6,
      8,
      6
    ],
    "index": 3,
    "mode": "angle",
    "context": "Class 12 event distribution sectors 20"
  },
  {
    "chapterId": "c12-probability",
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
    "context": "Optional data summary prerequisite 1"
  },
  {
    "chapterId": "c12-probability",
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
      45
    ],
    "mode": "median",
    "context": "Optional data summary prerequisite 2"
  },
  {
    "chapterId": "c12-probability",
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
    "mode": "range",
    "context": "Optional data summary prerequisite 3"
  },
  {
    "chapterId": "c12-probability",
    "kind": "stemLeaf",
    "values": [
      37,
      40,
      43,
      43,
      46,
      49,
      49,
      52,
      55
    ],
    "mode": "median",
    "context": "Optional data summary prerequisite 4"
  },
  {
    "chapterId": "c12-probability",
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
      60
    ],
    "mode": "range",
    "context": "Optional data summary prerequisite 5"
  }
];
const data={};for(const {chapterId,kind,...p} of specs)(data[chapterId]||={examples:[]}).examples.push(makeInvestigation(kind,p));
export default data;
