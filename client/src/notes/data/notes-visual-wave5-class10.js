// Class 10 large visual reasoning expansion — native vector data only.
import { makeAdvancedVisual } from '../visualAdvancedFactory.js';
const specs=[
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "linesIntersection",
    "m1": 2,
    "m2": -1,
    "x": 1,
    "y": 3,
    "context": "Intersections and simultaneous equations A"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "linesIntersection",
    "m1": 3,
    "m2": -2,
    "x": -2,
    "y": 2,
    "context": "Two-line intersection B"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "linesIntersection",
    "m1": -1,
    "m2": 2,
    "x": 2,
    "y": -3,
    "context": "Graphical solution C"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "linesIntersection",
    "m1": 4,
    "m2": 1,
    "x": -1,
    "y": 4,
    "context": "Two equations D"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "linesIntersection",
    "m1": 2,
    "m2": 5,
    "x": 3,
    "y": 2,
    "context": "Supply and demand E"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "linesIntersection",
    "m1": -3,
    "m2": 1,
    "x": 0,
    "y": 1,
    "context": "Paired linear model F"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "linesIntersection",
    "m1": 1,
    "m2": -4,
    "x": -3,
    "y": 5,
    "context": "Intersecting gradients G"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "linesIntersection",
    "m1": 3,
    "m2": 1,
    "x": 4,
    "y": -2,
    "context": "Parallel-free graphs H"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "linesIntersection",
    "m1": 5,
    "m2": -2,
    "x": -2,
    "y": 3,
    "context": "Two unknowns I"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "linesIntersection",
    "m1": 2,
    "m2": -3,
    "x": 1,
    "y": -2,
    "context": "Line families J"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "linesIntersection",
    "m1": -2,
    "m2": 3,
    "x": 2,
    "y": 2,
    "context": "Number pair K"
  },
  {
    "chapterId": "c10-pair-linear-equations",
    "kind": "linesIntersection",
    "m1": -1,
    "m2": 4,
    "x": -4,
    "y": 4,
    "context": "Coordinated linear constraints L"
  },
  {
    "chapterId": "c10-areas-circles",
    "kind": "sector",
    "r": 6,
    "angle": 40,
    "mode": "area",
    "context": "Small central sector"
  },
  {
    "chapterId": "c10-areas-circles",
    "kind": "sector",
    "r": 9,
    "angle": 80,
    "mode": "area",
    "context": "Circular flower bed"
  },
  {
    "chapterId": "c10-areas-circles",
    "kind": "sector",
    "r": 12,
    "angle": 45,
    "mode": "area",
    "context": "Shaded arc wedge"
  },
  {
    "chapterId": "c10-areas-circles",
    "kind": "sector",
    "r": 15,
    "angle": 72,
    "mode": "area",
    "context": "Clock segment"
  },
  {
    "chapterId": "c10-areas-circles",
    "kind": "sector",
    "r": 10,
    "angle": 90,
    "mode": "area",
    "context": "Quarter circle"
  },
  {
    "chapterId": "c10-areas-circles",
    "kind": "sector",
    "r": 8,
    "angle": 45,
    "mode": "area",
    "context": "Minor sector"
  },
  {
    "chapterId": "c10-areas-circles",
    "kind": "sector",
    "r": 6,
    "angle": 120,
    "mode": "area",
    "context": "One third circle"
  },
  {
    "chapterId": "c10-areas-circles",
    "kind": "sector",
    "r": 14,
    "angle": 90,
    "mode": "area",
    "context": "Circular pavement"
  },
  {
    "chapterId": "c10-areas-circles",
    "kind": "sector",
    "r": 6,
    "angle": 30,
    "mode": "arc",
    "context": "Short circle arc"
  },
  {
    "chapterId": "c10-areas-circles",
    "kind": "sector",
    "r": 12,
    "angle": 45,
    "mode": "arc",
    "context": "Extended circular track"
  },
  {
    "chapterId": "c10-surface-volume",
    "kind": "cuboid",
    "l": 3,
    "w": 4,
    "h": 5,
    "mode": "volume",
    "context": "Solid model A"
  },
  {
    "chapterId": "c10-surface-volume",
    "kind": "cuboid",
    "l": 4,
    "w": 6,
    "h": 9,
    "mode": "surface",
    "context": "Box wrapping B"
  },
  {
    "chapterId": "c10-surface-volume",
    "kind": "cuboid",
    "l": 5,
    "w": 12,
    "h": 6,
    "mode": "volume",
    "context": "Cylinder comparison cuboid"
  },
  {
    "chapterId": "c10-surface-volume",
    "kind": "cuboid",
    "l": 8,
    "w": 5,
    "h": 7,
    "mode": "surface",
    "context": "Packaging surface C"
  },
  {
    "chapterId": "c10-surface-volume",
    "kind": "cuboid",
    "l": 10,
    "w": 3,
    "h": 4,
    "mode": "volume",
    "context": "Tank capacity D"
  },
  {
    "chapterId": "c10-surface-volume",
    "kind": "cuboid",
    "l": 7,
    "w": 6,
    "h": 2,
    "mode": "surface",
    "context": "School equipment E"
  },
  {
    "chapterId": "c10-surface-volume",
    "kind": "cuboid",
    "l": 12,
    "w": 8,
    "h": 3,
    "mode": "volume",
    "context": "Rectangular prism F"
  },
  {
    "chapterId": "c10-surface-volume",
    "kind": "cuboid",
    "l": 6,
    "w": 5,
    "h": 11,
    "mode": "surface",
    "context": "Parcel design G"
  },
  {
    "chapterId": "c10-triangles",
    "kind": "parallel",
    "angle": 24,
    "mode": "corresponding",
    "context": "Parallel triangle angle A"
  },
  {
    "chapterId": "c10-triangles",
    "kind": "parallel",
    "angle": 38,
    "mode": "supplementary",
    "context": "Transversal triangle angle B"
  },
  {
    "chapterId": "c10-triangles",
    "kind": "parallel",
    "angle": 51,
    "mode": "corresponding",
    "context": "Similar figure angle C"
  },
  {
    "chapterId": "c10-triangles",
    "kind": "parallel",
    "angle": 63,
    "mode": "supplementary",
    "context": "Parallel bisector angle D"
  },
  {
    "chapterId": "c10-triangles",
    "kind": "parallel",
    "angle": 71,
    "mode": "corresponding",
    "context": "Corresponding edge E"
  },
  {
    "chapterId": "c10-triangles",
    "kind": "parallel",
    "angle": 43,
    "mode": "supplementary",
    "context": "Extension geometry F"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "venn",
    "a": 5,
    "b": 9,
    "ab": 3,
    "out": 2,
    "mode": "union",
    "context": "union"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "venn",
    "a": 11,
    "b": 7,
    "ab": 4,
    "out": 1,
    "mode": "overlap",
    "context": "overlap"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "venn",
    "a": 12,
    "b": 15,
    "ab": 5,
    "out": 4,
    "mode": "aTotal",
    "context": "aTotal"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "venn",
    "a": 8,
    "b": 9,
    "ab": 2,
    "out": 3,
    "mode": "neither",
    "context": "neither"
  },
  {
    "chapterId": "c10-statistics",
    "kind": "venn",
    "a": 17,
    "b": 10,
    "ab": 7,
    "out": 6,
    "mode": "union",
    "context": "union"
  },
  {
    "chapterId": "c10-probability",
    "kind": "tree",
    "a": 1,
    "ad": 2,
    "sa": 1,
    "sad": 2,
    "sb": 1,
    "sbd": 4,
    "mode": "total",
    "context": "Optional two-stage probability A"
  },
  {
    "chapterId": "c10-probability",
    "kind": "tree",
    "a": 2,
    "ad": 5,
    "sa": 3,
    "sad": 4,
    "sb": 1,
    "sbd": 2,
    "mode": "joint",
    "context": "Optional probability tree B"
  },
  {
    "chapterId": "c10-probability",
    "kind": "tree",
    "a": 3,
    "ad": 5,
    "sa": 2,
    "sad": 3,
    "sb": 1,
    "sbd": 4,
    "mode": "total",
    "context": "Conditional branches C"
  },
  {
    "chapterId": "c10-probability",
    "kind": "tree",
    "a": 1,
    "ad": 3,
    "sa": 1,
    "sad": 2,
    "sb": 2,
    "sbd": 5,
    "mode": "joint",
    "context": "Card-draw diagram D"
  },
  {
    "chapterId": "c10-probability",
    "kind": "tree",
    "a": 3,
    "ad": 4,
    "sa": 2,
    "sad": 5,
    "sb": 3,
    "sbd": 5,
    "mode": "total",
    "context": "Elementary branch model E"
  },
  {
    "chapterId": "c10-arithmetic-progressions",
    "kind": "dots",
    "rows": 4,
    "mode": "total",
    "context": "Growing arithmetic dot sequence"
  },
  {
    "chapterId": "c10-arithmetic-progressions",
    "kind": "dots",
    "rows": 6,
    "mode": "next",
    "context": "Pattern-recognition diagram"
  },
  {
    "chapterId": "c10-arithmetic-progressions",
    "kind": "dots",
    "rows": 9,
    "mode": "total",
    "context": "Finite sums in rows"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "linesIntersection",
    "m1": 2,
    "m2": -1,
    "x": 3,
    "y": 2,
    "context": "Coordinate geometry crossover"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "linesIntersection",
    "m1": -1,
    "m2": 3,
    "x": -2,
    "y": 1,
    "context": "Intersection of trajectories"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "linesIntersection",
    "m1": 4,
    "m2": -2,
    "x": 0,
    "y": 4,
    "context": "Plot and solve"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "linesIntersection",
    "m1": 3,
    "m2": -1,
    "x": -3,
    "y": 1,
    "context": "Intersection projection"
  },
  {
    "chapterId": "c10-coordinate-geometry",
    "kind": "linesIntersection",
    "m1": -2,
    "m2": 5,
    "x": 2,
    "y": -2,
    "context": "Oblique crossing"
  }
];
const output={};for(const {chapterId,kind,...p} of specs)(output[chapterId]||={examples:[]}).examples.push(makeAdvancedVisual(kind,p));
export default output;
