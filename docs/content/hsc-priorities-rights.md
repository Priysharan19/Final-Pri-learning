# HSC 2027 priorities — rights and licence position

Prithagoras · engine in `client/src/engine/hsc/` · written 18 November 2026.
This is a record of what the product does and why. It is **not legal advice**. Items marked **FOR LEGAL REVIEW** need the owner's counsel before launch.

## What NESA owns

NESA past HSC papers, marking guidelines (including their Mapping Grids), sample examination materials and syllabus text are **Crown copyright**. NESA's copyright page allows reproduction only as the *Copyright Act 1968* (Cth) permits (research or study, criticism or review, and similar). Its licence for NSW schools **expressly excludes** private or home tutoring companies, publishers and other organisations. Pri Learning is a commercial service, so that licence does not cover it. Source: `docs/research/NSW_HSC_CURRICULUM_ASSESSMENT_AUTHORITY.md` §5.7.

## What Pri stores and shows

| Item | What Pri does | Position |
|---|---|---|
| Question, criterion, sample-answer or feedback **text** | Not stored, not shown. `hscSchema.js` refuses any record carrying a text field unless its source is marked `reproduction: 'permitted'`. No source is. | Not permitted without NESA's written permission. |
| Diagrams, reference sheets | Not stored, not shown. | Not permitted. |
| **Metadata** per question part: year, course, question number and part, marks, NESA's own 2017 topic code (or 2024 outcome code for the sample), a response type | Stored in `records-*.js` and `sample-2024.js`, read from NESA's Mapping Grids. | Facts about the paper, not its expression. Believed low risk. **FOR LEGAL REVIEW**: confirm that extracting and storing NESA's topic mapping per part (a compilation NESA made) is acceptable for commercial use. |
| Response type (mcq / short / extended / proof / sketch / explain) | Pri's own classification from the **first word** of the marking-guideline criterion; the criterion text is not stored. | Pri's own derived fact. |
| 2024 outcome codes and focus-area names | Shown as labels (`MAV-12-06 · Applications of calculus`). | Already in the NSW curriculum model; same open question as there (research §5.7): **FOR LEGAL REVIEW** / ask NESA. |
| Links to NESA's exam-pack pages | One link to NESA's own past-papers page per course. | Linking is not copying. |
| Practice questions | Pri's own original questions from the issued Prithagoras banks. The weighted practice paper reuses the existing practice-paper path. | `PRI_AUTHORED`. No NESA question is reproduced or adapted. |
| Claims | "Based on the new syllabus, NESA's sample materials and past papers. Not a prediction of the actual questions." Never "official", "NESA-approved", a predicted mark, band or ATAR. | Required by the product standard. |

## Third-party code

The research the owner shared names public tools (ExamRAG, Exam Paper Analyzer, HSC Paper Tagger). HSC Paper Tagger is **GPL-3.0**. **No code from any of them is used.** The idea of tagging papers by topic is general; the extractor `tools/hsc/extract-mapping-grids.py` is written from scratch and reads NESA's own Mapping Grids rather than classifying question text.

## The source PDFs

The PDFs are **not** in the repository. Each is listed in `client/src/engine/hsc/hscSources.js` with its URL, the NESA page listing it, the sha256 of the file read and the read date, so anyone can fetch and check it. Re-running the extractor on the same files reproduces the metadata.

## Open items for the owner

1. **FOR LEGAL REVIEW:** commercial storage of per-part topic metadata derived from NESA marking guidelines.
2. **FOR LEGAL REVIEW:** showing NESA outcome codes and focus-area names to students (shared with the curriculum model).
3. Consider asking NESA's Copyright Officer (copyright@nesa.nsw.edu.au) for written permission covering both, which would also settle any later use of question text.
