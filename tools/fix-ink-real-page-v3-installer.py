from pathlib import Path

p = Path('tools/apply-ink-real-page-v3.py')
text = p.read_text()
old = '''replace_once(
    "client/src/ink/nativeConsensus.js",
    "candidateReadings: live.map(evidenceOf),",
    "candidateReadings: attempted.map(evidenceOf),"
)
# second occurrence in disagreement branch
replace_once(
    "client/src/ink/nativeConsensus.js",
    "candidateReadings: live.map(evidenceOf),",
    "candidateReadings: attempted.map(evidenceOf),"
)
'''
new = '''consensus_path = Path("client/src/ink/nativeConsensus.js")
consensus_text = consensus_path.read_text()
old_candidates = "candidateReadings: live.map(evidenceOf),"
if consensus_text.count(old_candidates) != 2:
    raise SystemExit(f"expected 2 candidateReadings anchors, found {consensus_text.count(old_candidates)}")
consensus_path.write_text(consensus_text.replace(old_candidates, "candidateReadings: attempted.map(evidenceOf),", 2))
'''
if text.count(old) != 1:
    raise SystemExit(f'installer fix anchor count={text.count(old)}')
p.write_text(text.replace(old, new, 1))
print('V3 INSTALLER FIXED')
