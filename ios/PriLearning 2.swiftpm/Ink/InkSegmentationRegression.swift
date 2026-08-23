// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Production segmentation regression
//
// Geometry-only regression for the real failure where a high handwritten power
// became a separate line before OCR. A detached smaller mark carried by a body
// glyph must stay on that line while genuine second-line working stays separate.
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

    static func assertProductionInvariants() {
        var strokes: [InkStroke] = [
            stroke(20, 82, 22, 120),
            stroke(44, 81, 46, 119),
            stroke(72, 82, 88, 119),
            stroke(120, 81, 122, 120),
            stroke(150, 80, 151, 118),
            stroke(180, 83, 182, 120),
            stroke(20, 182, 22, 220),
            stroke(52, 180, 54, 219),
            stroke(86, 181, 88, 220)
        ]
        let exponentIndex = strokes.count
        strokes.append(stroke(92, 40, 104, 68))

        let lines = InkLineSegmenter.segment(strokes)
        let exponentLine = lines.firstIndex { $0.strokeIndexes.contains(exponentIndex) }
        let bodyLine = lines.firstIndex { $0.strokeIndexes.contains(0) && $0.strokeIndexes.contains(5) }
        let secondLine = lines.firstIndex { $0.strokeIndexes.contains(6) && $0.strokeIndexes.contains(8) }
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
