// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Production segmentation regression
//
// Geometry-only regressions for the real failure where a high handwritten power
// became a separate line before OCR. Detached raised marks carried by a body
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

    private static func legacyDetachedPowerInvariant() -> Bool {
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
        return lines.count == 2
            && exponentLine != nil
            && exponentLine == bodyLine
            && secondLine != nil
            && secondLine != bodyLine
    }

    /// Mirrors the August real-Pencil failure more closely: two genuine working
    /// lines, each with a handwritten power almost as large as the body glyphs.
    /// The old 0.88 size cutoff detached both powers into their own lines.
    private static func twoLargeSuperscriptsInvariant() -> Bool {
        var strokes: [InkStroke] = [
            stroke(20, 100, 22, 134),
            stroke(52, 99, 54, 134),
            stroke(84, 100, 104, 134),
            stroke(142, 100, 144, 134),
            stroke(178, 99, 180, 134),
            stroke(214, 100, 216, 134),
            stroke(20, 220, 22, 254),
            stroke(52, 219, 54, 254),
            stroke(84, 220, 104, 254),
            stroke(142, 220, 144, 254),
            stroke(178, 219, 180, 254),
            stroke(214, 220, 216, 254)
        ]

        let firstPower = strokes.count
        strokes.append(stroke(106, 66, 135, 98))
        let secondPower = strokes.count
        strokes.append(stroke(106, 186, 135, 218))

        let lines = InkLineSegmenter.segment(strokes)
        guard lines.count == 2 else { return false }
        guard let firstBody = lines.firstIndex(where: {
            $0.strokeIndexes.contains(0) && $0.strokeIndexes.contains(5)
        }), let secondBody = lines.firstIndex(where: {
            $0.strokeIndexes.contains(6) && $0.strokeIndexes.contains(11)
        }) else { return false }

        let firstPowerLine = lines.firstIndex { $0.strokeIndexes.contains(firstPower) }
        let secondPowerLine = lines.firstIndex { $0.strokeIndexes.contains(secondPower) }
        return firstBody != secondBody
            && firstPowerLine == firstBody
            && secondPowerLine == secondBody
    }

    static func assertProductionInvariants() {
        let legacy = legacyDetachedPowerInvariant()
        let twoLine = twoLargeSuperscriptsInvariant()
        let ok = legacy && twoLine

        NSLog(
            "PRIINK segmentation satellite=%@ legacy=%@ twoLargePowers=%@",
            ok ? "PASS" : "FAIL",
            legacy ? "yes" : "NO",
            twoLine ? "yes" : "NO"
        )
        precondition(ok,
            "Native handwriting line segmentation violated superscript/line separation invariant")
    }
}
