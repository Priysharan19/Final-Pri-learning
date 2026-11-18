// Original Pri Learning Class 12 worked problem-solving cases, not past papers.
// Deterministic answer checks required; independent pedagogical sign-off pending.
export default {
  "c12-relations-functions": {
    "examples": [
      {
        "question": "Find the inverse of $f(x) = \\dfrac{3x+1}{x-2}$, stating the excluded inputs.",
        "steps": [
          "Write $y = \\dfrac{3x+1}{x-2}$, where $x \\ne 2$.",
          "Rearrange $yx - 2y = 3x + 1$ to $x(y - 3) = 2y + 1$.",
          "Thus $f^{-1}(y) = \\dfrac{2y+1}{y-3}$, with $y \\ne 3$. The original function never outputs 3."
        ],
        "answer": "$f^{-1}(y) = \\dfrac{2y+1}{y-3}$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "(3*4+1)/(4-2)",
              "13/2"
            ],
            [
              "(2*(13/2)+1)/((13/2)-3)",
              "4"
            ]
          ]
        }
      }
    ]
  },
  "c12-inverse-trigonometric": {
    "examples": [
      {
        "question": "Evaluate $\\tan^{-1}\\left(\\tfrac{1}{2}\\right) + \\tan^{-1}\\left(\\tfrac{1}{3}\\right)$ exactly.",
        "steps": [
          "Both principal values are positive acute angles, and their sum stays below $\\tfrac{\\pi}{2}$.",
          "By the tangent addition identity, the tangent of the sum is $\\dfrac{\\tfrac{1}{2} + \\tfrac{1}{3}}{1 - \\tfrac{1}{6}} = 1$.",
          "The only such sum with tangent 1 is $\\tfrac{\\pi}{4}$."
        ],
        "answer": "$\\tfrac{\\pi}{4}$",
        "verify": {
          "kind": "value",
          "expr": "atan(1)",
          "answer": "pi/4"
        }
      }
    ]
  },
  "c12-matrices": {
    "examples": [
      {
        "question": "For $A = \\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}$, find the matrix $X$ satisfying $2A + X = I$.",
        "steps": [
          "Rearrange: $X = I - 2A$; the identity has ones on the diagonal and zeros elsewhere.",
          "Subtract entries: $1 - 2 = -1$, $0 - 4 = -4$, $0 - 6 = -6$, $1 - 8 = -7$.",
          "$X = \\begin{pmatrix} -1 & -4 \\\\ -6 & -7 \\end{pmatrix}$."
        ],
        "answer": "$\\begin{pmatrix} -1 & -4 \\\\ -6 & -7 \\end{pmatrix}$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "1-2*1",
              "-1"
            ],
            [
              "0-2*2",
              "-4"
            ],
            [
              "0-2*3",
              "-6"
            ],
            [
              "1-2*4",
              "-7"
            ]
          ]
        }
      }
    ]
  },
  "c12-determinants": {
    "examples": [
      {
        "question": "For which real values of $t$ is $\\begin{vmatrix} t & 1 \\\\ 4 & t \\end{vmatrix}$ zero?",
        "steps": [
          "The determinant is $t \\cdot t - 1 \\cdot 4 = t^2 - 4$.",
          "Set $t^2 - 4 = (t-2)(t+2) = 0$.",
          "Therefore $t = 2$ or $t = -2$; at each value the rows are dependent."
        ],
        "answer": "$t = \\pm 2$",
        "verify": {
          "kind": "roots",
          "f": "x^2-4",
          "answers": [
            "2",
            "-2"
          ],
          "degree": 2
        }
      }
    ]
  },
  "c12-continuity-differentiability": {
    "examples": [
      {
        "question": "Let $f(x) = x^2$ for $x \\le 1$ and $f(x) = ax + b$ for $x > 1$. Find $a$ and $b$ so that $f$ is differentiable at $x = 1$.",
        "steps": [
          "Continuity gives $a + b = 1$, since the left value is 1.",
          "The left derivative at $x = 1$ is 2; the right derivative is $a$, so $a = 2$.",
          "Then $b = 1 - a = -1$. Both the value and the derivative match."
        ],
        "answer": "$a = 2$, $b = -1$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "2+(-1)",
              "1"
            ],
            [
              "2*1",
              "2"
            ]
          ]
        }
      }
    ]
  },
  "c12-applications-derivatives": {
    "examples": [
      {
        "question": "A 40 m fence encloses three sides of a rectangular plot bordering a straight river. Find the greatest possible enclosed area.",
        "steps": [
          "Let $x$ be each side perpendicular to the river and $y$ the fenced side parallel to it: $2x + y = 40$.",
          "Area $A = xy = x(40 - 2x) = 40x - 2x^2$, with $0 < x < 20$.",
          "$A' = 40 - 4x$ vanishes at $x = 10$, giving $y = 20$ and maximum area $200\\text{ m}^2$."
        ],
        "answer": "$200\\text{ m}^2$, with dimensions 10 m by 20 m",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "2*10+20",
              "40"
            ],
            [
              "10*20",
              "200"
            ]
          ]
        }
      }
    ]
  },
  "c12-integrals": {
    "examples": [
      {
        "question": "Evaluate $\\displaystyle\\int_0^1 \\frac{2x}{1+x^2}\\,dx$.",
        "steps": [
          "Substitute $u = 1 + x^2$, so $du = 2x\\,dx$.",
          "When $x = 0$, $u = 1$; when $x = 1$, $u = 2$.",
          "The integral becomes $\\displaystyle\\int_1^2 \\frac{du}{u} = \\ln 2$."
        ],
        "answer": "$\\ln 2$",
        "verify": {
          "kind": "integral",
          "f": "2*x/(1+x^2)",
          "a": "0",
          "b": "1",
          "answer": "ln(2)"
        }
      }
    ]
  },
  "c12-applications-integrals": {
    "examples": [
      {
        "question": "Find the geometric area between $y = x^2$ and $y = 1$ over $-2 \\le x \\le 2$.",
        "steps": [
          "The curves meet at $x = \\pm 1$; which curve is on top changes there.",
          "By symmetry, the area is $2\\left(\\displaystyle\\int_0^1 (1 - x^2)\\,dx + \\int_1^2 (x^2 - 1)\\,dx\\right)$.",
          "The bracket equals $\\tfrac{2}{3} + \\tfrac{4}{3} = 2$, giving a total area of 4."
        ],
        "answer": "4 square units",
        "verify": {
          "kind": "value",
          "expr": "2*((1-1/3)+((8/3-2)-(1/3-1)))",
          "answer": "4"
        }
      }
    ]
  },
  "c12-differential-equations": {
    "examples": [
      {
        "question": "Solve $\\dfrac{dy}{dx} = 2xy$ with $y(0) = 3$, and find $y(1)$.",
        "steps": [
          "Separate the variables on the positive solution: $\\dfrac{dy}{y} = 2x\\,dx$.",
          "Integrate: $\\ln y = x^2 + C$; $y(0) = 3$ gives $e^C = 3$.",
          "Thus $y = 3e^{x^2}$, so $y(1) = 3e$."
        ],
        "answer": "$y = 3e^{x^2}$; $y(1) = 3e$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "3*exp(0)",
              "3"
            ],
            [
              "3*exp(1)",
              "3*e"
            ]
          ]
        }
      }
    ]
  },
  "c12-vector-algebra": {
    "examples": [
      {
        "question": "Find the scalar projection of $\\vec a = (3, 4, 0)$ along $\\vec b = (1, 2, 2)$.",
        "steps": [
          "$\\vec a \\cdot \\vec b = 3 \\times 1 + 4 \\times 2 + 0 \\times 2 = 11$.",
          "The length $|\\vec b| = \\sqrt{1 + 4 + 4} = 3$.",
          "The scalar projection of $\\vec a$ on $\\vec b$ is $\\tfrac{11}{3}$."
        ],
        "answer": "$\\tfrac{11}{3}$",
        "verify": {
          "kind": "value",
          "expr": "(3*1+4*2+0*2)/sqrt(1^2+2^2+2^2)",
          "answer": "11/3"
        }
      }
    ]
  },
  "c12-3d-geometry": {
    "examples": [
      {
        "question": "Find the distance from $P(3, 0, 0)$ to the line through the origin with direction $(1, 2, 2)$.",
        "steps": [
          "Let $\\vec b = (1, 2, 2)$ and $\\vec p = (3, 0, 0)$. The squared distance is $|\\vec p|^2 - \\dfrac{(\\vec p \\cdot \\vec b)^2}{|\\vec b|^2}$.",
          "Compute $|\\vec p|^2 = 9$, $\\vec p \\cdot \\vec b = 3$ and $|\\vec b|^2 = 9$.",
          "The squared distance is $9 - \\tfrac{9}{9} = 8$, so the distance is $2\\sqrt{2}$."
        ],
        "answer": "$2\\sqrt{2}$",
        "verify": {
          "kind": "value",
          "expr": "sqrt(3^2-3^2/(1^2+2^2+2^2))",
          "answer": "2*sqrt(2)"
        }
      }
    ]
  },
  "c12-linear-programming": {
    "examples": [
      {
        "question": "Maximise $P = 5x + 3y$ subject to $x + y \\le 8$, $2x + y \\le 10$, $x \\ge 0$ and $y \\ge 0$.",
        "steps": [
          "The feasible vertices are $(0, 0)$, $(5, 0)$, $(2, 6)$ and $(0, 8)$.",
          "Evaluate $5x + 3y$ at the vertices to obtain 0, 25, 28 and 24.",
          "The maximum is 28, at the intersection $(2, 6)$."
        ],
        "answer": "28 at $(2, 6)$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "5*2+3*6",
              "28"
            ],
            [
              "2+6",
              "8"
            ],
            [
              "2*2+6",
              "10"
            ]
          ]
        }
      }
    ]
  },
  "c12-probability": {
    "examples": [
      {
        "question": "One of two boxes is chosen at random. Box A has 2 red balls and 1 blue ball; Box B has 1 red and 2 blue. Given that a red ball is drawn, find the probability that Box A was chosen.",
        "steps": [
          "Both boxes have prior probability $\\tfrac{1}{2}$.",
          "$P(A \\cap \\text{red}) = \\tfrac{1}{2} \\cdot \\tfrac{2}{3} = \\tfrac{1}{3}$; $P(B \\cap \\text{red}) = \\tfrac{1}{2} \\cdot \\tfrac{1}{3} = \\tfrac{1}{6}$.",
          "By Bayes' theorem, $P(A \\mid \\text{red}) = \\dfrac{1/3}{1/3 + 1/6} = \\tfrac{2}{3}$."
        ],
        "answer": "$\\tfrac{2}{3}$",
        "verify": {
          "kind": "value",
          "expr": "(0.5*(2/3))/(0.5*(2/3)+0.5*(1/3))",
          "answer": "2/3"
        }
      }
    ]
  }
};
