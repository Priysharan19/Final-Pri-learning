// Original Pri Learning, Class 7: two new reasoning challenges per chapter.
// Worked study material only. Independent mathematical/translation review pending.
export default {
  "c7-large-numbers-current": {
    "examples": [
      {
        "question": "A school inventory has 7,45,68,921 items recorded. What is the smallest number to add to reach the next exact lakh?",
        "steps": [
          "A lakh is 1,00,000, so the next lakh boundary is 7,46,00,000.",
          "Subtract the inventory number from that boundary.",
          "The extra number required is 31,079."
        ],
        "answer": "31,079",
        "verify": {
          "kind": "value",
          "expr": "74600000-74568921",
          "answer": "31079"
        }
      },
      {
        "question": "A state had 1 crore saplings and distributed 78,56,901. How many remain?",
        "steps": [
          "Write one crore as 1,00,00,000.",
          "Align the digits in matching place-value columns.",
          "Subtract to obtain 21,43,099."
        ],
        "answer": "21,43,099",
        "verify": {
          "kind": "value",
          "expr": "10000000-7856901",
          "answer": "2143099"
        }
      }
    ]
  },
  "c7-arithmetic-expressions-current": {
    "examples": [
      {
        "question": "Evaluate 6+4×(17−9)−18÷3, stating why the brackets come first.",
        "steps": [
          "Compute the bracket: 17−9=8.",
          "Multiply and divide before adding or subtracting: 4×8=32 and 18÷3=6.",
          "Then 6+32−6=32."
        ],
        "answer": "32",
        "verify": {
          "kind": "value",
          "expr": "6+4*(17-9)-18/3",
          "answer": "32"
        }
      },
      {
        "question": "Evaluate 5×[12−(2+3)]+24÷4.",
        "steps": [
          "Work from the innermost bracket: 2+3=5.",
          "The square bracket becomes 12−5=7; multiply 5×7=35.",
          "Add 24÷4=6 to obtain 41."
        ],
        "answer": "41",
        "verify": {
          "kind": "value",
          "expr": "5*(12-(2+3))+24/4",
          "answer": "41"
        }
      }
    ]
  },
  "c7-decimals-current": {
    "examples": [
      {
        "question": "A shop sells rope for ₹18.40 per metre. What is the cost of 7.5 metres?",
        "steps": [
          "Compute 18.40×(7+0.5).",
          "Seven metres cost ₹128.80 and half a metre costs ₹9.20.",
          "Total ₹138.00."
        ],
        "answer": "₹138",
        "verify": {
          "kind": "value",
          "expr": "18.4*7.5",
          "answer": "138"
        }
      },
      {
        "question": "A tank contains 15.6 litres of water. How many full 0.75-litre bottles can be filled, and how much water remains?",
        "steps": [
          "Twenty bottles use 20×0.75=15 litres.",
          "Another complete bottle would require 0.75 litres, which is unavailable.",
          "Therefore 20 full bottles and 0.6 litres remain."
        ],
        "answer": "20 bottles, 0.6 L left",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "20*0.75",
              "15"
            ],
            [
              "15.6-15",
              "0.6"
            ]
          ]
        }
      }
    ]
  },
  "c7-letter-numbers-current": {
    "examples": [
      {
        "question": "Matchsticks form n adjacent squares in a single row, sharing every touching side. Write the stick rule and find the count for n=25.",
        "steps": [
          "The first square uses four sticks; each further square shares one side and needs three new sticks.",
          "Thus total sticks T(n)=4+3(n−1)=3n+1.",
          "For n=25, T=76."
        ],
        "answer": "3n+1; 76 sticks",
        "verify": {
          "kind": "value",
          "expr": "3*25+1",
          "answer": "76"
        }
      },
      {
        "question": "The expression 4(a−3)+2a counts tiles. Calculate it for a=11 and explain what distributing changes.",
        "steps": [
          "First evaluate a−3=8, giving 4×8.",
          "The remaining term 2a=22.",
          "Total 32+22=54; distributing first also gives 6a−12."
        ],
        "answer": "54 tiles",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "4*(11-3)+2*11",
              "54"
            ],
            [
              "6*11-12",
              "54"
            ]
          ]
        }
      }
    ]
  },
  "c7-parallel-intersecting-lines-current": {
    "examples": [
      {
        "question": "Two same-side interior angles between parallel lines are (3x+10)° and (2x+20)°. Find x and both angles.",
        "steps": [
          "Same-side interior angles on parallel lines add to 180°.",
          "Thus 3x+10+2x+20=180, so 5x=150 and x=30.",
          "The angles are 100° and 80°."
        ],
        "answer": "x=30; angles 100°, 80°",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "3*30+10",
              "100"
            ],
            [
              "2*30+20",
              "80"
            ],
            [
              "100+80",
              "180"
            ]
          ]
        }
      },
      {
        "question": "At intersecting straight lines, vertically opposite angles are (7x−2)° and (5x+30)°. Find x.",
        "steps": [
          "Vertically opposite angles are equal.",
          "Solve 7x−2=5x+30, giving 2x=32.",
          "Therefore x=16 and each stated angle is 110°."
        ],
        "answer": "x=16",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "7*16-2",
              "110"
            ],
            [
              "5*16+30",
              "110"
            ]
          ]
        }
      }
    ]
  },
  "c7-number-play-current": {
    "examples": [
      {
        "question": "Choose the missing digit d so that 52d14 is divisible by 9.",
        "steps": [
          "Add the known digits: 5+2+1+4=12.",
          "The digit sum must be a multiple of 9, so 12+d=18 for a digit 0–9.",
          "Hence d=6 and the number is 52614."
        ],
        "answer": "d=6",
        "verify": {
          "kind": "value",
          "expr": "5+2+6+1+4",
          "answer": "18"
        }
      },
      {
        "question": "Explain why 8736 is divisible by 12 and calculate its quotient.",
        "steps": [
          "For divisibility by 12, check both 3 and 4.",
          "The digit sum is 24, divisible by 3; the final two digits 36 are divisible by 4.",
          "So 8736÷12=728."
        ],
        "answer": "728",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "8+7+3+6",
              "24"
            ],
            [
              "8736/12",
              "728"
            ]
          ]
        }
      }
    ]
  },
  "c7-triangles-current": {
    "examples": [
      {
        "question": "Two sides of a triangle are 8 cm and 13 cm. How many integer lengths can its third side have?",
        "steps": [
          "Use the strict triangle inequality |13−8|<x<13+8.",
          "Thus 5<x<21.",
          "Integer values 6 through 20 give 15 choices."
        ],
        "answer": "15 choices",
        "verify": {
          "kind": "value",
          "expr": "20-6+1",
          "answer": "15"
        }
      },
      {
        "question": "A triangle's angles are in the ratio 2:3:4. Find all angles and explain why the triangle exists.",
        "steps": [
          "Set the angles to 2x,3x,4x.",
          "Their sum is 9x=180°, so x=20°.",
          "The angles 40°,60°,80° are all positive and sum to 180°."
        ],
        "answer": "40°, 60°, 80°",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "2*20",
              "40"
            ],
            [
              "3*20",
              "60"
            ],
            [
              "4*20",
              "80"
            ]
          ]
        }
      }
    ]
  },
  "c7-fractions-current": {
    "examples": [
      {
        "question": "A class raises 48 tokens. It spends 5/8 of the tokens on materials and 1/6 on printing. How many tokens remain?",
        "steps": [
          "Material cost is (5/8)×48=30 tokens.",
          "Printing uses (1/6)×48=8 tokens.",
          "Remaining tokens are 48−30−8=10."
        ],
        "answer": "10 tokens",
        "verify": {
          "kind": "value",
          "expr": "48-(5/8)*48-(1/6)*48",
          "answer": "10"
        }
      },
      {
        "question": "A jug is emptied by 3/7 of its original capacity. Then 1/4 of the remaining water is used. What fraction of the original remains?",
        "steps": [
          "After the first use, the remaining fraction is 1−3/7=4/7.",
          "A quarter of that remainder is (1/4)(4/7)=1/7 of the original.",
          "Final fraction is 4/7−1/7=3/7."
        ],
        "answer": "3/7",
        "verify": {
          "kind": "value",
          "expr": "(1-3/7)*(1-1/4)",
          "answer": "3/7"
        }
      }
    ]
  },
  "c7-geometric-twins-current": {
    "examples": [
      {
        "question": "Point P(−3,4) is reflected in the y-axis. Find its image and the distance between the two points.",
        "steps": [
          "Reflection in the y-axis reverses the x-coordinate only.",
          "The image is P′=(3,4).",
          "Because the y-coordinates agree, their separation is 3−(−3)=6 units."
        ],
        "answer": "P′=(3,4), distance 6",
        "verify": {
          "kind": "value",
          "expr": "3-(-3)",
          "answer": "6"
        }
      },
      {
        "question": "Reflect the point (7,−1) in the vertical line x=2. Give its image and displacement length.",
        "steps": [
          "The original x-coordinate is 5 units to the right of the mirror.",
          "Place the image 5 units left of x=2, giving x′=−3.",
          "The image (−3,−1) is 10 units away."
        ],
        "answer": "(−3,−1); 10 units",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "2-(7-2)",
              "-3"
            ],
            [
              "7-(-3)",
              "10"
            ]
          ]
        }
      }
    ]
  },
  "c7-integer-operations-current": {
    "examples": [
      {
        "question": "Calculate −12−(−17)+(−9) using the number line idea.",
        "steps": [
          "Subtracting −17 is the same as adding 17.",
          "The intermediate result is −12+17=5.",
          "Adding −9 gives −4."
        ],
        "answer": "−4",
        "verify": {
          "kind": "value",
          "expr": "-12-(-17)+(-9)",
          "answer": "-4"
        }
      },
      {
        "question": "A bank balance is −₹250. A deposit of ₹480 is followed by a payment of ₹375. Find the final balance.",
        "steps": [
          "After deposit the balance is −250+480=230.",
          "Paying ₹375 lowers it by 375.",
          "The final balance is −₹145."
        ],
        "answer": "−₹145",
        "verify": {
          "kind": "value",
          "expr": "-250+480-375",
          "answer": "-145"
        }
      }
    ]
  },
  "c7-common-ground-current": {
    "examples": [
      {
        "question": "Evaluate 2/3+3/5−1/2 using the least common denominator.",
        "steps": [
          "The least common multiple of 3, 5 and 2 is 30.",
          "Write the parts as 20/30+18/30−15/30.",
          "Combine to obtain 23/30."
        ],
        "answer": "23/30",
        "verify": {
          "kind": "value",
          "expr": "2/3+3/5-1/2",
          "answer": "23/30"
        }
      },
      {
        "question": "Without decimals, determine how much greater 5/12 is than 7/18.",
        "steps": [
          "The least common denominator of 12 and 18 is 36.",
          "Convert 5/12=15/36 and 7/18=14/36.",
          "Their positive difference is 1/36."
        ],
        "answer": "1/36",
        "verify": {
          "kind": "value",
          "expr": "5/12-7/18",
          "answer": "1/36"
        }
      }
    ]
  },
  "c7-decimal-operations-current": {
    "examples": [
      {
        "question": "Divide 4.8 by 0.12 without using a calculator.",
        "steps": [
          "Multiply both quantities by 100; the quotient does not change.",
          "The calculation becomes 480÷12.",
          "Therefore 4.8÷0.12=40."
        ],
        "answer": "40",
        "verify": {
          "kind": "value",
          "expr": "4.8/0.12",
          "answer": "40"
        }
      },
      {
        "question": "Compute 1.25×0.48 by converting 1.25 into a fraction.",
        "steps": [
          "Write 1.25=5/4.",
          "Divide 0.48 by 4 to get 0.12.",
          "Multiply by 5 to obtain 0.60."
        ],
        "answer": "0.6",
        "verify": {
          "kind": "value",
          "expr": "1.25*0.48",
          "answer": "0.6"
        }
      }
    ]
  },
  "c7-connecting-dots-current": {
    "examples": [
      {
        "question": "A convex polygon has 35 diagonals. Find how many vertices it has.",
        "steps": [
          "The diagonal count is n(n−3)/2, so n(n−3)=70.",
          "Rearrange n²−3n−70=(n−10)(n+7)=0.",
          "A polygon needs a positive number of vertices, hence n=10."
        ],
        "answer": "10 vertices",
        "verify": {
          "kind": "value",
          "expr": "10*(10-3)/2",
          "answer": "35"
        }
      },
      {
        "question": "How many diagonals are present in a 12-sided convex polygon? Explain why dividing by two matters.",
        "steps": [
          "Each of the 12 vertices connects diagonally to 12−3=9 other vertices.",
          "That gives 12×9 endpoint counts.",
          "Every diagonal is counted at both ends, so 12×9/2=54."
        ],
        "answer": "54",
        "verify": {
          "kind": "value",
          "expr": "12*(12-3)/2",
          "answer": "54"
        }
      }
    ]
  },
  "c7-constructions-tilings-current": {
    "examples": [
      {
        "question": "Three regular pentagons meet at a point. How much angular gap remains? Can they tile that point alone?",
        "steps": [
          "Each regular pentagon's interior angle is (5−2)×180°/5=108°.",
          "Three such angles total 324°.",
          "The remaining 360°−324°=36° means they cannot tile the point without a gap."
        ],
        "answer": "36° gap",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "(5-2)*180/5",
              "108"
            ],
            [
              "360-3*108",
              "36"
            ]
          ]
        }
      },
      {
        "question": "How many equilateral triangles can meet edge-to-edge at one regular tiling vertex?",
        "steps": [
          "Each equilateral triangle contributes 60°.",
          "The angles around a vertex must total 360°.",
          "360÷60=6 triangles fit without gaps."
        ],
        "answer": "6 triangles",
        "verify": {
          "kind": "value",
          "expr": "360/60",
          "answer": "6"
        }
      }
    ]
  },
  "c7-finding-unknown-current": {
    "examples": [
      {
        "question": "Solve (x−5)/3+4=10, and verify your result in the original equation.",
        "steps": [
          "Subtract 4: (x−5)/3=6.",
          "Multiply by 3: x−5=18; add 5 to obtain x=23.",
          "Check (23−5)/3+4=6+4=10."
        ],
        "answer": "x=23",
        "verify": {
          "kind": "value",
          "expr": "(23-5)/3+4",
          "answer": "10"
        }
      },
      {
        "question": "Solve 3(2x−1)−4=5x+9.",
        "steps": [
          "Expand the entire bracket: 6x−3−4=5x+9.",
          "Simplify to 6x−7=5x+9 and subtract 5x.",
          "So x=16; both sides equal 89."
        ],
        "answer": "x=16",
        "verify": {
          "kind": "values",
          "pairs": [
            [
              "3*(2*16-1)-4",
              "89"
            ],
            [
              "5*16+9",
              "89"
            ]
          ]
        }
      }
    ]
  }
};
