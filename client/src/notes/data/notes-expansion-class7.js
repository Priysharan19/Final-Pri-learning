// Pri Learning Class 7 original supplementary mathematics explanations and worked examples.
export default {
  "c7-large-numbers-current": {
    "concepts": [
      {
        "title": "Place value is an addition statement",
        "body": "Reading a large numeral is not just naming digits. Write it as a sum of digit values, then regroup it into Indian-place-value commas without changing the number."
      }
    ],
    "points": [
      {
        "front": "Why does a zero in the ten-thousands place still matter?",
        "back": "It preserves the positions of all digits to its left and right."
      }
    ],
    "mistakes": [
      {
        "wrong": "Moving a digit to the next column does not change the number.",
        "right": "Each place to the left is worth ten times as much."
      }
    ],
    "examples": [
      {
        "question": "Express 5,04,06,019 as a sum of powers of ten.",
        "steps": [
          "The 5 is in the crore place, the 4 in the lakh place, and the 6 in the thousand place.",
          "The final two digits contribute 19.",
          "Total is 5×10^7+4×10^5+6×10^3+19."
        ],
        "answer": "50,406,019",
        "verify": {
          "kind": "value",
          "expr": "5*10^7+4*10^5+6*10^3+19",
          "answer": "50406019"
        }
      }
    ]
  },
  "c7-arithmetic-expressions-current": {
    "concepts": [
      {
        "title": "Brackets encode a different mathematical operation order",
        "body": "Brackets are instructions to group operations; multiplication and division at one level are evaluated left to right, as are addition and subtraction at one level. Never remove brackets without preserving their meaning."
      }
    ],
    "points": [
      {
        "front": "Are 3×(4+5) and 3×4+5 equal?",
        "back": "No; the first is 27 and the second is 17."
      }
    ],
    "mistakes": [
      {
        "wrong": "A multiplication always occurs before any bracket.",
        "right": "Compute inside grouping brackets before operations outside."
      }
    ],
    "examples": [
      {
        "question": "Evaluate 18-2(3+4).",
        "steps": [
          "First compute 3+4=7.",
          "Then multiply 2×7=14.",
          "Finally 18-14=4."
        ],
        "answer": "4",
        "verify": {
          "kind": "value",
          "expr": "18-2*(3+4)",
          "answer": "4"
        }
      }
    ]
  },
  "c7-decimals-current": {
    "concepts": [
      {
        "title": "Decimal comparison is a place-value comparison",
        "body": "Add trailing zeros to align decimal places without changing a decimal's value. Compare the first position where digits differ; a longer decimal is not automatically larger."
      }
    ],
    "points": [
      {
        "front": "Does 0.57 equal 0.570?",
        "back": "Yes. Trailing zeros beyond the decimal point do not change the value."
      }
    ],
    "mistakes": [
      {
        "wrong": "0.507 is greater than 0.57 because 507 exceeds 57.",
        "right": "Compare 0.507 with 0.570; the tenths digits are 5 in both, but the hundredths digits are 0 and 7."
      }
    ],
    "examples": [
      {
        "question": "Arrange 0.507 and 0.57 in increasing order, then add them.",
        "steps": [
          "Write 0.57 as 0.570.",
          "Thus 0.507<0.570.",
          "Sum is 0.507+0.570=1.077."
        ],
        "answer": "0.507, 0.57; sum 1.077",
        "verify": {
          "kind": "value",
          "expr": "0.507+0.57",
          "answer": "1.077"
        }
      }
    ]
  },
  "c7-letter-numbers-current": {
    "concepts": [
      {
        "title": "Variables describe a rule for every input",
        "body": "An expression such as 5n+2 is a rule, not a particular number until n is specified. Substitution needs brackets when replacing variables by negative numbers or sums."
      }
    ],
    "points": [
      {
        "front": "Why is 2(n+3) not the same as 2n+3?",
        "back": "Distributivity gives 2n+6; each term inside the bracket is multiplied by 2."
      }
    ],
    "mistakes": [
      {
        "wrong": "Putting n=3 into n² means 3×2.",
        "right": "The square means multiply 3 by itself, giving 9."
      }
    ],
    "examples": [
      {
        "question": "A tile design uses 5n+2 tiles for row n. How many tiles are used for n=7?",
        "steps": [
          "Replace n with 7.",
          "Calculate 5×7+2.",
          "The count is 37."
        ],
        "answer": "37 tiles",
        "verify": {
          "kind": "value",
          "expr": "5*7+2",
          "answer": "37"
        }
      }
    ]
  },
  "c7-parallel-intersecting-lines-current": {
    "concepts": [
      {
        "title": "Parallel lines create predictable angle families",
        "body": "A transversal cuts two parallel lines, creating equal corresponding and alternate interior angles. Same-side interior angles are supplementary. Use a clear angle diagram rather than memorising labels in isolation."
      }
    ],
    "points": [
      {
        "front": "Why are same-side interior angles supplementary for parallel lines?",
        "back": "Their measures add to a straight angle, 180 degrees."
      }
    ],
    "mistakes": [
      {
        "wrong": "All angles formed by a transversal are equal.",
        "right": "Only certain angle pairs are equal; adjacent angles may sum to 180 degrees."
      }
    ],
    "examples": [
      {
        "question": "Two same-side interior angles are formed by a transversal through parallel lines. One is 113°. Find the other.",
        "steps": [
          "These angles add to 180°.",
          "Subtract 113° from 180°.",
          "The missing angle is 67°."
        ],
        "answer": "67°",
        "verify": {
          "kind": "value",
          "expr": "180-113",
          "answer": "67"
        }
      }
    ]
  },
  "c7-number-play-current": {
    "concepts": [
      {
        "title": "Digit-sum tests follow from the number system",
        "body": "Since 10 is 1 more than a multiple of 9, every power of ten leaves remainder 1 when divided by 9. This is why a number and its digit sum have the same remainder mod 9."
      }
    ],
    "points": [
      {
        "front": "Does a digit sum divisible by 9 prove the original number is divisible by 9?",
        "back": "Yes, for an integer in ordinary base-ten notation."
      }
    ],
    "mistakes": [
      {
        "wrong": "A number divisible by 3 is automatically divisible by 9.",
        "right": "Divisibility by 9 requires a digit sum divisible by 9, which is stricter."
      }
    ],
    "examples": [
      {
        "question": "Use digit sums to determine whether 47,862 is divisible by 9.",
        "steps": [
          "Digit sum is 4+7+8+6+2=27.",
          "Since 27=3×9, the original integer is divisible by 9.",
          "Indeed 47,862÷9=5,318."
        ],
        "answer": "Yes, quotient 5,318",
        "verify": {
          "kind": "value",
          "expr": "47862/9",
          "answer": "5318"
        }
      }
    ]
  },
  "c7-triangles-current": {
    "concepts": [
      {
        "title": "Triangle inequalities are strict",
        "body": "For three positive side lengths a,b,c, every side is strictly smaller than the sum of the other two. A side equal to that sum gives a straight, degenerate shape rather than a proper triangle."
      }
    ],
    "points": [
      {
        "front": "Could side lengths 2,4,6 make a triangle?",
        "back": "No; 2+4=6, but the inequality must be strict."
      }
    ],
    "mistakes": [
      {
        "wrong": "If a third side is less than the sum of two sides, it is always possible.",
        "right": "It must also exceed the absolute difference between those two sides."
      }
    ],
    "examples": [
      {
        "question": "Two sides are 5 cm and 7 cm. How many integer values can the third side take?",
        "steps": [
          "The strict bounds are |7-5|<x<7+5, or 2<x<12.",
          "Possible integers are 3 through 11.",
          "There are 9 choices."
        ],
        "answer": "9 choices",
        "verify": {
          "kind": "value",
          "expr": "11-3+1",
          "answer": "9"
        }
      }
    ]
  },
  "c7-fractions-current": {
    "concepts": [
      {
        "title": "A common denominator represents equally sized parts",
        "body": "To add fractions, split both wholes into parts of the same size. The least common denominator is convenient but not essential; never add denominators when adding parts of one whole."
      }
    ],
    "points": [
      {
        "front": "Why can't 1/2+1/3 be 2/5?",
        "back": "Halves and thirds are not pieces of equal size; convert them into sixths."
      }
    ],
    "mistakes": [
      {
        "wrong": "For fractions, add numerator to numerator and denominator to denominator.",
        "right": "Use equivalent fractions with a common denominator."
      }
    ],
    "examples": [
      {
        "question": "Compute 3/4+5/6.",
        "steps": [
          "A common denominator is 12.",
          "3/4=9/12 and 5/6=10/12.",
          "The result is 19/12=1 and 7/12."
        ],
        "answer": "19/12",
        "verify": {
          "kind": "value",
          "expr": "3/4+5/6",
          "answer": "19/12"
        }
      }
    ]
  },
  "c7-geometric-twins-current": {
    "concepts": [
      {
        "title": "Reflection preserves distance but reverses orientation",
        "body": "Reflection in the x-axis changes y to -y, leaving x unchanged. Distances and angles are preserved, but clockwise and anticlockwise orientation exchange."
      }
    ],
    "points": [
      {
        "front": "What happens to the point (a,0) under reflection in the x-axis?",
        "back": "It stays fixed because it is already on the mirror line."
      }
    ],
    "mistakes": [
      {
        "wrong": "Reflecting in the x-axis changes the sign of x.",
        "right": "It changes y to -y, not x."
      }
    ],
    "examples": [
      {
        "question": "Reflect P(-4,3) in the x-axis and find the distance between P and its image.",
        "steps": [
          "The reflected point is P'(-4,-3).",
          "The points lie on one vertical line.",
          "Distance between y=3 and y=-3 is 6."
        ],
        "answer": "P'=(-4,-3); distance 6",
        "verify": {
          "kind": "value",
          "expr": "3-(-3)",
          "answer": "6"
        }
      }
    ]
  },
  "c7-integer-operations-current": {
    "concepts": [
      {
        "title": "Negative quantities are relative to a chosen zero",
        "body": "A change can be positive or negative independently of the current value. Use a signed number line: moving right adds, moving left subtracts. A negative total is a legitimate result."
      }
    ],
    "points": [
      {
        "front": "Why does subtracting -5 have the same effect as adding 5?",
        "back": "Removing a negative change is an increase: a-(-5)=a+5."
      }
    ],
    "mistakes": [
      {
        "wrong": "Adding a negative number always gives a negative answer.",
        "right": "The final sign depends on the initial value and relative magnitudes."
      }
    ],
    "examples": [
      {
        "question": "Temperature starts at -6°C, rises 9°C, then falls 4°C. What is the final temperature?",
        "steps": [
          "After rising: -6+9=3°C.",
          "After falling: 3-4=-1°C.",
          "The temperature is one degree below zero."
        ],
        "answer": "-1°C",
        "verify": {
          "kind": "value",
          "expr": "-6+9-4",
          "answer": "-1"
        }
      }
    ]
  },
  "c7-common-ground-current": {
    "concepts": [
      {
        "title": "Equivalent fractions reveal common structure",
        "body": "Multiplying numerator and denominator by the same nonzero integer preserves value. A shared denominator exposes comparison, addition and subtraction as operations on equal-sized units."
      }
    ],
    "points": [
      {
        "front": "Why is 4/9 the same number as 28/63?",
        "back": "Both numerator and denominator have been multiplied by 7."
      }
    ],
    "mistakes": [
      {
        "wrong": "Fractions with different denominators cannot be compared.",
        "right": "They can be converted to equivalent fractions or compared by cross multiplication."
      }
    ],
    "examples": [
      {
        "question": "Find 4/9+5/7 using denominator 63.",
        "steps": [
          "4/9=28/63.",
          "5/7=45/63.",
          "Sum is 73/63."
        ],
        "answer": "73/63",
        "verify": {
          "kind": "value",
          "expr": "4/9+5/7",
          "answer": "73/63"
        }
      }
    ]
  },
  "c7-decimal-operations-current": {
    "concepts": [
      {
        "title": "Scaling both factors helps estimate products",
        "body": "Before multiplying decimals, estimate the answer using nearby whole numbers. Multiply as whole numbers and then place the decimal according to the combined decimal digits; check the magnitude."
      }
    ],
    "points": [
      {
        "front": "Why is 0.5×0.5 less than either factor?",
        "back": "It takes half of a half, yielding a quarter."
      }
    ],
    "mistakes": [
      {
        "wrong": "Multiplying by a decimal always makes a number larger.",
        "right": "A positive factor below 1 reduces a positive product."
      }
    ],
    "examples": [
      {
        "question": "Calculate 0.48×2.5 without a calculator.",
        "steps": [
          "Write 2.5=5/2.",
          "0.48×5=2.4.",
          "Divide by 2 to get 1.2."
        ],
        "answer": "1.2",
        "verify": {
          "kind": "value",
          "expr": "0.48*2.5",
          "answer": "1.2"
        }
      }
    ]
  },
  "c7-connecting-dots-current": {
    "concepts": [
      {
        "title": "Counting diagonals without double counting",
        "body": "In an n-vertex polygon, each vertex can connect diagonally to n-3 others (exclude itself and its two neighbours). Each diagonal is counted from both ends, so divide by 2."
      }
    ],
    "points": [
      {
        "front": "Why divide n(n-3) by two?",
        "back": "Every diagonal has two endpoints and was counted twice."
      }
    ],
    "mistakes": [
      {
        "wrong": "An n-gon has n(n-1) diagonals.",
        "right": "That counts ordered connections and includes sides; the true diagonal count is n(n-3)/2."
      }
    ],
    "examples": [
      {
        "question": "How many diagonals does an octagon have?",
        "steps": [
          "An octagon has n=8 vertices.",
          "Count 8(8-3)/2.",
          "There are 20 diagonals."
        ],
        "answer": "20",
        "verify": {
          "kind": "value",
          "expr": "8*(8-3)/2",
          "answer": "20"
        }
      }
    ]
  },
  "c7-constructions-tilings-current": {
    "concepts": [
      {
        "title": "A tiling must fill a full turn without gaps",
        "body": "Angles around a point total 360°. In a regular tiling, the interior angles of the polygons meeting there must add to 360°, not merely approximate it."
      }
    ],
    "points": [
      {
        "front": "Why can three regular hexagons meet at one tiling vertex?",
        "back": "A regular hexagon has 120° interior angles, and 3×120°=360°."
      }
    ],
    "mistakes": [
      {
        "wrong": "Any three regular polygons can tile a vertex.",
        "right": "Their interior angles must add exactly to 360° without overlaps or gaps."
      }
    ],
    "examples": [
      {
        "question": "How many regular hexagon corners exactly fill a full angle around a point?",
        "steps": [
          "Each interior angle is 120°.",
          "Compute 360°/120°.",
          "Three hexagons meet around the point."
        ],
        "answer": "3",
        "verify": {
          "kind": "value",
          "expr": "360/120",
          "answer": "3"
        }
      }
    ]
  },
  "c7-finding-unknown-current": {
    "concepts": [
      {
        "title": "Undo operations in reverse order",
        "body": "An equation is a balance: performing the same legal operation on both sides preserves equality. Reverse the order of operations applied to the unknown to isolate it."
      }
    ],
    "points": [
      {
        "front": "What is the inverse operation of multiplying by a nonzero number?",
        "back": "Dividing by the same number."
      }
    ],
    "mistakes": [
      {
        "wrong": "If x/3+7=15, the first step is to divide by 7.",
        "right": "First subtract 7, then multiply by 3."
      }
    ],
    "examples": [
      {
        "question": "Solve x/3+7=15.",
        "steps": [
          "Subtract 7 on both sides: x/3=8.",
          "Multiply both sides by 3.",
          "x=24; check 24/3+7=15."
        ],
        "answer": "24",
        "verify": {
          "kind": "value",
          "expr": "24/3+7",
          "answer": "15"
        }
      }
    ]
  }
};
