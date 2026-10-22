# Luxury layer fonts (subset, self-hosted)

All SIL Open Font License 1.1. Subset with fontTools `pyftsubset` from the @fontsource Latin files (v5), keeping `kern liga lnum tnum onum smcp c2sc sups`.

| File | Face | Glyphs |
|---|---|---|
| stix-400 / stix-400i | STIX Two Text | Basic Latin, plus the maths and typographic symbols the interface sets: × ÷ − ′ ″ ² ³ ¹ ± ° · ≤ ≥ ≠ √ π θ α β → ₹, curly quotes, dashes, ellipsis |
| iserif-400 | Instrument Serif | the same set |

KaTeX still sets the mathematics. Devanagari falls back to the system's Hindi faces (Kohinoor Devanagari on iOS). A designed Hindi pairing (Tiro Devanagari, Noto Sans Devanagari) is an open item in the build log. To add glyphs, rerun pyftsubset with the wider set and update this table.

Italic Instrument Serif and STIX 600 were dropped for the install budget: set italics with `font-style: italic` on `var(--c-italic)` (STIX Two italic), and set the date window in STIX 400 tabular.

Aurora (current direction) dropped Cormorant SC: labels are the interface sans in tracked capitals. Three faces ship: Instrument Serif 400, STIX Two Text 400 and 400 italic.
