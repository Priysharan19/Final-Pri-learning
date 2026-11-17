// Original Class 8 supplementary worked studies. Two different reasoning tasks per chapter.
// Independent content review remains mandatory.
export default {
  "c8-rational-numbers": {
    "examples": [
      {
        "question": "Evaluate $-\\tfrac{7}{12}+\\tfrac{5}{18}$ in simplest form, keeping a positive common denominator.",
        "steps": [
          "The LCM of $12$ and $18$ is $36$.",
          "Write $-\\tfrac{7}{12}=-\\tfrac{21}{36}$ and $\\tfrac{5}{18}=\\tfrac{10}{36}$.",
          "Add numerators to get $-\\tfrac{11}{36}$."
        ],
        "answer": "$-\\tfrac{11}{36}$",
        "verify": {
          "kind": "value",
          "expr": "-7/12+5/18",
          "answer": "-11/36"
        }
      },
      {
        "question": "Which is greater: $-\\tfrac{3}{5}$ or $-\\tfrac{5}{8}$? Find the positive difference.",
        "steps": [
          "Convert to denominator $40$: $-\\tfrac{3}{5}=-\\tfrac{24}{40}$ and $-\\tfrac{5}{8}=-\\tfrac{25}{40}$.",
          "The number closer to zero, $-\\tfrac{24}{40}$, is greater.",
          "The positive difference is $\\tfrac{1}{40}$."
        ],
        "answer": "$-\\tfrac{3}{5}$ greater by $\\tfrac{1}{40}$",
        "verify": {
          "kind": "value",
          "expr": "(-3/5)-(-5/8)",
          "answer": "1/40"
        }
      }
    ]
  },
  "c8-linear-equations": {
    "examples": [
      {
        "question": "Solve $5(x-2)+3=2(x+7)$, showing both distributive steps.",
        "steps": [
          "Expand to $5x-10+3=2x+14$.",
          "Simplify: $5x-7=2x+14$, so $3x=21$.",
          "Therefore $x=7$; both sides equal $28$."
        ],
        "answer": "$x=7$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "5*(7-2)+3",
              "28"
            ],
            [
              "2*(7+7)",
              "28"
            ]
          ]
        }
      },
      {
        "question": "Solve $\\tfrac{3x-1}{4}=\\tfrac{x+5}{2}$.",
        "steps": [
          "Multiply both sides by $4$ to clear denominators.",
          "Then $3x-1=2x+10$.",
          "Thus $x=11$; both sides equal $8$."
        ],
        "answer": "$x=11$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "(3*11-1)/4",
              "8"
            ],
            [
              "(11+5)/2",
              "8"
            ]
          ]
        }
      }
    ]
  },
  "c8-quadrilaterals": {
    "examples": [
      {
        "question": "The interior angles of a quadrilateral are in the ratio $1:2:3:4$. Find every angle.",
        "steps": [
          "All four angles sum to $360^\\circ$.",
          "The ratio parts add to $10$, so each part equals $36^\\circ$.",
          "The angles are $36^\\circ$, $72^\\circ$, $108^\\circ$ and $144^\\circ$."
        ],
        "answer": "$36^\\circ$, $72^\\circ$, $108^\\circ$, $144^\\circ$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "360/(1+2+3+4)",
              "36"
            ],
            [
              "36*(1+2+3+4)",
              "360"
            ]
          ]
        }
      },
      {
        "question": "Adjacent angles of a parallelogram are $(3x+20)^\\circ$ and $(2x+10)^\\circ$. Find $x$ and the angles.",
        "steps": [
          "Adjacent angles of a parallelogram are supplementary.",
          "Solve $3x+20+2x+10=180$ to get $x=30$.",
          "They measure $110^\\circ$ and $70^\\circ$, so opposite angles repeat those values."
        ],
        "answer": "$x=30$; $110^\\circ$ and $70^\\circ$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "3*30+20",
              "110"
            ],
            [
              "2*30+10",
              "70"
            ],
            [
              "110+70",
              "180"
            ]
          ]
        }
      }
    ]
  },
  "c8-data-handling": {
    "examples": [
      {
        "question": "Values $2,3,5$ appear with frequencies $4,6,2$. Find the weighted mean.",
        "steps": [
          "Multiply each value by its frequency: $8,18,10$.",
          "The total is $36$ across $4+6+2=12$ observations.",
          "The mean is $\\tfrac{36}{12}=3$."
        ],
        "answer": "$3$",
        "verify": {
          "kind": "value",
          "expr": "(2*4+3*6+5*2)/(4+6+2)",
          "answer": "3"
        }
      },
      {
        "question": "In a school survey of $120$ learners, a pie-chart sector is $90^\\circ$. How many learners does it represent?",
        "steps": [
          "The sector occupies $\\tfrac{90}{360}=\\tfrac{1}{4}$ of the circle.",
          "Apply the same fraction to the $120$ learners.",
          "It represents $30$ learners."
        ],
        "answer": "$30$ learners",
        "verify": {
          "kind": "value",
          "expr": "120*90/360",
          "answer": "30"
        }
      }
    ]
  },
  "c8-squares-roots": {
    "examples": [
      {
        "question": "Find the principal square root of $0.0009$ and explain its place value.",
        "steps": [
          "Observe $0.0009=\\tfrac{9}{10000}$.",
          "The square root is $\\tfrac{\\sqrt{9}}{\\sqrt{10000}}=\\tfrac{3}{100}$.",
          "Thus the principal root is $0.03$."
        ],
        "answer": "$0.03$",
        "verify": {
          "kind": "value",
          "expr": "sqrt(0.0009)",
          "answer": "0.03"
        }
      },
      {
        "question": "Find the smallest positive whole number to add to $150$ to obtain a perfect square.",
        "steps": [
          "Nearby squares are $12^2=144$ and $13^2=169$.",
          "The next square above $150$ is $169$.",
          "Add $169-150=19$."
        ],
        "answer": "$19$",
        "verify": {
          "kind": "value",
          "expr": "13^2-150",
          "answer": "19"
        }
      }
    ]
  },
  "c8-cubes-roots": {
    "examples": [
      {
        "question": "Find the real cube root of $-3375$.",
        "steps": [
          "Since $15^2=225$ and $15\\times 225=3375$, $15^3=3375$.",
          "An odd power of a negative number stays negative.",
          "Hence the real cube root is $-15$."
        ],
        "answer": "$-15$",
        "verify": {
          "kind": "value",
          "expr": "(-15)^3",
          "answer": "-3375"
        }
      },
      {
        "question": "What is the smallest positive integer to multiply $72$ by to make a perfect cube?",
        "steps": [
          "Prime-factorize $72=2^3\\times 3^2$.",
          "A perfect cube requires each prime exponent to be a multiple of three.",
          "Multiply once more by $3$ to get $216=6^3$; the multiplier is $3$."
        ],
        "answer": "$3$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "72*3",
              "216"
            ],
            [
              "6^3",
              "216"
            ]
          ]
        }
      }
    ]
  },
  "c8-comparing-quantities": {
    "examples": [
      {
        "question": "A ₹800 item is discounted by $20\\%$ and then increased by $25\\%$ of its discounted price. Find the final price.",
        "steps": [
          "The discount leaves $800\\times 0.80=640$.",
          "The increase is $25\\%$ of $640$, not of $800$.",
          "Final price is $640\\times 1.25=800$."
        ],
        "answer": "₹800",
        "verify": {
          "kind": "value",
          "expr": "800*(1-0.20)*(1+0.25)",
          "answer": "800"
        }
      },
      {
        "question": "A marked price of ₹1200 is reduced by $15\\%$ and then charged $5\\%$ tax on the discounted price. Find the amount paid.",
        "steps": [
          "The discounted price is $1200\\times 0.85=1020$.",
          "Apply the $5\\%$ tax to $1020$, not the original price.",
          "Total $=1020\\times 1.05=1071$."
        ],
        "answer": "₹1071",
        "verify": {
          "kind": "value",
          "expr": "1200*0.85*1.05",
          "answer": "1071"
        }
      }
    ]
  },
  "c8-algebraic-identities": {
    "examples": [
      {
        "question": "Use an algebraic identity to calculate $49^2$ mentally.",
        "steps": [
          "Write $49=50-1$.",
          "Use $(a-b)^2=a^2-2ab+b^2$.",
          "Then $49^2=2500-100+1=2401$."
        ],
        "answer": "$2401$",
        "verify": {
          "kind": "value",
          "expr": "(50-1)^2",
          "answer": "2401"
        }
      },
      {
        "question": "Simplify $(x+2)^2-(x-2)^2$, and evaluate it at $x=7$.",
        "steps": [
          "Apply difference of squares: $A^2-B^2=(A-B)(A+B)$.",
          "With $A=x+2$, $B=x-2$ this becomes $4\\times(2x)=8x$.",
          "At $x=7$ the result is $56$."
        ],
        "answer": "$8x$; at $x=7$, $56$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "(7+2)^2-(7-2)^2",
              "56"
            ],
            [
              "8*7",
              "56"
            ]
          ]
        }
      }
    ]
  },
  "c8-mensuration": {
    "examples": [
      {
        "question": "A trapezium with parallel sides $12$ cm and $14$ cm has area $117\\text{ cm}^2$. Find its perpendicular height.",
        "steps": [
          "Area $=(12+14)\\tfrac{h}{2}=13h$.",
          "Solve $13h=117$.",
          "The height is $9$ cm."
        ],
        "answer": "$9$ cm",
        "verify": {
          "kind": "value",
          "expr": "117/((12+14)/2)",
          "answer": "9"
        }
      },
      {
        "question": "A cuboid is $4$ cm wide, $5$ cm long and $6$ cm high. Find its volume and total surface area.",
        "steps": [
          "Volume $=4\\times 5\\times 6=120\\text{ cm}^3$.",
          "Total surface area $=2(lw+lh+wh)$.",
          "Substitution gives $2(20+30+24)=148\\text{ cm}^2$."
        ],
        "answer": "$120\\text{ cm}^3$; $148\\text{ cm}^2$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "4*5*6",
              "120"
            ],
            [
              "2*(4*5+5*6+4*6)",
              "148"
            ]
          ]
        }
      }
    ]
  },
  "c8-exponents": {
    "examples": [
      {
        "question": "Simplify $3^5\\div 3^2\\times 3^{-1}$ without expanding large powers.",
        "steps": [
          "All factors share the nonzero base $3$.",
          "Combine exponents, preserving division as subtraction: $3^{5-2-1}$.",
          "This equals $3^2=9$."
        ],
        "answer": "$9$",
        "verify": {
          "kind": "value",
          "expr": "3^5/3^2*3^(-1)",
          "answer": "9"
        }
      },
      {
        "question": "Write $0.000056$ in scientific notation and verify its decimal size.",
        "steps": [
          "Shift the decimal five places right to get $5.6$.",
          "Compensate by multiplying with $10$ to the power $-5$.",
          "The number is $5.6\\times 10^{-5}$."
        ],
        "answer": "$5.6\\times 10^{-5}$",
        "verify": {
          "kind": "value",
          "expr": "5.6*10^(-5)",
          "answer": "0.000056"
        }
      }
    ]
  },
  "c8-proportions": {
    "examples": [
      {
        "question": "A vehicle covers $180$ km in $3$ hours at constant speed. How far does it travel in $4.5$ hours at the same speed?",
        "steps": [
          "Its speed is $180\\div 3=60$ km/h.",
          "Distance and time are directly proportional at constant speed.",
          "Distance in $4.5$ hours is $60\\times 4.5=270$ km."
        ],
        "answer": "$270$ km",
        "verify": {
          "kind": "value",
          "expr": "(180/3)*4.5",
          "answer": "270"
        }
      },
      {
        "question": "Eight identical workers complete a job in $15$ days. If $12$ equally productive workers do the same job, how many days are needed?",
        "steps": [
          "Total work is $8\\times 15=120$ worker-days.",
          "At the same rate, $12$ workers supply $12$ worker-days each day.",
          "The duration is $\\tfrac{120}{12}=10$ days."
        ],
        "answer": "$10$ days",
        "verify": {
          "kind": "value",
          "expr": "8*15/12",
          "answer": "10"
        }
      }
    ]
  },
  "c8-factorisation": {
    "examples": [
      {
        "question": "Factor $x^2-9x+20$ and list its two zeros.",
        "steps": [
          "Find two numbers with sum $9$ and product $20$: $4$ and $5$.",
          "Factor $x^2-9x+20=(x-4)(x-5)$.",
          "The equation equals zero at $x=4$ and $x=5$."
        ],
        "answer": "$x=4$ or $5$",
        "verify": {
          "kind": "roots",
          "f": "x^2-9*x+20",
          "answers": [
            "4",
            "5"
          ],
          "degree": 2
        }
      },
      {
        "question": "Solve $4x^2-25=0$ using difference of squares.",
        "steps": [
          "Write $(2x)^2-5^2=(2x-5)(2x+5)$.",
          "A product vanishes when either factor does.",
          "So $x=\\tfrac{5}{2}$ or $x=-\\tfrac{5}{2}$."
        ],
        "answer": "$x=\\pm \\tfrac{5}{2}$",
        "verify": {
          "kind": "roots",
          "f": "4*x^2-25",
          "answers": [
            "5/2",
            "-5/2"
          ],
          "degree": 2
        }
      }
    ]
  },
  "c8-graphs": {
    "examples": [
      {
        "question": "A straight line passes through $(2,7)$ and $(6,15)$. Find its equation in $y=mx+c$ form.",
        "steps": [
          "Its gradient is $\\tfrac{15-7}{6-2}=\\tfrac{8}{4}=2$.",
          "Use point $(2,7)$: $7=2\\times 2+c$, so $c=3$.",
          "Thus $y=2x+3$; it also passes through $(6,15)$."
        ],
        "answer": "$y=2x+3$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "2*2+3",
              "7"
            ],
            [
              "2*6+3",
              "15"
            ]
          ]
        }
      },
      {
        "question": "Find the midpoint of $A(-2,3)$ and $B(6,11)$, and compare its distances in $x$ and $y$ from both endpoints.",
        "steps": [
          "Average $x$-coordinates: $\\tfrac{-2+6}{2}=2$.",
          "Average $y$-coordinates: $\\tfrac{3+11}{2}=7$.",
          "Midpoint is $(2,7)$, with equal coordinate changes $4$ and $4$ on each side."
        ],
        "answer": "$(2,7)$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "(-2+6)/2",
              "2"
            ],
            [
              "(3+11)/2",
              "7"
            ]
          ]
        }
      }
    ]
  }
};
