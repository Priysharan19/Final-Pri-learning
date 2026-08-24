// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Production segmentation regression
//
// Geometry-only regressions for real Pencil failures. Superscripts, integral
// limits and evaluation bounds are 2D parts of an expression, not independent
// lines. Genuine next-line working must still remain separate.
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

    /// Two genuine working lines, each with a handwritten power almost as large
    /// as the body glyphs. A size-only satellite cutoff must not detach them.
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

    /// Mirrors natural calculus working: each baseline line is far apart, while
    /// small upper/lower limits and bracket bounds sit close to their owning line.
    /// The original stroke order is intentionally line-by-line, as PKDrawing is.
    private static func calculusLimitsAndBoundsInvariant() -> Bool {
        var strokes: [InkStroke] = []

        // Line 1: = integral_0^1 (3x^2 - 2x) dx
        let line1Start = strokes.count
        strokes.append(stroke(20, 110, 42, 110))
        strokes.append(stroke(20, 122, 42, 122))
        strokes.append(stroke(66, 88, 58, 142))                 // integral body
        let upperLimit = strokes.count
        strokes.append(stroke(76, 66, 77, 82))                  // upper 1
        let lowerLimit = strokes.count
        strokes.append(stroke(76, 145, 88, 160))                // lower 0
        strokes.append(stroke(112, 102, 128, 132))
        strokes.append(stroke(146, 102, 164, 132))              // x carrier
        let exponent2 = strokes.count
        strokes.append(stroke(166, 78, 180, 96))                // ^2
        strokes.append(stroke(202, 114, 226, 114))
        strokes.append(stroke(250, 102, 267, 132))
        strokes.append(stroke(302, 102, 320, 132))
        strokes.append(stroke(344, 101, 360, 132))
        let line1End = strokes.count - 1

        // Line 2: = [x^3 - x^2]_0^1
        let line2Start = strokes.count
        strokes.append(stroke(20, 230, 42, 230))
        strokes.append(stroke(20, 242, 42, 242))
        strokes.append(stroke(68, 212, 68, 258))
        strokes.append(stroke(68, 212, 82, 212))
        strokes.append(stroke(68, 258, 82, 258))
        strokes.append(stroke(112, 222, 130, 252))
        let exponent3 = strokes.count
        strokes.append(stroke(132, 198, 146, 216))
        strokes.append(stroke(174, 234, 198, 234))
        strokes.append(stroke(224, 222, 242, 252))
        let exponent2b = strokes.count
        strokes.append(stroke(244, 198, 258, 216))
        strokes.append(stroke(282, 212, 282, 258))
        strokes.append(stroke(268, 212, 282, 212))
        strokes.append(stroke(268, 258, 282, 258))
        let evalUpper = strokes.count
        strokes.append(stroke(292, 194, 293, 211))              // upper 1
        let evalLower = strokes.count
        strokes.append(stroke(292, 260, 304, 276))              // lower 0
        let line2End = strokes.count - 3

        // Line 3: ordinary body line with a power.
        let line3Start = strokes.count
        strokes.append(stroke(20, 350, 42, 350))
        strokes.append(stroke(20, 362, 42, 362))
        strokes.append(stroke(78, 342, 96, 372))
        let line3Power = strokes.count
        strokes.append(stroke(98, 318, 112, 336))
        strokes.append(stroke(142, 354, 166, 354))
        strokes.append(stroke(194, 342, 212, 372))
        let line3End = strokes.count - 1

        // Line 4: = 0, deliberately short. It must NOT be swallowed by line 3.
        let line4Start = strokes.count
        strokes.append(stroke(20, 470, 42, 470))
        strokes.append(stroke(20, 482, 42, 482))
        strokes.append(stroke(78, 462, 94, 490))
        let line4End = strokes.count - 1

        let lines = InkLineSegmenter.segment(strokes)
        guard lines.count == 4 else { return false }

        func owner(_ index: Int) -> Int? {
            lines.firstIndex { $0.strokeIndexes.contains(index) }
        }

        guard let l1 = owner(line1Start), let l2 = owner(line2Start),
              let l3 = owner(line3Start), let l4 = owner(line4Start) else { return false }

        let distinctBodies = Set([l1, l2, l3, l4]).count == 4
        let bodyEndsStayPut = owner(line1End) == l1
            && owner(line2End) == l2
            && owner(line3End) == l3
            && owner(line4End) == l4
        let line1Satellites = owner(upperLimit) == l1
            && owner(lowerLimit) == l1
            && owner(exponent2) == l1
        let line2Satellites = owner(exponent3) == l2
            && owner(exponent2b) == l2
            && owner(evalUpper) == l2
            && owner(evalLower) == l2
        let line3Satellite = owner(line3Power) == l3

        return distinctBodies && bodyEndsStayPut
            && line1Satellites && line2Satellites && line3Satellite
    }

    static func assertProductionInvariants() {
        let legacy = legacyDetachedPowerInvariant()
        let twoLine = twoLargeSuperscriptsInvariant()
        let calculus = calculusLimitsAndBoundsInvariant()
        let ok = legacy && twoLine && calculus

        NSLog(
            "PRIINK segmentation satellite=%@ legacy=%@ twoLargePowers=%@ calculusLimits=%@",
            ok ? "PASS" : "FAIL",
            legacy ? "yes" : "NO",
            twoLine ? "yes" : "NO",
            calculus ? "yes" : "NO"
        )
        precondition(ok,
            "Native handwriting line segmentation violated 2D maths / line separation invariant")
    }
}
