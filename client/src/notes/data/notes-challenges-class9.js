// Original Pri Learning Class 9: two additional progressively explained tasks per chapter.
export default {
  "c9-coordinate-geometry": {
    "examples": [
      {
        "question": "Find the area of triangle $A(0,0)$, $B(6,0)$, $C(6,8)$, explaining which lengths are perpendicular.",
        "steps": [
          "$AB$ is horizontal and has length $6$.",
          "$BC$ is vertical and has length $8$, so angle $ABC$ is a right angle.",
          "Area $=\\tfrac{1}{2}\\times 6\\times 8=24$ square units."
        ],
        "answer": "$24$ square units",
        "verify": {
          "kind": "value",
          "expr": "6*8/2",
          "answer": "24"
        }
      },
      {
        "question": "Find the midpoint and length of the segment from $A(-5,4)$ to $B(7,-2)$.",
        "steps": [
          "Midpoint $M=(\\tfrac{-5+7}{2},\\tfrac{4-2}{2})=(1,1)$.",
          "Coordinate differences are $12$ and $-6$.",
          "Length $=\\sqrt{12^2+6^2}=\\sqrt{180}=6\\sqrt{5}$."
        ],
        "answer": "$M=(1,1)$, length $6\\sqrt{5}$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "(-5+7)/2",
              "1"
            ],
            [
              "(4-2)/2",
              "1"
            ],
            [
              "sqrt((7+5)^2+(-2-4)^2)",
              "6*sqrt(5)"
            ]
          ]
        }
      }
    ]
  },
  "c9-linear-polynomials": {
    "examples": [
      {
        "question": "A linear polynomial $p(x)=ax+7$ satisfies $p(3)=25$. Find $a$ and its zero.",
        "steps": [
          "Set $3a+7=25$ and solve to get $a=6$.",
          "Then $p(x)=6x+7$.",
          "Its zero is the solution of $6x+7=0$, namely $x=-\\tfrac{7}{6}$."
        ],
        "answer": "$a=6$, zero $-\\tfrac{7}{6}$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "6*3+7",
              "25"
            ],
            [
              "6*(-7/6)+7",
              "0"
            ]
          ]
        }
      },
      {
        "question": "The zero of $p(x)=kx-12$ is $x=4$. Determine $k$ and $p(-2)$.",
        "steps": [
          "Because $p(4)=0$, we know $4k-12=0$.",
          "Hence $k=3$ and $p(x)=3x-12$.",
          "Evaluate $p(-2)=-6-12=-18$."
        ],
        "answer": "$k=3$, $p(-2)=-18$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "3*4-12",
              "0"
            ],
            [
              "3*(-2)-12",
              "-18"
            ]
          ]
        }
      }
    ]
  },
  "c9-number-systems": {
    "examples": [
      {
        "question": "Locate two different rational numbers strictly between $\\tfrac{1}{3}$ and $\\tfrac{1}{2}$, checking their order by cross multiplication.",
        "steps": [
          "Choose $\\tfrac{3}{8}$ and $\\tfrac{5}{12}$ as candidates.",
          "Compare $\\tfrac{1}{3}=\\tfrac{8}{24}$, $\\tfrac{3}{8}=\\tfrac{9}{24}$, $\\tfrac{5}{12}=\\tfrac{10}{24}$ and $\\tfrac{1}{2}=\\tfrac{12}{24}$.",
          "Both candidates lie strictly inside the requested interval."
        ],
        "answer": "$\\tfrac{3}{8}$ and $\\tfrac{5}{12}$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "1/3+1/24",
              "3/8"
            ],
            [
              "3/8+1/24",
              "5/12"
            ],
            [
              "5/12+1/12",
              "1/2"
            ]
          ]
        }
      },
      {
        "question": "Without approximating radicals, simplify $(\\sqrt{5}+\\sqrt{2})(\\sqrt{5}-\\sqrt{2})$.",
        "steps": [
          "Recognise the difference-of-squares structure $(a+b)(a-b)=a^2-b^2$.",
          "With $a=\\sqrt{5}$ and $b=\\sqrt{2}$, the expression is $5-2$.",
          "The exact answer is $3$."
        ],
        "answer": "$3$",
        "verify": {
          "kind": "value",
          "expr": "(sqrt(5)+sqrt(2))*(sqrt(5)-sqrt(2))",
          "answer": "3"
        }
      }
    ]
  },
  "c9-algebraic-identities": {
    "examples": [
      {
        "question": "Calculate $98^3-2^3$ without independently cubing both numbers.",
        "steps": [
          "Use $a^3-b^3=(a-b)(a^2+ab+b^2)$.",
          "The factors are $96$ and $(9604+196+4)=9804$.",
          "Multiply $96\\times 9804$ to obtain $941184$."
        ],
        "answer": "$941184$",
        "verify": {
          "kind": "value",
          "expr": "(98-2)*(98^2+98*2+2^2)",
          "answer": "941184"
        }
      },
      {
        "question": "Calculate $1.02^2$ exactly using the square-of-a-sum identity.",
        "steps": [
          "Write $1.02=1+0.02$.",
          "Then $1.02^2=1+2\\times 0.02+0.02^2$.",
          "The exact decimal is $1.0404$."
        ],
        "answer": "$1.0404$",
        "verify": {
          "kind": "value",
          "expr": "(1+0.02)^2",
          "answer": "1.0404"
        }
      }
    ]
  },
  "c9-circles": {
    "examples": [
      {
        "question": "In a circle of radius $10$ cm, a chord lies $6$ cm from the centre. Find its complete length.",
        "steps": [
          "The perpendicular from centre to chord bisects the chord.",
          "Half-length $=\\sqrt{10^2-6^2}=\\sqrt{64}=8$.",
          "Double the result to obtain chord length $16$ cm."
        ],
        "answer": "$16$ cm",
        "verify": {
          "kind": "value",
          "expr": "2*sqrt(10^2-6^2)",
          "answer": "16"
        }
      },
      {
        "question": "A cyclic quadrilateral has one angle of $116^\\circ$. What is its opposite angle? Explain why the other two angles cannot be found uniquely.",
        "steps": [
          "Opposite angles of a cyclic quadrilateral add to $180^\\circ$.",
          "Therefore the opposite angle is $180-116=64^\\circ$.",
          "The remaining opposite pair also sums to $180^\\circ$, but either value can vary without further data."
        ],
        "answer": "$64^\\circ$",
        "verify": {
          "kind": "value",
          "expr": "180-116",
          "answer": "64"
        }
      }
    ]
  },
  "c9-perimeter-area": {
    "examples": [
      {
        "question": "Use Heron's formula to find the area of a triangle with side lengths $5$ cm, $12$ cm and $13$ cm.",
        "steps": [
          "The semiperimeter is $s=\\tfrac{5+12+13}{2}=15$.",
          "Heron's product is $15(15-5)(15-12)(15-13)=15\\times 10\\times 3\\times 2$.",
          "The area is $\\sqrt{900}=30\\text{ cm}^2$."
        ],
        "answer": "$30\\text{ cm}^2$",
        "verify": {
          "kind": "value",
          "expr": "sqrt(15*(15-5)*(15-12)*(15-13))",
          "answer": "30"
        }
      },
      {
        "question": "An isosceles triangle has equal sides $13$ cm and base $10$ cm. Find its area and perimeter.",
        "steps": [
          "The altitude bisects the base into two lengths of $5$ cm.",
          "Height $=\\sqrt{13^2-5^2}=\\sqrt{144}=12$ cm.",
          "Area $=10\\times \\tfrac{12}{2}=60\\text{ cm}^2$; perimeter $=13+13+10=36$ cm."
        ],
        "answer": "Area $60\\text{ cm}^2$, perimeter $36$ cm",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "sqrt(13^2-5^2)",
              "12"
            ],
            [
              "10*12/2",
              "60"
            ],
            [
              "13+13+10",
              "36"
            ]
          ]
        }
      }
    ]
  },
  "c9-probability": {
    "examples": [
      {
        "question": "Three fair coins are tossed. Find the probability of exactly two heads.",
        "steps": [
          "The ordered sample space contains $2^3=8$ equally likely sequences.",
          "Exactly-two-head sequences are HHT, HTH and THH: three outcomes.",
          "The probability is $\\tfrac{3}{8}$."
        ],
        "answer": "$\\tfrac{3}{8}$",
        "verify": {
          "kind": "value",
          "expr": "3/2^3",
          "answer": "3/8"
        }
      },
      {
        "question": "A bag has $5$ green and $4$ yellow balls. Two balls are drawn without replacement. Find $P(\\text{both yellow})$.",
        "steps": [
          "$P(\\text{yellow first})=\\tfrac{4}{9}$.",
          "With one yellow removed, $P(\\text{yellow second}\\mid\\text{first yellow})=\\tfrac{3}{8}$.",
          "Multiply the conditional factors to get $\\tfrac{4}{9}\\times\\tfrac{3}{8}=\\tfrac{1}{6}$."
        ],
        "answer": "$\\tfrac{1}{6}$",
        "verify": {
          "kind": "value",
          "expr": "4/9*3/8",
          "answer": "1/6"
        }
      }
    ]
  },
  "c9-sequences-progressions": {
    "examples": [
      {
        "question": "A sequence is defined by $a_n=n^2+n$ for positive integer $n$. Find $a_6-a_5$.",
        "steps": [
          "Compute $a_6=6^2+6=42$.",
          "Compute $a_5=5^2+5=30$.",
          "The difference is $42-30=12$."
        ],
        "answer": "$12$",
        "verify": {
          "kind": "value",
          "expr": "(6^2+6)-(5^2+5)",
          "answer": "12"
        }
      },
      {
        "question": "A rule is explicitly given by $a_n=(n+1)^2$. Verify its first four terms and find the tenth.",
        "steps": [
          "For $n=1,2,3,4$ the terms are $4,9,16,25$.",
          "Unlike guessing from a finite pattern, the supplied formula fixes all terms.",
          "For $n=10$, $a_{10}=11^2=121$."
        ],
        "answer": "$4$, $9$, $16$, $25$; tenth term $121$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "(1+1)^2",
              "4"
            ],
            [
              "(2+1)^2",
              "9"
            ],
            [
              "(3+1)^2",
              "16"
            ],
            [
              "(4+1)^2",
              "25"
            ],
            [
              "(10+1)^2",
              "121"
            ]
          ]
        }
      }
    ]
  }
};
