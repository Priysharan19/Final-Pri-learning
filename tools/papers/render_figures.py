#!/usr/bin/env python3
"""Render the diagrams of one paper to SVG (dev-time tool; the SVGs are checked in).

usage: render_figures.py <paper LaTeX dir> <out dir> <figs file> <figName> ...

Compiles each \\figName from the owner's own figure macros with pdflatex (the
`preview` package crops each to its own box) and converts the PDF pages to SVG
with PyMuPDF, text as outlines so nothing depends on a font. Needs TeX Live
and PyMuPDF; the app never runs this.
"""
import os, re, shutil, subprocess, sys, tempfile

def main():
    src, out, figs_file, specs = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4:]
    if not specs:
        return
    # each spec is a LaTeX macro name, or macro=output name (an option's diagram is published under a neutral name)
    names = [s.split('=')[0] for s in specs]
    outs = [s.split('=')[-1] for s in specs]
    import pymupdf as fitz
    tex = open(os.path.join(src, 'paper.tex'), encoding='utf8').read()
    pre = tex.split('\\begin{document}')[0]
    pre = re.sub(r'\\renewcommand\{\\hsclogo\}.*', '', pre)  # cover artwork is not needed
    pre += '\n\\usepackage[active,tightpage]{preview}\n\\PreviewBorder=3pt\n'
    body = '\\begin{document}\n\\pagestyle{empty}\n' + ''.join('\\begin{preview}\\%s\\end{preview}\\clearpage\n' % n for n in names) + '\\end{document}\n'
    with tempfile.TemporaryDirectory() as tmp:
        for f in os.listdir(src):
            if f.endswith(('.tex', '.sty')) and f != 'paper.tex' and f != 'guidelines.tex':
                shutil.copy(os.path.join(src, f), tmp)
        open(os.path.join(tmp, 'figrender.tex'), 'w', encoding='utf8').write(pre + body)
        r = subprocess.run(['pdflatex', '-interaction=nonstopmode', '-halt-on-error', 'figrender.tex'], cwd=tmp, capture_output=True, text=True)
        pdf = os.path.join(tmp, 'figrender.pdf')
        if not os.path.exists(pdf):
            sys.stderr.write(r.stdout[-1500:])
            sys.exit('figure build failed')
        doc = fitz.open(pdf)
        if len(doc) != len(names):
            sys.exit('expected %d figure pages, got %d' % (len(names), len(doc)))
        os.makedirs(out, exist_ok=True)
        for name, page in zip(outs, doc):
            svg = page.get_svg_image(text_as_path=True)
            # a figure is an image of the question's own diagram: keep it small and self-contained
            svg = re.sub(r'<\?xml[^>]*\?>\s*', '', svg)
            open(os.path.join(out, name + '.svg'), 'w', encoding='utf8').write(svg)
    print('  figures: %d' % len(names))

main()
