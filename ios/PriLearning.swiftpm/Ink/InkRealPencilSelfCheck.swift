// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Real-iPad failure regression checks
//
// These deterministic checks encode the structural facts exposed by the first
// physical Apple Pencil screenshot we received. They do not pretend to measure
// real-writer accuracy; they prevent the software from reintroducing the exact
// failure mechanics that turned
//
//     = x² - 36
//     = (x - 6)(x + 6)
//
// into a phantom third line and leading-minus / duplicated-x OCR artefacts.
// ─────────────────────────────────────────────────────────────────────────────
import CoreGraphics
import Foundation

enum InkRealPencilSelfCheck {
    static func run() {
        var failures: [String] = []
        var checks = 0

        func check(_ name: String, _ condition: @autoclosure () -> Bool) {
            checks += 1
            if !condition() { failures.append(name) }
        }

        func stroke(_ points: [(CGFloat, CGFloat)]) -> InkStroke {
            InkStroke(points: points.map { InkPoint(x: $0.0, y: $0.1, w: 3) })
        }

        // Two ordinary baselines with one compact raised mark beside the first
        // line. The exponent is deliberately high enough that centre-distance
        // grouping would be tempted to make it a separate line.
        let firstXDown = stroke([(30, 52), (41, 64), (52, 77)])
        let firstXUp = stroke([(30, 77), (41, 64), (52, 52)])
        let raisedTwo = stroke([(60, 34), (67, 27), (75, 30), (72, 37), (62, 44), (77, 44)])
        let firstMinus = stroke([(88, 65), (110, 65)])
        let firstDigit = stroke([(124, 51), (124, 78)])

        let secondLeft = stroke([(30, 150), (42, 162), (54, 176)])
        let secondRight = stroke([(30, 176), (42, 162), (54, 150)])
        let secondMinus = stroke([(88, 164), (110, 164)])
        let secondDigit = stroke([(124, 150), (124, 177)])

        let page = [
            firstXDown, firstXUp, raisedTwo, firstMinus, firstDigit,
            secondLeft, secondRight, secondMinus, secondDigit
        ]
        let lines = InkLineSegmenter.segment(page)
        check("screenshot-style page stays two written lines", lines.count == 2)
        if lines.count == 2 {
            check("raised exponent stays attached to first line",
                  lines[0].strokeIndexes.contains(2))
            check("raised exponent never becomes its own line",
                  !lines[1].strokeIndexes.contains(2))
        } else {
            check("raised exponent stays attached to first line", false)
            check("raised exponent never becomes its own line", false)
        }

        // A student's continuation line beginning '=' is ordinary working. The
        // grammar must not reward the screenshot's false leading-minus reading.
        check("continuation equals outranks false leading minus",
              MathGrammar.score("=x^(2)-36") > MathGrammar.score("-n-36"))
        check("factored continuation equals outranks false leading minus",
              MathGrammar.score("=(x-6)(x+6)") > MathGrammar.score("-(2-6)(21-6)"))

        // Recreate an OCR omission of the leading '='. Only x is represented in
        // the OCR glyph list; the real two horizontal Pencil traces remain to
        // its left. Structural recovery must restore '=' from those traces.
        let eqTop = stroke([(4, 57), (23, 57)])
        let eqBottom = stroke([(4, 69), (23, 69)])
        let xDown = stroke([(42, 50), (53, 63), (64, 78)])
        let xUp = stroke([(42, 78), (53, 63), (64, 50)])
        let structuralStrokes = [eqTop, eqBottom, xDown, xUp]
        var glyphs = [
            DecodedGlyph(
                symbol: "x",
                box: xDown.bounds.union(xUp.bounds),
                confidence: 0.82,
                alternatives: [],
                isSuperscript: false,
                strokeIndexes: [2, 3],
                approximate: false
            )
        ]
        MathShapeClassifier.repair(&glyphs, strokes: structuralStrokes, glyphHeight: 40)
        glyphs.sort { $0.box.midX < $1.box.midX }
        check("omitted leading equals is recovered from two Pencil bars",
              glyphs.first?.symbol == "=" && glyphs.contains(where: { $0.symbol == "*" || $0.symbol == "x" }))

        if failures.isEmpty {
            NSLog("PRIINK real-pencil PASS %d/%d", checks, checks)
        } else {
            NSLog("PRIINK real-pencil FAIL %d/%d: %@",
                  checks - failures.count, checks,
                  failures.joined(separator: ", ") as NSString)
        }
    }
}
