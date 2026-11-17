// Pri Learning — 14 new original Class 10 multi-step worked investigations.
export default {
  "c10-real-numbers": {
    "examples": [
      {
        "question": "Find the least positive number divisible by each of 18, 24 and 30.",
        "steps": [
          "Factorise: $18 = 2 \\times 3^2$, $24 = 2^3 \\times 3$ and $30 = 2 \\times 3 \\times 5$.",
          "Take the maximum prime power present in each.",
          "$\\text{LCM} = 2^3 \\times 3^2 \\times 5 = 360$."
        ],
        "answer": "360",
        "verify": {
          "kind": "value",
          "expr": "2^3*3^2*5",
          "answer": "360"
        }
      }
    ]
  },
  "c10-polynomials": {
    "examples": [
      {
        "question": "A monic quadratic has real roots whose product is 36 and whose absolute difference is 5. Find all possible coefficients of $x$.",
        "steps": [
          "Let the roots be $r$ and $s$. The identity $(r+s)^2 = (r-s)^2 + 4rs$ gives $(r+s)^2 = 25 + 144 = 169$.",
          "Thus $r+s = 13$ or $r+s = -13$; both are possible, for example roots $9, 4$ or $-9, -4$.",
          "The coefficient of $x$ is $-(r+s)$, so it can be $-13$ or $13$."
        ],
        "answer": "$-13$ or $13$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "9*4",
              "36"
            ],
            [
              "(9-4)^2",
              "25"
            ],
            [
              "(-9-4)^2",
              "169"
            ]
          ]
        }
      }
    ]
  },
  "c10-pair-linear-equations": {
    "examples": [
      {
        "question": "Two books and three pens cost ₹67; three books and two pens cost ₹73. Find each price.",
        "steps": [
          "Set $2b + 3p = 67$ and $3b + 2p = 73$.",
          "Subtract the equations: $b - p = 6$, so $b = p + 6$.",
          "Substitution gives $5p = 55$, so $p = 11$ and $b = 17$."
        ],
        "answer": "Book ₹17, pen ₹11",
        "verify": {
          "kind": "system",
          "equations": [
            "2*b+3*p=67",
            "3*b+2*p=73"
          ],
          "solution": {
            "b": "17",
            "p": "11"
          }
        }
      }
    ]
  },
  "c10-quadratic-equations": {
    "examples": [
      {
        "question": "A rectangle's length is 3 cm greater than its width, and its area is $54\\text{ cm}^2$. Find its dimensions.",
        "steps": [
          "If the width is $x > 0$, the length is $x + 3$ and $x(x+3) = 54$.",
          "Factorise: $x^2 + 3x - 54 = (x+9)(x-6) = 0$.",
          "Reject $x = -9$; the dimensions are 6 cm by 9 cm."
        ],
        "answer": "6 cm by 9 cm",
        "verify": {
          "kind": "value",
          "expr": "6*9",
          "answer": "54"
        }
      }
    ]
  },
  "c10-arithmetic-progressions": {
    "examples": [
      {
        "question": "The sum of the first $n$ terms of a sequence is $S_n = 3n^2 + 2n$. Find its 15th term.",
        "steps": [
          "The 15th term equals $S_{15} - S_{14}$.",
          "In general $S_n - S_{n-1}$ simplifies to $6n - 1$.",
          "Thus the 15th term is $6 \\times 15 - 1 = 89$."
        ],
        "answer": "89",
        "verify": {
          "kind": "value",
          "expr": "3*15^2+2*15-(3*14^2+2*14)",
          "answer": "89"
        }
      }
    ]
  },
  "c10-triangles": {
    "examples": [
      {
        "question": "Two similar triangles have corresponding sides in the ratio $2 : 3$. The smaller area is $32\\text{ cm}^2$. Find the larger area.",
        "steps": [
          "Their altitudes are also in the ratio $2 : 3$.",
          "Therefore their areas are in the squared ratio $4 : 9$.",
          "Larger area $= 32 \\times \\tfrac{9}{4} = 72\\text{ cm}^2$."
        ],
        "answer": "$72\\text{ cm}^2$",
        "verify": {
          "kind": "value",
          "expr": "32*9/4",
          "answer": "72"
        }
      }
    ]
  },
  "c10-coordinate-geometry": {
    "examples": [
      {
        "question": "Find the point $P$ that divides $A(1, 5)$ and $B(7, -1)$ internally in the ratio $AP : PB = 2 : 1$.",
        "steps": [
          "Use $P = A + \\tfrac{2}{3}(B - A)$.",
          "$B - A = (6, -6)$, and $\\tfrac{2}{3}(B - A) = (4, -4)$.",
          "Add to $A$ to obtain $P = (5, 1)$."
        ],
        "answer": "$(5, 1)$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "1+(2/3)*(7-1)",
              "5"
            ],
            [
              "5+(2/3)*(-1-5)",
              "1"
            ]
          ]
        }
      }
    ]
  },
  "c10-trigonometry": {
    "examples": [
      {
        "question": "An acute angle satisfies $\\sin\\theta + \\cos\\theta = \\tfrac{7}{5}$. Find $\\tan\\theta + \\cot\\theta$.",
        "steps": [
          "Square the condition: $1 + 2\\sin\\theta\\cos\\theta = \\tfrac{49}{25}$.",
          "Hence $\\sin\\theta\\cos\\theta = \\tfrac{12}{25}$.",
          "$\\tan\\theta + \\cot\\theta = \\dfrac{\\sin^2\\theta + \\cos^2\\theta}{\\sin\\theta\\cos\\theta} = \\tfrac{25}{12}$."
        ],
        "answer": "$\\tfrac{25}{12}$",
        "verify": {
          "kind": "value",
          "expr": "1/((49/25-1)/2)",
          "answer": "25/12"
        }
      }
    ]
  },
  "c10-trig-applications": {
    "examples": [
      {
        "question": "Walking 20 m towards a tower changes its angle of elevation from $30^\\circ$ to $60^\\circ$. Find the height of the tower, assuming level ground.",
        "steps": [
          "Let the original horizontal distance be $d$ and the height be $h$.",
          "Using tangents, $h = \\dfrac{d}{\\sqrt{3}} = (d - 20)\\sqrt{3}$; solving gives $d = 30$.",
          "Hence $h = \\dfrac{30}{\\sqrt{3}} = 10\\sqrt{3}$ metres."
        ],
        "answer": "$10\\sqrt{3}$ m",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "30/sqrt(3)",
              "10*sqrt(3)"
            ],
            [
              "(30-20)*sqrt(3)",
              "10*sqrt(3)"
            ]
          ]
        }
      }
    ]
  },
  "c10-circles": {
    "examples": [
      {
        "question": "Tangents $PA$ and $PB$ meet at $P$ outside a circle with centre $O$. Given $\\angle APB = 70^\\circ$, find $\\angle AOB$.",
        "steps": [
          "Radii $OA$ and $OB$ are perpendicular to the tangents.",
          "In quadrilateral $OAPB$, angles $OAP$ and $OBP$ are each $90^\\circ$.",
          "Therefore $\\angle AOB = 360^\\circ - 90^\\circ - 90^\\circ - 70^\\circ = 110^\\circ$."
        ],
        "answer": "$110^\\circ$",
        "verify": {
          "kind": "value",
          "expr": "360-90-90-70",
          "answer": "110"
        }
      }
    ]
  },
  "c10-areas-circles": {
    "examples": [
      {
        "question": "Find the area of a quarter-annulus with radii 14 cm and 7 cm, using $\\pi = \\tfrac{22}{7}$.",
        "steps": [
          "Subtract the two circle areas, then take one quarter.",
          "Area $= \\tfrac{\\pi}{4}(14^2 - 7^2) = \\tfrac{147\\pi}{4}$.",
          "Using $\\pi = \\tfrac{22}{7}$ gives $115.5\\text{ cm}^2$."
        ],
        "answer": "$115.5\\text{ cm}^2$",
        "verify": {
          "kind": "value",
          "expr": "(22/7)*(14^2-7^2)/4",
          "answer": "115.5"
        }
      }
    ]
  },
  "c10-surface-volume": {
    "examples": [
      {
        "question": "A cylinder of radius 3 cm and height 8 cm has a cone of the same radius and height 4 cm removed. Find the remaining volume.",
        "steps": [
          "Cylinder volume $= \\pi \\times 9 \\times 8 = 72\\pi$.",
          "Removed cone volume $= \\tfrac{1}{3}\\pi \\times 9 \\times 4 = 12\\pi$.",
          "Remaining volume $= 72\\pi - 12\\pi = 60\\pi\\text{ cm}^3$."
        ],
        "answer": "$60\\pi\\text{ cm}^3$",
        "verify": {
          "kind": "value",
          "expr": "3^2*8-(1/3)*3^2*4",
          "answer": "60"
        }
      }
    ]
  },
  "c10-statistics": {
    "examples": [
      {
        "question": "Values 10, 20, 30 occur with frequencies $4, x, 2$. Their mean is 18. Find $x$.",
        "steps": [
          "The weighted mean is $\\dfrac{100 + 20x}{6 + x} = 18$.",
          "Rearrange: $100 + 20x = 108 + 18x$.",
          "Therefore $2x = 8$ and $x = 4$."
        ],
        "answer": "4",
        "verify": {
          "kind": "value",
          "expr": "(4*10+4*20+2*30)/(4+4+2)",
          "answer": "18"
        }
      }
    ]
  },
  "c10-probability": {
    "examples": [
      {
        "question": "A bag contains 4 red and 3 blue balls. Two are taken without replacement. Find $P(\\text{both red})$.",
        "steps": [
          "The probability of red first is $\\tfrac{4}{7}$.",
          "Given red first, the probability of red second is $\\tfrac{3}{6}$.",
          "Multiply: $P(\\text{both red}) = \\tfrac{4}{7} \\times \\tfrac{3}{6} = \\tfrac{2}{7}$."
        ],
        "answer": "$\\tfrac{2}{7}$",
        "verify": {
          "kind": "value",
          "expr": "4/7*3/6",
          "answer": "2/7"
        }
      }
    ]
  }
};
