// Original Class IX 2026–27 Quadrilaterals — not graded, not student served.
// https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart1/Maths_SecP1IX_2026-27.pdf
export const class9Quadrilaterals202627={
  "id": "pl9-quad-202627-study-v1",
  "version": "2026.10.14.2",
  "grade": 9,
  "track": "CBSE standard",
  "chapter": "4-gons (Quadrilaterals)",
  "competencies": [
    "C-4.2",
    "C-7.3"
  ],
  "sourceUrl": "https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart1/Maths_SecP1IX_2026-27.pdf",
  "status": "unwired-author-draft",
  "classification": "core",
  "rights": "original",
  "concepts": [
    "In parallelogram ABCD, opposite directed sides are equal; thus D=A+C−B for consecutively specified A,B,C.",
    "A nondegenerate quadrilateral is a parallelogram when its diagonals bisect one another; compare the exact midpoints of AC and BD.",
    "The midpoint segment joining two triangle side midpoints is parallel to the remaining side and half its length. The converse needs the second point to lie on the correct side.",
    "The centroid is the unique concurrence of the triangle's three medians and divides each median in ratio 2:1 from its vertex.",
    "Joining consecutive side midpoints of any simple quadrilateral produces a parallelogram (Varignon).",
    "Verifying coordinates in examples does not replace the general proof of a theorem."
  ],
  "workedExamples": [
    {
      "id": "pl9-quad-w1",
      "question": "A(0,0), B(4,0), C(6,3) are consecutive parallelogram vertices. Find D.",
      "steps": [
        "Use D−A=C−B.",
        "D=A+C−B=(2,3).",
        "Verify AB=(4,0)=DC and BC=(2,3)=AD."
      ],
      "answer": "D=(2,3)",
      "witness": {
        "kind": "fourth",
        "A": [
          0,
          0
        ],
        "B": [
          4,
          0
        ],
        "C": [
          6,
          3
        ],
        "D": [
          2,
          3
        ]
      }
    },
    {
      "id": "pl9-quad-w2",
      "question": "In triangle A(0,0), B(6,0), C(0,8), find the midsegment DE connecting AB and AC.",
      "steps": [
        "D=(3,0) and E=(0,4).",
        "DE=(-3,4) and BC=(-6,8)=2DE.",
        "Therefore DE=5, BC=10 and DE∥BC."
      ],
      "answer": "DE=5; BC=10; DE∥BC",
      "witness": {
        "kind": "midsegment",
        "A": [
          0,
          0
        ],
        "B": [
          6,
          0
        ],
        "C": [
          0,
          8
        ],
        "D": [
          3,
          0
        ],
        "E": [
          0,
          4
        ],
        "DE2": 25,
        "DEtext": "5",
        "BCtext": "10"
      }
    },
    {
      "id": "pl9-quad-w3",
      "question": "Triangle A(0,12), B(-3,0), C(3,0) has centroid G. Determine its position on median AM.",
      "steps": [
        "M=(0,0) is midpoint of BC.",
        "G=(A+B+C)/3=(0,4).",
        "Thus AG=8, GM=4 and AG:GM=2:1."
      ],
      "answer": "G=(0,4); AG=8; GM=4",
      "witness": {
        "kind": "centroid",
        "A": [
          0,
          12
        ],
        "B": [
          -3,
          0
        ],
        "C": [
          3,
          0
        ],
        "M": [
          0,
          0
        ],
        "G": [
          0,
          4
        ],
        "AG": 8,
        "GM": 4
      }
    }
  ],
  "questions": [
    {
      "id": "pl9-quad-v1",
      "archetypeId": "pl9-quad-fourth-vertex",
      "question": "A(1,2), B(5,2), C(7,6) are consecutive vertices of a parallelogram ABCD. Find D.",
      "steps": [
        "Opposite directed sides satisfy D-A=C-B.",
        "Therefore D=A+C-B=(3,6).",
        "Check AB=DC=(4,0) and AD=BC=(2,4)."
      ],
      "answer": "D=(3,6)",
      "witness": {
        "kind": "fourth",
        "A": [
          1,
          2
        ],
        "B": [
          5,
          2
        ],
        "C": [
          7,
          6
        ],
        "D": [
          3,
          6
        ]
      },
      "hint": "Use D=A+C-B.",
      "commonWrong": "Vertex order matters.",
      "figure": {
        "kind": "polygon",
        "points": [
          [
            1,
            2
          ],
          [
            5,
            2
          ],
          [
            7,
            6
          ],
          [
            3,
            6
          ]
        ],
        "alt": "ABCD has four labelled consecutive vertices on an equal-scale coordinate grid."
      },
      "origin": "original",
      "status": "draft"
    },
    {
      "id": "pl9-quad-v2",
      "archetypeId": "pl9-quad-fourth-vertex",
      "question": "Consecutive vertices A(-2,1), B(2,3), C(5,7) belong to parallelogram ABCD. Find D.",
      "steps": [
        "The directed vector AD must equal BC.",
        "D=A+C-B=(1,5).",
        "AD=(3,4)=BC and AB=(4,2)=DC."
      ],
      "answer": "D=(1,5)",
      "witness": {
        "kind": "fourth",
        "A": [
          -2,
          1
        ],
        "B": [
          2,
          3
        ],
        "C": [
          5,
          7
        ],
        "D": [
          1,
          5
        ]
      },
      "hint": "Use equal opposite directed sides.",
      "commonWrong": "D=A+B-C generally fails.",
      "figure": null,
      "origin": "original",
      "status": "draft"
    },
    {
      "id": "pl9-quad-d1",
      "archetypeId": "pl9-quad-diagonal-converse",
      "question": "Test if A(0,0), B(4,0), C(6,3), D(2,3) make a parallelogram using diagonals.",
      "steps": [
        "The midpoint of AC is (3,1.5).",
        "The midpoint of BD is also (3,1.5).",
        "Equal midpoints mean the diagonals bisect one another, so ABCD is a parallelogram."
      ],
      "answer": "Yes; midpoint (3,1.5)",
      "witness": {
        "kind": "diagonals",
        "points": [
          [
            0,
            0
          ],
          [
            4,
            0
          ],
          [
            6,
            3
          ],
          [
            2,
            3
          ]
        ],
        "midpoint": [
          3,
          1.5
        ]
      },
      "hint": "Check AC and BD midpoints.",
      "commonWrong": "Diagonals need not have equal lengths.",
      "figure": {
        "kind": "polygon-diagonals",
        "points": [
          [
            0,
            0
          ],
          [
            4,
            0
          ],
          [
            6,
            3
          ],
          [
            2,
            3
          ]
        ],
        "alt": "Quadrilateral ABCD with diagonals AC and BD shown; no equal-length diagonal ticks."
      },
      "origin": "original",
      "status": "draft"
    },
    {
      "id": "pl9-quad-d2",
      "archetypeId": "pl9-quad-diagonal-converse",
      "question": "For A(1,1), B(6,2), C(8,5), D(3,4), use the diagonal converse to classify ABCD.",
      "steps": [
        "Midpoint of AC is (4.5,3).",
        "Midpoint of BD is (4.5,3).",
        "The diagonals bisect each other, hence ABCD is a parallelogram."
      ],
      "answer": "Yes; midpoint (4.5,3)",
      "witness": {
        "kind": "diagonals",
        "points": [
          [
            1,
            1
          ],
          [
            6,
            2
          ],
          [
            8,
            5
          ],
          [
            3,
            4
          ]
        ],
        "midpoint": [
          4.5,
          3
        ]
      },
      "hint": "Midpoint is the average of the endpoints.",
      "commonWrong": "Do not compare diagonal lengths.",
      "figure": null,
      "origin": "original",
      "status": "draft"
    },
    {
      "id": "pl9-quad-m1",
      "archetypeId": "pl9-quad-midpoint-theorem",
      "question": "Triangle A(0,0), B(8,0), C(2,6): D and E are midpoints of AB and AC. Prove DE∥BC and find both lengths.",
      "steps": [
        "D=(4,0), E=(1,3), so DE=(-3,3).",
        "BC=(-6,6)=2DE, proving parallelism.",
        "Lengths: DE=3√2 and BC=6√2."
      ],
      "answer": "DE=3√2, BC=6√2; DE∥BC",
      "witness": {
        "kind": "midsegment",
        "A": [
          0,
          0
        ],
        "B": [
          8,
          0
        ],
        "C": [
          2,
          6
        ],
        "D": [
          4,
          0
        ],
        "E": [
          1,
          3
        ],
        "DE2": 18,
        "DEtext": "3√2",
        "BCtext": "6√2"
      },
      "hint": "Use vectors to establish parallelism.",
      "commonWrong": "Half-length alone does not prove a parallel line.",
      "figure": {
        "kind": "triangle-midsegment",
        "points": [
          [
            0,
            0
          ],
          [
            8,
            0
          ],
          [
            2,
            6
          ]
        ],
        "midpoints": [
          [
            4,
            0
          ],
          [
            1,
            3
          ]
        ],
        "alt": "Triangle ABC with D and E marked as the midpoints of sides AB and AC."
      },
      "origin": "original",
      "status": "draft"
    },
    {
      "id": "pl9-quad-m2",
      "archetypeId": "pl9-quad-midpoint-theorem",
      "question": "A(0,0), B(10,0), C(4,8). D and E bisect AB and AC. Show DE∥BC and find lengths.",
      "steps": [
        "D=(5,0), E=(2,4), giving DE=(-3,4).",
        "BC=(-6,8)=2DE, so DE∥BC.",
        "DE=5 units and BC=10 units."
      ],
      "answer": "DE=5, BC=10; DE∥BC",
      "witness": {
        "kind": "midsegment",
        "A": [
          0,
          0
        ],
        "B": [
          10,
          0
        ],
        "C": [
          4,
          8
        ],
        "D": [
          5,
          0
        ],
        "E": [
          2,
          4
        ],
        "DE2": 25,
        "DEtext": "5",
        "BCtext": "10"
      },
      "hint": "Compare directed vectors.",
      "commonWrong": "Do not assume the midpoint segment lies on BC.",
      "figure": null,
      "origin": "original",
      "status": "draft"
    },
    {
      "id": "pl9-quad-c1",
      "archetypeId": "pl9-quad-midpoint-converse",
      "question": "D is midpoint of AB in triangle ABC; E lies on AC and DE∥BC. If AC=10 cm, find AE and EC.",
      "steps": [
        "The converse midpoint theorem applies because E lies on AC and DE∥BC.",
        "Therefore E is the midpoint of AC.",
        "AE=EC=5 cm."
      ],
      "answer": "AE=EC=5 cm",
      "witness": {
        "kind": "midpoint-converse",
        "length": 10,
        "half": 5,
        "parallel": true,
        "onSegment": true
      },
      "hint": "List the converse theorem hypotheses.",
      "commonWrong": "Parallelism alone does not make E a midpoint.",
      "figure": null,
      "origin": "original",
      "status": "draft"
    },
    {
      "id": "pl9-quad-c2",
      "archetypeId": "pl9-quad-midpoint-converse",
      "question": "D bisects AB, E belongs to AC and DE∥BC. Given AC=14 cm, find AE and EC with proof.",
      "steps": [
        "Through D, the line parallel to BC meets AC at its midpoint.",
        "Thus AE=EC by the converse midpoint theorem.",
        "Each part is 14/2=7 cm."
      ],
      "answer": "AE=EC=7 cm",
      "witness": {
        "kind": "midpoint-converse",
        "length": 14,
        "half": 7,
        "parallel": true,
        "onSegment": true
      },
      "hint": "Check E lies on AC.",
      "commonWrong": "The segment midpoint condition is essential.",
      "figure": null,
      "origin": "original",
      "status": "draft"
    },
    {
      "id": "pl9-quad-g1",
      "archetypeId": "pl9-quad-centroid-median",
      "question": "A(0,6), B(-3,0), C(3,0). Find the centroid G and lengths AG and GM, where M is midpoint of BC.",
      "steps": [
        "M=(0,0).",
        "G=(A+B+C)/3=(0,2), two-thirds of the way from A to M.",
        "AG=4, GM=2; the ratio is 2:1."
      ],
      "answer": "G=(0,2); AG=4; GM=2",
      "witness": {
        "kind": "centroid",
        "A": [
          0,
          6
        ],
        "B": [
          -3,
          0
        ],
        "C": [
          3,
          0
        ],
        "M": [
          0,
          0
        ],
        "G": [
          0,
          2
        ],
        "AG": 4,
        "GM": 2
      },
      "hint": "Use the centroid's 2:1 median division.",
      "commonWrong": "The centroid is not generally the midpoint of a median.",
      "figure": {
        "kind": "triangle-centroid",
        "points": [
          [
            0,
            6
          ],
          [
            -3,
            0
          ],
          [
            3,
            0
          ]
        ],
        "median": [
          [
            0,
            6
          ],
          [
            0,
            0
          ]
        ],
        "centroid": [
          0,
          2
        ],
        "alt": "Triangle with median from A to midpoint M of BC; centroid G is marked on the median."
      },
      "origin": "original",
      "status": "draft"
    },
    {
      "id": "pl9-quad-g2",
      "archetypeId": "pl9-quad-centroid-median",
      "question": "Triangle A(0,9), B(-6,0), C(6,0): locate centroid G and calculate AG and GM.",
      "steps": [
        "M=(0,0) is midpoint of BC.",
        "G=(A+B+C)/3=(0,3).",
        "The distances along AM are AG=6 and GM=3."
      ],
      "answer": "G=(0,3); AG=6; GM=3",
      "witness": {
        "kind": "centroid",
        "A": [
          0,
          9
        ],
        "B": [
          -6,
          0
        ],
        "C": [
          6,
          0
        ],
        "M": [
          0,
          0
        ],
        "G": [
          0,
          3
        ],
        "AG": 6,
        "GM": 3
      },
      "hint": "Centroid coordinates are the average of the vertex coordinates.",
      "commonWrong": "Be careful which segment is twice the other.",
      "figure": null,
      "origin": "original",
      "status": "draft"
    },
    {
      "id": "pl9-quad-p1",
      "archetypeId": "pl9-quad-varignon-midpoints",
      "question": "Quadrilateral A(0,0),B(6,0),C(8,4),D(0,6) has successive side-midpoints P,Q,R,S. Prove PQRS is a parallelogram.",
      "steps": [
        "P=(3,0),Q=(7,2),R=(4,5),S=(0,3).",
        "PQ=(4,2)=SR and QR=(-3,3)=PS.",
        "Both pairs of opposite sides are equal as directed vectors; PQRS is a parallelogram."
      ],
      "answer": "P(3,0), Q(7,2), R(4,5), S(0,3); parallelogram",
      "witness": {
        "kind": "varignon",
        "points": [
          [
            0,
            0
          ],
          [
            6,
            0
          ],
          [
            8,
            4
          ],
          [
            0,
            6
          ]
        ],
        "mid": [
          [
            3,
            0
          ],
          [
            7,
            2
          ],
          [
            4,
            5
          ],
          [
            0,
            3
          ]
        ]
      },
      "hint": "Join consecutive side midpoints.",
      "commonWrong": "The original quadrilateral need not be a parallelogram.",
      "figure": {
        "kind": "quad-midpoints",
        "points": [
          [
            0,
            0
          ],
          [
            6,
            0
          ],
          [
            8,
            4
          ],
          [
            0,
            6
          ]
        ],
        "mid": [
          [
            3,
            0
          ],
          [
            7,
            2
          ],
          [
            4,
            5
          ],
          [
            0,
            3
          ]
        ],
        "alt": "A general quadrilateral with a second polygon connecting consecutive side midpoints."
      },
      "origin": "original",
      "status": "draft"
    },
    {
      "id": "pl9-quad-p2",
      "archetypeId": "pl9-quad-varignon-midpoints",
      "question": "For A(1,1),B(7,2),C(6,8),D(-2,6), calculate successive side-midpoints and prove their quadrilateral is a parallelogram.",
      "steps": [
        "P=(4,1.5),Q=(6.5,5),R=(2,7),S=(-0.5,3.5).",
        "PQ=(2.5,3.5)=SR and QR=(-4.5,2)=PS.",
        "Equal opposite directed vectors prove PQRS is a parallelogram."
      ],
      "answer": "P(4,1.5), Q(6.5,5), R(2,7), S(-0.5,3.5); parallelogram",
      "witness": {
        "kind": "varignon",
        "points": [
          [
            1,
            1
          ],
          [
            7,
            2
          ],
          [
            6,
            8
          ],
          [
            -2,
            6
          ]
        ],
        "mid": [
          [
            4,
            1.5
          ],
          [
            6.5,
            5
          ],
          [
            2,
            7
          ],
          [
            -0.5,
            3.5
          ]
        ]
      },
      "hint": "Compute the four midpoints first.",
      "commonWrong": "Do not assume the original quadrilateral is a parallelogram.",
      "figure": null,
      "origin": "original",
      "status": "draft"
    }
  ],
  "scopeNotes": [
    "General medians-concurrent proof, central symmetry, reflection/rotation symmetry and tiling the plane remain open for full outcome coverage."
  ]
};
export default class9Quadrilaterals202627;
