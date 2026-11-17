// Original Pri Learning supplementary notes, Class 10. No reproduced textbook or PYQ text.
// Review status: source-authored draft; deterministic and independent QA required.
export default {
  "c10-real-numbers": {
    "concepts": [
      {
        "title": "Why the Euclidean algorithm works",
        "body": "Replacing a pair of positive integers by the smaller number and their remainder preserves all common divisors. The last non-zero remainder is therefore the HCF."
      }
    ],
    "points": [
      {
        "front": "Why can a common divisor never exceed the last non-zero Euclidean remainder?",
        "back": "Every common divisor divides each remainder; the last non-zero remainder is itself a common divisor, and hence is greatest."
      }
    ],
    "mistakes": [
      {
        "wrong": "The HCF of two numbers is always their difference.",
        "right": "The difference can be a multiple of the HCF without equalling it."
      }
    ],
    "examples": [
      {
        "question": "Use Euclid's algorithm to find $\\text{HCF}(252, 198)$.",
        "steps": [
          "$252 = 198 + 54$ and $198 = 3 \\times 54 + 36$.",
          "$54 = 36 + 18$ and $36 = 2 \\times 18 + 0$.",
          "The final non-zero remainder is 18."
        ],
        "answer": "18",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "252-198",
              "54"
            ],
            [
              "198-3*54",
              "36"
            ],
            [
              "54-36",
              "18"
            ],
            [
              "36-2*18",
              "0"
            ]
          ]
        }
      }
    ]
  },
  "c10-polynomials": {
    "concepts": [
      {
        "title": "Roots and coefficients are two views of one structure",
        "body": "For a monic quadratic with roots $r$ and $s$, expanding $(x-r)(x-s)$ explains why the coefficient of $x$ is $-(r+s)$ and the constant is $rs$. Check both rather than guessing a factorisation."
      }
    ],
    "points": [
      {
        "front": "Why does a repeated root make a quadratic touch rather than cross the $x$-axis?",
        "back": "At a double root the quadratic is a constant multiple of $(x-r)^2$, which has the same sign on either side of $r$."
      }
    ],
    "mistakes": [
      {
        "wrong": "The product of the roots is always the coefficient of $x$.",
        "right": "For $ax^2 + bx + c$ with $a \\ne 0$, the product of the roots is $\\tfrac{c}{a}$ and the sum is $-\\tfrac{b}{a}$."
      }
    ],
    "examples": [
      {
        "question": "Factorise $x^2 - 5x + 6$ and identify both zeros.",
        "steps": [
          "Find two numbers whose sum is 5 and product is 6: 2 and 3.",
          "Write $x^2 - 5x + 6 = (x-2)(x-3)$.",
          "Hence $x = 2$ or $x = 3$."
        ],
        "answer": "$x = 2, 3$",
        "verify": {
          "kind": "roots",
          "f": "x^2-5*x+6",
          "answers": [
            "2",
            "3"
          ],
          "degree": 2
        }
      }
    ]
  },
  "c10-pair-linear-equations": {
    "concepts": [
      {
        "title": "Elimination without accidental loss of solutions",
        "body": "Adding or subtracting entire equations preserves their common solutions. Scale an entire equation, not isolated terms, before cancelling a variable. Parallel distinct lines have none; coincident lines have infinitely many."
      }
    ],
    "points": [
      {
        "front": "What does a row reading $0 = 5$ mean in elimination?",
        "back": "The equations are inconsistent: no ordered pair satisfies both."
      }
    ],
    "mistakes": [
      {
        "wrong": "Two lines with equal slopes always represent the same equation.",
        "right": "Equal slopes may represent two distinct parallel lines; the intercepts must also match for coincidence."
      }
    ],
    "examples": [
      {
        "question": "Solve $x + y = 11$ and $2x - y = 7$.",
        "steps": [
          "Add the equations: $3x = 18$, so $x = 6$.",
          "Substitute $x = 6$ into $x + y = 11$: $y = 5$.",
          "Check: $2(6) - 5 = 7$."
        ],
        "answer": "$(x, y) = (6, 5)$",
        "verify": {
          "kind": "system",
          "equations": [
            "x+y=11",
            "2*x-y=7"
          ],
          "solution": {
            "x": "6",
            "y": "5"
          }
        }
      }
    ]
  },
  "c10-quadratic-equations": {
    "concepts": [
      {
        "title": "Choosing a method is part of the problem",
        "body": "Factoring is efficient when rational factors are visible. Completing the square always works over the reals when the discriminant is non-negative and exposes the vertex. The quadratic formula follows from completing the square."
      }
    ],
    "points": [
      {
        "front": "How does the discriminant classify real roots?",
        "back": "For real $a, b, c$ with $a \\ne 0$: $b^2 - 4ac$ positive gives two distinct real roots, zero gives one repeated root, negative gives no real roots."
      }
    ],
    "mistakes": [
      {
        "wrong": "If a quadratic does not factor over integers, it has no real zeros.",
        "right": "Irrational roots may exist; use the discriminant or quadratic formula."
      }
    ],
    "examples": [
      {
        "question": "Solve $2x^2 - 7x + 3 = 0$.",
        "steps": [
          "Split the middle term: $2x^2 - 6x - x + 3 = 0$.",
          "Factorise: $(2x-1)(x-3) = 0$.",
          "Thus $x = \\tfrac{1}{2}$ or $x = 3$."
        ],
        "answer": "$x = \\tfrac{1}{2}, 3$",
        "verify": {
          "kind": "roots",
          "f": "2*x^2-7*x+3",
          "answers": [
            "1/2",
            "3"
          ],
          "degree": 2
        }
      }
    ]
  },
  "c10-arithmetic-progressions": {
    "concepts": [
      {
        "title": "Pairing terms explains the sum formula",
        "body": "For an AP, the first and last terms sum to the same amount as the second and the second-last. Counting the $n$ terms twice in such pairs gives $S_n = \\tfrac{n}{2}(a + l)$; substitute $l = a + (n-1)d$ to get $S_n = \\tfrac{n}{2}\\bigl(2a + (n-1)d\\bigr)$."
      }
    ],
    "points": [
      {
        "front": "Why is the common difference of an AP with decreasing terms negative?",
        "back": "Each successive term is obtained by adding the same negative amount."
      }
    ],
    "mistakes": [
      {
        "wrong": "The $n$th term and the sum of $n$ terms are the same quantity.",
        "right": "$a_n$ is one entry, whereas $S_n$ adds up the first $n$ entries."
      }
    ],
    "examples": [
      {
        "question": "An AP begins at 7 and increases by 3. Find its 20th term and $S_{20}$.",
        "steps": [
          "$a_{20} = 7 + 19 \\times 3 = 64$.",
          "$S_{20} = \\tfrac{20}{2}(7 + 64)$.",
          "Therefore $S_{20} = 710$."
        ],
        "answer": "$a_{20} = 64$; $S_{20} = 710$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "7+19*3",
              "64"
            ],
            [
              "20*(7+64)/2",
              "710"
            ]
          ]
        }
      }
    ]
  },
  "c10-triangles": {
    "concepts": [
      {
        "title": "Similarity scales lengths and areas differently",
        "body": "When two triangles are similar with scale factor $k$, corresponding heights also scale by $k$. Their areas scale by $k^2$, not $k$; this follows directly from $\\tfrac{1}{2} \\times \\text{base} \\times \\text{height}$."
      }
    ],
    "points": [
      {
        "front": "What happens to area when every length is tripled?",
        "back": "The area becomes nine times as large."
      }
    ],
    "mistakes": [
      {
        "wrong": "If side lengths are in the ratio $3 : 5$, their areas are in the ratio $3 : 5$.",
        "right": "Areas of similar figures scale as the square of the corresponding length ratio."
      }
    ],
    "examples": [
      {
        "question": "Two similar triangles have sides in the ratio $3 : 5$. The smaller area is $45\\text{ cm}^2$. Find the larger area.",
        "steps": [
          "The area ratio is $3^2 : 5^2 = 9 : 25$.",
          "Let the larger area be $A$. Then $\\tfrac{45}{A} = \\tfrac{9}{25}$.",
          "$A = \\tfrac{45 \\times 25}{9} = 125\\text{ cm}^2$."
        ],
        "answer": "$125\\text{ cm}^2$",
        "verify": {
          "kind": "value",
          "expr": "45*25/9",
          "answer": "125"
        }
      }
    ]
  },
  "c10-coordinate-geometry": {
    "concepts": [
      {
        "title": "Distance is Pythagoras in disguise",
        "body": "The horizontal separation is $|x_2 - x_1|$ and the vertical separation is $|y_2 - y_1|$. These are perpendicular legs; squaring their lengths gives the distance formula. Keep the signs inside the differences before squaring."
      }
    ],
    "points": [
      {
        "front": "Can the distance between two distinct points be negative?",
        "back": "No. The distance is a non-negative square root, and is zero only when the points coincide."
      }
    ],
    "mistakes": [
      {
        "wrong": "Subtract the $x$-coordinates for both coordinate differences.",
        "right": "The other leg must use $y_2 - y_1$; mixing coordinates measures the wrong shape."
      }
    ],
    "examples": [
      {
        "question": "Find the distance between $A(2, -1)$ and $B(8, 7)$.",
        "steps": [
          "The horizontal change is $8 - 2 = 6$.",
          "The vertical change is $7 - (-1) = 8$.",
          "Distance $= \\sqrt{6^2 + 8^2} = 10$."
        ],
        "answer": "10 units",
        "verify": {
          "kind": "value",
          "expr": "sqrt((8-2)^2+(7+1)^2)",
          "answer": "10"
        }
      }
    ]
  },
  "c10-trigonometry": {
    "concepts": [
      {
        "title": "Ratios depend on angle, not triangle size",
        "body": "All right triangles with the same acute angle are similar, so $\\tfrac{\\text{opposite}}{\\text{hypotenuse}}$, $\\tfrac{\\text{adjacent}}{\\text{hypotenuse}}$ and $\\tfrac{\\text{opposite}}{\\text{adjacent}}$ stay constant. First label the sides relative to the chosen angle."
      }
    ],
    "points": [
      {
        "front": "When is $\\tan\\theta$ undefined?",
        "back": "When $\\cos\\theta = 0$, because $\\tan\\theta = \\dfrac{\\sin\\theta}{\\cos\\theta}$."
      }
    ],
    "mistakes": [
      {
        "wrong": "The side opposite an angle is always the longest side.",
        "right": "The hypotenuse is opposite the right angle; the opposite side of another angle may be shorter."
      }
    ],
    "examples": [
      {
        "question": "In a right triangle the sides opposite and adjacent to an acute angle $\\theta$ are 3 and 4. Find $\\sin\\theta$ and $\\cos\\theta$.",
        "steps": [
          "Hypotenuse $= \\sqrt{3^2 + 4^2} = 5$.",
          "$\\sin\\theta = \\tfrac{\\text{opposite}}{\\text{hypotenuse}} = \\tfrac{3}{5}$.",
          "$\\cos\\theta = \\tfrac{\\text{adjacent}}{\\text{hypotenuse}} = \\tfrac{4}{5}$."
        ],
        "answer": "$\\sin\\theta = \\tfrac{3}{5}$; $\\cos\\theta = \\tfrac{4}{5}$",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "sqrt(3^2+4^2)",
              "5"
            ],
            [
              "3/5",
              "0.6"
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
  "c10-trig-applications": {
    "concepts": [
      {
        "title": "Sight lines demand careful vertical offsets",
        "body": "Angles of elevation are measured from the observer's horizontal eye line, not from the ground. Draw the eye-height line before using $\\tan\\theta = \\tfrac{\\text{vertical rise}}{\\text{horizontal distance}}$."
      }
    ],
    "points": [
      {
        "front": "What must be added when a sight-line height is measured above a person's eyes?",
        "back": "Add the observer's eye height to obtain total height above ground if ground levels agree."
      }
    ],
    "mistakes": [
      {
        "wrong": "The angle of elevation is measured from the vertical.",
        "right": "It is measured from the horizontal through the observer."
      }
    ],
    "examples": [
      {
        "question": "A person with eye height 1.5 m sees the top of a tower at an angle of elevation of $45^\\circ$ from 35 m away on level ground. Find the height of the tower.",
        "steps": [
          "Rise above eye level $= 35\\tan 45^\\circ = 35$ m.",
          "The total height is $35 + 1.5$ m.",
          "The tower is 36.5 m high."
        ],
        "answer": "36.5 m",
        "verify": {
          "kind": "value",
          "expr": "35+1.5",
          "answer": "36.5"
        }
      }
    ]
  },
  "c10-circles": {
    "concepts": [
      {
        "title": "Radius–tangent perpendicularity makes right triangles",
        "body": "At a point of tangency, the radius is perpendicular to the tangent. If $P$ is outside a circle with centre $O$ and $T$ is the point of tangency, use $OP^2 = OT^2 + PT^2$ before calculating."
      }
    ],
    "points": [
      {
        "front": "Why are tangent segments from the same external point equally long?",
        "back": "They are legs of congruent right triangles with the shared hypotenuse $OP$ and equal radii."
      }
    ],
    "mistakes": [
      {
        "wrong": "A radius to a tangent point lies along the tangent.",
        "right": "The radius is perpendicular to the tangent there."
      }
    ],
    "examples": [
      {
        "question": "A circle has radius 5 cm and an external point 13 cm from its centre. Find the length of the tangent from that point.",
        "steps": [
          "Form the right triangle $OPT$ with $OT = 5$ and $OP = 13$.",
          "$PT^2 = 13^2 - 5^2 = 144$.",
          "$PT = 12$ cm; a length cannot be negative."
        ],
        "answer": "12 cm",
        "verify": {
          "kind": "value",
          "expr": "sqrt(13^2-5^2)",
          "answer": "12"
        }
      }
    ]
  },
  "c10-areas-circles": {
    "concepts": [
      {
        "title": "Sector area is a fraction of a full turn",
        "body": "A sector with central angle $\\theta$ degrees occupies $\\tfrac{\\theta}{360}$ of the circle, so its area is that fraction of $\\pi r^2$. The area of a segment needs a triangle subtracted as well."
      }
    ],
    "points": [
      {
        "front": "Why can a $90^\\circ$ sector not be treated as $\\tfrac{90}{180}$ of a circle?",
        "back": "A full turn is $360^\\circ$, so $90^\\circ$ is one quarter, not one half."
      }
    ],
    "mistakes": [
      {
        "wrong": "A sector and a segment are interchangeable.",
        "right": "A segment is the area between a chord and its arc, not the whole region bounded by two radii."
      }
    ],
    "examples": [
      {
        "question": "Find the area of a $90^\\circ$ sector of radius 14 cm, using $\\pi = \\tfrac{22}{7}$.",
        "steps": [
          "A quarter circle has area $\\tfrac{90}{360} \\times \\pi \\times 14^2$.",
          "Using $\\pi = \\tfrac{22}{7}$ gives $\\tfrac{1}{4} \\times \\tfrac{22}{7} \\times 196$.",
          "The area is $154\\text{ cm}^2$."
        ],
        "answer": "$154\\text{ cm}^2$",
        "verify": {
          "kind": "value",
          "expr": "(90/360)*(22/7)*14^2",
          "answer": "154"
        }
      }
    ]
  },
  "c10-surface-volume": {
    "concepts": [
      {
        "title": "Separate curvature from end caps",
        "body": "The curved surface of a cylinder unrolls to a rectangle whose width is the base circumference $2\\pi r$ and whose height is $h$. The total surface area adds the two circular bases; the volume multiplies the base area by the height."
      }
    ],
    "points": [
      {
        "front": "What changes if cylinder height doubles while radius stays fixed?",
        "back": "Volume and curved surface area double; each end-cap area stays the same."
      }
    ],
    "mistakes": [
      {
        "wrong": "The surface area and volume of a cylinder have the same units.",
        "right": "Surface area has square units; volume has cubic units."
      }
    ],
    "examples": [
      {
        "question": "A cylinder has radius 3 cm and height 10 cm. Find its volume as a multiple of $\\pi$.",
        "steps": [
          "Base area $= \\pi \\times 3^2 = 9\\pi\\text{ cm}^2$.",
          "Volume equals base area times height.",
          "Volume $= 9\\pi \\times 10 = 90\\pi\\text{ cm}^3$."
        ],
        "answer": "$90\\pi\\text{ cm}^3$",
        "verify": {
          "kind": "value",
          "expr": "3^2*10",
          "answer": "90"
        }
      }
    ]
  },
  "c10-statistics": {
    "concepts": [
      {
        "title": "A grouped mean is weighted, not just an average of labels",
        "body": "When values occur at different frequencies, add each value multiplied by its frequency and divide by total frequency. In grouped data, class midpoints are approximations to values inside each interval."
      }
    ],
    "points": [
      {
        "front": "When will an unweighted mean of category values be misleading?",
        "back": "Whenever category frequencies are unequal."
      }
    ],
    "mistakes": [
      {
        "wrong": "For a frequency table, divide by the number of distinct observations.",
        "right": "Divide the weighted sum by the total number of observations."
      }
    ],
    "examples": [
      {
        "question": "The values 2, 5, 8 have frequencies 2, 3, 5. Find the mean.",
        "steps": [
          "Weighted total: $2 \\times 2 + 5 \\times 3 + 8 \\times 5 = 59$.",
          "Total frequency: $2 + 3 + 5 = 10$.",
          "Mean $= \\tfrac{59}{10} = 5.9$."
        ],
        "answer": "5.9",
        "verify": {
          "kind": "value",
          "expr": "(2*2+5*3+8*5)/(2+3+5)",
          "answer": "5.9"
        }
      }
    ]
  },
  "c10-probability": {
    "concepts": [
      {
        "title": "Use an outcome table before counting a sum",
        "body": "For two fair independent dice there are 36 equally likely ordered pairs. A target sum can occur in different orders, and $(a, b)$ and $(b, a)$ are distinct outcomes when $a \\ne b$."
      }
    ],
    "points": [
      {
        "front": "What is the difference between impossible and merely unlikely?",
        "back": "Impossible events have probability zero; unlikely possible events have positive probability."
      }
    ],
    "mistakes": [
      {
        "wrong": "Rolling $(3, 6)$ and $(6, 3)$ counts as one outcome with two dice.",
        "right": "They are different ordered outcomes and both contribute to the sum 9."
      }
    ],
    "examples": [
      {
        "question": "Two fair dice are rolled. Find the probability that their sum is 9.",
        "steps": [
          "Favourable pairs: $(3, 6)$, $(4, 5)$, $(5, 4)$, $(6, 3)$.",
          "There are 4 favourable outcomes out of 36.",
          "Probability $= \\tfrac{4}{36} = \\tfrac{1}{9}$."
        ],
        "answer": "$\\tfrac{1}{9}$",
        "verify": {
          "kind": "value",
          "expr": "4/36",
          "answer": "1/9"
        }
      }
    ]
  }
};
