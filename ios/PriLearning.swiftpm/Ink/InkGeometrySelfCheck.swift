// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Deterministic geometry regression checks
//
// These checks exercise the small, stroke-based maths classifiers without
// involving Vision. That makes failures attributable: a Vision model revision
// cannot hide a regression in our own geometry or uncertainty logic.
// ─────────────────────────────────────────────────────────────────────────────
import CoreGraphics
import Foundation

enum InkGeometrySelfCheck {

    static func run() {
        var failures: [String] = []
        var checks = 0

        func check(_ name: String, _ condition: @autoclosure () -> Bool) {
            checks += 1
            if !condition() { failures.append(name) }
        }

        let down = stroke([(8, 8), (20, 20), (32, 32)])
        let up = stroke([(8, 32), (20, 20), (32, 8)])
        var crossed = [glyph("4", strokes: [0, 1], box: down.bounds.union(up.bounds))]
        MathShapeClassifier.repair(&crossed, strokes: [down, up], glyphHeight: 40)
        check("diagonal cross recovers x-shaped mark", crossed[0].symbol == "*")

        // Real-device failure: Vision called one two-stroke x `21`. Two OCR
        // characters must not survive when the physical trace proves one
        // crossed mark.
        let crossBox = down.bounds.union(up.bounds)
        var duplicatedCross = [
            glyph("2", strokes: [0, 1], box: CGRect(x: crossBox.minX, y: crossBox.minY,
                                                     width: crossBox.width / 2, height: crossBox.height),
                  approximate: true),
            glyph("1", strokes: [0, 1], box: CGRect(x: crossBox.midX, y: crossBox.minY,
                                                     width: crossBox.width / 2, height: crossBox.height),
                  approximate: true)
        ]
        MathShapeClassifier.repair(&duplicatedCross, strokes: [down, up], glyphHeight: 40)
        check("OCR 21 over one crossed x collapses to one x-shaped mark",
              duplicatedCross.count == 1 && duplicatedCross[0].symbol == "*")

        let vertical = stroke([(20, 5), (20, 20), (20, 35)])
        let horizontal = stroke([(5, 20), (20, 20), (35, 20)])
        var plus = [glyph("4", strokes: [0, 1], box: vertical.bounds.union(horizontal.bounds))]
        MathShapeClassifier.repair(&plus, strokes: [vertical, horizontal], glyphHeight: 40)
        check("axis-aligned cross recovers plus", plus[0].symbol == "+")

        let loop = stroke([
            (20, 5), (29, 8), (35, 16), (36, 25), (31, 34), (21, 38),
            (12, 34), (6, 25), (7, 15), (12, 8), (20, 5)
        ])
        let thetaBar = stroke([(8, 22), (20, 21.5), (34, 21)])
        var theta = [glyph("0", strokes: [0, 1], box: loop.bounds.union(thetaBar.bounds))]
        MathShapeClassifier.repair(&theta, strokes: [loop, thetaBar], glyphHeight: 40)
        check("oval plus internal bar recovers theta", theta[0].symbol == "theta")

        var zero = [glyph("0", strokes: [0], box: loop.bounds)]
        MathShapeClassifier.repair(&zero, strokes: [loop], glyphHeight: 40)
        check("plain zero remains zero", zero[0].symbol == "0")

        let yArm = stroke([(8, 8), (16, 18), (22, 26)])
        let yDescender = stroke([(34, 8), (28, 20), (23, 32), (19, 44), (15, 58)])
        var y = [glyph("1", strokes: [0, 1], box: yArm.bounds.union(yDescender.bounds))]
        MathShapeClassifier.repair(&y, strokes: [yArm, yDescender], glyphHeight: 50)
        check("two arms plus descender recovers y from 1", y[0].symbol == "y")

        var variableContext = [
            glyph("2", strokes: [], box: CGRect(x: 0, y: 0, width: 8, height: 16)),
            glyph("*", strokes: [], box: CGRect(x: 10, y: 0, width: 12, height: 16)),
            glyph("y", strokes: [], box: CGRect(x: 24, y: 0, width: 10, height: 16))
        ]
        MathDecoder.applyContext(&variableContext, locked: [])
        check("x-shaped mark in algebraic context becomes variable x", variableContext[1].symbol == "x")

        var multiplyContext = [
            glyph("2", strokes: [], box: CGRect(x: 0, y: 0, width: 8, height: 16)),
            glyph("*", strokes: [], box: CGRect(x: 10, y: 0, width: 12, height: 16)),
            glyph("3", strokes: [], box: CGRect(x: 24, y: 0, width: 8, height: 16))
        ]
        MathDecoder.applyContext(&multiplyContext, locked: [])
        check("digit cross digit remains multiplication", multiplyContext[1].symbol == "*")

        var ambiguous = [
            glyph("1", strokes: [], box: CGRect(x: 0, y: 0, width: 5, height: 16), confidence: 0.96),
            glyph("=", strokes: [], box: CGRect(x: 8, y: 4, width: 10, height: 8)),
            glyph("3", strokes: [], box: CGRect(x: 22, y: 0, width: 8, height: 16))
        ]
        MathDecoder.applyContext(&ambiguous, locked: [])
        check("ambiguous lhs 1 surfaces y alternative",
              ambiguous[0].alternatives.contains(where: { $0.symbol == "y" }) && ambiguous[0].confidence <= 0.78)

        // Reproduce the architectural failure mode behind `sin(x)=1 → sin(x1`:
        // approximate OCR ownership must never block stronger stroke evidence.
        let first = stroke([(5, 5), (5, 35)])
        let eqTop = stroke([(20, 15), (34, 15)])
        let eqBottom = stroke([(20, 23), (34, 23)])
        let finalOne = stroke([(47, 5), (47, 35)])
        var missing = [
            glyph("x", strokes: [0], box: first.bounds, approximate: true),
            glyph("1", strokes: [1, 2], box: eqTop.bounds.union(eqBottom.bounds), approximate: true),
            glyph("?", strokes: [3], box: finalOne.bounds, approximate: true)
        ]
        MathShapeClassifier.repair(&missing, strokes: [first, eqTop, eqBottom, finalOne], glyphHeight: 40)
        check("approximate layout re-anchors swallowed equals", missing.contains(where: { $0.symbol == "=" }))
        check("approximate ownership cannot hide trailing one after equals",
              missing.sorted(by: { $0.box.midX < $1.box.midX }).suffix(2).map(\.symbol) == ["=", "1"])

        // The aligner may do the right thing and drop every bad OCR symbol. The
        // remaining glyphs are then exact, but real trailing ink still exists.
        var exactSurvivor = [glyph("x", strokes: [0], box: first.bounds)]
        MathShapeClassifier.repair(&exactSurvivor,
                                   strokes: [first, eqTop, eqBottom, finalOne], glyphHeight: 40)
        check("exact survivors still recover unexplained trailing equals and one",
              exactSurvivor.sorted(by: { $0.box.midX < $1.box.midX }).map(\.symbol) == ["x", "=", "1"])

        // Exact real-iPad segmentation failure: two handwritten algebra lines,
        // first containing x². The raised 2 must remain on line one instead of
        // becoming a phantom third recognition line.
        let l1EqTop = stroke([(0, 38), (14, 38)])
        let l1EqBottom = stroke([(0, 44), (14, 44)])
        let l1XDown = stroke([(20, 30), (27, 40), (34, 50)])
        let l1XUp = stroke([(20, 50), (27, 40), (34, 30)])
        let l1Power = stroke([(37, 26), (41, 18), (45, 22), (38, 28), (46, 28)])
        let l1Minus = stroke([(52, 42), (67, 42)])
        let l2EqTop = stroke([(0, 88), (14, 88)])
        let l2EqBottom = stroke([(0, 94), (14, 94)])
        let l2XDown = stroke([(20, 80), (27, 90), (34, 100)])
        let l2XUp = stroke([(20, 100), (27, 90), (34, 80)])
        let segmented = InkLineSegmenter.segment([
            l1EqTop, l1EqBottom, l1XDown, l1XUp, l1Power, l1Minus,
            l2EqTop, l2EqBottom, l2XDown, l2XUp
        ])
        let topLine = segmented.min { $0.band.lowerBound < $1.band.lowerBound }
        check("raised power stays on its base line",
              segmented.count == 2 && topLine?.strokeIndexes.contains(4) == true)

        if failures.isEmpty {
            NSLog("PRIINK geometry PASS %d/%d", checks, checks)
        } else {
            NSLog("PRIINK geometry FAIL %d/%d: %@", checks - failures.count, checks,
                  failures.joined(separator: ", ") as NSString)
        }
    }

    private static func glyph(
        _ symbol: String,
        strokes: [Int],
        box: CGRect,
        confidence: Double = 0.7,
        approximate: Bool = false
    ) -> DecodedGlyph {
        DecodedGlyph(symbol: symbol, box: box, confidence: confidence,
                     alternatives: [], isSuperscript: false,
                     strokeIndexes: strokes, approximate: approximate)
    }

    private static func stroke(_ tuples: [(CGFloat, CGFloat)]) -> InkStroke {
        InkStroke(points: tuples.map { InkPoint(x: $0.0, y: $0.1, w: 3) })
    }
}
