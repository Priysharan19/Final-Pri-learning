#!/usr/bin/env python3
# ─────────────────────────────────────────────────────────────────────────────
# Pri Learning · HSC paper metadata from NESA's own mapping grids
#
# Every NESA HSC marking guideline ends with a "Mapping Grid": one row per
# question part giving the marks, the syllabus topic code(s) NESA itself mapped
# the part to, and the outcomes. This tool reads those grids — and the grid in
# NESA's sample examination materials for the 2024 syllabuses — and writes the
# METADATA ONLY into client/src/engine/hsc/:
#
#   records-advanced.js     HSC Mathematics Advanced, one row per question part
#   records-extension1.js   HSC Mathematics Extension 1, one row per question part
#   sample-2024.js          the 2024-syllabus sample examination items
#
# What is written: question number and part, marks, NESA's topic code(s) (or
# 2024 outcome codes for the sample), and a response type derived from the
# first criterion of the part's marking guideline (proof / sketch / explain;
# otherwise short or extended by marks; Section I is multiple choice). No
# question text, no criterion text, no sample answer: NESA material is Crown
# copyright and its schools licence excludes tutoring companies
# (docs/content/hsc-priorities-rights.md).
#
# The PDFs are not in the repository. Download them from NESA's pages (the URLs
# are in client/src/engine/hsc/hscSources.js) into one directory and run:
#
#   python3 -I tools/hsc/extract-mapping-grids.py <pdf-dir> [--write]
#
# Without --write it prints each paper's row count and mark total and the
# sha256 of every file read, so the sources registry can be checked against
# what was actually opened. A paper whose rows do not add up to the paper's
# total (100 Advanced, 70 Extension 1) is refused, not written.
#
# Ideas only from public HSC-paper tooling: no third-party code is used here.
# Needs: pypdf.
# ─────────────────────────────────────────────────────────────────────────────
import hashlib
import json
import os
import re
import sys

import pypdf

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'client', 'src', 'engine', 'hsc')

# (course, year, marking-guideline file). The 2026 Advanced marking guideline
# was not yet published on 18 November 2026, so 2026 Advanced is not tagged.
PAPERS = [
    ('advanced', 2020, '2020-hsc-mathematics-advanced-mg.pdf'),
    ('advanced', 2021, '2021-hsc-mathematics-advanced-mg.pdf'),
    ('advanced', 2022, '2022-hsc-mathematics-advanced-mg.pdf'),
    ('advanced', 2023, '2023-hsc-maths-adv-mg.pdf'),
    ('advanced', 2024, '2024-hsc-maths-adv-mg.pdf'),
    ('advanced', 2025, '2025-hsc-maths-adv-mg.pdf'),
    ('extension1', 2020, '2020-hsc-mathematics-ext-1-mg.pdf'),
    ('extension1', 2021, '2021-hsc-maths-ext-1-mg.pdf'),
    ('extension1', 2022, '2022-hsc-maths-ext-1-mg.pdf'),
    ('extension1', 2023, '2023-hsc-maths-ext-1-mg.pdf'),
    ('extension1', 2024, '2024-hsc-maths-ext-1-mg.pdf'),
    ('extension1', 2025, '2025-hsc-maths-extension-1-mg.pdf'),
    ('extension1', 2026, '2026-hsc-maths-extension-1-mg.pdf'),
]
SAMPLES = [
    ('advanced', 'adv-annotated-sample.pdf'),
    ('extension1', 'ext1-annotated-sample.pdf'),
]
TOTAL = {'advanced': 100, 'extension1': 70}
TOPICS_2017 = {
    'advanced': set('MA-F1 MA-F2 MA-T1 MA-T2 MA-T3 MA-C1 MA-C2 MA-C3 MA-C4 MA-E1 MA-M1 MA-S1 MA-S2 MA-S3'.split()),
    'extension1': set('ME-F1 ME-F2 ME-T1 ME-T2 ME-T3 ME-C1 ME-C2 ME-C3 ME-A1 ME-P1 ME-V1 ME-S1'.split()),
}
# NESA's sample grid prints Extension 1 Q13(c) as "ME-11-02"; the item's content
# column is "Polynomials", which is ME1-11-02. Corrected here and noted on the item.
SAMPLE_CODE_FIXES = {('extension1', 13, '(c)'): ('ME-11-02', 'ME1-11-02')}


def text_of(path):
    reader = pypdf.PdfReader(path)
    return '\n'.join(f'\n=====PAGE {i + 1}=====\n' + (p.extract_text() or '') for i, p in enumerate(reader.pages))


