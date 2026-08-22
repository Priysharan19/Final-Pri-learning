# NSW Stage 6 mathematics — 2026 transition audit

Status: **OPEN / release-impacting**

This file records the authoritative syllabus version Pri Learning must target by student year in calendar 2026. It exists because a structurally complete internal curriculum table is not enough when NSW is transitioning between Stage 6 syllabuses.

## Authoritative NESA sources

- Mathematics syllabuses index: https://curriculum.nsw.edu.au/learning-areas/mathematics
- Mathematics Advanced 11–12 (2024): https://curriculum.nsw.edu.au/learning-areas/mathematics/mathematics-advanced-11-12-2024/overview
- Mathematics Advanced 11–12 (2024) outcomes: https://curriculum.nsw.edu.au/learning-areas/mathematics/mathematics-advanced-11-12-2024/outcomes
- Mathematics Standard 11–12 (2024) outcomes: https://curriculum.nsw.edu.au/learning-areas/mathematics/mathematics-standard-11-12-2024/outcomes
- Mathematics Extension 1 11–12 (2024) outcomes: https://curriculum.nsw.edu.au/learning-areas/mathematics/mathematics-extension-1-11-12-2024/outcomes
- Mathematics Extension 2 11–12 (2024) outcomes: https://curriculum.nsw.edu.au/learning-areas/mathematics/mathematics-extension-2-11-12-2024/outcomes
- Mathematics K–10 (2022) outcomes: https://curriculum.nsw.edu.au/learning-areas/mathematics/mathematics-k-10-2022/outcomes

## 2026 version matrix

According to NESA's current curriculum pages:

| Student cohort in calendar 2026 | Syllabus to teach |
|---|---|
| Years 7–10 | Mathematics K–10 Syllabus (2022) |
| Year 11 Standard | Mathematics Standard 11–12 Syllabus (2024) |
| Year 11 Advanced | Mathematics Advanced 11–12 Syllabus (2024) |
| Year 11 Extension 1 | Mathematics Extension 1 11–12 Syllabus (2024) |
| Year 12 Standard | Mathematics Standard Stage 6 Syllabus (2017) until the 2026 HSC |
| Year 12 Advanced | Mathematics Advanced Stage 6 Syllabus (2017) until the 2026 HSC |
| Year 12 Extension 1 | Mathematics Extension 1 Stage 6 Syllabus (2017) until the 2026 HSC |
| Year 12 Extension 2 | Mathematics Extension 2 Stage 6 Syllabus (2017) until the 2026 HSC |

The 2024 Stage 6 syllabuses start Year 12 implementation in Term 4 2026 and first HSC examination in 2027.

## Finding 1 — current senior code labels are not version-aware

`client/src/engine/curriculum.js` currently assigns legacy-style senior labels such as:

- `MA-F1`
- `MA-T1/T2`
- `MA-E1`
- `MA-C1`
- `MS-F1`
- `MS-A1`

The 2024 Advanced outcomes instead use identifiers such as `MAV-11-01` through `MAV-11-10` for Year 11, and the 2024 Standard outcomes use `MST-11-*`. Extension 1 uses `ME1-11-*` / `ME1-12-*`.

Therefore Pri Learning must not describe its current Year 11 Stage 6 code mapping as fully current-NESA-validated until the 2024 mapping is implemented and reviewed.

## Required architecture

The curriculum model needs an explicit syllabus version, not one timeless code string.

Recommended minimum shape:

```js
{
  jurisdiction: 'nsw',
  syllabus: 'mathematics-advanced-2024',
  syllabusVersion: 2024,
  cohortYear: 11,
  outcomes: ['MAV-11-02'],
  validFrom: '2026-T1'
}
```

For Year 12 during 2026, the same product must still be capable of serving the 2017 syllabus. Do not globally replace old codes and accidentally move 2026 HSC students onto 2027 content.

## Audit rules

Each senior subtopic and each generated form must eventually record:

1. syllabus/version
2. year/course/pathway
3. authoritative outcome/content reference
4. whether the mapping was machine-checked structurally
5. whether a human reviewer checked semantic alignment
6. reviewer/date/status
7. any course-boundary risk

Allowed statuses: `unreviewed`, `source-mapped`, `teacher-reviewed`, `rejected`, `needs-split`.

## Release rule

Until the ledger is complete:

- do not claim every senior dot point is NESA-validated;
- do not infer semantic correctness from generator reachability;
- keep Year 11 2024 and Year 12 2017 curriculum versions separate in 2026;
- do not rewrite Year 12 2026 content to the 2024 syllabus merely because the newer syllabus exists.

## Next implementation slice

1. Add version-aware Stage 6 curriculum metadata.
2. Map Year 11 Advanced 2024 outcomes first (`MAV-11-*`).
3. Map Year 11 Standard 2024 (`MST-11-*`) and Extension 1 2024 (`ME1-11-*`).
4. Preserve explicit 2017 mappings for Year 12 2026.
5. Add tests that fail if a 2026 Year 11 profile receives a 2017-only mapping or a 2026 Year 12 profile receives a 2024-only mapping.
6. Only then start semantic review of each generator family and marking criterion.
