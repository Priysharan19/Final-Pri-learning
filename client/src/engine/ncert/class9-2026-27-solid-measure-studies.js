// Class IX 2026–27 CBSE original solid-mensuration STUDY ONLY draft.
// Not imported by Notes, not grading material. Geometry requires rendered figure review.
// https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart1/Maths_SecP1IX_2026-27.pdf
export const class9SolidMeasure202627={
  "id": "pl-cbse9-solids-202627-v1",
  "version": "2026.10.14.1",
  "grade": 9,
  "track": "CBSE standard",
  "sourceUrl": "https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart1/Maths_SecP1IX_2026-27.pdf",
  "chapter": "Surface Area and Volume",
  "syllabusOutcome": "C-5.2",
  "classification": "core",
  "status": "draft-unwired",
  "mode": "study-only",
  "provenance": "original-Pri-Learning",
  "objectives": [
    "Visualise exact nets and exposed solid faces.",
    "Compute cuboid and cylinder surface area/volume with correct units.",
    "Distinguish cone slant height from perpendicular height.",
    "Exclude hidden joins when solving composite solids.",
    "Explain area versus volume changes under uniform enlargement."
  ],
  "concepts": [
    "Area counts exposed two-dimensional surfaces; volume measures enclosed three-dimensional capacity. Their units cannot be interchanged.",
    "For a rectangular prism, total surface area 2(lw+lh+wh) assumes all six faces; an open-top container excludes its lid.",
    "Right cylinders: curved area 2πrh and volume πr²h. Right cones: slant length √(r²+h²), curved area πrl and volume (1/3)πr²h.",
    "For composite solids, add volumes but count only exposed exterior faces; any shared seam is internal.",
    "Scaling every dimension by k scales surface areas by k² and volumes by k³."
  ],
  "workedExamples": [
    {
      "id": "pl9-solid-w1",
      "question": "A sphere of radius 3 cm: find surface area and volume.",
      "solutionSteps": [
        "Surface area=4πr²=4π×9=36π cm².",
        "Volume=(4/3)πr³=(4/3)π×27=36π cm³.",
        "The numerical coefficients happen to match, but the units and quantities differ."
      ],
      "answer": "36π cm²; 36π cm³",
      "check": {
        "kind": "sphere",
        "r": 3,
        "area": 36,
        "volume": 36
      }
    },
    {
      "id": "pl9-solid-w2",
      "question": "A closed cylinder of radius 3 cm and height 8 cm: curved and total surface areas.",
      "solutionSteps": [
        "Curved area=2πrh=48π cm².",
        "Two circular bases contribute 2πr²=18π cm².",
        "Total surface area=66π cm²."
      ],
      "answer": "48π cm²; 66π cm²",
      "check": {
        "kind": "closed-cylinder",
        "r": 3,
        "h": 8,
        "curved": 48,
        "total": 66
      }
    },
    {
      "id": "pl9-solid-w3",
      "question": "A right cone of radius 5 cm and height 12 cm: curved area and volume.",
      "solutionSteps": [
        "Slant height=√(5²+12²)=13 cm.",
        "Curved area=πrl=65π cm².",
        "Volume=(1/3)πr²h=100π cm³."
      ],
      "answer": "65π cm²; 100π cm³",
      "check": {
        "kind": "cone",
        "r": 5,
        "h": 12,
        "slant": 13,
        "curved": 65,
        "volume": 100
      }
    }
  ],
  "questions": [
    {
      "id": "pl9-solid-cuboid1",
      "archetypeId": "pl9-solid-cuboid-total",
      "question": "A solid cuboid measures 8 cm × 5 cm × 3 cm. Find its total surface area and volume.",
      "solutionSteps": [
        "TSA=2(lw+lh+wh).",
        "2(40+24+15)=158 cm².",
        "Volume=lwh=8×5×3=120 cm³."
      ],
      "answer": "158 cm²; 120 cm³",
      "check": {
        "kind": "cuboid",
        "l": 8,
        "w": 5,
        "h": 3,
        "area": 158,
        "volume": 120
      },
      "hint": "Count all six exposed rectangular faces.",
      "commonMistake": "Do not confuse square and cubic units.",
      "figure": null,
      "status": "draft-study",
      "origin": "original",
      "version": "2026.10.14.1"
    },
    {
      "id": "pl9-solid-cuboid2",
      "archetypeId": "pl9-solid-cuboid-total",
      "question": "A closed rectangular box measures 10 cm × 4 cm × 6 cm. Determine outer surface area and capacity.",
      "solutionSteps": [
        "Outer surface area=2(10×4+10×6+4×6).",
        "This is 2(40+60+24)=248 cm².",
        "Capacity=10×4×6=240 cm³."
      ],
      "answer": "248 cm²; 240 cm³",
      "check": {
        "kind": "cuboid",
        "l": 10,
        "w": 4,
        "h": 6,
        "area": 248,
        "volume": 240
      },
      "hint": "The box is closed, so include its lid.",
      "commonMistake": "The product lwh is volume, not total area.",
      "figure": null,
      "status": "draft-study",
      "origin": "original",
      "version": "2026.10.14.1"
    },
    {
      "id": "pl9-solid-open1",
      "archetypeId": "pl9-solid-cuboid-open-top",
      "question": "An open rectangular tank is 6 cm long, 4 cm wide, 5 cm deep. How much sheet material covers its bottom and four walls, ignoring thickness?",
      "solutionSteps": [
        "Base=6×4=24 cm².",
        "Walls=2×6×5+2×4×5=100 cm².",
        "Total sheet area=124 cm²; interior capacity=6×4×5=120 cm³."
      ],
      "answer": "sheet 124 cm²; capacity 120 cm³",
      "check": {
        "kind": "open-cuboid",
        "l": 6,
        "w": 4,
        "h": 5,
        "sheet": 124,
        "capacity": 120
      },
      "hint": "The top face is missing.",
      "commonMistake": "Including a lid adds unwanted material.",
      "figure": null,
      "status": "draft-study",
      "origin": "original",
      "version": "2026.10.14.1"
    },
    {
      "id": "pl9-solid-open2",
      "archetypeId": "pl9-solid-cuboid-open-top",
      "question": "An uncovered plant box has length 7 cm, width 3 cm and height 4 cm. Calculate the area of material used for the base and walls and its internal volume.",
      "solutionSteps": [
        "Base=7×3=21 cm².",
        "Four walls=2×7×4+2×3×4=80 cm².",
        "Open surface=101 cm², volume=7×3×4=84 cm³."
      ],
      "answer": "101 cm²; 84 cm³",
      "check": {
        "kind": "open-cuboid",
        "l": 7,
        "w": 3,
        "h": 4,
        "sheet": 101,
        "capacity": 84
      },
      "hint": "Draw a net of five rectangles.",
      "commonMistake": "A box without a top still has a base.",
      "figure": null,
      "status": "draft-study",
      "origin": "original",
      "version": "2026.10.14.1"
    },
    {
      "id": "pl9-solid-cylinder1",
      "archetypeId": "pl9-solid-cylinder-curved",
      "question": "A right circular cylinder has radius 3 cm and height 7 cm. Find curved area and volume in exact form.",
      "solutionSteps": [
        "Curved area=2πrh=2π×3×7=42π cm².",
        "Base area=πr²=9π cm².",
        "Volume=πr²h=63π cm³."
      ],
      "answer": "42π cm²; 63π cm³",
      "check": {
        "kind": "cylinder",
        "r": 3,
        "h": 7,
        "curved": 42,
        "volume": 63
      },
      "hint": "Curved area excludes both circular bases.",
      "commonMistake": "Curved area has cm², volume cm³.",
      "figure": null,
      "status": "draft-study",
      "origin": "original",
      "version": "2026.10.14.1"
    },
    {
      "id": "pl9-solid-cylinder2",
      "archetypeId": "pl9-solid-cylinder-curved",
      "question": "A cylindrical pipe segment (solid for this calculation) has radius 4 cm and height 5 cm. Find its outer curved area and enclosed volume.",
      "solutionSteps": [
        "Curved area=2π×4×5=40π cm².",
        "Base area=π×16=16π cm².",
        "Volume=16π×5=80π cm³."
      ],
      "answer": "40π cm²; 80π cm³",
      "check": {
        "kind": "cylinder",
        "r": 4,
        "h": 5,
        "curved": 40,
        "volume": 80
      },
      "hint": "Do not include circular ends in curved area.",
      "commonMistake": "πr²h is not an area formula.",
      "figure": null,
      "status": "draft-study",
      "origin": "original",
      "version": "2026.10.14.1"
    },
    {
      "id": "pl9-solid-cone1",
      "archetypeId": "pl9-solid-cone-slant",
      "question": "A cone has radius 3 cm and perpendicular height 4 cm. Find slant height, curved area and volume exactly.",
      "solutionSteps": [
        "Slant height √(3²+4²)=5 cm.",
        "Curved area πrl=15π cm².",
        "Volume=(1/3)πr²h=12π cm³."
      ],
      "answer": "5 cm; 15π cm²; 12π cm³",
      "check": {
        "kind": "cone",
        "r": 3,
        "h": 4,
        "slant": 5,
        "curved": 15,
        "volume": 12
      },
      "hint": "Slant height is not the perpendicular height.",
      "commonMistake": "Cone volume is one-third the matching cylinder.",
      "figure": null,
      "status": "draft-study",
      "origin": "original",
      "version": "2026.10.14.1"
    },
    {
      "id": "pl9-solid-cone2",
      "archetypeId": "pl9-solid-cone-slant",
      "question": "A right cone has radius 8 cm, height 15 cm. Calculate its slant height, curved area, and volume.",
      "solutionSteps": [
        "The right cross-section gives slant √(64+225)=17 cm.",
        "Curved area=π×8×17=136π cm².",
        "Volume=(1/3)π×64×15=320π cm³."
      ],
      "answer": "17 cm; 136π cm²; 320π cm³",
      "check": {
        "kind": "cone",
        "r": 8,
        "h": 15,
        "slant": 17,
        "curved": 136,
        "volume": 320
      },
      "hint": "Find slant length using Pythagoras.",
      "commonMistake": "Do not use h instead of l in curved area.",
      "figure": null,
      "status": "draft-study",
      "origin": "original",
      "version": "2026.10.14.1"
    },
    {
      "id": "pl9-solid-joined1",
      "archetypeId": "pl9-solid-composite-exposed",
      "question": "A hemisphere of radius 3 cm sits flush on top of a closed cylinder of radius 3 cm and height 10 cm. The shared circular seam is hidden. Find exterior area (including bottom) and volume.",
      "solutionSteps": [
        "Cylinder curved area=60π; hemisphere curved area=18π; bottom circle area=9π.",
        "Only exposed regions count: area=(60+18+9)π=87π cm².",
        "Volume=π×9×10+(2/3)π×27=(90+18)π=108π cm³."
      ],
      "answer": "87π cm²; 108π cm³",
      "check": {
        "kind": "composite-hemi-cylinder",
        "r": 3,
        "h": 10,
        "outer": 87,
        "volume": 108
      },
      "hint": "Include the bottom but not the hidden shared circular top.",
      "commonMistake": "Counting both touching circular faces inflates outer area.",
      "figure": {
        "kind": "hemi-on-cylinder",
        "radius": 3,
        "cylinderHeight": 10,
        "exposedParts": [
          "cylinder-lateral",
          "hemisphere-curved",
          "bottom-disc"
        ],
        "alt": "A hemisphere sits on a vertical cylinder of equal radius; the joining circle is internal."
      },
      "status": "draft-study",
      "origin": "original",
      "version": "2026.10.14.1"
    },
    {
      "id": "pl9-solid-joined2",
      "archetypeId": "pl9-solid-composite-exposed",
      "question": "An equal-radius hemisphere of radius 6 cm caps a cylinder of height 8 cm and radius 6 cm. Find total exposed area including the base, and total solid volume.",
      "solutionSteps": [
        "Lateral cylinder=96π, curved hemisphere=72π and base=36π.",
        "Exposed area=(96+72+36)π=204π cm².",
        "Total volume=π×36×8+(2/3)π×216=288π+144π=432π cm³."
      ],
      "answer": "204π cm²; 432π cm³",
      "check": {
        "kind": "composite-hemi-cylinder",
        "r": 6,
        "h": 8,
        "outer": 204,
        "volume": 432
      },
      "hint": "The circular join contributes no exterior area.",
      "commonMistake": "Area and volume scale differently.",
      "figure": {
        "kind": "hemi-on-cylinder",
        "radius": 6,
        "cylinderHeight": 8,
        "exposedParts": [
          "cylinder-lateral",
          "hemisphere-curved",
          "bottom-disc"
        ],
        "alt": "Hemisphere mounted on a matching-radius cylinder; the bottom face is visible and the join is not."
      },
      "status": "draft-study",
      "origin": "original",
      "version": "2026.10.14.1"
    },
    {
      "id": "pl9-solid-scale1",
      "archetypeId": "pl9-solid-dimension-scaling",
      "question": "A solid cylinder is enlarged so both radius and height are doubled. By what factors do total surface area and volume change?",
      "solutionSteps": [
        "Every area term involves two lengths, so it scales by 2².",
        "Total surface area factor=4.",
        "Volume πr²h involves three lengths, so its factor is 2³=8."
      ],
      "answer": "surface area ×4; volume ×8",
      "check": {
        "kind": "scale",
        "k": 2,
        "areaFactor": 4,
        "volumeFactor": 8
      },
      "hint": "Compare powers of the scale factor.",
      "commonMistake": "Area and volume do not scale by the same factor.",
      "figure": null,
      "status": "draft-study",
      "origin": "original",
      "version": "2026.10.14.1"
    },
    {
      "id": "pl9-solid-scale2",
      "archetypeId": "pl9-solid-dimension-scaling",
      "question": "A sphere is enlarged with all lengths tripled. Compare the new surface area and volume to the old.",
      "solutionSteps": [
        "The area formula 4πr² implies factor 3².",
        "Surface area grows by 9.",
        "The volume formula (4/3)πr³ implies factor 3³=27."
      ],
      "answer": "surface area ×9; volume ×27",
      "check": {
        "kind": "scale",
        "k": 3,
        "areaFactor": 9,
        "volumeFactor": 27
      },
      "hint": "Area depends on r² while volume depends on r³.",
      "commonMistake": "Tripling dimensions does not triple volume.",
      "figure": null,
      "status": "draft-study",
      "origin": "original",
      "version": "2026.10.14.1"
    }
  ]
};
export default class9SolidMeasure202627;
