// Original Pri Learning supplementary notes, Class 11; optional JEE bridges explicitly labelled.
// DRAFT: mathematical review and complete release CI required; not an exam difficulty certification.
export default {
  "c11-sets": {
    "concepts": [
      {
        "title": "Counting a union without double counting",
        "body": "The sum $|A| + |B|$ counts shared members twice. Subtract $|A \\cap B|$ once to obtain $|A \\cup B|$. Three sets need inclusion–exclusion one level further."
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
        "wrong": "For finite sets, $|A \\cup B|$ always equals $|A| + |B|$.",
        "right": "Subtract the intersection cardinality when the sets overlap."
      }
    ],
    "examples": [
      {
        "question": "$A$ has 18 elements, $B$ has 14 and 5 are shared. Find the number of elements in $A \\cup B$.",
        "steps": [
          "Start with $18 + 14 = 32$.",
          "The 5 shared members were counted twice.",
          "Subtract them once: $32 - 5 = 27$."
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
        "right": "The function $x \\mapsto x^2$ on the real numbers is not one-to-one, because $x$ and $-x$ have the same image."
      }
    ],
    "examples": [
      {
        "question": "For $f(x) = 2x^2 - 3$, evaluate $f(-2) + f(3)$.",
        "steps": [
          "$f(-2) = 2 \\times 4 - 3 = 5$.",
          "$f(3) = 2 \\times 9 - 3 = 15$.",
          "Their sum is $5 + 15 = 20$."
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
        "body": "$\\sin x$ has period $2\\pi$, whereas $\\sin kx$ repeats after $\\dfrac{2\\pi}{|k|}$ for non-zero $k$. A horizontal translation moves the peaks but does not change the period."
      }
    ],
    "points": [
      {
        "front": "Why is the period of $\\sin 3x$ one third of that of $\\sin x$?",
        "back": "Tripling the angle completes a full $2\\pi$ cycle while $x$ changes by only $\\tfrac{2\\pi}{3}$."
      }
    ],
    "mistakes": [
      {
        "wrong": "The period of $\\sin\\left(x + \\tfrac{\\pi}{6}\\right)$ is $\\tfrac{\\pi}{6}$.",
        "right": "A phase shift changes where the graph starts, not its period of $2\\pi$."
      }
    ],
    "examples": [
      {
        "question": "Solve $\\sin(2x) = 0$ for $0 \\le x < 2\\pi$ and count the solutions.",
        "steps": [
          "$\\sin\\theta = 0$ exactly at integer multiples of $\\pi$.",
          "Thus $2x = k\\pi$ and $x = \\tfrac{k\\pi}{2}$.",
          "For $k = 0, 1, 2, 3$ there are four solutions."
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
        "body": "For $z = x + iy$, $|z - a|$ is the distance from the point $(x, y)$ to the Argand point $a$. Equal distances to two distinct points define a perpendicular bisector. This geometric view is essential for advanced locus questions."
      }
    ],
    "points": [
      {
        "front": "Why does complex conjugation reflect a point across the real axis?",
        "back": "Conjugation sends $x + iy$ to $x - iy$: the horizontal coordinate is unchanged and the vertical coordinate is reversed."
      }
    ],
    "mistakes": [
      {
        "wrong": "The principal argument of a product is always the arithmetic sum of the two principal arguments.",
        "right": "After adding the angles, reduce by a multiple of $2\\pi$ into the principal-argument interval; zero has no argument."
      }
    ],
    "examples": [
      {
        "question": "Optional JEE extension: Find the locus of complex $z$ satisfying $|z - 1| = |z + 3|$.",
        "steps": [
          "Write $z = x + iy$ and square the two moduli.",
          "$(x-1)^2 + y^2 = (x+3)^2 + y^2$ gives $-2x + 1 = 6x + 9$.",
          "Therefore $x = -1$, a vertical line."
        ],
        "answer": "$\\operatorname{Re}(z) = -1$",
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
        "question": "Optional JEE bridge: use roots of unity to simplify $1 + \\omega + \\omega^2$, where $\\omega$ is a non-real cube root of 1.",
        "steps": [
          "Since $\\omega^3 = 1$ and $\\omega \\ne 1$, $(\\omega - 1)(\\omega^2 + \\omega + 1) = 0$.",
          "Divide by the non-zero factor $\\omega - 1$.",
          "Thus $1 + \\omega + \\omega^2 = 0$."
        ],
        "answer": "0",
        "verify": {
          "kind": "value",
          "expr": "1-1",
          "answer": "0"
        }
      },
      {
        "question": "Optional JEE bridge: given $|z - 2| = 3$, find the least and greatest possible $|z|$.",
        "steps": [
          "The locus is a circle of radius 3 centred at real coordinate 2.",
          "The point of the circle closest to the origin is $-1$; the farthest is $5$.",
          "Hence $\\min |z| = 1$ and $\\max |z| = 5$."
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
        "question": "Optional JEE bridge: write down the two roots of $z^2 - 2z + 5 = 0$.",
        "steps": [
          "Complete the square: $(z-1)^2 = -4$.",
          "Therefore $z - 1 = \\pm 2i$.",
          "The two roots are $1 + 2i$ and $1 - 2i$."
        ],
        "answer": "$1 \\pm 2i$",
        "verify": {
          "kind": "value",
          "expr": "(-2)^2-4*1*5",
          "answer": "-16"
        }
      },
      {
        "question": "Optional JEE bridge: $z = 3 + 4i$ and $w = -3 + 4i$. Compare $|z + w|$ with $|z| + |w|$.",
        "steps": [
          "Both original moduli are 5.",
          "The sum is $8i$, with modulus 8.",
          "Thus $8 \\le 10$, which illustrates the triangle inequality with a strict gap."
        ],
        "answer": "$|z + w| = 8$; $|z| + |w| = 10$",
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
        "question": "Optional JEE bridge: reflect $z = 4 - 7i$ in the real axis and give $|z|^2$.",
        "steps": [
          "Reflection in the real axis conjugates $z$, giving $4 + 7i$.",
          "The modulus is unchanged by conjugation.",
          "$|z|^2 = 4^2 + 7^2 = 65$."
        ],
        "answer": "Conjugate $4 + 7i$; squared modulus 65",
        "verify": {
          "kind": "value",
          "expr": "4^2+(-7)^2",
          "answer": "65"
        }
      },
      {
        "question": "Optional JEE bridge: if $z_1 = z_2 = -1 + i$, find the principal argument of $z_1 z_2$.",
        "steps": [
          "Each principal argument is $\\tfrac{3\\pi}{4}$.",
          "Multiplying gives $(-1 + i)^2 = -2i$, whose principal argument is $-\\tfrac{\\pi}{2}$.",
          "Adding the principal arguments gives $\\tfrac{3\\pi}{2}$, which must be reduced by $2\\pi$."
        ],
        "answer": "$-\\tfrac{\\pi}{2}$",
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
        "question": "Optional JEE bridge: for $z = 1 + i\\sqrt{3}$, find $|z|$ and $z^3$.",
        "steps": [
          "$|z| = 2$ and an argument is $\\tfrac{\\pi}{3}$.",
          "Cubing gives modulus $2^3 = 8$ and argument $\\pi$.",
          "Therefore $z^3 = -8$."
        ],
        "answer": "$|z| = 2$; $z^3 = -8$",
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
        "front": "Why do inequality signs reverse when both sides are multiplied by $-1$?",
        "back": "If $a < b$, then $b - a > 0$, so $(-a) - (-b) = b - a > 0$ and $-a > -b$."
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
        "question": "Solve $-3x + 5 > 14$ and state the greatest integer solution.",
        "steps": [
          "Subtract 5: $-3x > 9$.",
          "Divide by $-3$ and reverse the sign: $x < -3$.",
          "The greatest integer strictly below $-3$ is $-4$."
        ],
        "answer": "$-4$",
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
        "body": "Choosing $r$ objects from $n$ ignores their order; arranging the chosen objects multiplies by $r!$. Decide what counts as a distinct outcome before choosing $^nC_r$ or $^nP_r$."
      }
    ],
    "points": [
      {
        "front": "How can an unordered selection become an ordered arrangement?",
        "back": "Multiply by $r!$ if all $r$ chosen objects are distinct and every order is allowed."
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
          "Multiply: $6 \\times 5 = 30$ assignments."
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
        "body": "In $(a+b)^n$, the term with index $r$ is $\\binom{n}{r} a^{n-r} b^r$. When $b$ contains a negative sign or a power of $x$, carry it into the full term before reading off the requested coefficient."
      }
    ],
    "points": [
      {
        "front": "What does the symmetry $\\binom{n}{r} = \\binom{n}{n-r}$ represent?",
        "back": "Each choice of $r$ selected objects corresponds to the complementary choice of the $n - r$ objects left out."
      }
    ],
    "mistakes": [
      {
        "wrong": "The binomial coefficient determines the sign of every term.",
        "right": "The signs also depend on $a$ and $b$, particularly when $b$ is negative."
      }
    ],
    "examples": [
      {
        "question": "Find the coefficient of $x^3$ in $(1 + 2x)^5$.",
        "steps": [
          "The $x^3$ term uses $r = 3$.",
          "Its coefficient is $\\binom{5}{3} \\times 2^3 = 10 \\times 8$.",
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
        "body": "A sequence gives the $n$th object $a_n$. A series gives the partial sums $S_n$. For a geometric progression with ratio $r \\ne 1$, subtracting $r$ times the sum gives $(1 - r)S_n = a(1 - r^n)$."
      }
    ],
    "points": [
      {
        "front": "Why is the infinite GP formula invalid for $|r| \\ge 1$?",
        "back": "The term $r^n$ does not tend to zero, so the partial sums generally have no limit."
      }
    ],
    "mistakes": [
      {
        "wrong": "Any geometric progression has a finite infinite sum.",
        "right": "Convergence requires $|r| < 1$ when the first term is non-zero."
      }
    ],
    "examples": [
      {
        "question": "Find the sum of the first five terms of a GP with first term 3 and ratio 2.",
        "steps": [
          "The terms are 3, 6, 12, 24, 48.",
          "Add these five terms, or use $\\dfrac{3(2^5 - 1)}{2 - 1}$.",
          "The result is 93."
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
        "body": "For two distinct points with different $x$-coordinates, $m = \\dfrac{\\Delta y}{\\Delta x}$. A vertical line has undefined slope, not zero slope; the slope of a horizontal line is zero."
      }
    ],
    "points": [
      {
        "front": "Why can a vertical line not be written as $y = mx + c$ with a finite $m$?",
        "back": "Its $x$-value is fixed while $y$ varies, so it does not give a single $y$ for each $x$."
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
        "question": "Find the gradient of the line through $(-2, 5)$ and $(4, -7)$.",
        "steps": [
          "Rise $= -7 - 5 = -12$.",
          "Run $= 4 - (-2) = 6$.",
          "Gradient $= \\tfrac{-12}{6} = -2$."
        ],
        "answer": "$-2$",
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
        "right": "The orientation depends on where the focus and directrix are placed and on the sign of the parameter."
      }
    ],
    "examples": [
      {
        "question": "For $y^2 = 12x$, find the focal distance $p$ and the focus.",
        "steps": [
          "Compare with $y^2 = 4px$.",
          "$4p = 12$, so $p = 3$.",
          "The focus is $(3, 0)$."
        ],
        "answer": "$(3, 0)$",
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
        "body": "In Cartesian 3D coordinates, differences in $x$, $y$ and $z$ describe mutually perpendicular displacements. Pythagoras' theorem applied twice gives the 3D distance formula."
      }
    ],
    "points": [
      {
        "front": "Can a 3D distance be less than the absolute difference of the $x$-coordinates?",
        "back": "No, because the squared $y$ and $z$ differences add non-negative amounts."
      }
    ],
    "mistakes": [
      {
        "wrong": "Two points with different $z$-coordinates can be at zero distance if $x$ and $y$ agree.",
        "right": "Zero distance requires all three coordinate differences to be zero."
      }
    ],
    "examples": [
      {
        "question": "Find the distance from $(1, 2, 3)$ to $(3, 5, 9)$.",
        "steps": [
          "The coordinate differences are 2, 3, 6.",
          "$\\text{Distance}^2 = 2^2 + 3^2 + 6^2 = 49$.",
          "Distance $= 7$."
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
        "body": "A removable discontinuity may have a finite limit even if $f(a)$ is undefined. Simplifying a rational expression away from the excluded point can reveal the limit, without pretending the original denominator was non-zero at that point."
      }
    ],
    "points": [
      {
        "front": "Why may a limit exist when the expression is undefined at $x = a$?",
        "back": "The limit depends on the values as $x$ approaches $a$, not on the value exactly at $a$."
      }
    ],
    "mistakes": [
      {
        "wrong": "If direct substitution gives $\\tfrac{0}{0}$, the limit must be zero.",
        "right": "$\\tfrac{0}{0}$ is indeterminate and needs algebraic or analytic investigation."
      }
    ],
    "examples": [
      {
        "question": "Evaluate $\\displaystyle\\lim_{x \\to 2} \\frac{x^2 - 4}{x - 2}$.",
        "steps": [
          "Factorise the numerator as $(x-2)(x+2)$.",
          "For $x \\ne 2$, cancel the non-zero factor $x - 2$.",
          "The limit of $x + 2$ as $x \\to 2$ is 4."
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
        "question": "Find the population variance of 1, 3, 5.",
        "steps": [
          "The mean is 3.",
          "The squared deviations are 4, 0, 4.",
          "Population variance $= \\dfrac{4 + 0 + 4}{3} = \\tfrac{8}{3}$."
        ],
        "answer": "$\\tfrac{8}{3}$",
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
        "body": "$P(A \\mid B) = \\dfrac{P(A \\cap B)}{P(B)}$ when $P(B) > 0$. The conditioning event $B$ becomes the new sample space: only its outcomes appear in the denominator."
      }
    ],
    "points": [
      {
        "front": "Does $P(A \\mid B)$ always equal $P(A)$?",
        "back": "No; that equality holds when $A$ and $B$ are independent and $P(B) > 0$."
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
        "question": "A fair die is known to show an even number. Find $P(\\text{result} > 3 \\mid \\text{even})$.",
        "steps": [
          "The even outcomes are 2, 4, 6.",
          "The favourable outcomes among them are 4 and 6.",
          "The probability is $\\tfrac{2}{3}$."
        ],
        "answer": "$\\tfrac{2}{3}$",
        "verify": {
          "kind": "value",
          "expr": "2/3",
          "answer": "2/3"
        }
      }
    ]
  }
};