def sha256(path):
    with open(path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


def grid_text(t):
    t = t[t.find('Mapping Grid') + len('Mapping Grid'):]
    keep = []
    for ln in t.split('\n'):
        s = ln.strip()
        if (not s or s.startswith('=====PAGE') or s.startswith('NESA') or s.startswith('Question')
                or re.match(r'^Page\s*\d+\s*of\s*\d+', s) or re.match(r'^Section I+\s*$', s)
                or s.startswith('Bands') or s.startswith('Marks') or s in ('performance', 'bands')):
            continue
        keep.append(re.sub(r'Page\s*\d+\s*of\s*\d+', ' ', s))
    j = ' '.join(keep).replace('–', '-').replace('‑', '-').replace('−', '-')
    j = re.sub(r'\s+', ' ', j)
    return re.sub(r'\(\s*([a-z]+)\s*\)', r'(\1)', j)


ROW = re.compile(r'(?<![\w-])(\d{1,2}) ?((?:\([a-z]\) ?)?(?:\([ivx]+\) ?)?)(\d{1,2}) ')


def rows_2017(t):
    j = grid_text(t)
    # The lookahead keeps a candidate that is not a row start from consuming a real one.
    starts = list(re.compile(ROW.pattern + r'(?=M[AEX]{1,2} ?-? ?[A-Z] ?\d)').finditer(j))
    rows = []
    for k, m in enumerate(starts):
        body = j[m.end():starts[k + 1].start() if k + 1 < len(starts) else len(j)]
        topics = []
        for a, b, c in re.findall(r'(M[AEX]{1,2}) ?-? ?([A-Z]) ?(\d)(?!\d)', body):
            code = f'{a}-{b}{c}'
            if code not in topics:
                topics.append(code)
        rows.append({'q': int(m.group(1)), 'part': re.sub(r'\s', '', m.group(2)), 'marks': int(m.group(3)), 'codes': topics})
    return rows


def rows_2024(t, course):
    j = grid_text(t)
    starts = list(re.compile(ROW.pattern + r'(?=[A-Z])').finditer(j))
    rows = []
    for k, m in enumerate(starts):
        body = j[m.end():starts[k + 1].start() if k + 1 < len(starts) else len(j)]
        q, part = int(m.group(1)), re.sub(r'\s', '', m.group(2))
        note = None
        fix = SAMPLE_CODE_FIXES.get((course, q, part))
        if fix and fix[0] in body:
            body = body.replace(fix[0], fix[1])
            note = f'NESA prints {fix[0]}; the content column names this outcome.'
        codes = []
        for c in re.findall(r'((?:MAV|ME1)-1[12]-\d\d)', body):
            if c not in codes:
                codes.append(c)
        if codes:
            rows.append({'q': q, 'part': part, 'marks': int(m.group(3)), 'codes': codes, 'note': note})
    return rows


def response_types(t):
    """First criterion of each Section II part → a response type (no criterion text is kept)."""
    t = re.sub(r'[ \t]+', ' ', t.replace('–', '-'))
    t = t[:t.find('Mapping Grid')]
    t = re.sub(r'\(\s*([a-z]+)\s*\)', r'(\1)', t)
    hdr = re.compile(r'Question\s+(\d{1,2})\s*((?:\([a-z]\)\s*)?(?:\([ivx]+\)\s*)?)(?=\s*(?:\n|Criteria|\(continued\)|$))')
    found = list(hdr.finditer(t))
    out = {}
    for k, m in enumerate(found):
        key = (int(m.group(1)), re.sub(r'\s', '', m.group(2)))
        if key[0] <= 10 or key in out:
            continue
        body = t[m.end():found[k + 1].start() if k + 1 < len(found) else len(t)]
        c = re.search(r'Provides\s+(?:a\s+|the\s+|an\s+|correct\s+)*([A-Za-z][A-Za-z ]{0,40})', body)
        if not c:
            continue
        first = c.group(1).replace(' ', '').lower()
        if first.startswith('proof'):
            out[key] = 'proof'
        elif first.startswith(('sketch', 'graph', 'drawing', 'diagram')):
            out[key] = 'sketch'
        elif first.startswith(('explanation', 'reason', 'justification', 'interpretation', 'comprehensivedescription', 'description', 'comment')):
            out[key] = 'explain'
        else:
            out[key] = None
    return out


def response_of(q, part, marks, styles):
    if q <= 10:
        return 'mcq'
    s = styles.get((q, part))
    if s:
        return s
    return 'short' if marks <= 2 else 'extended'


def part_id(q, part):
    return f'{q}{part.replace("(", "").replace(")", "")}'


HEADER = """// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · HSC {title} · question-part METADATA (generated)
//
// Generated by tools/hsc/extract-mapping-grids.py from the "Mapping Grid" NESA
// prints at the end of each marking guideline. Do not hand-edit: re-run the tool.
// Each row: [part, marks, NESA topic code(s), response type]. The topic codes are
// NESA's own mapping of the part to the 2017 syllabus; the response type is Pri's
// reading of the first criterion of the part's marking guideline (mcq for Section I).
// METADATA ONLY — no NESA question, criterion or answer text is stored
// (docs/content/hsc-priorities-rights.md).
// ─────────────────────────────────────────────────────────────────────────────
"""


def write_records(course, papers):
    const = 'HSC_ADVANCED_PAPERS' if course == 'advanced' else 'HSC_EXTENSION1_PAPERS'
    title = 'Mathematics Advanced' if course == 'advanced' else 'Mathematics Extension 1'
    lines = [HEADER.format(title=title), f'export const {const} = Object.freeze([']
    for year, rows in papers:
        lines.append(f"  Object.freeze({{ course: '{course}', year: {year}, syllabus: '2017', source: 'nesa-{course}-{year}-mg', paper: 'nesa-{course}-{year}-paper', rows: Object.freeze([")
        for r in rows:
            lines.append(f"    ['{part_id(r['q'], r['part'])}', {r['marks']}, '{' '.join(r['codes'])}', '{r['response']}'],")
        lines.append('  ]) }),')
    lines.append(']);\n')
    name = 'records-advanced.js' if course == 'advanced' else 'records-extension1.js'
    with open(os.path.join(OUT, name), 'w') as f:
        f.write('\n'.join(lines))


def write_samples(samples):
    lines = [HEADER.format(title='2024-syllabus sample examination materials').replace(
        "NESA's own mapping of the part to the 2017 syllabus", "NESA's own mapping of the item to a 2024 outcome").replace(
        'Each row: [part, marks, NESA topic code(s), response type]', 'Each row: [item, marks, NESA 2024 outcome code(s), response type, note?]'),
        'export const HSC_SAMPLE_2024 = Object.freeze([']
    for course, rows in samples:
        lines.append(f"  Object.freeze({{ course: '{course}', syllabus: '2024', source: 'nesa-{course}-2024-sample', rows: Object.freeze([")
        for r in rows:
            note = f", {json.dumps(r['note'])}" if r.get('note') else ''
            lines.append(f"    ['{part_id(r['q'], r['part'])}', {r['marks']}, '{' '.join(r['codes'])}', '{r['response']}'{note}],")
        lines.append('  ]) }),')
    lines.append(']);\n')
    with open(os.path.join(OUT, 'sample-2024.js'), 'w') as f:
        f.write('\n'.join(lines))


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__ or 'usage: extract-mapping-grids.py <pdf-dir> [--write]')
    pdfs, write = sys.argv[1], '--write' in sys.argv
    by_course = {'advanced': [], 'extension1': []}
    for course, year, name in PAPERS:
        path = os.path.join(pdfs, name)
        t = text_of(path)
        rows = rows_2017(t)
        styles = response_types(t)
        total = sum(r['marks'] for r in rows)
        keys = [(r['q'], r['part']) for r in rows]
        bad = [r for r in rows if not r['codes'] or any(c not in TOPICS_2017[course] for c in r['codes'])]
        if total != TOTAL[course] or len(set(keys)) != len(keys) or bad or sorted(set(r['q'] for r in rows if r['q'] <= 10)) != list(range(1, 11)):
            sys.exit(f'{name}: refused — {len(rows)} rows, {total} marks, {len(bad)} bad rows')
        for r in rows:
            r['response'] = response_of(r['q'], r['part'], r['marks'], styles)
        by_course[course].append((year, rows))
        print(f'{course} {year}: {len(rows)} parts, {total} marks, sha256 {sha256(path)}')
    samples = []
    for course, name in SAMPLES:
        path = os.path.join(pdfs, name)
        t = text_of(path)
        rows = rows_2024(t, course)
        styles = response_types(t)
        total = sum(r['marks'] for r in rows)
        if total != TOTAL[course]:
            sys.exit(f'{name}: refused — {len(rows)} rows, {total} marks')
        for r in rows:
            r['response'] = response_of(r['q'], r['part'], r['marks'], styles)
        samples.append((course, rows))
        print(f'{course} 2024 sample: {len(rows)} items, {total} marks, sha256 {sha256(path)}')
    if write:
        for course, papers in by_course.items():
            write_records(course, papers)
        write_samples(samples)
        print('written')


if __name__ == '__main__':
    main()
