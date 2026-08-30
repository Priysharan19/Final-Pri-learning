# NCERT Class 8 Chapters 3–13 release audit

This release completes the source-audited Pri Learning integration for the eleven remaining NCERT Class 8 Mathematics chapters supplied for the 2024–25 reprint.

## Release contract

- 11 chapters (Chapters 3–13)
- 150 uploaded source pages audited
- 31 NCERT exercise sections represented
- 185 top-level source exercise questions represented in the source-vs-attached-answer audit
- 11 dedicated NCERT mastery generator families across four difficulty levels (44 authored cells)
- progressive hints and complete worked solution stages on generated questions
- dedicated topper notes, worked examples, exercise answer-key audit and page-level source coverage UI for every chapter
- numeric questions remain on Pri Learning's production InkAnswer handwriting recognition, confidence, marking, retry and Pri Explain path
- production web build synchronized to both tracked iPad bundles

The permanent regression suite is `client/test/ncert-class8-ch3-13-check.mjs` and is included in root `npm test` as `test:ncert:class8:rest`.
