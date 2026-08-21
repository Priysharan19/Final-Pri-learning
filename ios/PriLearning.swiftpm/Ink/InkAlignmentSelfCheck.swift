// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Trace alignment regression checks
//
// These are independent of Vision. They prove that the ownership layer behaves
// correctly when OCR and ink disagree — the cases proportional interpolation
// cannot represent safely.
// ─────────────────────────────────────────────────────────────────────────────
import CoreGraphics
import Foundation

enum InkAlignmentSelfCheck {

    static func run() {
        var failures: [String] = []
        var checks = 0

        func check(_ name: String, _ condition: @autoclosure () -> Bool) {
            checks += 1
            if !condition() { failures.append(name) }
        }

        let xA = stroke([(4, 6), (14, 16), (24, 26)])
        let xB = stroke([(4, 26), (14, 16), (24, 6)])
        let eqA = stroke([(36, 12), (58, 12)])
        let eqB = stroke([(36, 20), (58, 20)])
        let one = stroke([(74, 5), (74, 30)])
        let strokes = [xA, xB, eqA, eqB, one]
        let marks = [
            mark([0, 1], strokes),
            mark([2, 3], strokes),
            mark([4], strokes)
        ]

        // OCR omitted the final 1. The aligner must not stretch '=' onto the
        // final vertical stroke; that ink remains available for recovery.
        let omitted = InkSymbolAligner.align(
            symbols: ["x", "="], agreement: [:], marks: marks,
            strokes: strokes, glyphHeight: 36
        )
        check("omitted trailing mark stays unmatched",
              omitted.symbolToMark == [0, 1] && omitted.unmatchedMarks == Set([2]))

        // OCR called the equals a 1. Geometry should place the reported 1 on
        // the actual vertical mark and leave the equals unexplained, rather
        // than claiming the two horizontal strokes belong to the digit.
        let wrongMiddle = InkSymbolAligner.align(
            symbols: ["x", "1"], agreement: [1: ["1": 0.85]], marks: marks,
            strokes: strokes, glyphHeight: 36
        )
        check("vertical digit outranks equals for 1 ownership",
              wrongMiddle.symbolToMark[1] == 2 && wrongMiddle.unmatchedMarks.contains(1))

        // OCR duplicated a final digit. Exactly one of the duplicates may own
        // the real Pencil mark; the other must remain ownerless.
        let duplicate = InkSymbolAligner.align(
            symbols: ["x", "=", "1", "1"], agreement: [:], marks: marks,
            strokes: strokes, glyphHeight: 36
        )
        let finalOwners = duplicate.symbolToMark.suffix(2).compactMap { $0 }
        check("hallucinated duplicate symbol is not given fake ink",
              finalOwners.count == 1 && finalOwners.first == 2)

        let dot = stroke([(8, 8), (8.4, 8.2)])
        let tall = stroke([(26, 2), (26, 30)])
        let dotStrokes = [dot, tall]
        let dotMarks = [mark([0], dotStrokes), mark([1], dotStrokes)]
        let punctuation = InkSymbolAligner.align(
            symbols: [".", "1"], agreement: [:], marks: dotMarks,
            strokes: dotStrokes, glyphHeight: 34
        )
        check("dot geometry anchors punctuation",
              punctuation.symbolToMark == [0, 1])

        // Joined cursive-ish letters can share one wide mark. The aligner must
        // preserve both OCR symbols and flag their ownership as approximate.
        let joined = stroke([(2, 18), (10, 6), (18, 18), (26, 6), (36, 18), (46, 8)])
        let joinedStrokes = [joined]
        let joinedMarks = [mark([0], joinedStrokes)]
        let shared = InkSymbolAligner.align(
            symbols: ["s", "i"], agreement: [:], marks: joinedMarks,
            strokes: joinedStrokes, glyphHeight: 34
        )
        check("two OCR symbols can share joined ink",
              shared.symbolToMark == [0, 0]
                && shared.approximateSymbols == Set([0, 1]))

        // Exact clean alignment should remain trusted; the new architecture
        // must not turn every ordinary glyph into an approximate correction.
        let exact = InkSymbolAligner.align(
            symbols: ["x", "=", "1"], agreement: [:], marks: marks,
            strokes: strokes, glyphHeight: 36
        )
        check("clean exact alignment remains fully owned",
              exact.symbolToMark == [0, 1, 2]
                && exact.unmatchedMarks.isEmpty
                && exact.approximateSymbols.isEmpty)

        if failures.isEmpty {
            NSLog("PRIINK alignment PASS %d/%d", checks, checks)
        } else {
            NSLog("PRIINK alignment FAIL %d/%d: %@", checks - failures.count, checks,
                  failures.joined(separator: ", ") as NSString)
        }
    }

    private static func mark(_ indexes: [Int], _ strokes: [InkStroke]) -> InkSpatialMark {
        let boxes = indexes.map { strokes[$0].bounds }
        let box = boxes.dropFirst().reduce(boxes[0]) { $0.union($1) }
        return InkSpatialMark(strokeIndexes: indexes, bounds: box, isRaised: false)
    }

    private static func stroke(_ tuples: [(CGFloat, CGFloat)]) -> InkStroke {
        InkStroke(points: tuples.enumerated().map { index, p in
            InkPoint(x: p.0, y: p.1, w: 3, t: Double(index) * 0.008)
        })
    }
}
