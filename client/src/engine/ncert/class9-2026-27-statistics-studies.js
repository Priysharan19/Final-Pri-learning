// CBSE Class IX 2026–27 ORIGINAL Statistics study pack, not wired, no server marking.
// Source: https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart1/Maths_SecP1IX_2026-27.pdf
export const class9Statistics202627 = {
  "id": "pl-cbse9-statistics-202627-1",
  "version": "2026.10.14.1",
  "track": "CBSE standard Class IX",
  "sourceUrl": "https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart1/Maths_SecP1IX_2026-27.pdf",
  "officialChapter": "Statistics",
  "officialCompetencies": [
    "C-6.1",
    "C-9.1"
  ],
  "classification": "core",
  "status": "draft-unwired-independent-review-pending",
  "mode": "study-only",
  "provenance": "original Pri Learning content",
  "goals": [
    "Compute and interpret weighted averages from frequency distributions.",
    "Interpret absolute stacked bar graphs and 100% stacked bars.",
    "Distinguish a larger absolute count from a larger share.",
    "Explain the relative resistance of the median to an extreme observation."
  ],
  "concepts": [
    "A frequency-weighted mean is the sum of frequency times value divided by the total frequency; averaging the distinct values without weights is generally incorrect.",
    "In a stacked bar, segments add to the whole group's count; to compare relative shares, divide each segment by that bar's total.",
    "A 100%-stacked bar represents percentages within each group and must be multiplied by the group's actual size to obtain counts.",
    "To compute the median, sort the data and inspect the central position(s); a large outlier can change the mean much more than the median."
  ],
  "workedExamples": [
    {
      "id": "pl9-stat-w01",
      "question": "Scores 6,10 occur with frequencies 2,3. Compute the mean.",
      "steps": [
        "Total score=2×6+3×10=42.",
        "Total frequency=2+3=5.",
        "Weighted mean=42/5=8.4."
      ],
      "answer": "8.4",
      "check": {
        "kind": "weighted",
        "values": [
          6,
          10
        ],
        "freq": [
          2,
          3
        ],
        "mean": 8.4
      }
    },
    {
      "id": "pl9-stat-w02",
      "question": "One bar has 18 bus, 12 walking and 10 cycling commuters. What percentage walk?",
      "steps": [
        "The full bar represents 18+12+10=40 commuters.",
        "The walking segment contains 12.",
        "Thus 12/40×100=30% walk."
      ],
      "answer": "30%",
      "check": {
        "kind": "stacked-single",
        "values": [
          18,
          12,
          10
        ],
        "focusIndex": 1,
        "pct": 30
      }
    },
    {
      "id": "pl9-stat-w03",
      "question": "A sample 2,3,4,5,6 gains an outlier 30. How does mean compare with median?",
      "steps": [
        "Initially mean=20/5=4 and median=4.",
        "After appending 30, mean=50/6=25/3.",
        "The new median is (4+5)/2=4.5; the mean rises far more."
      ],
      "answer": "mean 4→25/3, median 4→4.5",
      "check": {
        "kind": "outlier",
        "original": [
          2,
          3,
          4,
          5,
          6
        ],
        "added": 30,
        "meanBefore": 4,
        "meanAfter": 8.333333333333334,
        "medianBefore": 4,
        "medianAfter": 4.5
      }
    }
  ],
  "questions": [
    {
      "id": "pl9-stat-weighted-1",
      "archetypeId": "pl9-stat-frequency-weighted-mean",
      "question": "Five marks are 4,4,4,7,7 and five are 9,9,9,9,9. Find the mean mark.",
      "hint": "Use value times frequency, not the mean of three values.",
      "steps": [
        "Total marks=3×4+2×7+5×9=71.",
        "Number of marks=3+2+5=10.",
        "Weighted mean=71/10=7.1."
      ],
      "answer": "7.1",
      "check": {
        "kind": "weighted",
        "values": [
          4,
          7,
          9
        ],
        "freq": [
          3,
          2,
          5
        ],
        "mean": 7.1
      },
      "misconception": "The frequencies are weights; do not average 4,7,9.",
      "figure": null,
      "provenance": "original",
      "classification": "core",
      "state": "unwired-study-draft",
      "version": "2026.10.14.1"
    },
    {
      "id": "pl9-stat-weighted-2",
      "archetypeId": "pl9-stat-frequency-weighted-mean",
      "question": "Scores 3, 6 and 8 occur 2, 3 and 5 times respectively. Calculate the mean.",
      "hint": "Make a value×frequency table.",
      "steps": [
        "Total=2×3+3×6+5×8=64.",
        "There are 10 observations.",
        "Mean=64/10=6.4."
      ],
      "answer": "6.4",
      "check": {
        "kind": "weighted",
        "values": [
          3,
          6,
          8
        ],
        "freq": [
          2,
          3,
          5
        ],
        "mean": 6.4
      },
      "misconception": "A frequency count is not itself a score.",
      "figure": null,
      "provenance": "original",
      "classification": "core",
      "state": "unwired-study-draft",
      "version": "2026.10.14.1"
    },
    {
      "id": "pl9-stat-missing-1",
      "archetypeId": "pl9-stat-inverse-frequency",
      "question": "A frequency table has score 3 occurring twice, score 5 occurring x times and score 9 occurring three times. If the mean is 6, find x.",
      "hint": "Set total score divided by total frequency equal to 6.",
      "steps": [
        "(2×3+5x+3×9)/(x+5)=6.",
        "33+5x=30+6x.",
        "Therefore x=3, a valid whole-number frequency."
      ],
      "answer": "x=3",
      "check": {
        "kind": "missing",
        "values": [
          3,
          5,
          9
        ],
        "freq": [
          2,
          null,
          3
        ],
        "unknownIndex": 1,
        "mean": 6,
        "x": 3
      },
      "misconception": "Do not treat x as a score instead of a frequency.",
      "figure": null,
      "provenance": "original",
      "classification": "core",
      "state": "unwired-study-draft",
      "version": "2026.10.14.1"
    },
    {
      "id": "pl9-stat-missing-2",
      "archetypeId": "pl9-stat-inverse-frequency",
      "question": "Scores 2,6,10 occur 3,x,1 times. Their mean is 5. Determine x.",
      "hint": "Write the weighted mean equation with x in numerator and denominator.",
      "steps": [
        "(3×2+6x+1×10)/(x+4)=5.",
        "16+6x=20+5x.",
        "Thus x=4."
      ],
      "answer": "x=4",
      "check": {
        "kind": "missing",
        "values": [
          2,
          6,
          10
        ],
        "freq": [
          3,
          null,
          1
        ],
        "unknownIndex": 1,
        "mean": 5,
        "x": 4
      },
      "misconception": "After multiplying by x+4, expand both terms.",
      "figure": null,
      "provenance": "original",
      "classification": "core",
      "state": "unwired-study-draft",
      "version": "2026.10.14.1"
    },
    {
      "id": "pl9-stat-stacked-1",
      "archetypeId": "pl9-stat-stacked-share-compare",
      "question": "A stacked bar for Class A has 12 bus, 16 walking and 12 cycling pupils; Class B has 10 bus, 6 walking and 14 cycling. Which class has a larger walking percentage?",
      "hint": "Compare proportions, not absolute walking counts.",
      "steps": [
        "Class A total=40, walking=16 so its share is 40%.",
        "Class B total=30, walking=6 so its share is 20%.",
        "Class A has the greater walking proportion by 20 percentage points."
      ],
      "answer": "Class A, 40% versus 20%",
      "check": {
        "kind": "stacked",
        "groups": [
          [
            12,
            16,
            12
          ],
          [
            10,
            6,
            14
          ]
        ],
        "focusIndex": 1,
        "percentages": [
          40,
          20
        ]
      },
      "misconception": "The segment heights in groups with different totals cannot be compared as percentages without dividing.",
      "figure": {
        "type": "stacked-bar",
        "groups": [
          {
            "label": "A",
            "segments": [
              12,
              16,
              12
            ]
          },
          {
            "label": "B",
            "segments": [
              10,
              6,
              14
            ]
          }
        ],
        "categories": [
          "bus",
          "walk",
          "cycle"
        ],
        "alt": "Two bars show bus, walking and cycling counts for classes A and B; each category remains separately distinguishable without colour."
      },
      "provenance": "original",
      "classification": "core",
      "state": "unwired-study-draft",
      "version": "2026.10.14.1"
    },
    {
      "id": "pl9-stat-stacked-2",
      "archetypeId": "pl9-stat-stacked-share-compare",
      "question": "A stacked chart shows Class A with bus 15, walk 15, cycle 20; Class B with bus 5, walk 12, cycle 3. Which has the larger walking percentage?",
      "hint": "Compute each full bar total first.",
      "steps": [
        "Class A has 50 pupils and 15 walk: 30%.",
        "Class B has 20 pupils and 12 walk: 60%.",
        "Class B's walking share is higher by 30 percentage points."
      ],
      "answer": "Class B, 60% versus 30%",
      "check": {
        "kind": "stacked",
        "groups": [
          [
            15,
            15,
            20
          ],
          [
            5,
            12,
            3
          ]
        ],
        "focusIndex": 1,
        "percentages": [
          30,
          60
        ]
      },
      "misconception": "Class A has more walkers by count, but fewer by proportion.",
      "figure": {
        "type": "stacked-bar",
        "groups": [
          {
            "label": "A",
            "segments": [
              15,
              15,
              20
            ]
          },
          {
            "label": "B",
            "segments": [
              5,
              12,
              3
            ]
          }
        ],
        "categories": [
          "bus",
          "walk",
          "cycle"
        ],
        "alt": "Stacked bars of three travel modes for 50 pupils in A and 20 in B."
      },
      "provenance": "original",
      "classification": "core",
      "state": "unwired-study-draft",
      "version": "2026.10.14.1"
    },
    {
      "id": "pl9-stat-pct-1",
      "archetypeId": "pl9-stat-100pct-count",
      "question": "A 100%-stacked bar says 35% of 40 pupils play chess. How many pupils is that?",
      "hint": "Convert the segment percentage into a fraction of the given total.",
      "steps": [
        "35% = 35/100.",
        "Number=40×35/100=14.",
        "The segment represents 14 pupils, not 35 pupils."
      ],
      "answer": "14 pupils",
      "check": {
        "kind": "percent-to-count",
        "total": 40,
        "pct": 35,
        "count": 14
      },
      "misconception": "A 100% stacked chart shows proportions, not raw counts.",
      "figure": null,
      "provenance": "original",
      "classification": "core",
      "state": "unwired-study-draft",
      "version": "2026.10.14.1"
    },
    {
      "id": "pl9-stat-pct-2",
      "archetypeId": "pl9-stat-100pct-count",
      "question": "In a club of 60 learners, a 100%-stacked bar shows 15% prefer robotics. Find the count.",
      "hint": "Multiply the known total by the proportion.",
      "steps": [
        "15%=0.15.",
        "60×0.15=9.",
        "Nine learners prefer robotics."
      ],
      "answer": "9 learners",
      "check": {
        "kind": "percent-to-count",
        "total": 60,
        "pct": 15,
        "count": 9
      },
      "misconception": "Never compare 15% to an absolute count without the denominator.",
      "figure": null,
      "provenance": "original",
      "classification": "core",
      "state": "unwired-study-draft",
      "version": "2026.10.14.1"
    },
    {
      "id": "pl9-stat-outlier-1",
      "archetypeId": "pl9-stat-median-mean-outlier",
      "question": "The sorted data 2,3,3,4,5 gain one value 30. Find the old and new means and medians. Which measure changes more?",
      "hint": "Remember a six-number median averages the middle two.",
      "steps": [
        "Old mean=17/5=3.4 and median=3.",
        "New ordered data are 2,3,3,4,5,30; new mean=47/6 and median=(3+4)/2=3.5.",
        "The mean rises by 47/6−17/5=133/30, much more than the median rise of 0.5."
      ],
      "answer": "means 17/5 and 47/6; medians 3 and 3.5; mean changes more",
      "check": {
        "kind": "outlier",
        "original": [
          2,
          3,
          3,
          4,
          5
        ],
        "added": 30,
        "meanBefore": 3.4,
        "meanAfter": 7.833333333333333,
        "medianBefore": 3,
        "medianAfter": 3.5
      },
      "misconception": "An extreme value can dramatically affect the mean without becoming the median.",
      "figure": null,
      "provenance": "original",
      "classification": "core",
      "state": "unwired-study-draft",
      "version": "2026.10.14.1"
    },
    {
      "id": "pl9-stat-outlier-2",
      "archetypeId": "pl9-stat-median-mean-outlier",
      "question": "The data 1,4,4,5,6 gain the outlying value 40. Compare old/new means and medians.",
      "hint": "Compute mean with the changed number of observations.",
      "steps": [
        "Original mean=(1+4+4+5+6)/5=4; original median=4.",
        "New mean=(20+40)/6=10.",
        "The ordered six values have median (4+5)/2=4.5; the mean changes much more."
      ],
      "answer": "means 4 and 10; medians 4 and 4.5",
      "check": {
        "kind": "outlier",
        "original": [
          1,
          4,
          4,
          5,
          6
        ],
        "added": 40,
        "meanBefore": 4,
        "meanAfter": 10,
        "medianBefore": 4,
        "medianAfter": 4.5
      },
      "misconception": "A median for six values is the average of positions three and four.",
      "figure": null,
      "provenance": "original",
      "classification": "core",
      "state": "unwired-study-draft",
      "version": "2026.10.14.1"
    },
    {
      "id": "pl9-stat-share-1",
      "archetypeId": "pl9-stat-count-versus-percentage",
      "question": "School A has 80 pupils and 25% cycle. School B has 20 pupils and 50% cycle. Which school has more cyclists, and which has the greater share?",
      "hint": "Counts require multiplying each percentage by its own group size.",
      "steps": [
        "School A cyclists=80×0.25=20.",
        "School B cyclists=20×0.5=10.",
        "A has more cyclists, although B's cycling percentage is higher."
      ],
      "answer": "More cyclists: A (20 vs 10); higher share: B",
      "check": {
        "kind": "share-count",
        "totals": [
          80,
          20
        ],
        "pcts": [
          25,
          50
        ],
        "counts": [
          20,
          10
        ]
      },
      "misconception": "More people and larger percentage are different comparisons.",
      "figure": null,
      "provenance": "original",
      "classification": "core",
      "state": "unwired-study-draft",
      "version": "2026.10.14.1"
    },
    {
      "id": "pl9-stat-share-2",
      "archetypeId": "pl9-stat-count-versus-percentage",
      "question": "Community A has 120 members, 20% of whom volunteer. Community B has 40 members with 50% volunteering. Compare volunteer counts and percentages.",
      "hint": "Multiply each proportion by the corresponding population.",
      "steps": [
        "Community A has 120×0.20=24 volunteers.",
        "Community B has 40×0.50=20.",
        "A has more volunteers, but B has the larger volunteer percentage."
      ],
      "answer": "More volunteers: A (24 vs 20); higher percentage: B",
      "check": {
        "kind": "share-count",
        "totals": [
          120,
          40
        ],
        "pcts": [
          20,
          50
        ],
        "counts": [
          24,
          20
        ]
      },
      "misconception": "Population sizes differ; percent is not a number of people.",
      "figure": null,
      "provenance": "original",
      "classification": "core",
      "state": "unwired-study-draft",
      "version": "2026.10.14.1"
    }
  ]
};
export default class9Statistics202627;
