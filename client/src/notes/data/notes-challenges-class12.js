// Original Pri Learning Class 12 worked problem-solving cases, not past papers.
// Deterministic answer checks required; independent pedagogical sign-off pending.
export default {
  "c12-relations-functions": {
    "examples": [
      {
        "question": "Find the inverse of f(x)=(3x+1)/(x-2), specifying the excluded inputs.",
        "steps": [
          "Write y=(3x+1)/(x-2), where x≠2.",
          "Rearrange yx-2y=3x+1 to x(y-3)=2y+1.",
          "Thus f inverse(y)=(2y+1)/(y-3), with y≠3. The original function never outputs 3."
        ],
        "answer": "f inverse(y)=(2y+1)/(y-3)",
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
        "question": "Evaluate arctan(1/2)+arctan(1/3) exactly.",
        "steps": [
          "Both principal arctangents are positive acute angles, and their sum remains below π/2.",
          "By the tangent addition identity, tan(sum)=(1/2+1/3)/(1-1/6)=1.",
          "The only such sum with tangent 1 is π/4."
        ],
        "answer": "π/4",
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
        "question": "For A=[[1,2],[3,4]], find the matrix X satisfying 2A+X=I.",
        "steps": [
          "Rearrange X=I-2A; the identity has diagonal ones and off-diagonal zeros.",
          "Subtract entries: 1-2=-1, 0-4=-4, 0-6=-6, 1-8=-7.",
          "X=[[-1,-4],[-6,-7]]."
        ],
        "answer": "[[-1,-4],[-6,-7]]",
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
        "question": "For what values of real t is the determinant of [[t,1],[4,t]] zero?",
        "steps": [
          "The determinant is t·t-1·4=t²-4.",
          "Set t²-4=(t-2)(t+2)=0.",
          "Therefore t=2 or t=-2; at each value the rows are dependent."
        ],
        "answer": "t=±2",
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
        "question": "Let f(x)=x² for x≤1 and f(x)=ax+b for x>1. Determine a and b for differentiability at x=1.",
        "steps": [
          "Continuity gives a+b=1, since the left value is 1.",
          "The left derivative at x=1 is 2; the right derivative is a, so a=2.",
          "Then b=1-a=-1. Both value and derivative match."
        ],
        "answer": "a=2, b=-1",
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
          "Let x be each side perpendicular to the river, y the fenced parallel side: 2x+y=40.",
          "Area A=xy=x(40-2x)=40x-2x², with 0<x<20.",
          "A'=40-4x vanishes at x=10, yielding y=20 and maximum area 200 m²."
        ],
        "answer": "200 m², dimensions 10 m by 20 m",
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
        "question": "Evaluate ∫ from 0 to 1 of 2x/(1+x²) dx.",
        "steps": [
          "Use substitution u=1+x², so du=2x dx.",
          "When x=0, u=1; when x=1, u=2.",
          "The result ∫ from 1 to 2 of du/u equals ln 2."
        ],
        "answer": "ln(2)",
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
        "question": "Find the geometric area between y=x² and y=1 over -2≤x≤2.",
        "steps": [
          "Intersections are x=±1; the curve order changes there.",
          "By symmetry, area equals 2(∫0^1(1-x²) dx + ∫1^2(x²-1) dx).",
          "The bracket equals 2/3+4/3=2, giving total area 4."
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
        "question": "Solve dy/dx=2xy with y(0)=3, and find y(1).",
        "steps": [
          "Separate variables on the positive solution: dy/y=2x dx.",
          "Integrate ln y=x²+C; y(0)=3 gives exp(C)=3.",
          "Thus y=3 exp(x²), so y(1)=3e."
        ],
        "answer": "y=3exp(x²); y(1)=3e",
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
        "question": "Find the scalar projection of a=(3,4,0) along b=(1,2,2).",
        "steps": [
          "Calculate a dot b =3×1+4×2+0×2=11.",
          "The length |b|=sqrt(1+4+4)=3.",
          "Scalar projection of a on b is 11/3."
        ],
        "answer": "11/3",
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
        "question": "Find the distance from P=(3,0,0) to the line through the origin in direction (1,2,2).",
        "steps": [
          "Let b=(1,2,2) and P=(3,0,0). The squared distance is |P|²-(P dot b)²/|b|².",
          "Compute |P|²=9, P dot b=3 and |b|²=9.",
          "Distance²=9-9/9=8, so distance=2sqrt(2)."
        ],
        "answer": "2sqrt(2)",
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
        "question": "Maximise P=5x+3y subject to x+y≤8, 2x+y≤10, x≥0 and y≥0.",
        "steps": [
          "Feasible vertices are (0,0),(5,0),(2,6) and (0,8).",
          "Evaluate 5x+3y at the vertices to obtain 0,25,28 and 24.",
          "Maximum is 28 at intersection (2,6)."
        ],
        "answer": "28 at (2,6)",
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
        "question": "One of two boxes is chosen fairly. Box A has 2 red and 1 blue ball; Box B has 1 red and 2 blue balls. Given a red draw, find probability Box A was chosen.",
        "steps": [
          "Both boxes have prior probability 1/2.",
          "Joint P(A and red)=(1/2)(2/3)=1/3; joint P(B and red)=(1/2)(1/3)=1/6.",
          "By Bayes' theorem P(A|red)=(1/3)/(1/3+1/6)=2/3."
        ],
        "answer": "2/3",
        "verify": {
          "kind": "value",
          "expr": "(0.5*(2/3))/(0.5*(2/3)+0.5*(1/3))",
          "answer": "2/3"
        }
      }
    ]
  }
};
