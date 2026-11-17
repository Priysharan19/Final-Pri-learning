// Original Class 8 notes enrichment for Pri Learning; no third-party questions reproduced.
export default {
  "c8-rational-numbers": {
    "concepts": [
      {
        "title": "A number's sign travels with its numerator",
        "body": "Every rational number can be written with a positive denominator. When adding opposite-signed fractions, express both in equal-sized units; the numerator sum determines the sign of the result."
      }
    ],
    "points": [
      {
        "front": "Why is $\\tfrac{-a}{b}$ equal to $\\tfrac{a}{-b}$ for nonzero $b$?",
        "back": "Both describe the negative of $\\tfrac{a}{b}$."
      }
    ],
    "mistakes": [
      {
        "wrong": "The denominator must become negative when the numerator is negative.",
        "right": "Keep a standard positive denominator and put the sign in front or in the numerator."
      }
    ],
    "examples": [
      {
        "question": "Evaluate $-\\tfrac{3}{4}+\\tfrac{5}{6}$.",
        "steps": [
          "Use common denominator $12$.",
          "$-\\tfrac{3}{4}=-\\tfrac{9}{12}$ and $\\tfrac{5}{6}=\\tfrac{10}{12}$.",
          "Sum $=\\tfrac{1}{12}$."
        ],
        "answer": "$\\tfrac{1}{12}$",
        "verify": {
          "kind": "value",
          "expr": "-3/4+5/6",
          "answer": "1/12"
        }
      }
    ]
  },
  "c8-linear-equations": {
    "concepts": [
      {
        "title": "Distributivity prevents invisible lost terms",
        "body": "When removing brackets from an equation, multiply every term inside by the outside multiplier. Undo terms stepwise and check the resulting value in the unmodified original equation."
      }
    ],
    "points": [
      {
        "front": "Why must $4(2x-3)$ become $8x-12$?",
        "back": "Both the variable term and constant inside the bracket are multiplied by four."
      }
    ],
    "mistakes": [
      {
        "wrong": "$4(2x-3)$ simplifies to $8x-3$.",
        "right": "Distribute $4$ to both terms to get $8x-12$."
      }
    ],
    "examples": [
      {
        "question": "Solve $4(2x-3)=5x+9$.",
        "steps": [
          "Expand: $8x-12=5x+9$.",
          "Subtract $5x$ and add $12$: $3x=21$.",
          "$x=7$; check both sides equal $44$."
        ],
        "answer": "$7$",
        "verify": {
          "kind": "value",
          "expr": "4*(2*7-3)",
          "answer": "5*7+9"
        }
      }
    ]
  },
  "c8-quadrilaterals": {
    "concepts": [
      {
        "title": "Diagonal splitting proves the angle sum",
        "body": "Draw one diagonal of a simple quadrilateral to split it into two triangles. Their interior angle sums total $360$ degrees. This reasoning works for concave as well as convex simple quadrilaterals."
      }
    ],
    "points": [
      {
        "front": "Why is a quadrilateral's angle sum $360$ degrees?",
        "back": "It can be partitioned into two non-overlapping triangles, each with $180$ degrees."
      }
    ],
    "mistakes": [
      {
        "wrong": "Every quadrilateral has four right angles.",
        "right": "Only rectangles and some special quadrilaterals do; the total is always $360$ degrees."
      }
    ],
    "examples": [
      {
        "question": "Angles of a quadrilateral are $76^\\circ,104^\\circ,92^\\circ$ and $x^\\circ$. Find $x$.",
        "steps": [
          "Add the three known angles: $76+104+92=272$.",
          "Subtract from the quadrilateral angle sum $360$.",
          "$x=88^\\circ$."
        ],
        "answer": "$88^\\circ$",
        "verify": {
          "kind": "value",
          "expr": "360-(76+104+92)",
          "answer": "88"
        }
      }
    ]
  },
  "c8-data-handling": {
    "concepts": [
      {
        "title": "A pie-chart angle is proportional to a count",
        "body": "Each category's fraction of all observations controls its sector angle: $\\text{fraction}\\times 360^\\circ$. Check that all category counts sum to the total and all sector angles sum to $360$."
      }
    ],
    "points": [
      {
        "front": "Why cannot sector angles be chosen independently?",
        "back": "They must encode each category's share of the same total and sum to a full revolution."
      }
    ],
    "mistakes": [
      {
        "wrong": "A quarter of observations takes $45$ degrees in a pie chart.",
        "right": "One quarter of $360$ degrees is $90$ degrees."
      }
    ],
    "examples": [
      {
        "question": "In a survey of $60$ pupils, $15$ choose cricket. What central angle represents cricket?",
        "steps": [
          "The fraction is $\\tfrac{15}{60}=\\tfrac{1}{4}$.",
          "Multiply by the full turn, $360^\\circ$.",
          "The cricket sector is $90^\\circ$."
        ],
        "answer": "$90^\\circ$",
        "verify": {
          "kind": "value",
          "expr": "(15/60)*360",
          "answer": "90"
        }
      }
    ]
  },
  "c8-squares-roots": {
    "concepts": [
      {
        "title": "Square-root notation means the non-negative root",
        "body": "Every positive number has a positive and a negative solution of $x^2=a$, but the symbol $\\sqrt{a}$ denotes only the principal non-negative square root. Keep that distinction clear when solving equations."
      }
    ],
    "points": [
      {
        "front": "What is the difference between $\\sqrt{49}$ and the solutions of $x^2=49$?",
        "back": "$\\sqrt{49}=7$, whereas the equation has solutions $x=7$ and $x=-7$."
      }
    ],
    "mistakes": [
      {
        "wrong": "$\\sqrt{25}$ equals plus or minus $5$.",
        "right": "The radical denotes $5$; plus-or-minus appears when solving $x^2=25$."
      }
    ],
    "examples": [
      {
        "question": "Find $\\sqrt{2025}$ using nearby squares.",
        "steps": [
          "$40^2=1600$ and $50^2=2500$, so the root lies between $40$ and $50$.",
          "$45^2=(40+5)^2=1600+400+25=2025$.",
          "Principal square root is $45$."
        ],
        "answer": "$45$",
        "verify": {
          "kind": "value",
          "expr": "45^2",
          "answer": "2025"
        }
      }
    ]
  },
  "c8-cubes-roots": {
    "concepts": [
      {
        "title": "Cubing preserves the sign of an integer",
        "body": "Unlike squaring, cubing a negative integer gives a negative result. Every real number has exactly one real cube root; look for three equal factors with sign intact."
      }
    ],
    "points": [
      {
        "front": "Why is cube root of $-8$ negative rather than positive?",
        "back": "$(-2)^3=-8$, while $(+2)^3=+8$."
      }
    ],
    "mistakes": [
      {
        "wrong": "Every root of a negative number is non-real.",
        "right": "Odd roots of negative numbers are real and negative."
      }
    ],
    "examples": [
      {
        "question": "Find the real cube root of $-1728$.",
        "steps": [
          "Recognise $12\\times 12\\times 12=1728$.",
          "A negative number cubed remains negative.",
          "So $(-12)^3=-1728$ and the cube root is $-12$."
        ],
        "answer": "$-12$",
        "verify": {
          "kind": "value",
          "expr": "(-12)^3",
          "answer": "-1728"
        }
      }
    ]
  },
  "c8-comparing-quantities": {
    "concepts": [
      {
        "title": "Successive percentages act on changing bases",
        "body": "Repeated percentage changes multiply scale factors; they are not usually added. A $5\\%$ increase twice means multiply by $1.05$ then $1.05$ again, not simply increase by $10\\%$ of the original."
      }
    ],
    "points": [
      {
        "front": "Why does increasing by $10\\%$ then decreasing by $10\\%$ not restore the original?",
        "back": "The decrease applies to the larger new base, producing $0.99$ of the original."
      }
    ],
    "mistakes": [
      {
        "wrong": "Two successive $5\\%$ increases are exactly a $10\\%$ increase overall.",
        "right": "They produce the factor $1.05^2=1.1025$, a $10.25\\%$ total increase."
      }
    ],
    "examples": [
      {
        "question": "A price of $1000$ increases by $5\\%$ in each of two successive years. Find the final price.",
        "steps": [
          "After one year: $1000\\times 1.05=1050$.",
          "After the second: $1050\\times 1.05$.",
          "Final price $=1102.50$."
        ],
        "answer": "$1102.50$",
        "verify": {
          "kind": "value",
          "expr": "1000*(1.05)^2",
          "answer": "1102.5"
        }
      }
    ]
  },
  "c8-algebraic-identities": {
    "concepts": [
      {
        "title": "Identities are true for every permissible value",
        "body": "An identity such as $(a+b)^2=a^2+2ab+b^2$ is not one equation to solve; it is an equality for every allowed $a$ and $b$. The middle cross-term comes from multiplying two binomials."
      }
    ],
    "points": [
      {
        "front": "Where does the $2ab$ term in $(a+b)^2$ come from?",
        "back": "The two cross products ab and ba add to $2ab$."
      }
    ],
    "mistakes": [
      {
        "wrong": "$(a+b)^2$ expands to $a^2+b^2$.",
        "right": "The correct expansion also contains $2ab$."
      }
    ],
    "examples": [
      {
        "question": "Use $(a+b)^2$ to find $103^2$.",
        "steps": [
          "Write $103$ as $100+3$.",
          "Apply $a^2+2ab+b^2$: $10000+600+9$.",
          "Result is $10609$."
        ],
        "answer": "$10609$",
        "verify": {
          "kind": "value",
          "expr": "100^2+2*100*3+3^2",
          "answer": "10609"
        }
      }
    ]
  },
  "c8-mensuration": {
    "concepts": [
      {
        "title": "Trapezium area averages the parallel sides",
        "body": "A trapezium with parallel sides $a$ and $b$ and perpendicular height $h$ has area $\\tfrac{a+b}{2}\\times h$. The sloping side is not the height unless perpendicular."
      }
    ],
    "points": [
      {
        "front": "Why does trapezium area use perpendicular height?",
        "back": "Area counts square units between two parallel lines and depends on their shortest separation."
      }
    ],
    "mistakes": [
      {
        "wrong": "Any side joining the two parallel bases is the height.",
        "right": "Only a perpendicular segment measures height."
      }
    ],
    "examples": [
      {
        "question": "A trapezium has parallel sides $10$ cm and $16$ cm, with perpendicular height $6$ cm. Find area.",
        "steps": [
          "Average parallel lengths: $\\tfrac{10+16}{2}=13$.",
          "Multiply by perpendicular height $6$.",
          "Area is $78\\text{ cm}^2$."
        ],
        "answer": "$78\\text{ cm}^2$",
        "verify": {
          "kind": "value",
          "expr": "(10+16)*6/2",
          "answer": "78"
        }
      }
    ]
  },
  "c8-exponents": {
    "concepts": [
      {
        "title": "Exponent laws require a shared base",
        "body": "For the same non-zero base, $a^m\\times a^n=a^{m+n}$ and $\\tfrac{a^m}{a^n}=a^{m-n}$. Negative powers mean reciprocals, not negative values."
      }
    ],
    "points": [
      {
        "front": "Why is $2^{-3}$ positive?",
        "back": "It means $\\tfrac{1}{2^3}=\\tfrac{1}{8}$."
      }
    ],
    "mistakes": [
      {
        "wrong": "$2^{-3}$ equals $-8$.",
        "right": "The minus is in the exponent and creates a reciprocal."
      }
    ],
    "examples": [
      {
        "question": "Simplify $2^3\\times 2^{-5}$.",
        "steps": [
          "Combine exponents because the bases match: $2^{3-5}$.",
          "This is $2^{-2}$.",
          "Rewrite as $\\tfrac{1}{2^2}=\\tfrac{1}{4}$."
        ],
        "answer": "$\\tfrac{1}{4}$",
        "verify": {
          "kind": "value",
          "expr": "2^3*2^(-5)",
          "answer": "1/4"
        }
      }
    ]
  },
  "c8-proportions": {
    "concepts": [
      {
        "title": "Inverse proportion depends on what stays fixed",
        "body": "For a fixed amount of identical work and identical workers, increasing worker count decreases completion time: $\\text{workers}\\times\\text{days}$ is constant. State those assumptions; real-world productivity is not always perfectly linear."
      }
    ],
    "points": [
      {
        "front": "What changes in an inverse proportion if one quantity doubles?",
        "back": "The other is halved, provided the product stays constant."
      }
    ],
    "mistakes": [
      {
        "wrong": "If worker count doubles, the time must double.",
        "right": "For fixed work at the same rate, completion time halves."
      }
    ],
    "examples": [
      {
        "question": "Six equally productive workers finish a job in eight days. How many days for twelve workers?",
        "steps": [
          "Total work equals $6\\times 8=48$ worker-days.",
          "With $12$ workers, days $=\\tfrac{48}{12}$.",
          "The job takes $4$ days."
        ],
        "answer": "$4$ days",
        "verify": {
          "kind": "value",
          "expr": "6*8/12",
          "answer": "4"
        }
      }
    ]
  },
  "c8-factorisation": {
    "concepts": [
      {
        "title": "Factoring reverses expansion and should be checked",
        "body": "To factor $ax^2+bx+c$ by grouping, choose two middle contributions whose sum is $b$ and whose product is $ac$. Verify the factors by full multiplication; the two conditions prevent many false guesses."
      }
    ],
    "points": [
      {
        "front": "Why does multiplying proposed factors provide a decisive check?",
        "back": "Expansion must recover every coefficient of the original polynomial."
      }
    ],
    "mistakes": [
      {
        "wrong": "If two factors produce the right leading term they must be correct.",
        "right": "They must also reproduce the middle and constant terms."
      }
    ],
    "examples": [
      {
        "question": "Factor $6x^2+11x+3$.",
        "steps": [
          "Split $11x$ as $9x+2x$.",
          "Group: $3x(2x+3)+1(2x+3)$.",
          "Result $(3x+1)(2x+3)$."
        ],
        "answer": "$(3x+1)(2x+3)$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "3*2",
              "6"
            ],
            [
              "3*3+1*2",
              "11"
            ],
            [
              "1*3",
              "3"
            ]
          ]
        }
      }
    ]
  },
  "c8-graphs": {
    "concepts": [
      {
        "title": "Slope compares vertical and horizontal changes",
        "body": "For a straight-line graph, $\\tfrac{\\text{rise}}{\\text{run}}$ is unchanged whichever two distinct points are chosen, provided the line is not vertical. Check units: a rate can mean rupees per item, metres per second or other unit ratios."
      }
    ],
    "points": [
      {
        "front": "Why can't the slope of a line be read from just one point?",
        "back": "Slope measures change between at least two points."
      }
    ],
    "mistakes": [
      {
        "wrong": "A steep positive line has a negative gradient.",
        "right": "Gradient sign follows the direction of $y$ change as $x$ increases."
      }
    ],
    "examples": [
      {
        "question": "Find the slope of the line through $(1,4)$ and $(5,12)$.",
        "steps": [
          "Vertical change is $12-4=8$.",
          "Horizontal change is $5-1=4$.",
          "Slope $=\\tfrac{8}{4}=2$."
        ],
        "answer": "$2$",
        "verify": {
          "kind": "value",
          "expr": "(12-4)/(5-1)",
          "answer": "2"
        }
      }
    ]
  }
};
