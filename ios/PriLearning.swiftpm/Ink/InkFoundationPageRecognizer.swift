// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Foundation-model page recogniser
//
// Converts one-pass PriInkFoundation predictions into the same Reading contract
// used by the rest of the product. Model text and Pencil ownership are kept as
// separate facts: structural tokens inserted by the model (for example the
// parentheses around a stacked fraction) do not get falsely attributed to a
// physical stroke just to make the arrays line up.
// ─────────────────────────────────────────────────────────────────────────────
import CoreGraphics
import Foundation

final class InkFoundationPageRecognizer {
    private let runtime = InkFoundationRuntime()

    var isAvailable: Bool { runtime.isAvailable }

    func read(strokes: [InkStroke], overrides: [String: String]) -> Reading? {
        guard runtime.isAvailable else { return nil }
        let live = strokes.filter { !$0.isEmpty }
        guard !live.isEmpty else {
            return Reading(lines: [], text: "", minConfidence: 1, margin: 1, weakest: nil)
        }

        let pageGlyph = InkLineSegmenter.pageGlyphSize(strokes)
        let fractions = FractionFinder.find(in: strokes, pageGlyph: pageGlyph)
        let consumed = Set(fractions.flatMap(\.allStrokeIndexes))
        let masked = strokes.enumerated().map { index, stroke in
            consumed.contains(index) ? InkStroke(points: []) : stroke
        }
        var lines = InkLineSegmenter.segment(masked)

        // A page containing only a stacked fraction has no baseline line after
        // masking. Give it a logical band so the block is still read as one
        // expression rather than disappearing.
        if lines.isEmpty, let block = fractions.first {
            lines = [InkLine(
                strokeIndexes: [], strokes: [], bounds: block.bounds,
                band: block.bounds.minY...block.bounds.maxY,
                glyphHeight: pageGlyph
            )]
        }

        var output: [ReadingLine] = []
        for (lineIndex, line) in lines.enumerated() {
            let blocks = fractions.filter { block in
                let y = block.bar.midY
                return y >= line.band.lowerBound - line.glyphHeight
                    && y <= line.band.upperBound + line.glyphHeight
            }
            var indexes = Set(line.strokeIndexes)
            for block in blocks { indexes.formUnion(block.allStrokeIndexes) }
            let ordered = indexes.sorted()
            guard !ordered.isEmpty else { continue }
            let members = ordered.compactMap { strokes.indices.contains($0) ? strokes[$0] : nil }
            guard let prediction = runtime.predict(strokes: members) else { return nil }
            output.append(readLine(
                prediction: prediction,
                lineIndex: lineIndex,
                strokeIndexes: ordered,
                strokes: strokes,
                glyphHeight: max(line.glyphHeight, pageGlyph * 0.65),
                overrides: overrides
            ))
        }
        return summarise(output)
    }

    private func readLine(
        prediction: InkFoundationPrediction,
        lineIndex: Int,
        strokeIndexes: [Int],
        strokes: [InkStroke],
        glyphHeight: CGFloat,
        overrides: [String: String]
    ) -> ReadingLine {
        var tokens = Self.tokens(of: prediction.text)
        let marks = clusters(of: strokeIndexes, strokes: strokes).map {
            InkSpatialMark(strokeIndexes: $0.strokeIndexes, bounds: $0.bounds, isRaised: $0.isRaised)
        }

        let alignment = InkSymbolAligner.align(
            symbols: tokens,
            agreement: prediction.agreement,
            marks: marks,
            strokes: strokes,
            glyphHeight: glyphHeight
        )

        var symbols: [ReadingSymbol] = []
        for position in tokens.indices {
            let id = "f\(lineIndex)_\(position)"
            if let chosen = overrides[id] { tokens[position] = chosen }

            // A model may insert structural notation that has no single physical
            // mark. It remains part of line.text but is deliberately absent from
            // the correction/training symbol list: learning from guessed stroke
            // ownership is how recognisers poison their own personalisation data.
            guard position < alignment.symbolToMark.count,
                  let markIndex = alignment.symbolToMark[position],
                  marks.indices.contains(markIndex) else { continue }
            let mark = marks[markIndex]
            let candidates = prediction.agreement[position] ?? [:]
            let original = Self.tokens(of: prediction.text)[position]
            let modelConfidence = candidates[original] ?? prediction.confidence
            let confidence = overrides[id] == nil ? modelConfidence : 1.0
            var alternatives = candidates
                .sorted { $0.value > $1.value }
                .map { (symbol: $0.key, confidence: $0.value) }
            if !alternatives.contains(where: { $0.symbol == tokens[position] }) {
                alternatives.insert((tokens[position], confidence), at: 0)
            }
            symbols.append(ReadingSymbol(
                id: id,
                symbol: tokens[position],
                confidence: confidence,
                alternatives: alternatives,
                box: mark.bounds,
                strokeIndexes: mark.strokeIndexes,
                approximate: alignment.approximateSymbols.contains(position)
            ))
        }

        let box: CGRect
        if let first = strokeIndexes.first, strokes.indices.contains(first) {
            box = strokeIndexes.dropFirst().reduce(strokes[first].bounds) { partial, index in
                strokes.indices.contains(index) ? partial.union(strokes[index].bounds) : partial
            }
        } else {
            box = .zero
        }
        return ReadingLine(
            text: tokens.joined(), box: box, symbols: symbols,
            strokeIndexes: strokeIndexes, unread: false
        )
    }

