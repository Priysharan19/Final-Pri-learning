// Original Pri Learning Class 11 worked challenges; Complex Numbers has its own deep study pack.
export default {
  "c11-sets": {
    "examples": [
      {
        "question": "Three groups have sizes |A|=20, |B|=18, |C|=15, pairwise overlaps 7,6,5 and triple overlap 2. Find the union's size.",
        "steps": [
          "Each individual count includes overlaps, so add the three sizes first.",
          "Subtract each pairwise intersection once and add the triple intersection back once.",
          "Inclusion–exclusion gives 20+18+15-7-6-5+2=37."
        ],
        "answer": "37",
        "verify": {
          "kind": "value",
          "expr": "20+18+15-7-6-5+2",
          "answer": "37"
        }
      }
    ]
  },
  "c11-relations-functions": {
    "examples": [
      {
        "question": "Find the range of f(x)=x²+2x+2 on the real line; is f injective?",
        "steps": [
          "Complete the square: f(x)=(x+1)²+1.",
          "Its minimum is 1 at x=-1, so the range is [1,infinity).",
          "f(-2)=2=f(0), so the function is not one-to-one."
        ],
        "answer": "Range [1,∞); not injective",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "(-1)^2+2*(-1)+2",
              "1"
            ],
            [
              "(-2)^2+2*(-2)+2",
              "2"
            ],
            [
              "0^2+2*0+2",
              "2"
            ]
          ]
        }
      }
    ]
  },
  "c11-trig-functions": {
    "examples": [
      {
        "question": "How many solutions satisfy sin(2x)=sin(x) for 0≤x<2π?",
        "steps": [
          "Use sin(2x)=2sin(x)cos(x), so sin(x)(2cos(x)-1)=0.",
          "sin(x)=0 gives x=0,π; cos(x)=1/2 gives x=π/3,5π/3.",
          "There are exactly four distinct solutions in the half-open interval."
        ],
        "answer": "4 solutions",
        "verify": {
          "kind": "value",
          "expr": "2+2",
          "answer": "4"
        }
      }
    ]
  },
  "c11-linear-inequalities": {
    "examples": [
      {
        "question": "Solve the strict inequality |2x-3|<5.",
        "steps": [
          "Use |u|<5 iff -5<u<5.",
          "Therefore -5<2x-3<5, so -2<2x<8.",
          "Divide by 2 to obtain -1<x<4; neither endpoint is included."
        ],
        "answer": "-1<x<4",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "abs(2*0-3)",
              "3"
            ],
            [
              "abs(2*4-3)",
              "5"
            ]
          ]
        }
      }
    ]
  },
  "c11-permutations-combinations": {
    "examples": [
      {
        "question": "Eight people form a three-person committee. How many committees include at least one of two specified people?",
        "steps": [
          "Total possible committees: C(8,3)=56.",
          "Committees containing neither specified person: C(6,3)=20.",
          "Subtract to obtain 36 eligible committees."
        ],
        "answer": "36",
        "verify": {
          "kind": "value",
          "expr": "56-20",
          "answer": "36"
        }
      }
    ]
  },
  "c11-binomial-theorem": {
    "examples": [
      {
        "question": "Determine the coefficient of x^4 in (2+x)^6.",
        "steps": [
          "The x^4 term uses four copies of x and two copies of 2.",
          "Its binomial coefficient is C(6,4)=15.",
          "Multiply 15×2²=60."
        ],
        "answer": "60",
        "verify": {
          "kind": "value",
          "expr": "15*2^2",
          "answer": "60"
        }
      }
    ]
  },
  "c11-sequences-series": {
    "examples": [
      {
        "question": "A positive-ratio geometric progression has third term 12 and fifth term 48. Find first term and the sum of its first five terms.",
        "steps": [
          "a r²=12 and a r⁴=48, hence r²=4. Positive r gives r=2.",
          "Therefore a=12/4=3.",
          "S5=3(2^5-1)/(2-1)=93."
        ],
        "answer": "First term 3; S5=93",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "3*2^2",
              "12"
            ],
            [
              "3*2^4",
              "48"
            ],
            [
              "3*(2^5-1)",
              "93"
            ]
          ]
        }
      }
    ]
  },
  "c11-straight-lines": {
    "examples": [
      {
        "question": "Find the equation of a line through (1,-3) parallel to the line joining (1,2) and (4,8).",
        "steps": [
          "The reference line has slope (8-2)/(4-1)=2.",
          "A parallel line has the same slope 2.",
          "Point-slope form y+3=2(x-1) simplifies to y=2x-5."
        ],
        "answer": "y=2x-5",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "(8-2)/(4-1)",
              "2"
            ],
            [
              "2*1-5",
              "-3"
            ]
          ]
        }
      }
    ]
  },
  "c11-conic-sections": {
    "examples": [
      {
        "question": "For the ellipse x²/25+y²/9=1, determine its foci and eccentricity.",
        "steps": [
          "Here a²=25, b²=9 and the major axis lies on the x-axis.",
          "Compute c²=a²-b²=16, hence c=4.",
          "Foci are (±4,0), and eccentricity e=c/a=4/5."
        ],
        "answer": "Foci (±4,0), eccentricity 4/5",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "25-9",
              "16"
            ],
            [
              "sqrt(25-9)",
              "4"
            ],
            [
              "4/5",
              "0.8"
            ]
          ]
        }
      }
    ]
  },
  "c11-3d-introduction": {
    "examples": [
      {
        "question": "Show that vectors (1,0,1),(0,1,1),(2,3,5) are linearly dependent.",
        "steps": [
          "Let a=(1,0,1) and b=(0,1,1).",
          "Compute 2a+3b=(2,3,2+3)=(2,3,5).",
          "Thus c-2a-3b=0 with nonzero coefficients, proving dependence."
        ],
        "answer": "c=2a+3b",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "2*1+3*0",
              "2"
            ],
            [
              "2*0+3*1",
              "3"
            ],
            [
              "2*1+3*1",
              "5"
            ]
          ]
        }
      }
    ]
  },
  "c11-limits-derivatives": {
    "examples": [
      {
        "question": "Using the definition, find the derivative of f(x)=x² at x=3.",
        "steps": [
          "Difference quotient is ((3+h)²-9)/h for h≠0.",
          "Expand the numerator to 6h+h² and divide to get 6+h.",
          "Taking h→0 gives f'(3)=6."
        ],
        "answer": "6",
        "verify": {
          "kind": "value",
          "expr": "2*3",
          "answer": "6"
        }
      }
    ]
  },
  "c11-statistics": {
    "examples": [
      {
        "question": "Twelve students have mean mark 14, and eight others have mean mark 20. Find the combined mean.",
        "steps": [
          "Group totals are 12×14=168 and 8×20=160.",
          "Total of 20 observations is 328.",
          "Combined mean =328/20=16.4."
        ],
        "answer": "16.4",
        "verify": {
          "kind": "value",
          "expr": "(12*14+8*20)/(12+8)",
          "answer": "16.4"
        }
      }
    ]
  },
  "c11-probability": {
    "examples": [
      {
        "question": "Independent events A and B have probabilities 0.3 and 0.4. Find the probability that exactly one occurs.",
        "steps": [
          "Exactly-one cases are A without B and B without A.",
          "Independence gives P(A and not B)=0.3×0.6 and P(not A and B)=0.7×0.4.",
          "Add disjoint cases: 0.18+0.28=0.46."
        ],
        "answer": "0.46",
        "verify": {
          "kind": "value",
          "expr": "0.3*(1-0.4)+(1-0.3)*0.4",
          "answer": "0.46"
        }
      }
    ]
  }
};
