// Original Pri Learning supplementary notes, Class 12 (review pending).
export default {
  "c12-relations-functions": {
    "concepts": [
      {
        "title": "Composition order can change the result",
        "body": "The composition $f \\circ g$ means apply $g$ first and then $f$. In general $f \\circ g$ differs from $g \\circ f$, so the order is part of the mathematical statement. Check that each output lies in the next function's domain."
      }
    ],
    "points": [
      {
        "front": "Why must the inner function's range lie in the outer function's domain?",
        "back": "Otherwise the composite expression is not defined for some inputs."
      }
    ],
    "mistakes": [
      {
        "wrong": "Composition is commutative just like addition.",
        "right": "Order matters; $f(g(x))$ and $g(f(x))$ can differ."
      }
    ],
    "examples": [
      {
        "question": "Let $f(x) = 2x + 1$ and $g(x) = x^2$. Find $f(g(3))$ and $g(f(3))$.",
        "steps": [
          "$g(3) = 9$, hence $f(g(3)) = 19$.",
          "$f(3) = 7$, hence $g(f(3)) = 49$.",
          "The two results differ; composition is not commutative."
        ],
        "answer": "19 and 49",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "2*(3^2)+1",
              "19"
            ],
            [
              "(2*3+1)^2",
              "49"
            ]
          ]
        }
      }
    ]
  },
  "c12-inverse-trigonometric": {
    "concepts": [
      {
        "title": "Principal branches make inverse trigonometry functions",
        "body": "Sine takes each value at many inputs; $\\sin^{-1}$ is a function only after its output is restricted to the principal interval $\\left[-\\tfrac{\\pi}{2}, \\tfrac{\\pi}{2}\\right]$. Therefore $\\sin^{-1}(\\sin x)$ need not equal $x$ outside that interval."
      }
    ],
    "points": [
      {
        "front": "What is the output interval of the principal $\\sin^{-1}$ function?",
        "back": "From $-\\tfrac{\\pi}{2}$ to $\\tfrac{\\pi}{2}$, inclusive."
      }
    ],
    "mistakes": [
      {
        "wrong": "$\\sin^{-1}\\left(\\sin\\left(\\tfrac{5\\pi}{6}\\right)\\right)$ must equal $\\tfrac{5\\pi}{6}$.",
        "right": "The principal value is $\\tfrac{\\pi}{6}$, because it lies in the output interval of $\\sin^{-1}$."
      }
    ],
    "examples": [
      {
        "question": "Find the principal value of $\\sin^{-1}\\left(\\sin\\left(\\tfrac{5\\pi}{6}\\right)\\right)$.",
        "steps": [
          "$\\sin\\left(\\tfrac{5\\pi}{6}\\right) = \\tfrac{1}{2}$.",
          "The angle $\\tfrac{\\pi}{6}$ is in the principal range of $\\sin^{-1}$ and has sine $\\tfrac{1}{2}$.",
          "Therefore the principal value is $\\tfrac{\\pi}{6}$."
        ],
        "answer": "$\\tfrac{\\pi}{6}$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "sin(5*pi/6)",
              "1/2"
            ],
            [
              "sin(pi/6)",
              "1/2"
            ]
          ]
        }
      }
    ]
  },
  "c12-matrices": {
    "concepts": [
      {
        "title": "Matrix products encode row–column interactions",
        "body": "The $(i, j)$ entry of $AB$ is the dot product of row $i$ of $A$ with column $j$ of $B$. The inner dimensions must match; even when both $AB$ and $BA$ exist, they are generally different."
      }
    ],
    "points": [
      {
        "front": "Why can $AB$ exist when $BA$ does not?",
        "back": "$AB$ only requires the number of columns of $A$ to equal the number of rows of $B$, a condition that need not hold the other way round."
      }
    ],
    "mistakes": [
      {
        "wrong": "Matrix multiplication is elementwise multiplication.",
        "right": "It is row–column dot-product multiplication, unlike the Hadamard product."
      }
    ],
    "examples": [
      {
        "question": "Multiply $A = \\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}$ by $B = \\begin{pmatrix} 2 & 0 \\\\ 1 & 3 \\end{pmatrix}$.",
        "steps": [
          "Top row: $(1 \\times 2 + 2 \\times 1,\\ 1 \\times 0 + 2 \\times 3) = (4, 6)$.",
          "Bottom row: $(3 \\times 2 + 4 \\times 1,\\ 3 \\times 0 + 4 \\times 3) = (10, 12)$.",
          "$AB = \\begin{pmatrix} 4 & 6 \\\\ 10 & 12 \\end{pmatrix}$."
        ],
        "answer": "$\\begin{pmatrix} 4 & 6 \\\\ 10 & 12 \\end{pmatrix}$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "1*2+2*1",
              "4"
            ],
            [
              "1*0+2*3",
              "6"
            ],
            [
              "3*2+4*1",
              "10"
            ],
            [
              "3*0+4*3",
              "12"
            ]
          ]
        }
      }
    ]
  },
  "c12-determinants": {
    "concepts": [
      {
        "title": "Expansion signs alternate because orientation matters",
        "body": "For a $3 \\times 3$ determinant, cofactor expansion along the first row has the signs $+, -, +$. A determinant is zero when its rows are linearly dependent, and is multiplied by $k$ when one row is multiplied by $k$."
      }
    ],
    "points": [
      {
        "front": "What happens to a determinant when two rows are swapped?",
        "back": "Its sign reverses."
      }
    ],
    "mistakes": [
      {
        "wrong": "Every cofactor in the first row is added without signs.",
        "right": "The middle contribution carries a minus sign."
      }
    ],
    "examples": [
      {
        "question": "Evaluate $\\begin{vmatrix} 1 & 2 & 3 \\\\ 0 & 1 & 4 \\\\ 5 & 6 & 0 \\end{vmatrix}$.",
        "steps": [
          "Expand along the first row: $1(0 - 24) - 2(0 - 20) + 3(0 - 5)$.",
          "Compute $-24 + 40 - 15$.",
          "The determinant is 1."
        ],
        "answer": "1",
        "verify": {
          "kind": "value",
          "expr": "1*(0-24)-2*(0-20)+3*(0-5)",
          "answer": "1"
        }
      }
    ]
  },
  "c12-continuity-differentiability": {
    "concepts": [
      {
        "title": "Continuity is a matching condition at the junction",
        "body": "A function is continuous at $a$ when its two-sided limit equals its defined value $f(a)$. If a removable discontinuity is present, assigning the limiting value repairs continuity; differentiability is a stronger condition."
      }
    ],
    "points": [
      {
        "front": "Does being continuous at a point guarantee differentiability there?",
        "back": "No. The absolute-value function is continuous but has a sharp corner at zero."
      }
    ],
    "mistakes": [
      {
        "wrong": "A finite limit guarantees continuity even if $f(a)$ differs from it.",
        "right": "Continuity requires the actual value $f(a)$ to equal that limit."
      }
    ],
    "examples": [
      {
        "question": "Let $f(x) = \\dfrac{x^2 - 4}{x - 2}$ for $x \\ne 2$ and $f(2) = k$. Find $k$ for continuity.",
        "steps": [
          "For $x \\ne 2$, cancel the factor to get $f(x) = x + 2$.",
          "The limit as $x$ tends to 2 is 4.",
          "Set $f(2) = k = 4$ to make the function continuous."
        ],
        "answer": "$k = 4$",
        "verify": {
          "kind": "value",
          "expr": "2+2",
          "answer": "4"
        }
      }
    ]
  },
  "c12-applications-derivatives": {
    "concepts": [
      {
        "title": "Stationary does not mean minimum",
        "body": "If $f'(a) = 0$ the point is stationary, but it could be a maximum, a minimum or neither. Examine the sign change of $f'$, or use $f''$ when its hypotheses apply, then check the endpoints of the domain."
      }
    ],
    "points": [
      {
        "front": "Why can an interior maximum occur where $f' = 0$?",
        "back": "The derivative may change from positive to negative there."
      }
    ],
    "mistakes": [
      {
        "wrong": "Every root of $f'$ is a local minimum.",
        "right": "A sign change from positive to negative instead gives a local maximum."
      }
    ],
    "examples": [
      {
        "question": "Find the minimum of $f(x) = x^2 - 6x + 5$ on the real line.",
        "steps": [
          "Differentiate: $f'(x) = 2x - 6$, so the stationary point is $x = 3$.",
          "Second derivative: $f''(x) = 2 > 0$.",
          "At $x = 3$ the minimum value is $9 - 18 + 5 = -4$."
        ],
        "answer": "$-4$ at $x = 3$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "2*3-6",
              "0"
            ],
            [
              "3^2-6*3+5",
              "-4"
            ]
          ]
        }
      }
    ]
  },
  "c12-integrals": {
    "concepts": [
      {
        "title": "Antiderivatives should be checked by differentiation",
        "body": "An indefinite integral is a family $F(x) + C$ whose derivatives equal the integrand. A definite integral is a number, $F(b) - F(a)$, and contains no arbitrary $C$."
      }
    ],
    "points": [
      {
        "front": "Why does a definite integral not keep a constant $+C$?",
        "back": "Any constant cancels in $F(b) - F(a)$."
      }
    ],
    "mistakes": [
      {
        "wrong": "The integral of $x^2$ is $2x$.",
        "right": "Differentiating $\\tfrac{x^3}{3}$ gives $x^2$; raise the power first, then divide by the new power."
      }
    ],
    "examples": [
      {
        "question": "Evaluate $\\displaystyle\\int_0^2 (3x^2 - 4x + 1)\\,dx$.",
        "steps": [
          "An antiderivative is $x^3 - 2x^2 + x$.",
          "At 2: $8 - 8 + 2 = 2$.",
          "At 0 the value is zero, so the integral is 2."
        ],
        "answer": "2",
        "verify": {
          "kind": "value",
          "expr": "(2^3-2*2^2+2)-(0^3-2*0^2+0)",
          "answer": "2"
        }
      }
    ]
  },
  "c12-applications-integrals": {
    "concepts": [
      {
        "title": "Area uses upper minus lower, not blindly the integrand",
        "body": "For two curves meeting at the endpoints, compare which graph lies above on each interval. The enclosed area is the integral of upper minus lower; intersections inside the interval may require splitting it."
      }
    ],
    "points": [
      {
        "front": "Why is the signed integral not always geometric area?",
        "back": "Parts below an axis or where curve order swaps can contribute negative signed values."
      }
    ],
    "mistakes": [
      {
        "wrong": "To find enclosed area, integrate lower curve minus upper curve.",
        "right": "For positive geometric area, integrate the non-negative height upper-minus-lower."
      }
    ],
    "examples": [
      {
        "question": "Find the area between $y = x$ and $y = x^2$ from $x = 0$ to $x = 1$.",
        "steps": [
          "On $0 \\le x \\le 1$, $x \\ge x^2$.",
          "Integrate $x - x^2$, giving $\\left[\\tfrac{x^2}{2} - \\tfrac{x^3}{3}\\right]_0^1$.",
          "Area $= \\tfrac{1}{2} - \\tfrac{1}{3} = \\tfrac{1}{6}$."
        ],
        "answer": "$\\tfrac{1}{6}$",
        "verify": {
          "kind": "value",
          "expr": "1/2-1/3",
          "answer": "1/6"
        }
      }
    ]
  },
  "c12-differential-equations": {
    "concepts": [
      {
        "title": "An initial condition chooses one solution from a family",
        "body": "Integrating $\\dfrac{dy}{dx} = g(x)$ produces $y = G(x) + C$. A given point $(x_0, y_0)$ on the solution curve then fixes $C$."
      }
    ],
    "points": [
      {
        "front": "Why is $+C$ needed before applying an initial condition?",
        "back": "Differentiation removes constants, so a differential equation usually admits a family of curves."
      }
    ],
    "mistakes": [
      {
        "wrong": "A differential equation with an initial value still needs an arbitrary constant in its final answer.",
        "right": "Use the given condition to find the constant of integration."
      }
    ],
    "examples": [
      {
        "question": "Solve $\\dfrac{dy}{dx} = 3x^2$ with $y(0) = 4$, and find $y(2)$.",
        "steps": [
          "Integrate: $y = x^3 + C$.",
          "Set $x = 0$ and $y = 4$, giving $C = 4$.",
          "Thus $y(2) = 8 + 4 = 12$."
        ],
        "answer": "12",
        "verify": {
          "kind": "value",
          "expr": "2^3+4",
          "answer": "12"
        }
      }
    ]
  },
  "c12-vector-algebra": {
    "concepts": [
      {
        "title": "Dot products measure alignment, not length alone",
        "body": "$\\vec a \\cdot \\vec b = |\\vec a|\\,|\\vec b|\\cos\\theta$. In coordinates it is the sum of the products of corresponding components. For two non-zero vectors, a zero dot product means they are perpendicular."
      }
    ],
    "points": [
      {
        "front": "Can two non-zero vectors have zero dot product?",
        "back": "Yes, when the angle between them is $90^\\circ$."
      }
    ],
    "mistakes": [
      {
        "wrong": "A negative dot product means one vector has negative length.",
        "right": "Lengths are non-negative; a negative dot product indicates an obtuse angle."
      }
    ],
    "examples": [
      {
        "question": "Find the dot product of $(1, 2, 3)$ and $(4, -1, 2)$.",
        "steps": [
          "Multiply corresponding components: $1 \\times 4$, $2 \\times (-1)$, $3 \\times 2$.",
          "Add: $4 - 2 + 6$.",
          "The dot product is 8."
        ],
        "answer": "8",
        "verify": {
          "kind": "value",
          "expr": "1*4+2*(-1)+3*2",
          "answer": "8"
        }
      }
    ]
  },
  "c12-3d-geometry": {
    "concepts": [
      {
        "title": "Point–plane distance normalizes a signed expression",
        "body": "The plane $ax + by + cz = d$ has normal vector $(a, b, c)$. Substitute the point into $ax + by + cz - d$ and divide its absolute value by $\\sqrt{a^2 + b^2 + c^2}$. The denominator stops a rescaling of the coefficients from changing the distance."
      }
    ],
    "points": [
      {
        "front": "Why is there an absolute value in point–plane distance?",
        "back": "Points on opposite sides have opposite signed expressions but both distances are non-negative."
      }
    ],
    "mistakes": [
      {
        "wrong": "Multiplying every plane coefficient by 3 triples the distance.",
        "right": "Numerator and normal length scale equally, so distance stays unchanged."
      }
    ],
    "examples": [
      {
        "question": "Find the distance from $(1, 2, 3)$ to the plane $2x - y + 2z = 4$.",
        "steps": [
          "The signed numerator is $2(1) - 2 + 2(3) - 4 = 2$.",
          "The length of the normal is $\\sqrt{2^2 + 1^2 + 2^2} = 3$.",
          "Distance $= \\tfrac{|2|}{3} = \\tfrac{2}{3}$."
        ],
        "answer": "$\\tfrac{2}{3}$",
        "verify": {
          "kind": "value",
          "expr": "abs(2*1-2+2*3-4)/sqrt(2^2+(-1)^2+2^2)",
          "answer": "2/3"
        }
      }
    ]
  },
  "c12-linear-programming": {
    "concepts": [
      {
        "title": "Checking vertices works only with the feasible region",
        "body": "For a bounded polygonal feasible region and a linear objective, a maximum or minimum is attained at a vertex (though it may also occur along an edge). First find every feasible intersection, then evaluate the objective."
      }
    ],
    "points": [
      {
        "front": "Why must a proposed intersection satisfy every inequality?",
        "back": "Only feasible points are candidates for the constrained optimum."
      }
    ],
    "mistakes": [
      {
        "wrong": "The optimum always occurs at the largest $x$-coordinate.",
        "right": "The objective weights and all constraints jointly determine the optimum."
      }
    ],
    "examples": [
      {
        "question": "Maximise $3x + 2y$ subject to $x + y \\le 4$, $x \\le 2$, $x \\ge 0$, $y \\ge 0$.",
        "steps": [
          "The vertices are $(0, 0)$, $(2, 0)$, $(2, 2)$ and $(0, 4)$.",
          "Evaluate $3x + 2y$: 0, 6, 10 and 8 respectively.",
          "The maximum, 10, occurs at $(2, 2)$."
        ],
        "answer": "10 at $(2, 2)$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "3*2+2*2",
              "10"
            ],
            [
              "3*0+2*4",
              "8"
            ],
            [
              "2+2",
              "4"
            ]
          ]
        }
      }
    ]
  },
  "c12-probability": {
    "concepts": [
      {
        "title": "Bayes' rule must account for false positives",
        "body": "A test with high sensitivity can still have a low positive predictive value when the base rate is small. Use a probability tree or a weighted population table rather than confusing $P(\\text{positive} \\mid \\text{condition})$ with $P(\\text{condition} \\mid \\text{positive})$."
      }
    ],
    "points": [
      {
        "front": "Why might a 90%-sensitive test be less than 50% correct among its positive results?",
        "back": "When the condition is rare, false positives from a large unaffected population can outnumber true positives."
      }
    ],
    "mistakes": [
      {
        "wrong": "$P(\\text{condition} \\mid \\text{positive})$ equals the sensitivity.",
        "right": "Sensitivity is $P(\\text{positive} \\mid \\text{condition})$, a different conditional probability."
      }
    ],
    "examples": [
      {
        "question": "Prevalence is 1%, sensitivity 90% and the false-positive rate 5%. Find $P(\\text{condition} \\mid \\text{positive})$.",
        "steps": [
          "True-positive probability: $0.01 \\times 0.90 = 0.009$.",
          "False-positive probability: $0.99 \\times 0.05 = 0.0495$.",
          "Posterior $= \\dfrac{0.009}{0.009 + 0.0495} = \\tfrac{2}{13}$."
        ],
        "answer": "$\\tfrac{2}{13}$",
        "verify": {
          "kind": "value",
          "expr": "(0.01*0.9)/(0.01*0.9+0.99*0.05)",
          "answer": "2/13"
        }
      }
    ]
  }
};
