// Original CBSE IX 2026-27 Euclid's-axioms student STUDY-ONLY draft; not wired, not server graded.
// Official PDF https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart1/Maths_SecP1IX_2026-27.pdf
export const class9Euclid202627 = {
  "id": "pl9-euclid-202627-draft1",
  "version": "2026.10.14.2",
  "grade": 9,
  "track": "CBSE Standard",
  "sourceUrl": "https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart1/Maths_SecP1IX_2026-27.pdf",
  "officialChapter": "Introduction to Euclid’s Geometry: Axioms and Postulates",
  "competencies": [
    "C-7.1",
    "C-7.3"
  ],
  "classification": "core, except modern square-construction extension marked enrichment",
  "status": "original-unwired-review-pending",
  "concepts": [
    "An axiom/postulate is an explicit premise; a theorem is a consequence proved by valid logical steps. A picture does not prove universal truth.",
    "Euclid's common notions of equal sums, equal differences and transitive equality require that the corresponding quantities actually be equal.",
    "The uniqueness of a line through two distinct points is a geometric incidence assumption; dropping 'distinct' changes the claim.",
    "Euclidean parallel-line uniqueness must identify the parallel postulate or an equivalent, not rely solely on appearance.",
    "Counterexamples invalidate a proposed universal implication when its hypotheses are satisfied but its conclusion fails.",
    "Modern square construction: create perpendicular equal adjacent sides and their parallels; historical Sulbasutra reconstructions require separately established provenance."
  ],
  "workedExamples": [
    {
      "id": "pl9-eucl-w01",
      "question": "Given a=b and b=c, prove a+4=c+4.",
      "steps": [
        "By transitivity of equality, a=c.",
        "Euclid's addition common notion permits adding the same number to equal quantities.",
        "Therefore a+4=c+4."
      ],
      "answer": "a+4=c+4",
      "proof": {
        "kind": "chain-add",
        "values": [
          6,
          6,
          6
        ],
        "offset": 4
      }
    },
    {
      "id": "pl9-eucl-w02",
      "question": "Why does a line through two distinct given points have a fixed direction?",
      "steps": [
        "A and B are assumed distinct.",
        "The Euclidean two-point incidence postulate determines the line AB uniquely.",
        "Any line through A and B coincides with AB; a rotated distinct line misses at least one point."
      ],
      "answer": "The line through two distinct points is unique",
      "proof": {
        "kind": "unique-line",
        "distinct": true,
        "count": 1
      }
    },
    {
      "id": "pl9-eucl-w03",
      "question": "Outline a modern straightedge-and-compass square construction on segment AB of length 3 cm, and show the diagonal.",
      "steps": [
        "Erect a perpendicular AD to AB at A and mark AD=AB=3.",
        "Through B draw a parallel to AD and through D a parallel to AB; call their intersection C. The resulting parallelogram has one right angle and adjacent equal sides, so is a square.",
        "By Pythagoras its diagonal AC=√(3²+3²)=3√2 cm. This is a modern verification, not a historical reconstruction of a Sulbasutra technique."
      ],
      "answer": "Square side 3 cm, diagonal 3√2 cm",
      "proof": {
        "kind": "square",
        "side": 3,
        "diagonalSquared": 18
      }
    }
  ],
  "questions": [
    {
      "id": "pl9-eucl-trans-1",
      "archetypeId": "pl9-eucl-transitivity",
      "question": "Segments AB, CD and EF satisfy AB=CD and CD=EF. What must be true? Give the exact reason.",
      "steps": [
        "Euclid's common notion: things equal to the same thing are equal to one another.",
        "Since AB=CD and CD=EF, both outer segments equal CD.",
        "Therefore AB=EF; no diagram or measurement is needed."
      ],
      "answer": "AB=EF",
      "proof": {
        "kind": "chain",
        "values": [
          5,
          5,
          5
        ],
        "relation": "AB=EF"
      },
      "hint": "Name the transitive equality axiom.",
      "commonError": "Do not infer the segments lie on the same line.",
      "review": "draft-independent-proof-review-pending",
      "rights": "original"
    },
    {
      "id": "pl9-eucl-trans-2",
      "archetypeId": "pl9-eucl-transitivity",
      "question": "Angles ∠P and ∠Q are equal, and ∠Q equals ∠R. Must ∠P and ∠R be equal, even if the angles are at different vertices?",
      "steps": [
        "Equality of measures is transitive.",
        "∠P and ∠R each equal ∠Q.",
        "Thus ∠P=∠R regardless of their location."
      ],
      "answer": "∠P=∠R",
      "proof": {
        "kind": "chain",
        "values": [
          37,
          37,
          37
        ],
        "relation": "∠P=∠R"
      },
      "hint": "Equality concerns size rather than position.",
      "commonError": "No shared vertex is required for equality of angle measures.",
      "review": "draft-independent-proof-review-pending",
      "rights": "original"
    },
    {
      "id": "pl9-eucl-add-1",
      "archetypeId": "pl9-eucl-addition-of-equals",
      "question": "Points A,B,C and D,E,F occur in that order on two lines. If AB=DE and BC=EF, prove AC=DF.",
      "steps": [
        "Betweenness gives AC=AB+BC and DF=DE+EF.",
        "Equal lengths added to equal lengths give equal totals.",
        "Hence AC=DF by Euclid's addition common notion."
      ],
      "answer": "AC=DF",
      "proof": {
        "kind": "segments-add",
        "left": [
          4,
          7
        ],
        "right": [
          4,
          7
        ]
      },
      "hint": "State the betweenness hypothesis before adding.",
      "commonError": "Without B and E between endpoints, segment sums need not be valid.",
      "review": "draft-independent-proof-review-pending",
      "rights": "original"
    },
    {
      "id": "pl9-eucl-add-2",
      "archetypeId": "pl9-eucl-addition-of-equals",
      "question": "Points G,H,I and J,K,L lie in order on two straight lines; GH=JK=6 cm and HI=KL=9 cm. Prove GI=JL.",
      "steps": [
        "By segment addition, GI=GH+HI and JL=JK+KL.",
        "Substitute the equal corresponding lengths: GI=6+9 and JL=6+9.",
        "Thus GI=JL=15 cm."
      ],
      "answer": "GI=JL=15 cm",
      "proof": {
        "kind": "segments-add",
        "left": [
          6,
          9
        ],
        "right": [
          6,
          9
        ]
      },
      "hint": "Two equal parts add to equal wholes.",
      "commonError": "Do not use GI=GH−HI when H lies between G and I.",
      "review": "draft-independent-proof-review-pending",
      "rights": "original"
    },
    {
      "id": "pl9-eucl-subtract-1",
      "archetypeId": "pl9-eucl-subtraction-of-equals",
      "question": "Points A,B,C and D,E,F lie in order. AC=DF=13 cm and AB=DE=5 cm. Prove BC=EF and find the length.",
      "steps": [
        "Because B and E are interior, BC=AC−AB and EF=DF−DE.",
        "Subtract equals from equals, yielding BC=EF.",
        "Both are 13−5=8 cm."
      ],
      "answer": "BC=EF=8 cm",
      "proof": {
        "kind": "segments-subtract",
        "whole": [
          13,
          13
        ],
        "part": [
          5,
          5
        ],
        "remainder": 8
      },
      "hint": "State the order of points to justify subtraction.",
      "commonError": "A segment difference is positive only when the designated point lies between.",
      "review": "draft-independent-proof-review-pending",
      "rights": "original"
    },
    {
      "id": "pl9-eucl-subtract-2",
      "archetypeId": "pl9-eucl-subtraction-of-equals",
      "question": "On collinear ordered triples P,Q,R and U,V,W, PR=UW=17 cm and PQ=UV=6 cm. Prove QR=VW and calculate it.",
      "steps": [
        "Q lies between P,R and V between U,W: QR=PR−PQ and VW=UW−UV.",
        "Equal wholes minus equal parts leave equal remainders.",
        "Therefore QR=VW=11 cm."
      ],
      "answer": "QR=VW=11 cm",
      "proof": {
        "kind": "segments-subtract",
        "whole": [
          17,
          17
        ],
        "part": [
          6,
          6
        ],
        "remainder": 11
      },
      "hint": "Use segment subtraction with stated betweenness.",
      "commonError": "Do not deduct lengths not known to belong to the given whole.",
      "review": "draft-independent-proof-review-pending",
      "rights": "original"
    },
    {
      "id": "pl9-eucl-counter-1",
      "archetypeId": "pl9-eucl-invalid-converse-countermodel",
      "question": "Two rectangles each have area 12 cm². Does equal area force congruence? Exhibit a counterexample.",
      "steps": [
        "A 2×6 rectangle has area 12 cm².",
        "A 3×4 rectangle also has area 12 cm².",
        "Their side-length multisets differ, so no rigid motion can make them coincide; equal areas do not imply congruence."
      ],
      "answer": "No; 2×6 and 3×4 are counterexamples",
      "proof": {
        "kind": "rectangle-area-countermodel",
        "a": [
          2,
          6
        ],
        "b": [
          3,
          4
        ]
      },
      "hint": "A counterexample needs the same premise but a false conclusion.",
      "commonError": "An equality of one measurement does not establish all side lengths.",
      "figure": {
        "kind": "two-rectangles",
        "rectangles": [
          [
            2,
            6
          ],
          [
            3,
            4
          ]
        ],
        "alt": "Two labelled rectangles, 2 by 6 and 3 by 4. No equality ticks or congruence marks."
      },
      "review": "draft-independent-proof-review-pending",
      "rights": "original"
    },
    {
      "id": "pl9-eucl-counter-2",
      "archetypeId": "pl9-eucl-invalid-converse-countermodel",
      "question": "Two rectangles each have perimeter 14 cm. Must their areas be equal? Disprove the statement.",
      "steps": [
        "The 2×5 rectangle has perimeter 2(2+5)=14 cm and area 10 cm².",
        "The 3×4 rectangle has perimeter 2(3+4)=14 cm and area 12 cm².",
        "The equal perimeters but unequal areas disprove the proposed implication."
      ],
      "answer": "No; areas 10 cm² and 12 cm²",
      "proof": {
        "kind": "rectangle-perimeter-countermodel",
        "a": [
          2,
          5
        ],
        "b": [
          3,
          4
        ]
      },
      "hint": "Preserve the hypothesis but violate the claimed conclusion.",
      "commonError": "Equal boundary lengths do not determine equal enclosed areas.",
      "figure": {
        "kind": "two-rectangles",
        "rectangles": [
          [
            2,
            5
          ],
          [
            3,
            4
          ]
        ],
        "alt": "Rectangles of sides 2 by 5 and 3 by 4, separately labelled; neither has a congruence symbol."
      },
      "review": "draft-independent-proof-review-pending",
      "rights": "original"
    },
    {
      "id": "pl9-eucl-incidence-1",
      "archetypeId": "pl9-eucl-two-point-uniqueness",
      "question": "A and B are distinct points. A pupil draws two supposedly different straight lines through both. Explain the logical flaw.",
      "steps": [
        "Euclidean incidence postulate: one straight line can be drawn through any two distinct points.",
        "Any line through both A and B is the unique line AB.",
        "Therefore the two described drawings coincide and cannot be distinct lines."
      ],
      "answer": "The lines coincide",
      "proof": {
        "kind": "unique-line",
        "distinct": true,
        "count": 1
      },
      "hint": "A≠B is crucial: one point alone does not determine a line.",
      "commonError": "Do not interpret two pencil strokes as two different geometric lines.",
      "review": "draft-independent-proof-review-pending",
      "rights": "original"
    },
    {
      "id": "pl9-eucl-incidence-2",
      "archetypeId": "pl9-eucl-two-point-uniqueness",
      "question": "Given distinct fixed points P and Q, how many straight lines contain both? Explain why adding a point R not on PQ changes the requirement.",
      "steps": [
        "A unique straight line passes through the two distinct points P and Q.",
        "If R is not on this line, that unique line does not contain R.",
        "No straight line passes through all three noncollinear points."
      ],
      "answer": "Exactly one through P,Q; none through P,Q,R",
      "proof": {
        "kind": "unique-line",
        "distinct": true,
        "count": 1,
        "noncollinearThird": true
      },
      "hint": "Distinguish a condition on two points from one on three noncollinear points.",
      "commonError": "Do not claim any arbitrary three points are collinear.",
      "review": "draft-independent-proof-review-pending",
      "rights": "original"
    },
    {
      "id": "pl9-eucl-parallel-1",
      "archetypeId": "pl9-eucl-euclidean-parallel-postulate",
      "question": "Point P lies off a line ℓ. In Euclidean plane geometry, how many lines through P can be parallel to ℓ? Name the assumption.",
      "steps": [
        "P is expressly outside ℓ.",
        "The Euclidean parallel postulate (Playfair's equivalent formulation) guarantees exactly one parallel through P.",
        "The uniqueness cannot be proved from neutral geometry without a parallel axiom."
      ],
      "answer": "Exactly one parallel through P",
      "proof": {
        "kind": "playfair",
        "pointOff": true,
        "parallelCount": 1
      },
      "hint": "Name the Euclidean, not spherical, setting.",
      "commonError": "This is a postulate/equivalent, not a universal rule for every geometry.",
      "review": "draft-independent-proof-review-pending",
      "rights": "original"
    },
    {
      "id": "pl9-eucl-parallel-2",
      "archetypeId": "pl9-eucl-euclidean-parallel-postulate",
      "question": "A line ℓ and point P not on ℓ are fixed. Someone claims to have constructed two distinct parallels to ℓ through P. Is that possible in the Euclidean plane?",
      "steps": [
        "Playfair's Euclidean parallel formulation gives a unique parallel through P.",
        "If both lines are parallel to ℓ and pass through P, each must be this same unique parallel.",
        "Thus the claim of distinct lines is impossible."
      ],
      "answer": "No; the two lines must coincide",
      "proof": {
        "kind": "playfair",
        "pointOff": true,
        "parallelCount": 1
      },
      "hint": "Uniqueness is the decisive part of the axiom.",
      "commonError": "The statement would need qualification outside Euclidean geometry.",
      "review": "draft-independent-proof-review-pending",
      "rights": "original"
    }
  ],
  "scopeNotes": [
    "Current 2026–27 syllabus also requires mathematical-history contributions and a Sulbasutra-attributed square construction; these are not yet covered by an independently provenance-verified historical lesson.",
    "These questions establish a logical-axiomatic beginning, not full-year chapter certification."
  ]
};
export default class9Euclid202627;
