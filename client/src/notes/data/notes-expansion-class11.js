// Original Pri Learning supplementary notes, Class 11; optional JEE bridges explicitly labelled.
// DRAFT: mathematical review and complete release CI required; not an exam difficulty certification.
export default {
  "c11-sets": {
    "concepts": [
      {
        "title": "Counting a union without double counting",
        "body": "The sum |A|+|B| counts shared members twice. Subtract |A intersect B| once to obtain |A union B|. A three-set calculation requires inclusion–exclusion at the third level."
      }
    ],
    "points": [
      {
        "front": "Why is an intersection subtracted in a two-set union count?",
        "back": "Each shared element is initially counted once in each set, so it must be removed once."
      }
    ],
    "mistakes": [
      {
        "wrong": "For finite sets, |A union B| always equals |A|+|B|.",
        "right": "Subtract the intersection cardinality when the sets overlap."
      }
    ],
    "examples": [
      {
        "question": "A has 18 elements, B has 14 and 5 are shared. Find the number in A union B.",
        "steps": [
          "Start with 18+14=32.",
          "The 5 shared members were counted twice.",
          "Subtract once to get 27."
        ],
        "answer": "27",
        "verify": {
          "kind": "value",
          "expr": "18+14-5",
          "answer": "27"
        }
      }
    ]
  },
  "c11-relations-functions": {
    "concepts": [
      {
        "title": "A function is a rule with an output contract",
        "body": "Every element of the domain must have exactly one image. Different inputs may share an output; injectivity is additional, while surjectivity depends on the stated codomain rather than just a graph."
      }
    ],
    "points": [
      {
        "front": "Can two different inputs of a function produce the same output?",
        "back": "Yes. This is allowed unless the function is required to be injective."
      }
    ],
    "mistakes": [
      {
        "wrong": "If every output is non-negative, a function must be one-to-one.",
        "right": "The function x↦x² on real numbers is not one-to-one because x and -x have the same image."
      }
    ],
    "examples": [
      {
        "question": "For f(x)=2x²-3, evaluate f(-2)+f(3).",
        "steps": [
          "f(-2)=2×4-3=5.",
          "f(3)=2×9-3=15.",
          "Their sum is 20."
        ],
        "answer": "20",
        "verify": {
          "kind": "value",
          "expr": "(2*(-2)^2-3)+(2*3^2-3)",
          "answer": "20"
        }
      }
    ]
  },
  "c11-trig-functions": {
    "concepts": [
      {
        "title": "Periodicity must respect transformations",
        "body": "sin(x) has period 2 pi, whereas sin(kx) repeats after 2 pi/|k| for non-zero k. A horizontal translation moves peaks but does not change the period."
      }
    ],
    "points": [
      {
        "front": "Why is the period of sin(3x) one third of that of sin(x)?",
        "back": "Tripling the angle reaches a full 2 pi cycle with only 2 pi/3 change in x."
      }
    ],
    "mistakes": [
      {
        "wrong": "The period of sin(x+pi/6) is pi/6.",
        "right": "A phase shift changes where the graph starts, not its 2 pi period."
      }
    ],
    "examples": [
      {
        "question": "Solve sin(2x)=0 for 0≤x<2pi and count the solutions.",
        "steps": [
          "sin(theta)=0 for integer multiples of pi.",
          "Thus 2x=k pi and x=k pi/2.",
          "For k=0,1,2,3 there are four solutions."
        ],
        "answer": "4 solutions",
        "verify": {
          "kind": "value",
          "expr": "2*2",
          "answer": "4"
        }
      }
    ]
  },
  "c11-complex-numbers": {
    "concepts": [
      {
        "title": "Argand geometry turns modulus into distance",
        "body": "For z=x+iy, |z-a| is the distance from point (x,y) to the Argand point a. Equal distances to two distinct points define a perpendicular bisector. This geometric lens is essential for advanced locus questions."
      }
    ],
    "points": [
      {
        "front": "Why does complex conjugation reflect a point across the real axis?",
        "back": "Conjugation sends x+iy to x-iy: horizontal coordinate unchanged, vertical coordinate reversed."
      }
    ],
    "mistakes": [
      {
        "wrong": "The principal argument of a product is always the arithmetic sum of the two principal arguments.",
        "right": "After adding angles, reduce by a multiple of 2 pi into the principal-argument interval; zero has no argument."
      }
    ],
    "examples": [
      {
        "question": "Optional JEE extension: Find the locus of complex z satisfying |z-1|=|z+3|.",
        "steps": [
          "Write z=x+iy and square the two moduli.",
          "(x-1)²+y²=(x+3)²+y² gives -2x+1=6x+9.",
          "Therefore x=-1, a vertical line."
        ],
        "answer": "Re(z)=-1",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "(-1-1)^2",
              "4"
            ],
            [
              "(-1+3)^2",
              "4"
            ]
          ]
        }
      },
      {
        "question": "Optional JEE bridge: use roots of unity to simplify 1+omega+omega² for non-real cube root omega of 1.",
        "steps": [
          "Since omega³=1 and omega≠1, (omega-1)(omega²+omega+1)=0.",
          "Divide by the nonzero omega-1.",
          "Thus 1+omega+omega²=0."
        ],
        "answer": "0",
        "verify": {
          "kind": "value",
          "expr": "1-1",
          "answer": "0"
        }
      },
      {
        "question": "Optional JEE bridge: given |z-2|=3, find the least and greatest possible |z|.",
        "steps": [
          "The locus is a circle of radius 3 centred at real coordinate 2.",
          "The closest point on the circle to the origin is -1; the farthest is 5.",
          "Hence min |z|=1 and max |z|=5."
        ],
        "answer": "minimum 1, maximum 5",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "3-2",
              "1"
            ],
            [
              "3+2",
              "5"
            ]
          ]
        }
      },
      {
        "question": "Optional JEE bridge: write down the two roots of z²-2z+5=0.",
        "steps": [
          "Complete the square: (z-1)²=-4.",
          "Therefore z-1=±2i.",
          "The two roots are 1+2i and 1-2i."
        ],
        "answer": "1±2i",
        "verify": {
          "kind": "value",
          "expr": "(-2)^2-4*1*5",
          "answer": "-16"
        }
      },
      {
        "question": "Optional JEE bridge: z=3+4i and w=-3+4i. Compare |z+w| with |z|+|w|.",
        "steps": [
          "Both original moduli are 5.",
          "The sum is 8i with modulus 8.",
          "Thus 8≤10, illustrating triangle inequality with a strict gap."
        ],
        "answer": "|z+w|=8; |z|+|w|=10",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "sqrt(3^2+4^2)",
              "5"
            ],
            [
              "sqrt((-3)^2+4^2)",
              "5"
            ],
            [
              "sqrt(8^2)",
              "8"
            ]
          ]
        }
      },
      {
        "question": "Optional JEE bridge: reflect z=4-7i across the real axis and give |z|².",
        "steps": [
          "Reflection across the real axis conjugates z, giving 4+7i.",
          "Modulus is unchanged under conjugation.",
          "|z|²=4²+(-7)²=65."
        ],
        "answer": "conjugate 4+7i; squared modulus 65",
        "verify": {
          "kind": "value",
          "expr": "4^2+(-7)^2",
          "answer": "65"
        }
      },
      {
        "question": "Optional JEE bridge: if z1=z2=-1+i, find the principal argument of z1z2.",
        "steps": [
          "Each principal argument is 3pi/4.",
          "Multiplication gives (-1+i)²=-2i, whose principal argument is -pi/2.",
          "Adding principal arguments gives 3pi/2, which must be reduced by 2pi."
        ],
        "answer": "-pi/2",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "(-1)^2-1^2",
              "0"
            ],
            [
              "2*(-1)*1",
              "-2"
            ]
          ]
        }
      },
      {
        "question": "Optional JEE bridge: for z=1+i sqrt(3), find |z| and z³.",
        "steps": [
          "|z|=2 and a polar argument is pi/3.",
          "Cubing gives modulus 2³=8 and argument pi.",
          "Therefore z³=-8."
        ],
        "answer": "|z|=2; z³=-8",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "sqrt(1^2+3)",
              "2"
            ],
            [
              "2^3",
              "8"
            ]
          ]
        }
      }
    ]
  },
  "c11-linear-inequalities": {
    "concepts": [
      {
        "title": "Boundary points require an explicit decision",
        "body": "A strict inequality excludes the boundary; a non-strict inequality includes it. When multiplying by a negative number, order reverses because negative scaling reverses the number line."
      }
    ],
    "points": [
      {
        "front": "Why do inequality signs reverse when multiplied by -1?",
        "back": "If a<b, then b-a>0, so (-a)-(-b)=b-a>0 and -a>-b."
      }
    ],
    "mistakes": [
      {
        "wrong": "Dividing both sides by a negative value preserves the inequality direction.",
        "right": "The sign must reverse under multiplication or division by a negative."
      }
    ],
    "examples": [
      {
        "question": "Solve -3x+5>14 and state the greatest integer solution.",
        "steps": [
          "Subtract 5: -3x>9.",
          "Divide by -3 and reverse: x<-3.",
          "The greatest integer strictly below -3 is -4."
        ],
        "answer": "-4",
        "verify": {
          "kind": "value",
          "expr": "-3*(-4)+5",
          "answer": "17"
        }
      }
    ]
  },
  "c11-permutations-combinations": {
    "concepts": [
      {
        "title": "Distinguish selecting from assigning roles",
        "body": "Choosing r objects from n ignores their order; arranging the chosen objects multiplies by r!. Explicitly list what counts as a distinct outcome before selecting nCr or nPr."
      }
    ],
    "points": [
      {
        "front": "How can an unordered selection become an ordered arrangement?",
        "back": "Multiply by r! if all r chosen objects are distinct and every order is allowed."
      }
    ],
    "mistakes": [
      {
        "wrong": "The number of ways to select three people for a committee equals the number of ways to choose a chair, secretary and treasurer.",
        "right": "Named roles distinguish outcomes; unlabelled committee membership does not."
      }
    ],
    "examples": [
      {
        "question": "From 6 students, how many choices of chair and vice-chair are there?",
        "steps": [
          "Choose a chair in 6 ways.",
          "Choose a different vice-chair in 5 ways.",
          "Multiply to obtain 30 assignments."
        ],
        "answer": "30",
        "verify": {
          "kind": "value",
          "expr": "6*5",
          "answer": "30"
        }
      }
    ]
  },
  "c11-binomial-theorem": {
    "concepts": [
      {
        "title": "Coefficient and term are different objects",
        "body": "In (a+b)^n, the term indexed by r is C(n,r) a^(n-r) b^r. When b contains a negative sign or power of x, carry those into the full term before extracting the requested coefficient."
      }
    ],
    "points": [
      {
        "front": "What does symmetry C(n,r)=C(n,n-r) represent?",
        "back": "A subset of r selected objects corresponds to the complementary subset of n-r objects."
      }
    ],
    "mistakes": [
      {
        "wrong": "The binomial coefficient determines the sign of every term.",
        "right": "The signs also depend on a and b, particularly when b is negative."
      }
    ],
    "examples": [
      {
        "question": "Find the coefficient of x³ in (1+2x)^5.",
        "steps": [
          "The x³ term uses r=3.",
          "Its coefficient is C(5,3)×2³=10×8.",
          "Hence the coefficient is 80."
        ],
        "answer": "80",
        "verify": {
          "kind": "value",
          "expr": "10*2^3",
          "answer": "80"
        }
      }
    ]
  },
  "c11-sequences-series": {
    "concepts": [
      {
        "title": "A sequence is indexed; a series accumulates",
        "body": "A sequence gives the nth object a_n. A series gives partial sums S_n. For a geometric progression with ratio r≠1, (1-r)S_n=a(1-r^n), obtained by subtracting r times the sum."
      }
    ],
    "points": [
      {
        "front": "Why is the infinite GP formula invalid for |r|≥1?",
        "back": "The term r^n does not tend to zero, so the finite-sum limit generally does not exist."
      }
    ],
    "mistakes": [
      {
        "wrong": "Any geometric progression has a finite infinite sum.",
        "right": "Convergence requires |r|<1 for non-zero first term."
      }
    ],
    "examples": [
      {
        "question": "Find the first five terms' sum in a GP with first term 3 and ratio 2.",
        "steps": [
          "The terms are 3,6,12,24,48.",
          "Sum these five terms or use 3(2^5-1)/(2-1).",
          "Result is 93."
        ],
        "answer": "93",
        "verify": {
          "kind": "value",
          "expr": "3*(2^5-1)",
          "answer": "93"
        }
      }
    ]
  },
  "c11-straight-lines": {
    "concepts": [
      {
        "title": "Slope is a change ratio, not a coordinate",
        "body": "For two distinct points with different x-coordinates, m=Δy/Δx. A vertical line has undefined slope, not zero slope; the slope of a horizontal line is zero."
      }
    ],
    "points": [
      {
        "front": "Why can't a vertical line be written y=mx+c with finite m?",
        "back": "Its x-value is fixed while y varies, so it fails the representation as a single y for every x."
      }
    ],
    "mistakes": [
      {
        "wrong": "A vertical line has slope 0.",
        "right": "A horizontal line has slope 0; a vertical line has undefined slope."
      }
    ],
    "examples": [
      {
        "question": "Find the gradient of the line through (-2,5) and (4,-7).",
        "steps": [
          "Rise = -7-5=-12.",
          "Run =4-(-2)=6.",
          "Gradient =-12/6=-2."
        ],
        "answer": "-2",
        "verify": {
          "kind": "value",
          "expr": "(-7-5)/(4+2)",
          "answer": "-2"
        }
      }
    ]
  },
  "c11-conic-sections": {
    "concepts": [
      {
        "title": "A conic definition is a distance condition",
        "body": "A parabola is the set of points equidistant from a focus and a directrix. Deriving its equation by squaring distances is more reliable than memorising orientation-dependent formulas."
      }
    ],
    "points": [
      {
        "front": "What distinguishes the focus and directrix of a parabola?",
        "back": "The focus is a point; the directrix is a line. Each parabola point has equal distances to both."
      }
    ],
    "mistakes": [
      {
        "wrong": "All parabolas open upwards.",
        "right": "Orientation depends on the focus/directrix placement and sign of the parameter."
      }
    ],
    "examples": [
      {
        "question": "For y²=12x, find the focal distance p and focus.",
        "steps": [
          "Compare with y²=4px.",
          "4p=12, so p=3.",
          "The focus is (3,0)."
        ],
        "answer": "(3,0)",
        "verify": {
          "kind": "value",
          "expr": "12/4",
          "answer": "3"
        }
      }
    ]
  },
  "c11-3d-introduction": {
    "concepts": [
      {
        "title": "Three coordinates encode three independent directions",
        "body": "In Cartesian 3D coordinates, differences in x, y and z describe mutually perpendicular displacements. The Pythagorean theorem applies twice to get the 3D distance formula."
      }
    ],
    "points": [
      {
        "front": "Can a 3D distance be less than the absolute x-coordinate difference?",
        "back": "No, because the squared y and z differences add non-negative contributions."
      }
    ],
    "mistakes": [
      {
        "wrong": "Two points with different z-coordinates can have zero distance if x and y agree.",
        "right": "Zero distance requires all three coordinate differences to be zero."
      }
    ],
    "examples": [
      {
        "question": "Find distance from (1,2,3) to (3,5,9).",
        "steps": [
          "The coordinate differences are 2,3,6.",
          "Distance²=2²+3²+6²=49.",
          "Distance=7."
        ],
        "answer": "7",
        "verify": {
          "kind": "value",
          "expr": "sqrt(2^2+3^2+6^2)",
          "answer": "7"
        }
      }
    ]
  },
  "c11-limits-derivatives": {
    "concepts": [
      {
        "title": "A limit concerns nearby behaviour, not a hole's assigned value",
        "body": "A removable discontinuity may have a finite limit even if f(a) is undefined. Simplifying a rational expression away from the excluded point can reveal the limit without pretending the original denominator was non-zero at that point."
      }
    ],
    "points": [
      {
        "front": "Why may a limit exist when the expression is undefined at x=a?",
        "back": "The limit depends on values approaching a, not on the value exactly at a."
      }
    ],
    "mistakes": [
      {
        "wrong": "If direct substitution gives 0/0, the limit is necessarily zero.",
        "right": "0/0 is indeterminate and requires algebraic or analytic investigation."
      }
    ],
    "examples": [
      {
        "question": "Evaluate lim(x→2) (x²-4)/(x-2).",
        "steps": [
          "Factor the numerator as (x-2)(x+2).",
          "For x≠2, cancel the nonzero factor x-2.",
          "The limit of x+2 as x→2 is 4."
        ],
        "answer": "4",
        "verify": {
          "kind": "value",
          "expr": "2+2",
          "answer": "4"
        }
      }
    ]
  },
  "c11-statistics": {
    "concepts": [
      {
        "title": "Spread is not captured by the mean",
        "body": "Two datasets can have identical means but very different dispersion. Variance averages squared deviations from the mean; standard deviation takes the square root to restore original units."
      }
    ],
    "points": [
      {
        "front": "Why are deviations squared in variance?",
        "back": "Positive and negative deviations would otherwise cancel, hiding spread."
      }
    ],
    "mistakes": [
      {
        "wrong": "A small mean guarantees a small standard deviation.",
        "right": "Mean measures centre; standard deviation measures spread and can be large for any centre."
      }
    ],
    "examples": [
      {
        "question": "Find population variance of 1,3,5.",
        "steps": [
          "Mean =3.",
          "Squared deviations are 4,0,4.",
          "Population variance =(4+0+4)/3=8/3."
        ],
        "answer": "8/3",
        "verify": {
          "kind": "value",
          "expr": "(4+0+4)/3",
          "answer": "8/3"
        }
      }
    ]
  },
  "c11-probability": {
    "concepts": [
      {
        "title": "Conditional sample spaces change denominators",
        "body": "P(A|B)=P(A and B)/P(B) when P(B)>0. The conditioning event B is the new universe: only its outcomes appear in the denominator."
      }
    ],
    "points": [
      {
        "front": "Does P(A|B) always equal P(A)?",
        "back": "No; that equality is a consequence of independence when P(B)>0."
      }
    ],
    "mistakes": [
      {
        "wrong": "Mutually exclusive events with positive probability are independent.",
        "right": "If one occurs, the other cannot; their intersection probability is zero, not the product of two positive probabilities."
      }
    ],
    "examples": [
      {
        "question": "A fair die is known to show an even number. Find P(result>3 | even).",
        "steps": [
          "Even outcomes are 2,4,6.",
          "Favourable conditioned outcomes are 4,6.",
          "Probability is 2/3."
        ],
        "answer": "2/3",
        "verify": {
          "kind": "value",
          "expr": "2/3",
          "answer": "2/3"
        }
      }
    ]
  }
};
