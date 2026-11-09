// Unit test for site/src/markdown.mjs, the converter that renders docs/legal
// onto prilearning.com. It pins the supported subset (H1–H3, wrapped
// paragraphs, bold, links, code, bullet lists with multi-paragraph items,
// numbered lists), the rendering options the pages use (dropTitle, demote,
// only, idFor, mapLink), the CommonMark rule that only a bullet or "1." may
// interrupt a paragraph — so a paragraph line beginning "2023. The Act
// applies." keeps its number as text instead of becoming a one-item list —
// and, on the real notices, that every word of every file survives into the
// render. Run as part of `npm run test:site`.
import assert from 'node:assert/strict';
import { readNotices } from '../site/build.mjs';
import { lastUpdated, parseBlocks, renderInline, renderMarkdown, sectionTitles, slugify } from '../site/src/markdown.mjs';
import { articleWords, noticeWords } from './site-check.mjs';

let checks = 0;
const eq = (actual, expected, label) => { assert.equal(actual, expected, label); checks++; };
const deepEq = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const has = (html, re, label) => { assert.match(html, re, label); checks++; };
const lacks = (html, re, label) => { assert.doesNotMatch(html, re, label); checks++; };

// ── Inline ───────────────────────────────────────────────────────────────────
eq(renderInline('a **b** c'), 'a <strong>b</strong> c', 'bold');
eq(renderInline('see [the policy](/refund-policy).', { mapLink: u => (u === '/refund-policy' ? '/refunds' : u) }), 'see <a href="/refunds">the policy</a>.', 'link through mapLink');
eq(renderInline('`x < 1` & "q"'), '<code>x &lt; 1</code> &amp; &quot;q&quot;', 'code and escaping');
eq(renderInline('*italic* and _under_ stay as typed'), '*italic* and _under_ stay as typed', 'unknown inline syntax is left as the characters typed');
eq(renderInline('**bold with [a link](/privacy)**'), '<strong>bold with <a href="/privacy">a link</a></strong>', 'nested inline');
eq(renderInline('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;', 'HTML in a notice is text');

// ── Blocks ───────────────────────────────────────────────────────────────────
const doc = [
  '# Title', '', '**Last updated: 1 January 2026**', '', 'First line', 'second line.', '',
  '## Section one', '', '- Item one', '- Item two', '  continues here.', '', '  Second paragraph of item two.', '- Item three', '',
  '### Sub', '', '1. First', '2. Second', '3. Third', '',
  '## Section two', '', 'Done.', ''
].join('\n');
const blocks = parseBlocks(doc);
deepEq(blocks.map(b => b.type), ['heading', 'paragraph', 'paragraph', 'heading', 'list', 'heading', 'list', 'heading', 'paragraph'], 'block sequence');
deepEq(blocks[4].items, [['Item one'], ['Item two continues here.', 'Second paragraph of item two.'], ['Item three']], 'bullet items with a two-paragraph item');
eq(blocks[6].ordered, true, 'numbered list is ordered');
eq(blocks[6].start, 1, 'numbered list starts at 1');

const r = renderMarkdown(doc);
eq(r.title, 'Title', 'title is the H1');
deepEq(r.headings.map(h => [h.level, h.id]), [[1, 'title'], [2, 'section-one'], [3, 'sub'], [2, 'section-two']], 'headings and ids');
has(r.html, /<h1 id="title">Title<\/h1>/, 'h1');
has(r.html, /<p><strong>Last updated: 1 January 2026<\/strong><\/p>/, 'stamp');
has(r.html, /<p>First line second line\.<\/p>/, 'hard-wrapped paragraph joins with a space');
has(r.html, /<ul><li>Item one<\/li><li><p>Item two continues here\.<\/p><p>Second paragraph of item two\.<\/p><\/li><li>Item three<\/li><\/ul>/, 'bullet list');
has(r.html, /<h3 id="sub">Sub<\/h3>\n<ol><li>First<\/li><li>Second<\/li><li>Third<\/li><\/ol>/, 'numbered list');

// Options the pages use.
const partial = renderMarkdown(doc, { dropTitle: true, demote: 1, only: [1] });
eq(partial.html, '<h3 id="section-two">Section two</h3>\n<p>Done.</p>', 'dropTitle + demote + only renders one demoted section');
deepEq(partial.headings, [{ level: 2, text: 'Section two', id: 'section-two' }], 'headings of a partial render');
const shared = renderMarkdown(doc, { idFor: (index) => `s${index}` });
deepEq(shared.headings.map(h => h.id), ['s0', 's1', 's2', 's3'], 'idFor numbers every heading including the H1');
const demoted = renderMarkdown(doc, { demote: 1 });
has(demoted.html, /<h2 id="title">Title<\/h2>[\s\S]*<h3 id="section-one">/, 'demote shifts every level');

// ── CommonMark: what may interrupt a paragraph ───────────────────────────────
// A number other than 1 followed by a dot is paragraph text. Before this rule
// the line below became <ol><li>The Act applies to us.</li></ol> and the token
// "2023." vanished from the notice.
const act = renderMarkdown('# T\n\nThis is required of us by the Act\n2023. The Act applies to us.\n');
has(act.html, /<p>This is required of us by the Act 2023\. The Act applies to us\.<\/p>/, 'a "2023." line stays in its paragraph');
lacks(act.html, /<ol/, 'and starts no list');
// "1." and a bullet may interrupt a paragraph.
const one = renderMarkdown('# T\n\nSteps follow\n1. First\n2. Second\n');
has(one.html, /<p>Steps follow<\/p>\n<ol><li>First<\/li><li>Second<\/li><\/ol>/, '"1." interrupts a paragraph');
const bullet = renderMarkdown('# T\n\nPoints follow\n- A\n- B\n');
has(bullet.html, /<p>Points follow<\/p>\n<ul><li>A<\/li><li>B<\/li><\/ul>/, 'a bullet interrupts a paragraph');
// A list that begins at another number keeps that number, visibly.
const start = renderMarkdown('# T\n\n3. Third\n4. Fourth\n');
has(start.html, /<ol start="3"><li>Third<\/li><li>Fourth<\/li><\/ol>/, 'a list starting at 3 says so');
// Inside a bullet item, a "2023." line is lazy continuation text.
const lazy = renderMarkdown('# T\n\n- Point made in\n2023. Still the point.\n- Next\n');
has(lazy.html, /<ul><li>Point made in 2023\. Still the point\.<\/li><li>Next<\/li><\/ul>/, 'lazy continuation inside a bullet keeps the number');
// Inside a numbered list any number starts the next item.
const sibling = renderMarkdown('# T\n\n1. a\n7. b\n');
has(sibling.html, /<ol><li>a<\/li><li>b<\/li><\/ol>/, 'a sibling item may carry any number');
// A heading still ends a paragraph.
const heading = renderMarkdown('# T\n\nText\n## Next\n');
has(heading.html, /<p>Text<\/p>\n<h2 id="next">Next<\/h2>/, 'a heading ends a paragraph');

// ── The fidelity tokenisers agree on this document ───────────────────────────
deepEq(articleWords(renderMarkdown(doc, { dropTitle: true }).html), noticeWords(doc), 'article words equal source words, ordinals included');
deepEq(articleWords(renderMarkdown('# T\n\nBy the Act\n2023. It applies.\n', { dropTitle: true }).html), ['By', 'the', 'Act', '2023.', 'It', 'applies.'], 'the number-dot token survives into the words');
deepEq(noticeWords('# T\n\n## A\n\n- **x** [y](/z) `c`\n\n## B\n\n1. one\n2. two\n'), ['A', 'x', 'y', 'c', 'B', '1.', 'one', '2.', 'two'], 'source words drop marks and link targets, keep ordinals');
deepEq(noticeWords('# T\n\n## A\n\nfirst\n\n## B\n\nsecond\n', [1]), ['B', 'second'], 'sections selects H2 sections by index');
deepEq(articleWords('<ol start="3"><li>c</li><li>d</li></ol>'), ['3.', 'c', '4.', 'd'], 'ordinals follow start');
deepEq(articleWords('<ol><li>Only</li></ol>'), ['1.', 'Only'], 'a swallowed paragraph would read as "1." where the source says "2023."');

// ── Helpers ──────────────────────────────────────────────────────────────────
eq(lastUpdated(doc), 'Last updated: 1 January 2026', 'lastUpdated');
deepEq(sectionTitles(doc), ['Section one', 'Section two'], 'sectionTitles');
eq(slugify('Children’s data & you'), 'childrens-data-you', 'slugify');
eq(slugify('बच्चे'), '', 'slugify yields nothing for Devanagari, so the Hindi page takes the English id');

// ── Every word of every notice survives the converter ────────────────────────
const docs = readNotices();
for (const slug of Object.keys(docs)) {
  for (const lang of ['en', 'hi']) {
    const source = docs[slug][lang];
    const words = articleWords(renderMarkdown(source, { dropTitle: true }).html);
    deepEq(words, noticeWords(source), `docs/legal/${docs[slug].file[lang]}: every word, in order`);
    assert.ok(words.length > 50, `docs/legal/${docs[slug].file[lang]} renders more than a stub`);
    checks++;
  }
}

console.log(`SITE MARKDOWN: PASS — ${checks} checks; the converter keeps every word of ${Object.keys(docs).length * 2} notices.`);
