from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path, old, new, label):
    p = ROOT / path
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one anchor, found {count}")
    p.write_text(text.replace(old, new, 1))
    print(f"patched {label}")


replace_once(
    "client/src/ink/runtimeSpatial.js",
    "const STRUCTURAL_FIVE_ALT_SHARE = 0.35;",
    "const STRUCTURAL_FIVE_ALT_SHARE = 0.30;",
    "structural five measured alternative floor",
)

replace_once(
    "client/src/ink/runtimeSpatial.js",
    "// defining 5 structure: a long top sweep, an early leftmost turn, then a\n// lower bowl that exits back to the right. Pri's s templates continue to\n// their leftmost endpoint, so they fail this shape test.\nconst STRUCTURAL_FIVE_ALT_SHARE = 0.30;",
    "// defining 5 structure: a long top sweep, an early leftmost turn, then a\n// lower bowl that exits back to the right. Pri's s templates continue to\n// their leftmost endpoint, so they fail this shape test. The browser release\n// fixture measures the real pointer-filtered 5 at about 0.32 of the leading s\n// score, so 0.30 leaves measured margin without weakening any other digit twin.\nconst STRUCTURAL_FIVE_ALT_SHARE = 0.30;",
    "structural five threshold evidence comment",
)

replace_once(
    "client/test/ink-hybrid-check.mjs",
    "const structuralResult = (group, sym = 's', conf = 0.58, altSym = '5', altConf = 0.23) => {",
    "const structuralResult = (group, sym = 's', conf = 0.58, altSym = '5', altConf = 0.19) => {",
    "hybrid measured browser candidate fixture",
)

replace_once(
    "client/test/ink-hybrid-check.mjs",
    "// Physical 5/s evidence: the mounted browser gives canonical 5 a weak\n// 23% 5 alternative behind a 58% s. Only the five-shaped trajectory may\n// use that weaker evidence; a real s with identical classifier scores\n// must remain s. Affine shear/scale checks keep this structural rather\n// than tied to one screenshot or canvas size.",
    "// Physical 5/s evidence: the exact PR browser rerun gave canonical 5 a\n// 19% 5 alternative behind a 58% s (the first run was 21% behind 66%). Only\n// the five-shaped trajectory may use that weaker evidence; a real s with the\n// identical classifier scores must remain s. Affine shear/scale checks keep\n// this structural rather than tied to one screenshot or canvas size.",
    "hybrid browser evidence comment",
)

replace_once(
    "client/test/ink-hybrid-check.mjs",
    "assert.equal(repaired.text, '5', `${label} must rescue measured 58/23 s-vs-5 evidence`);",
    "assert.equal(repaired.text, '5', `${label} must rescue measured 58/19 s-vs-5 evidence`);",
    "hybrid measured assertion label",
)

print("Pri Ink numeric single-glyph release patch complete")
