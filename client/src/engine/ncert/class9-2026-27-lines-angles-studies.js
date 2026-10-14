// Original Class IX Lines and Angles 2026–27 author draft only; no runtime import.
// https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart1/Maths_SecP1IX_2026-27.pdf
export const class9LinesAngles202627 = {
  "id": "pl9-lines-angles-202627-draft1",
  "version": "2026.10.14.2",
  "grade": 9,
  "track": "CBSE standard",
  "officialChapter": "Lines and Angles",
  "competencies": [
    "C-7.1",
    "C-7.3"
  ],
  "sourceUrl": "https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart1/Maths_SecP1IX_2026-27.pdf",
  "classification": "core",
  "status": "author-draft-unwired",
  "learningObjectives": [
    "Use linear-pair and vertical-opposite angle arguments with stated ray positions.",
    "Distinguish corresponding, alternate-interior and co-interior angles.",
    "Prove parallelism by a correct converse, not an unsupported picture.",
    "Use contrapositives or contradictions to rule out false parallelism claims."
  ],
  "concepts": [
    "A linear pair comprises two adjacent angles whose noncommon arms form one straight line; their measures add to 180°.",
    "Vertically opposite angles are equal because both are supplementary to the same adjacent angle.",
    "For parallel lines, corresponding and alternate interior angles agree while co-interior angles are supplementary; each relationship has a converse under Euclidean assumptions.",
    "The correct angle positions and the parallel-lines hypothesis are essential. Equal-looking drawn regions do not prove two lines parallel."
  ],
  "workedExamples": [
    {
      "id": "pl9-ang-w1",
      "question": "A linear pair has measures (3x−10)° and (2x+15)°. Find x.",
      "steps": [
        "Angles forming a straight line total 180°.",
        "(3x−10)+(2x+15)=180 gives 5x=175.",
        "Thus x=35, and the angles are 95° and 85°."
      ],
      "answer": "x=35; angles 95°, 85°",
      "proof": {
        "kind": "linear-pair",
        "forms": [
          [
            3,
            -10
          ],
          [
            2,
            15
          ]
        ],
        "x": 35,
        "angles": [
          95,
          85
        ]
      }
    },
    {
      "id": "pl9-ang-w2",
      "question": "Intersecting lines have vertical opposite angles measuring (2x+18)° and (4x−12)°. Solve.",
      "steps": [
        "Vertical opposite angles are equal.",
        "2x+18=4x−12 implies 2x=30, x=15.",
        "Each angle measures 48°."
      ],
      "answer": "x=15; angle 48°",
      "proof": {
        "kind": "vertical",
        "forms": [
          [
            2,
            18
          ],
          [
            4,
            -12
          ]
        ],
        "x": 15,
        "angle": 48
      }
    },
    {
      "id": "pl9-ang-w3",
      "question": "Two parallel lines are cut by a transversal. An acute corresponding angle is 73°. Find the matching angle and its neighbour.",
      "steps": [
        "Corresponding angles at parallel lines are equal.",
        "The matching angle is 73°.",
        "An adjacent linear-pair angle is 180°−73°=107°."
      ],
      "answer": "corresponding 73°; adjacent 107°",
      "proof": {
        "kind": "corresponding",
        "theta": 73,
        "corresponding": 73,
        "adjacent": 107
      }
    }
  ],
  "questions": [
    {
      "id": "pl9-ang-pair1",
      "archetypeId": "pl9-ang-linear-pair",
      "question": "Adjacent angles on one straight line are (2x+10)° and (3x−5)°. Find x and both angles.",
      "steps": [
        "A straight angle is 180°, so adjacent angles sum to 180°.",
        "2x+10+3x−5=180 gives 5x=175, x=35.",
        "The angles are 80° and 100°; they sum to 180°."
      ],
      "answer": "x=35; angles 80°, 100°",
      "proof": {
        "kind": "linear-pair",
        "forms": [
          [
            2,
            10
          ],
          [
            3,
            -5
          ]
        ],
        "x": 35,
        "angles": [
          80,
          100
        ]
      },
      "hint": "The rays must form a straight line.",
      "commonError": "Vertical-opposite angles are equal, not supplementary.",
      "figure": null,
      "origin": "original",
      "status": "author-draft"
    },
    {
      "id": "pl9-ang-pair2",
      "archetypeId": "pl9-ang-linear-pair",
      "question": "A linear pair is (x+20)° and (2x+10)°. Determine x and the angles.",
      "steps": [
        "A linear pair totals 180°.",
        "(x+20)+(2x+10)=180 yields 3x=150, x=50.",
        "Angles are 70° and 110°."
      ],
      "answer": "x=50; angles 70°, 110°",
      "proof": {
        "kind": "linear-pair",
        "forms": [
          [
            1,
            20
          ],
          [
            2,
            10
          ]
        ],
        "x": 50,
        "angles": [
          70,
          110
        ]
      },
      "hint": "Use addition to 180°, not equality.",
      "commonError": "Do not divide 180 by 2 without an equal-angle premise.",
      "figure": null,
      "origin": "original",
      "status": "author-draft"
    },
    {
      "id": "pl9-ang-vert1",
      "archetypeId": "pl9-ang-vertical-opposites",
      "question": "Two opposite angles formed by intersecting straight lines measure (4x+12)° and (6x−18)°. Find x and the angle.",
      "steps": [
        "Vertically opposite angles are equal because each supplements the same adjacent angle.",
        "Set 4x+12=6x−18, giving 2x=30 and x=15.",
        "Either angle is 4×15+12=72°."
      ],
      "answer": "x=15; both 72°",
      "proof": {
        "kind": "vertical",
        "forms": [
          [
            4,
            12
          ],
          [
            6,
            -18
          ]
        ],
        "x": 15,
        "angle": 72
      },
      "hint": "Equate opposite, not adjacent, angles.",
      "commonError": "An equality must have proof of opposite ray pairs.",
      "figure": null,
      "origin": "original",
      "status": "author-draft"
    },
    {
      "id": "pl9-ang-vert2",
      "archetypeId": "pl9-ang-vertical-opposites",
      "question": "At an intersection, vertical opposite angles are (5x+6)° and (3x+38)°. Calculate x and their measure.",
      "steps": [
        "Vertically opposite angles have equal measures.",
        "5x+6=3x+38 gives x=16.",
        "Each is 86°; adjacent angles would be 94°."
      ],
      "answer": "x=16; each 86°",
      "proof": {
        "kind": "vertical",
        "forms": [
          [
            5,
            6
          ],
          [
            3,
            38
          ]
        ],
        "x": 16,
        "angle": 86
      },
      "hint": "Identify which regions are opposite.",
      "commonError": "Subtract coefficients carefully.",
      "figure": null,
      "origin": "original",
      "status": "author-draft"
    },
    {
      "id": "pl9-ang-corr1",
      "archetypeId": "pl9-ang-parallel-corresponding",
      "question": "A transversal cuts two parallel lines. An angle at the first intersection is 64°; the angle at the second intersection in the corresponding relative position is β. Find β and its adjacent linear-pair angle.",
      "steps": [
        "Parallel lines cut by a transversal have equal corresponding angles.",
        "Therefore β=64°.",
        "Its adjacent angle is 180°−64°=116°."
      ],
      "answer": "β=64°; adjacent 116°",
      "proof": {
        "kind": "corresponding",
        "theta": 64,
        "corresponding": 64,
        "adjacent": 116
      },
      "hint": "Corresponding means identical relative positions at the two intersections.",
      "commonError": "Do not call every pair of angles at different vertices corresponding.",
      "figure": {
        "kind": "parallel-transversal",
        "parallelY": [
          0,
          3
        ],
        "transversalDeg": 64,
        "sector": "acute",
        "alt": "Two parallel horizontal lines cut by a sloping transversal; matching sectors are indicated without numeric labels."
      },
      "origin": "original",
      "status": "author-draft"
    },
    {
      "id": "pl9-ang-corr2",
      "archetypeId": "pl9-ang-parallel-corresponding",
      "question": "Two parallel lines are crossed by one transversal. A corresponding angle to 118° is γ. Find γ and the linear-pair angle next to γ.",
      "steps": [
        "Corresponding angles are equal since the lines are parallel.",
        "Thus γ=118°.",
        "The supplementary adjacent angle is 62°."
      ],
      "answer": "γ=118°; adjacent 62°",
      "proof": {
        "kind": "corresponding",
        "theta": 118,
        "corresponding": 118,
        "adjacent": 62
      },
      "hint": "Distinguish obtuse from acute corresponding sectors.",
      "commonError": "There is no reason to turn an obtuse corresponding angle into the acute supplement.",
      "figure": {
        "kind": "parallel-transversal",
        "parallelY": [
          0,
          3
        ],
        "transversalDeg": 62,
        "sector": "obtuse",
        "alt": "Two horizontal parallel lines crossed by one transversal; the referenced sectors are obtuse and correspond."
      },
      "origin": "original",
      "status": "author-draft"
    },
    {
      "id": "pl9-ang-alt1",
      "archetypeId": "pl9-ang-alternate-interior-converse",
      "question": "A transversal meets two distinct lines, making a pair of alternate interior angles of 72° and 72°. Under Euclidean geometry, what follows about the lines? State the converse theorem.",
      "steps": [
        "Both given angles are alternate interior, not merely arbitrary.",
        "The converse of the alternate interior angle theorem says equal alternate interior angles imply the lines are parallel.",
        "Thus the two lines are parallel."
      ],
      "answer": "The lines are parallel",
      "proof": {
        "kind": "alternate-converse",
        "angles": [
          72,
          72
        ],
        "parallel": true
      },
      "hint": "The precise angle positions are needed for the converse.",
      "commonError": "Equality of two unrelated angles does not prove parallelism.",
      "figure": {
        "kind": "parallel-transversal",
        "parallelY": [
          0,
          4
        ],
        "transversalDeg": 72,
        "sector": "alternate-interior",
        "alt": "A transversal cuts two lines, with alternate interior sectors selected."
      },
      "origin": "original",
      "status": "author-draft"
    },
    {
      "id": "pl9-ang-alt2",
      "archetypeId": "pl9-ang-alternate-interior-converse",
      "question": "Alternate interior angles on a transversal of two lines are each 109°. Can you conclude the lines are parallel? Explain which theorem direction is used.",
      "steps": [
        "The angles are explicitly alternate interior positions.",
        "Their equal measures trigger the converse theorem.",
        "Therefore the two lines are parallel."
      ],
      "answer": "Yes; the lines are parallel",
      "proof": {
        "kind": "alternate-converse",
        "angles": [
          109,
          109
        ],
        "parallel": true
      },
      "hint": "This is a converse, not the forward theorem.",
      "commonError": "Equal angles are useful only with stated incidence positions.",
      "figure": {
        "kind": "parallel-transversal",
        "parallelY": [
          0,
          4
        ],
        "transversalDeg": 71,
        "sector": "alternate-interior-obtuse",
        "alt": "Alternate interior obtuse sectors are selected at intersections of a transversal with two parallel lines."
      },
      "origin": "original",
      "status": "author-draft"
    },
    {
      "id": "pl9-ang-coin1",
      "archetypeId": "pl9-ang-co-interior-supplement",
      "question": "A transversal crosses parallel lines. Co-interior angles are (2x+15)° and (3x−5)°. Calculate x and the two angle measures.",
      "steps": [
        "Co-interior angles on parallel lines sum to 180°.",
        "(2x+15)+(3x−5)=180 gives 5x=170 and x=34.",
        "The angles are 83° and 97°."
      ],
      "answer": "x=34; angles 83°, 97°",
      "proof": {
        "kind": "co-interior",
        "forms": [
          [
            2,
            15
          ],
          [
            3,
            -5
          ]
        ],
        "x": 34,
        "angles": [
          83,
          97
        ]
      },
      "hint": "Same-side interior, not alternate interior, implies supplementary.",
      "commonError": "Do not make co-interior angles equal.",
      "figure": null,
      "origin": "original",
      "status": "author-draft"
    },
    {
      "id": "pl9-ang-coin2",
      "archetypeId": "pl9-ang-co-interior-supplement",
      "question": "For parallel lines and a transversal, co-interior angles are (4x−7)° and (x+12)°. Find x and the angles.",
      "steps": [
        "Co-interior angles are supplementary.",
        "4x−7+x+12=180 implies 5x=175 and x=35.",
        "The measures are 133° and 47°."
      ],
      "answer": "x=35; angles 133°, 47°",
      "proof": {
        "kind": "co-interior",
        "forms": [
          [
            4,
            -7
          ],
          [
            1,
            12
          ]
        ],
        "x": 35,
        "angles": [
          133,
          47
        ]
      },
      "hint": "Set their sum to 180°.",
      "commonError": "The larger angle need not be at the higher intersection.",
      "figure": null,
      "origin": "original",
      "status": "author-draft"
    },
    {
      "id": "pl9-ang-invalid1",
      "archetypeId": "pl9-ang-nonparallel-counterexample",
      "question": "Two corresponding angles made by a transversal are 68° and 71°. Are the lines parallel in Euclidean geometry? Justify.",
      "steps": [
        "If the lines were parallel, corresponding angles would be equal.",
        "68°≠71°, contradicting the required equality.",
        "By the contrapositive of the corresponding-angle theorem, the lines are not parallel."
      ],
      "answer": "No; the lines are not parallel",
      "proof": {
        "kind": "nonparallel-corresponding",
        "angles": [
          68,
          71
        ],
        "parallel": false
      },
      "hint": "Use the contrapositive of the forward theorem.",
      "commonError": "Approximate-looking angles in an illustration do not establish exact equality.",
      "figure": null,
      "origin": "original",
      "status": "author-draft"
    },
    {
      "id": "pl9-ang-invalid2",
      "archetypeId": "pl9-ang-nonparallel-counterexample",
      "question": "At two line intersections, the same-side interior angles are 104° and 72°. Can the crossed lines be parallel?",
      "steps": [
        "For parallel lines, such co-interior angles sum to 180°.",
        "Here 104°+72°=176°, not 180°.",
        "Therefore the two crossed lines cannot be parallel."
      ],
      "answer": "No; the lines are not parallel",
      "proof": {
        "kind": "nonparallel-cointerior",
        "angles": [
          104,
          72
        ],
        "parallel": false
      },
      "hint": "Use the supplementary criterion.",
      "commonError": "A four-degree mismatch cannot be dismissed as drawing error if the measures are given exactly.",
      "figure": null,
      "origin": "original",
      "status": "author-draft"
    }
  ],
  "scopeNotes": [
    "Additional official scope still needing separate material: reflex-angle classification, ray and angle definitions, transitivity of parallelism, vertical-opposite proof from first principles, and triangle-angle logical bounds.",
    "Figures are coordinate/vector specifications, not certified browser-rendered diagrams."
  ]
};
export default class9LinesAngles202627;