    // MARK: - Spatial marks

    private struct Cluster {
        var strokeIndexes: [Int]
        var bounds: CGRect
        var isRaised: Bool
    }

    private func clusters(of indexes: [Int], strokes: [InkStroke]) -> [Cluster] {
        let ordered = indexes
            .filter { strokes.indices.contains($0) && !strokes[$0].isEmpty }
            .sorted { strokes[$0].bounds.minX < strokes[$1].bounds.minX }
        guard !ordered.isEmpty else { return [] }

        var result: [Cluster] = []
        for index in ordered {
            let bounds = strokes[index].bounds
            if var last = result.last {
                let overlap = min(bounds.maxX, last.bounds.maxX) - max(bounds.minX, last.bounds.minX)
                let reference = max(min(bounds.width, last.bounds.width), 1)
                let centreInside = bounds.midX >= last.bounds.minX && bounds.midX <= last.bounds.maxX
                if overlap >= 0.32 * reference || centreInside {
                    last.strokeIndexes.append(index)
                    last.bounds = last.bounds.union(bounds)
                    result[result.count - 1] = last
                    continue
                }
            }
            result.append(Cluster(strokeIndexes: [index], bounds: bounds, isRaised: false))
        }

        let sizes = result.map { max($0.bounds.width, $0.bounds.height) }.sorted()
        let typical = sizes.isEmpty ? 24 : max(8, sizes[sizes.count / 2])
        let ordinary = result.filter { $0.bounds.height >= 0.35 * typical }
        if ordinary.count >= 2 {
            let tops = ordinary.map { $0.bounds.minY }.sorted()
            let bottoms = ordinary.map { $0.bounds.maxY }.sorted()
            let top = tops[tops.count / 2]
            let body = max(1, bottoms[bottoms.count / 2] - top)
            for i in result.indices where i > 0 {
                let b = result[i].bounds
                result[i].isRaised = b.midY < top + 0.35 * body
                    && b.maxY < top + 0.72 * body
                    && b.height < 0.80 * body
            }
        }
        return result
    }

    // The vocabulary emits these as one output token. All other maths is one
    // character per output slot, including function names (s-i-n, c-o-s, ...).
    private static let compound = ["theta", "sqrt", "pi", "<=", ">=", "!="]

    private static func tokens(of text: String) -> [String] {
        let raw = text.replacingOccurrences(of: " ", with: "")
        var out: [String] = []
        var i = raw.startIndex
        while i < raw.endIndex {
            var matched: String?
            for token in compound where raw[i...].hasPrefix(token) {
                matched = token; break
            }
            if let token = matched {
                out.append(token)
                i = raw.index(i, offsetBy: token.count)
            } else {
                out.append(String(raw[i]))
                i = raw.index(after: i)
            }
        }
        return out
    }

    // MARK: - Confidence contract

    private func summarise(_ lines: [ReadingLine]) -> Reading {
        guard !lines.isEmpty else {
            return Reading(lines: [], text: "", minConfidence: 1, margin: 1, weakest: nil)
        }
        var minimum = 1.0
        var margin = 1.0
        var weakest: (id: String, index: Int, symbol: String, confidence: Double,
                      alternatives: [(symbol: String, confidence: Double)])?
        var globalIndex = 0
        for line in lines {
            for symbol in line.symbols {
                let rival = symbol.alternatives
                    .filter { $0.symbol != symbol.symbol }
                    .map(\.confidence).max() ?? 0
                minimum = min(minimum, symbol.confidence)
                margin = min(margin, max(0, symbol.confidence - rival))
                if weakest == nil || symbol.confidence < weakest!.confidence {
                    weakest = (symbol.id, globalIndex, symbol.symbol, symbol.confidence, symbol.alternatives)
                }
                globalIndex += 1
            }
        }
        return Reading(
            lines: lines,
            text: lines.map(\.text).joined(separator: "\n"),
            minConfidence: minimum,
            margin: margin,
            weakest: weakest
        )
    }
}
