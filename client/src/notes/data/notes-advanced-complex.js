// Pri Learning — entirely original, supplemental Complex Numbers geometry/algebra studies.
// Study material, not certified exam-D4 questions. Independent expert review pending.
// Numerical invariants are re-derived by the notes engine; proof steps need human review.
export default {
  "c11-complex-numbers": {
    "examples": [
      {
        "question": "Optional Complex Numbers geometry: find the exact locus $|z - 2| = 2|z + 1|$ in the Argand plane.",
        "steps": [
          "Put $z = x + iy$ and square both non-negative moduli: $(x-2)^2 + y^2 = 4\\bigl((x+1)^2 + y^2\\bigr)$.",
          "Expand and simplify to $x^2 + 4x + y^2 = 0$.",
          "Complete the square: $(x+2)^2 + y^2 = 4$, a circle with centre $(-2, 0)$ and radius 2."
        ],
        "answer": "$(x+2)^2 + y^2 = 4$ (centre $-2$, radius 2)",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "(-4-2)^2",
              "4*(-4+1)^2"
            ],
            [
              "(0-2)^2",
              "4*(0+1)^2"
            ],
            [
              "(-2+2)^2+2^2",
              "4"
            ]
          ]
        }
      },
      {
        "question": "Optional Complex Numbers geometry: describe $\\operatorname{Re}\\left(\\dfrac{z-1}{z+1}\\right) = 0$, stating any excluded point.",
        "steps": [
          "Let $z = x + iy$; the quotient is undefined at $z = -1$.",
          "After multiplying the numerator and denominator by the conjugate of $z + 1$, the real part of the numerator is $x^2 + y^2 - 1$.",
          "Hence $x^2 + y^2 = 1$, but omit $(-1, 0)$, where the quotient was undefined."
        ],
        "answer": "The unit circle $x^2 + y^2 = 1$, excluding $z = -1$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "1^2+0^2",
              "1"
            ],
            [
              "0^2+1^2",
              "1"
            ],
            [
              "(-1)^2+0^2",
              "1"
            ]
          ]
        }
      },
      {
        "question": "Optional Complex Numbers geometry: minimise $|z - 3| + |z + 3|$ subject to $\\operatorname{Re}(z) = 0$.",
        "steps": [
          "Write $z = iy$, because its real part is zero.",
          "Both distances equal $\\sqrt{9 + y^2}$, so the sum is $2\\sqrt{9 + y^2}$.",
          "Since $y^2 \\ge 0$, the minimum is 6, attained at $z = 0$."
        ],
        "answer": "Minimum 6 at $z = 0$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "2*sqrt(3^2+0^2)",
              "6"
            ],
            [
              "2*sqrt(3^2+4^2)",
              "10"
            ]
          ]
        }
      },
      {
        "question": "Optional Complex Numbers algebra: find all non-zero $z$ for which $z + \\dfrac{1}{z}$ is real.",
        "steps": [
          "Write $z = x + iy$ with $x^2 + y^2 > 0$, so $\\dfrac{1}{z} = \\dfrac{x - iy}{x^2 + y^2}$.",
          "The imaginary part is $y\\left(1 - \\dfrac{1}{x^2 + y^2}\\right)$, which vanishes exactly when $y = 0$ or $x^2 + y^2 = 1$.",
          "The solutions are all non-zero real $z$ together with all points of the unit circle."
        ],
        "answer": "$z$ real and non-zero, or $|z| = 1$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "1-1/(1^2)",
              "0"
            ],
            [
              "2*(1-1/(2^2))",
              "1.5"
            ]
          ]
        }
      },
      {
        "question": "Optional Complex Numbers invariant: prove that $|z - 1|^2 + |z + 1|^2 = 4$ when $|z| = 1$.",
        "steps": [
          "Write $z = x + iy$ and use $x^2 + y^2 = 1$.",
          "Expand the left side: $\\bigl((x-1)^2 + y^2\\bigr) + \\bigl((x+1)^2 + y^2\\bigr) = 2(x^2 + y^2) + 2$.",
          "Substitute the unit-circle condition to obtain 4."
        ],
        "answer": "4 for every $z$ with $|z| = 1$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "(3/5-1)^2+(4/5)^2+(3/5+1)^2+(4/5)^2",
              "4"
            ]
          ]
        }
      },
      {
        "question": "Optional roots of unity: for a non-real cube root $\\omega$ of 1, find $(1 - \\omega)(1 - \\omega^2)$.",
        "steps": [
          "Since $\\omega^3 = 1$ and $\\omega \\ne 1$, factorising $\\omega^3 - 1$ gives $1 + \\omega + \\omega^2 = 0$.",
          "Expand: $(1 - \\omega)(1 - \\omega^2) = 1 - (\\omega + \\omega^2) + \\omega^3$.",
          "Substitute $\\omega + \\omega^2 = -1$ and $\\omega^3 = 1$ to obtain 3."
        ],
        "answer": "3",
        "verify": {
          "kind": "value",
          "expr": "(3/2)^2+3/4",
          "answer": "3"
        }
      },
      {
        "question": "Optional Complex Numbers constraints: if $\\operatorname{Re}(z) = 2$ and $|z| = \\sqrt{13}$, find all possible values of $\\operatorname{Re}(z^2)$.",
        "steps": [
          "Let $z = 2 + iy$. Then $4 + y^2 = 13$, so $y = 3$ or $y = -3$.",
          "For $z^2 = (2 + iy)^2$, the real part is $4 - y^2$.",
          "Both admissible values give $\\operatorname{Re}(z^2) = -5$."
        ],
        "answer": "$-5$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "2^2+3^2",
              "13"
            ],
            [
              "2^2-3^2",
              "-5"
            ]
          ]
        }
      },
      {
        "question": "Optional triangle inequality: for $z = 3 + 4i$ and $w = 6 + 8i$, show that $|z + w| = |z| + |w|$.",
        "steps": [
          "Observe that $w = 2z$: the two non-zero vectors point in the same direction.",
          "Compute $|z| = 5$ and $|w| = 10$.",
          "Their sum is $9 + 12i$, with modulus 15; equality holds in the triangle inequality."
        ],
        "answer": "$|z + w| = 15 = 5 + 10$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "sqrt(3^2+4^2)",
              "5"
            ],
            [
              "sqrt(6^2+8^2)",
              "10"
            ],
            [
              "sqrt(9^2+12^2)",
              "15"
            ]
          ]
        }
      },
      {
        "question": "Optional geometric transform: show that $\\left|\\dfrac{z - i}{z + i}\\right| = 1$ for real $z$.",
        "steps": [
          "For real $z = x$, the numerator $x - i$ and the denominator $x + i$ are conjugates.",
          "Their moduli are equal, both $\\sqrt{x^2 + 1}$, and the denominator is never zero for real $x$.",
          "Therefore the modulus of the quotient is 1."
        ],
        "answer": "1 for every real $z$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "sqrt(2^2+(-1)^2)",
              "sqrt(2^2+1^2)"
            ],
            [
              "sqrt((-4)^2+(-1)^2)",
              "sqrt((-4)^2+1^2)"
            ]
          ]
        }
      },
      {
        "question": "Optional argument branches: find the principal argument of $(-1 + i)^3$.",
        "steps": [
          "$-1 + i$ has argument $\\tfrac{3\\pi}{4}$.",
          "Cubing multiplies the angle by 3, giving $\\tfrac{9\\pi}{4}$, which reduces by $2\\pi$ to $\\tfrac{\\pi}{4}$.",
          "Directly, $(-1 + i)^3 = 2 + 2i$, which confirms a first-quadrant argument."
        ],
        "answer": "$\\tfrac{\\pi}{4}$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "(-1)^2-1^2",
              "0"
            ],
            [
              "2^2+2^2",
              "8"
            ],
            [
              "2/2",
              "1"
            ]
          ]
        }
      },
      {
        "question": "Optional Argand intersections: find $z$ when $|z - 1| = 2$ and $\\operatorname{Re}(z) = 2$.",
        "steps": [
          "Write $z = 2 + iy$.",
          "The circle equation becomes $(2 - 1)^2 + y^2 = 4$.",
          "Hence $y^2 = 3$ and $z = 2 \\pm i\\sqrt{3}$."
        ],
        "answer": "$z = 2 \\pm i\\sqrt{3}$",
        "verify": {
          "kind": "value",
          "expr": "(2-1)^2+3",
          "answer": "4"
        }
      },
      {
        "question": "Optional Complex Numbers locus: given $|z - (1+i)|^2 + |z - (1-i)|^2 = 10$, find the centre and radius of the locus.",
        "steps": [
          "Let $z = x + iy$. Adding the two squared distances gives $2(x-1)^2 + 2y^2 + 2$.",
          "Set the expression equal to 10: $(x-1)^2 + y^2 = 4$.",
          "The locus is a circle with centre $(1, 0)$ and radius 2."
        ],
        "answer": "Centre $(1, 0)$, radius 2",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "(3-1)^2+(-1)^2+(3-1)^2+(1)^2",
              "10"
            ],
            [
              "(3-1)^2",
              "4"
            ]
          ]
        }
      },
      {
        "question": "Optional reverse triangle inequality: if $|z| = 5$, find the least and greatest values of $|z - 2|$.",
        "steps": [
          "Use $\\bigl||z| - 2\\bigr| \\le |z - 2| \\le |z| + 2$, giving $3 \\le |z - 2| \\le 7$.",
          "Both bounds are attained: $z = 5$ gives distance 3 and $z = -5$ gives 7.",
          "Thus the interval is exact, not merely a pair of loose estimates."
        ],
        "answer": "Minimum 3, maximum 7",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "abs(5-2)",
              "3"
            ],
            [
              "abs(-5-2)",
              "7"
            ]
          ]
        }
      },
      {
        "question": "Optional area with complex vectors: find the area of the triangle with vertices $0$, $3 + 4i$ and $-1 + 2i$.",
        "steps": [
          "Treat the complex points as the vectors $(3, 4)$ and $(-1, 2)$.",
          "The signed parallelogram area is the determinant $3 \\times 2 - 4 \\times (-1) = 10$.",
          "The triangle's area is half the absolute value of the determinant: 5."
        ],
        "answer": "5 square units",
        "verify": {
          "kind": "value",
          "expr": "abs(3*2-4*(-1))/2",
          "answer": "5"
        }
      },
      {
        "question": "Optional equidistance locus: solve $|z - 1| = |z - i|$ geometrically.",
        "steps": [
          "For $z = x + iy$, these are the distances to the points $(1, 0)$ and $(0, 1)$.",
          "Squaring gives $(x-1)^2 + y^2 = x^2 + (y-1)^2$.",
          "This simplifies to $y = x$, the perpendicular bisector of the two points."
        ],
        "answer": "$\\operatorname{Im}(z) = \\operatorname{Re}(z)$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "(2-1)^2+2^2",
              "2^2+(2-1)^2"
            ],
            [
              "(0-1)^2+0^2",
              "0^2+(0-1)^2"
            ]
          ]
        }
      },
      {
        "question": "Optional roots of unity geometry: find the area of the triangle whose vertices are $1$, $\\omega$ and $\\omega^2$, where $\\omega$ is a non-real cube root of 1.",
        "steps": [
          "Use $1 = (1, 0)$, $\\omega = \\left(-\\tfrac{1}{2}, \\tfrac{\\sqrt{3}}{2}\\right)$, $\\omega^2 = \\left(-\\tfrac{1}{2}, -\\tfrac{\\sqrt{3}}{2}\\right)$.",
          "The segment joining $\\omega$ and $\\omega^2$ is vertical with length $\\sqrt{3}$; the distance from 1 to its line $x = -\\tfrac{1}{2}$ is $\\tfrac{3}{2}$.",
          "Area $= \\tfrac{1}{2} \\times \\sqrt{3} \\times \\tfrac{3}{2} = \\tfrac{3\\sqrt{3}}{4}$."
        ],
        "answer": "$\\tfrac{3\\sqrt{3}}{4}$",
        "verify": {
          "kind": "value",
          "expr": "sqrt(3)*(3/2)/2",
          "answer": "3*sqrt(3)/4"
        }
      }
    ]
  }
};
