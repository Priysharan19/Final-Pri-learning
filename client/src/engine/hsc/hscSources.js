// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · HSC priorities · provenance registry (Prithagoras)
//
// One entry per NESA document actually opened while building the HSC 2027
// priorities engine: the URL it was fetched from, the NESA page that lists it,
// the sha256 of the file that was read, and the day it was read. Every record
// in records-*.js and sample-2024.js names one of these as its source, and
// hscSchema.js refuses a record whose source is not here.
//
// RIGHTS (docs/content/hsc-priorities-rights.md). NESA material is Crown
// copyright; its schools licence expressly excludes tutoring companies and
// publishers. So no entry here permits reproducing NESA text: `reproduction`
// is 'not-permitted' on every document, and hscSchema.js refuses any record
// that carries question, criterion or answer text from a source that does not
// say 'permitted'. What Pri stores from these documents is metadata (question
// numbers, marks, NESA's own topic/outcome codes) and a link.
// ─────────────────────────────────────────────────────────────────────────────

/** Read date for every document below. */
export const HSC_RETRIEVED = '2026-11-18';

/** The rights position of every NESA document in this registry. */
export const HSC_REPRODUCTION = Object.freeze({ NOT_PERMITTED: 'not-permitted', PERMITTED: 'permitted' });

/** Kinds of document a record may cite. */
export const HSC_SOURCE_KINDS = Object.freeze(['exam-paper', 'marking-guidelines', 'sample-examination-materials', 'examination-specifications']);

const doc = (id, kind, title, url, listedAt, sha256) => [id, Object.freeze({
  id, kind, title, url, listedAt, sha256,
  authority: 'NSW Education Standards Authority (NESA)',
  retrieved: HSC_RETRIEVED,
  reproduction: HSC_REPRODUCTION.NOT_PERMITTED
})];

const CURRICULUM = 'https://curriculum.nsw.edu.au/learning-areas/mathematics';

