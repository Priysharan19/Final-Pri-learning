// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Production segmentation regression
//
// This is the geometry behind a real failure seen on iPad: the student wrote a
// normal algebra line, put the exponent clearly above the x-height, and the
// exponent was promoted to a separate written line before Vision ever saw the
// expression. Once that happens no language model can reconstruct the original
// 2-D maths reliably.
//
// Keep this check independent of Vision. It proves the structural invariant at
// the earliest layer: a detached, smaller mark carried by a body-height glyph
// belongs to that line, while a genuine second line remains separate.
// ─────────────────────────────────────────────────────────────────────────────
import CoreGraphics
import Foundation

enum InkSegmentationRegression {

    private static func stroke(
        _ x1: CGFloat, _ y1: CGFloat,
        _ x2: CGFloat, _ y2: CGFloat
    ) -> InkStroke {
        InkStroke(points: [
            InkPoint(x: x1, y: y1, w: 3),
            InkPoint(x: (x1 + x2) / 2, y: (y1 + y2) / 2, w: 3),
            InkPoint(x: x2, y: y2, w: 3)
        ])
    }

    /// Runs only under --ink-selfcheck. A failure is fatal on purpose: the
    /// native CI job must not report a green handwriting build if it can split
    /// an exponent away from its carrier again.
    static func assertProductionInvariants() {
        var strokes: [InkStroke] = [
            // Main body line, y ≈ 80...120. The diagonal at x≈72...88 is the
            // carrier corresponding to the x in a term such as 2x³.
            stroke(20, 82, 22, 120),
            stroke(44, 81, 46, 119),
            stroke(72, 82, 88, 119),
            stroke(120, 81, 122, 120),
            stroke(150, 80, 151, 118),
            stroke(180, 83, 182, 120),

            // Real second line. It is full-size and far enough below that the
            // raised-mark recovery must never absorb it.
            stroke(20, 182, 22, 220),
            stroke(52, 180, 54, 219),
            stroke(86, 181, 88, 220)
        ]

        // Written after the body strokes to mimic Pencil order. Its box is
        // intentionally clear of the body's top edge: the old overlap-only
        // segmenter made this a third line. At 28 pt high against a ~40 pt
        // body it is a realistic large handwritten exponent, not a tiny dot.
        let exponentIndex = strokes.count
        strokes.append(stroke(92, 40, 104, 68))

        let lines = InkLineSegmenter.segment(strokes)
        let exponentLine = lines.firstIndex { $0.strokeIndexes.contains(exponentIndex) }
        let bodyLine = lines.firstIndex { line in
            line.strokeIndexes.contains(0) && line.strokeIndexes.contains(5)
        }
        let secondLine = lines.firstIndex { line in
            line.strokeIndexes.contains(6) && line.strokeIndexes.contains(8)
        }

        let exponentAttached = exponentLine != nil && exponentLine == bodyLine
        let realSecondLinePreserved = secondLine != nil && secondLine != bodyLine
        let ok = lines.count == 2 && exponentAttached && realSecondLinePreserved

        NSLog("PRIINK segmentation satellite=%@ lines=%d exponentAttached=%@ realSecondLine=%@",
              ok ? "PASS" : "FAIL", lines.count,
              exponentAttached ? "yes" : "NO",
              realSecondLinePreserved ? "yes" : "NO")

        precondition(ok,
            "Native handwriting line segmentation violated exponent/line separation invariant")
    }
}