export const HSC_SOURCES = Object.freeze(Object.fromEntries([
  doc('nesa-advanced-2020-paper', 'exam-paper', '2020 HSC Mathematics Advanced examination', 'https://www.nsw.gov.au/sites/default/files/noindex/2025-05/2020-hsc-mathematics-advanced.pdf', 'https://www.nsw.gov.au/education-and-training/nesa/curriculum/hsc-exam-papers/mathematics-advanced/2020', '9b14ae156dc0b06ec672b2f17cede75f130a3501822c718f1ba9a9191efed115'),
  doc('nesa-advanced-2020-mg', 'marking-guidelines', '2020 HSC Mathematics Advanced marking guidelines (Mapping Grid read)', 'https://www.nsw.gov.au/sites/default/files/noindex/2025-05/2020-hsc-mathematics-advanced-mg.pdf', 'https://www.nsw.gov.au/education-and-training/nesa/curriculum/hsc-exam-papers/mathematics-advanced/2020', 'fb66642cc69ec050fde817f98ba7e047c25d972c762c27c4acaec61e2d9dd5bb'),
  doc('nesa-advanced-2021-paper', 'exam-paper', '2021 HSC Mathematics Advanced examination', 'https://www.nsw.gov.au/sites/default/files/noindex/2025-05/2021-hsc-mathematics-advanced.pdf', 'https://www.nsw.gov.au/education-and-training/nesa/curriculum/hsc-exam-papers/mathematics-advanced/2021', 'd5109a30a872281db67242b380075ca68081bda43929544bacdb795584b63539'),
  doc('nesa-advanced-2021-mg', 'marking-guidelines', '2021 HSC Mathematics Advanced marking guidelines (Mapping Grid read)', 'https://www.nsw.gov.au/sites/default/files/noindex/2025-05/2021-hsc-mathematics-advanced-mg.pdf', 'https://www.nsw.gov.au/education-and-training/nesa/curriculum/hsc-exam-papers/mathematics-advanced/2021', 'e0f1996fa63f258b24895d039c301809fc2493f8fe485aff6764a38b08a57326'),
  doc('nesa-advanced-2022-paper', 'exam-paper', '2022 HSC Mathematics Advanced examination', 'https://www.nsw.gov.au/sites/default/files/noindex/2025-05/2022-hsc-mathematics-advanced.pdf', 'https://www.nsw.gov.au/education-and-training/nesa/curriculum/hsc-exam-papers/mathematics-advanced/2022', 'e384e2306c655df357c9197b2809f6e76558413448f6a0d0efb39ea56a3edd06'),
  doc('nesa-advanced-2022-mg', 'marking-guidelines', '2022 HSC Mathematics Advanced marking guidelines (Mapping Grid read)', 'https://www.nsw.gov.au/sites/default/files/noindex/2025-05/2022-hsc-mathematics-advanced-mg.pdf', 'https://www.nsw.gov.au/education-and-training/nesa/curriculum/hsc-exam-papers/mathematics-advanced/2022', 'f0fd8610d6237226fa2179d0329a88bec9e57edef82bd70a0fbc5acbfdf1f19a'),
  doc('nesa-advanced-2023-paper', 'exam-paper', '2023 HSC Mathematics Advanced examination', 'https://www.nsw.gov.au/sites/default/files/noindex/2025-05/2023-hsc-maths-adv.pdf', 'https://www.nsw.gov.au/education-and-training/nesa/curriculum/hsc-exam-papers/mathematics-advanced/2023', 'ef02e04806d8ca6ae21bb51956368bdd99a9ab735fb2f220dc6c6e1d313886d7'),
  doc('nesa-advanced-2023-mg', 'marking-guidelines', '2023 HSC Mathematics Advanced marking guidelines (Mapping Grid read)', 'https://www.nsw.gov.au/sites/default/files/noindex/2025-05/2023-hsc-maths-adv-mg.pdf', 'https://www.nsw.gov.au/education-and-training/nesa/curriculum/hsc-exam-papers/mathematics-advanced/2023', '1d60075420bf23681a4843df614cd5b4b4160cbdd16335fe547452f24dc21516'),
  doc('nesa-advanced-2024-paper', 'exam-paper', '2024 HSC Mathematics Advanced examination', 'https://www.nsw.gov.au/sites/default/files/noindex/2025-05/2024-hsc-maths-adv.pdf', 'https://www.nsw.gov.au/education-and-training/nesa/curriculum/hsc-exam-papers/mathematics-advanced/2024', 'aa44136bcba8b65a5cfc63b9f214536a0df149f1624db946ca84281936d36b47'),
  doc('nesa-advanced-2024-mg', 'marking-guidelines', '2024 HSC Mathematics Advanced marking guidelines (Mapping Grid read)', 'https://www.nsw.gov.au/sites/default/files/noindex/2025-05/2024-hsc-maths-adv-mg.pdf', 'https://www.nsw.gov.au/education-and-training/nesa/curriculum/hsc-exam-papers/mathematics-advanced/2024', 'c6b87711a70ca97725d7fdba698e4fde497164dd88f117750c0a8aa32b158fe9'),
  doc('nesa-advanced-2025-paper', 'exam-paper', '2025 HSC Mathematics Advanced examination', 'https://www.nsw.gov.au/sites/default/files/noindex/2025-10/2025-hsc-maths-advanced.pdf', 'https://www.nsw.gov.au/education-and-training/nesa/curriculum/hsc-exam-papers/mathematics-advanced/2025', 'b23eb942dd92ff0f79a426c741abc90e99a8fbd55952b106d817e6d09ea5deba'),
  doc('nesa-advanced-2025-mg', 'marking-guidelines', '2025 HSC Mathematics Advanced marking guidelines (Mapping Grid read)', 'https://www.nsw.gov.au/sites/default/files/noindex/2025-11/2025-hsc-maths-adv-mg.pdf', 'https://www.nsw.gov.au/education-and-training/nesa/curriculum/hsc-exam-papers/mathematics-advanced/2025', '5237d02784c18b4e74cd68cd72e6cbc4a9319022a2237ef233261dba48410322'),
  doc('nesa-extension1-2020-paper', 'exam-paper', '2020 HSC Mathematics Extension 1 examination', 'https://www.nsw.gov.au/sites/default/files/noindex/2025-05/2020-hsc-mathematics-extension-1.pdf', 'https://www.nsw.gov.au/education-and-training/nesa/curriculum/hsc-exam-papers/mathematics-extension-1/2020', 'ca8aa245f5af3b3e53572bc29099abe1e264bc40a005480082af6cec968f51da'),
  doc('nesa-extension1-2020-mg', 'marking-guidelines', '2020 HSC Mathematics Extension 1 marking guidelines (Mapping Grid read)', 'https://www.nsw.gov.au/sites/default/files/noindex/2025-05/2020-hsc-mathematics-ext-1-mg.pdf', 'https://www.nsw.gov.au/education-and-training/nesa/curriculum/hsc-exam-papers/mathematics-extension-1/2020', '377b73052047e9df8f5b63d2c995f75f96831d1562e6c2208467f8ab8e884467'),
  doc('nesa-extension1-2021-paper', 'exam-paper', '2021 HSC Mathematics Extension 1 examination', 'https://www.nsw.gov.au/sites/default/files/noindex/2025-05/2021-hsc-mathematics-extension-1.pdf', 'https://www.nsw.gov.au/education-and-training/nesa/curriculum/hsc-exam-papers/mathematics-extension-1/2021', '6921786d55dba57029f6a7844c836d2a181046d11dee6078b6235ca59c0a7f4e'),
  doc('nesa-extension1-2021-mg', 'marking-guidelines', '2021 HSC Mathematics Extension 1 marking guidelines (Mapping Grid read)', 'https://www.nsw.gov.au/sites/default/files/noindex/2025-05/2021-hsc-maths-ext-1-mg.pdf', 'https://www.nsw.gov.au/education-and-training/nesa/curriculum/hsc-exam-papers/mathematics-extension-1/2021', 'b9ed2e322d0648cd7c228d853e6f5dae1fe52fe6d46f6581727c0c53086a82e5'),
  doc('nesa-extension1-2022-paper', 'exam-paper', '2022 HSC Mathematics Extension 1 examination', 'https://www.nsw.gov.au/sites/default/files/noindex/2025-05/2022-hsc-mathematics-extension-1.pdf', 'https://www.nsw.gov.au/education-and-training/nesa/curriculum/hsc-exam-papers/mathematics-extension-1/2022', '86bc677892f23575cf2a0a2e47255bfc981a2ecf38e072bafc37b6598b0cdee1'),
  doc('nesa-extension1-2022-mg', 'marking-guidelines', '2022 HSC Mathematics Extension 1 marking guidelines (Mapping Grid read)', 'https://www.nsw.gov.au/sites/default/files/noindex/2025-05/2022-hsc-maths-ext-1-mg.pdf', 'https://www.nsw.gov.au/education-and-training/nesa/curriculum/hsc-exam-papers/mathematics-extension-1/2022', '2efe270c04c65bcbc9c3ef88abe2fa93b1e0c24c291169a098146e1c1b9bd411'),
  doc('nesa-extension1-2023-paper', 'exam-paper', '2023 HSC Mathematics Extension 1 examination', 'https://www.nsw.gov.au/sites/default/files/noindex/2025-05/2023-hsc-maths-ext-1.pdf', 'https://www.nsw.gov.au/education-and-training/nesa/curriculum/hsc-exam-papers/mathematics-extension-1/2023', '7c11c93be785d8faf8ce779b3383b8e9e0d1d706ad0a020a104fcb86bb813c66'),
  doc('nesa-extension1-2023-mg', 'marking-guidelines', '2023 HSC Mathematics Extension 1 marking guidelines (Mapping Grid read)', 'https://www.nsw.gov.au/sites/default/files/noindex/2025-05/2023-hsc-maths-ext-1-mg.pdf', 'https://www.nsw.gov.au/education-and-training/nesa/curriculum/hsc-exam-papers/mathematics-extension-1/2023', '9e1c0a0a953817149c13e5492deaefb6865c25a521b29d706d1d27ecedc43e78'),
  doc('nesa-extension1-2024-paper', 'exam-paper', '2024 HSC Mathematics Extension 1 examination', 'https://www.nsw.gov.au/sites/default/files/noindex/2025-05/2024-hsc-maths-ext-1.pdf', 'https://www.nsw.gov.au/education-and-training/nesa/curriculum/hsc-exam-papers/mathematics-extension-1/2024', '958391196c7747d3a22d981c64519b1f3eb6a1d1122cc3b4758695ba5e084755'),
  doc('nesa-extension1-2024-mg', 'marking-guidelines', '2024 HSC Mathematics Extension 1 marking guidelines (Mapping Grid read)', 'https://www.nsw.gov.au/sites/default/files/noindex/2025-05/2024-hsc-maths-ext-1-mg.pdf', 'https://www.nsw.gov.au/education-and-training/nesa/curriculum/hsc-exam-papers/mathematics-extension-1/2024', 'd78290f410688679123982cc94a67f239e065336b9b88a4f22506d851f032708'),
  doc('nesa-extension1-2025-paper', 'exam-paper', '2025 HSC Mathematics Extension 1 examination', 'https://www.nsw.gov.au/sites/default/files/noindex/2025-10/2025-hsc-maths-extension-1.pdf', 'https://www.nsw.gov.au/education-and-training/nesa/curriculum/hsc-exam-papers/mathematics-extension-1/2025', '499decf8f5e0c287821650474348dcb1a1ba2ad73a6f37de6ef78f9bf267e8b1'),
  doc('nesa-extension1-2025-mg', 'marking-guidelines', '2025 HSC Mathematics Extension 1 marking guidelines (Mapping Grid read)', 'https://www.nsw.gov.au/sites/default/files/noindex/2025-11/2025-hsc-maths-extension-1-mg.pdf', 'https://www.nsw.gov.au/education-and-training/nesa/curriculum/hsc-exam-papers/mathematics-extension-1/2025', '1b2775277b2278f42670c9db4c6c5c717471aa4bcd95582be0bfae7507b281f1'),
  doc('nesa-extension1-2026-paper', 'exam-paper', '2026 HSC Mathematics Extension 1 examination', 'https://www.nsw.gov.au/sites/default/files/noindex/2026-10/2026-hsc-maths-extension-1.pdf', 'https://www.nsw.gov.au/education-and-training/nesa/curriculum/hsc-exam-papers/mathematics-extension-1/2026', '91dec8309b3fd794cef7e1f39a75977b8649278e3b5be115b34d0b042c81b023'),
  doc('nesa-extension1-2026-mg', 'marking-guidelines', '2026 HSC Mathematics Extension 1 marking guidelines (Mapping Grid read)', 'https://www.nsw.gov.au/sites/default/files/noindex/2026-11/2026-hsc-maths-extension-1-mg.pdf', 'https://www.nsw.gov.au/education-and-training/nesa/curriculum/hsc-exam-papers/mathematics-extension-1/2026', 'a58660e06508c27e2ecc963597d1b255e10c37ec93430543e08703099db8999a'),
  doc('nesa-advanced-2026-paper', 'exam-paper', '2026 HSC Mathematics Advanced examination (marking guidelines not yet published; not tagged)', 'https://www.nsw.gov.au/sites/default/files/noindex/2026-10/2026-hsc-maths-advanced.pdf', 'https://www.nsw.gov.au/education-and-training/nesa/curriculum/hsc-exam-papers/mathematics-advanced/2026', '8efaee076501771654430c6e00f553283d7b268b0b2f51fab713d4f7dac2ca7c'),
  doc('nesa-advanced-2024-sample', 'sample-examination-materials', 'HSC Mathematics Advanced (2024 syllabus) annotated sample examination materials (Mapping Grid read)',
    'https://library.curriculum.nsw.edu.au/341419dc-8ec2-0289-7225-6db7f2d751ef/c3154390-3080-4f0d-987c-1019ef0bae93/D2024%20462014%20%20HSC%20Mathematics%20Advanced%20-%20annotated-sample-examination-materials.pdf',
    `${CURRICULUM}/mathematics-advanced-11-12-2024/assessment/hsc-examinations`, 'fcfabd8c0c781ef6a9a4ae3ed645de2bf2e242f5686999e63dd91f086709bc9b'),
  doc('nesa-extension1-2024-sample', 'sample-examination-materials', 'HSC Mathematics Extension 1 (2024 syllabus) annotated sample examination materials (Mapping Grid read)',
    'https://library.curriculum.nsw.edu.au/341419dc-8ec2-0289-7225-6db7f2d751ef/85a3b2be-f6a2-427c-a80a-353bda067676/D2024%20461999%20%20HSC%20Mathematics%20Extension%201%20-%20annotated-sample-examination-materials.pdf',
    `${CURRICULUM}/mathematics-extension-1-11-12-2024/assessment/hsc-examinations`, 'd9f57971cb593f31186a8a487b345535f075c4ab46a1baa6d145aa807f0bdafc'),
  doc('nesa-advanced-2024-specifications', 'examination-specifications', 'Mathematics Advanced 11–12 (2024) HSC examination specifications: first HSC examination 2027',
    `${CURRICULUM}/mathematics-advanced-11-12-2024/assessment/hsc-examinations`, `${CURRICULUM}/mathematics-advanced-11-12-2024`, null),
  doc('nesa-extension1-2024-specifications', 'examination-specifications', 'Mathematics Extension 1 11–12 (2024) HSC examination specifications: first HSC examination 2027',
    `${CURRICULUM}/mathematics-extension-1-11-12-2024/assessment/hsc-examinations`, `${CURRICULUM}/mathematics-extension-1-11-12-2024`, null)
]));

/** The document record for a source id, or null. */
export function hscSource(id) {
  return HSC_SOURCES[String(id || '')] || null;
}

/**
 * Papers a student could expect here that are NOT tagged, and why. Surfaces
 * and the backtest read this so a missing year is a stated fact.
 */
export const HSC_UNTAGGED = Object.freeze([
  Object.freeze({ course: 'advanced', year: 2026, reason: 'NESA had not published the 2026 Mathematics Advanced marking guidelines (and so its Mapping Grid) on 18 November 2026. The paper is not tagged from Pri\'s own reading.' }),
  Object.freeze({ course: 'advanced', year: 2019, reason: 'Before 2020 the course was Mathematics (2-unit) on an earlier syllabus with different topics; it is not mapped.' }),
  Object.freeze({ course: 'extension1', year: 2019, reason: 'Before 2020 Extension 1 was examined on an earlier syllabus with different topics; it is not mapped.' })
]);
