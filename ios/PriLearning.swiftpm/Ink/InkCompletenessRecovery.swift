// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · no-disappeared-ink recovery
//
// Whole-line Vision is valuable for context, but it is allowed to omit marks.
// Mathematical ink is not prose: every real Pencil cluster is evidence and may
// not silently disappear just because OCR returned fewer characters than there
// are marks. This pass runs only after the native reader has produced a line.
//
// For each line it:
//   1. corrects only geometry-proven structural confusions on existing owners;
//   2. finds Pencil strokes that no visible symbol owns;
//   3. groups those strokes into spatial marks;
//   4. uses decisive geometry first, then isolated on-device Vision;
//   5. emits an explicit low-confidence '?' if neither can identify the mark.
//
// Thus uncertainty is visible and safe; written work never vanishes silently.
// ─────────────────────────────────────────────────────────────────────────────
import CoreGraphics
import Foundation
import Vision

private struct InkRecoveryCluster {
    var strokeIndexes: [Int]
    var bounds: CGRect
}

private struct InkRecoveryCandidate {
    var symbol: String
    var confidence: Double
    var alternatives: [(symbol: String, confidence: Double)]
    var approximate: Bool
}

enum InkCompletenessRecovery {

    static func recover(_ reading: Reading, strokes: [InkStroke]) -> Reading {
        guard !reading.lines.isEmpty else { return reading }
        var lines = reading.lines
        for index in lines.indices {
            lines[index] = recoverLine(lines[index], lineIndex: index, strokes: strokes)
        }
        return summarise(lines)
    }

    private static func recoverLine(
        _ line: ReadingLine,
        lineIndex: Int,
        strokes: [InkStroke]
    ) -> ReadingLine {
        let validIndexes = line.strokeIndexes.filter {
            strokes.indices.contains($0) && !strokes[$0].isEmpty
        }
        guard !validIndexes.isEmpty else { return line }

        let lineStrokes = validIndexes.map { strokes[$0] }
        let glyphHeight = InkLineSegmenter.pageGlyphSize(lineStrokes)
        var symbols = line.symbols
        var changed = false

        // A symbol that already owns real ink can still be wrong. Only replace
        // it when Pencil geometry is independently decisive (plus/equals/etc.).
        for i in symbols.indices {
            let owned = symbols[i].strokeIndexes.compactMap {
                strokes.indices.contains($0) ? strokes[$0] : nil
            }
            guard !owned.isEmpty,
                  let structural = structuralCandidate(owned, glyphHeight: glyphHeight),
                  structural.symbol != symbols[i].symbol else { continue }
            let old = symbols[i].symbol
            symbols[i].alternatives = adding(
                old,
                confidence: symbols[i].confidence,
                to: structural.alternatives + symbols[i].alternatives
            )
            symbols[i].symbol = structural.symbol
            symbols[i].confidence = max(symbols[i].confidence, structural.confidence)
            symbols[i].approximate = false
            changed = true
        }

        let ownedIndexes = Set(symbols.flatMap(\.strokeIndexes))
        let missingIndexes = validIndexes.filter { !ownedIndexes.contains($0) }
        let missingClusters = clusters(indexes: missingIndexes, strokes: strokes)

        for cluster in missingClusters {
            let members = cluster.strokeIndexes.map { strokes[$0] }
            let candidate = structuralCandidate(members, glyphHeight: glyphHeight)
                ?? isolatedVisionCandidate(members, glyphHeight: glyphHeight)
                ?? InkRecoveryCandidate(
                    symbol: "?",
                    confidence: 0,
                    alternatives: [],
                    approximate: true
                )

            symbols.append(ReadingSymbol(
                id: "n\(lineIndex)_recovered_\(symbols.count)",
                symbol: candidate.symbol,
                confidence: candidate.confidence,
                alternatives: candidate.alternatives,
                box: cluster.bounds,
                strokeIndexes: cluster.strokeIndexes.sorted(),
                approximate: candidate.approximate
            ))
            changed = true
        }

        guard changed else { return line }

        symbols.sort {
            if abs($0.box.midX - $1.box.midX) > 0.5 { return $0.box.midX < $1.box.midX }
            return $0.box.midY < $1.box.midY
        }

        var glyphs = decodedGlyphs(from: symbols, glyphHeight: glyphHeight)
        MathDecoder.repairBrackets(&glyphs, strokes: strokes, glyphHeight: glyphHeight)
        var locked = Set(glyphs.indices.filter { glyphs[$0].confidence >= 0.995 })
        locked.formUnion(MathDecoder.lockFunctionNames(&glyphs))
        MathDecoder.applyContext(&glyphs, locked: locked)

        var radicalSpans: [Int: CGFloat] = [:]
        for (i, glyph) in glyphs.enumerated() where glyph.symbol == "sqrt" {
            let ink = glyph.strokeIndexes.compactMap {
                strokes.indices.contains($0) ? strokes[$0].bounds : nil
            }
            if let span = ink.dropFirst().reduce(ink.first) { $0?.union($1) },
               span.width > glyph.box.width * 0.8 {
                radicalSpans[i] = span.maxX
            }
        }

        let text = MathDecoder.assemble(glyphs, radicalSpans: radicalSpans)
        let rebuiltSymbols = glyphs.enumerated().map { i, glyph in
            ReadingSymbol(
                id: "n\(lineIndex)_\(i)",
                symbol: glyph.symbol,
                confidence: glyph.confidence,
                alternatives: glyph.alternatives,
                box: glyph.box,
                strokeIndexes: glyph.strokeIndexes,
                approximate: glyph.approximate
            )
        }
        let box = rebuiltSymbols.isEmpty
            ? line.box
            : rebuiltSymbols.dropFirst().reduce(rebuiltSymbols[0].box) { $0.union($1.box) }

        if MathInkRecognizer.trace {
            let remaining = Set(validIndexes).subtracting(Set(rebuiltSymbols.flatMap(\.strokeIndexes)))
            NSLog(
                "PRIINK completeness line=%d inputStrokes=%d recoveredClusters=%d remainingUnowned=%d text=%@",
                lineIndex, validIndexes.count, missingClusters.count, remaining.count, text as NSString
            )
        }

        return ReadingLine(
            text: text,
            box: box,
            symbols: rebuiltSymbols,
            strokeIndexes: line.strokeIndexes,
            unread: rebuiltSymbols.isEmpty
        )
    }

    // MARK: - Spatial marks

    private static func clusters(indexes: [Int], strokes: [InkStroke]) -> [InkRecoveryCluster] {
        let ordered = indexes
            .filter { strokes.indices.contains($0) && !strokes[$0].isEmpty }
            .sorted { strokes[$0].bounds.minX < strokes[$1].bounds.minX }
        guard !ordered.isEmpty else { return [] }

        var result: [InkRecoveryCluster] = []
        for index in ordered {
            let box = strokes[index].bounds
            if var last = result.last {
                let xOverlap = min(box.maxX, last.bounds.maxX) - max(box.minX, last.bounds.minX)
                let xRef = max(min(box.width, last.bounds.width), 1)
                let yOverlap = min(box.maxY, last.bounds.maxY) - max(box.minY, last.bounds.minY)
                let yRef = max(min(box.height, last.bounds.height), 1)
                let centreXInside = box.midX >= last.bounds.minX && box.midX <= last.bounds.maxX
                // Unlike the old glyph grouper, x overlap alone is not enough:
                // an integral's upper and lower limits can share the same x.
                // Real multi-stroke glyphs overlap in x AND occupy compatible y.
                let sameVerticalBand = yOverlap >= -0.28 * max(box.height, last.bounds.height)
                    || yOverlap >= 0.18 * yRef
                if (xOverlap >= 0.28 * xRef || centreXInside) && sameVerticalBand {
                    last.strokeIndexes.append(index)
                    last.bounds = last.bounds.union(box)
                    result[result.count - 1] = last
                    continue
                }
            }
            result.append(InkRecoveryCluster(strokeIndexes: [index], bounds: box))
        }
        return result
    }

    // MARK: - Decisive Pencil geometry

    private static func structuralCandidate(
        _ members: [InkStroke],
        glyphHeight: CGFloat
    ) -> InkRecoveryCandidate? {
        guard !members.isEmpty else { return nil }
        let box = members.dropFirst().reduce(members[0].bounds) { $0.union($1.bounds) }

        if isEquals(members, glyphHeight: glyphHeight) {
            return InkRecoveryCandidate(symbol: "=", confidence: 0.96,
                                        alternatives: [("-", 0.08)], approximate: false)
        }
        if isPlus(members, glyphHeight: glyphHeight) {
            return InkRecoveryCandidate(symbol: "+", confidence: 0.95,
                                        alternatives: [("t", 0.10)], approximate: false)
        }
        if isDiagonalCross(members, glyphHeight: glyphHeight) {
            return InkRecoveryCandidate(symbol: "*", confidence: 0.93,
                                        alternatives: [("x", 0.28)], approximate: false)
        }
        if members.count == 1, isHorizontal(members[0]), box.width >= 0.24 * glyphHeight {
            return InkRecoveryCandidate(symbol: "-", confidence: 0.92,
                                        alternatives: [("_", 0.10)], approximate: false)
        }
        if max(box.width, box.height) <= max(4, 0.19 * glyphHeight) {
            return InkRecoveryCandidate(symbol: ".", confidence: 0.88,
                                        alternatives: [("°", 0.12)], approximate: false)
        }
        return nil
    }

    private static func isEquals(_ strokes: [InkStroke], glyphHeight: CGFloat) -> Bool {
        guard strokes.count == 2, isHorizontal(strokes[0]), isHorizontal(strokes[1]) else { return false }
        let a = strokes[0].bounds, b = strokes[1].bounds
        let narrow = min(a.width, b.width)
        let wide = max(a.width, b.width)
        let overlap = min(a.maxX, b.maxX) - max(a.minX, b.minX)
        let separation = abs(a.midY - b.midY)
        return narrow >= 0.22 * glyphHeight
            && narrow / max(wide, 1) >= 0.50
            && overlap >= 0.48 * narrow
            && separation >= 0.05 * glyphHeight
            && separation <= 0.55 * glyphHeight
    }

    private static func isPlus(_ strokes: [InkStroke], glyphHeight: CGFloat) -> Bool {
        guard strokes.count == 2 else { return false }
        for (h, v) in [(strokes[0], strokes[1]), (strokes[1], strokes[0])] {
            guard isHorizontal(h), isVertical(v) else { continue }
            let union = h.bounds.union(v.bounds)
            guard union.width >= 0.22 * glyphHeight,
                  union.height >= 0.22 * glyphHeight,
                  union.width / max(union.height, 1) >= 0.32,
                  union.width / max(union.height, 1) <= 3.0 else { continue }
            let xInside = v.bounds.midX >= h.bounds.minX - 0.10 * glyphHeight
                && v.bounds.midX <= h.bounds.maxX + 0.10 * glyphHeight
            let yInside = h.bounds.midY >= v.bounds.minY - 0.10 * glyphHeight
                && h.bounds.midY <= v.bounds.maxY + 0.10 * glyphHeight
            if xInside && yInside { return true }
        }
        return false
    }

    private static func isDiagonalCross(_ strokes: [InkStroke], glyphHeight: CGFloat) -> Bool {
        guard strokes.count == 2 else { return false }
        let a = strokes[0], b = strokes[1]
        guard isStraight(a), isStraight(b),
              let a0 = a.points.first, let a1 = a.points.last,
              let b0 = b.points.first, let b1 = b.points.last else { return false }
        let union = a.bounds.union(b.bounds)
        guard union.width >= 0.18 * glyphHeight, union.height >= 0.22 * glyphHeight else { return false }
        let adx = a1.x - a0.x, ady = a1.y - a0.y
        let bdx = b1.x - b0.x, bdy = b1.y - b0.y
        guard abs(adx) > 0.25 * abs(ady), abs(ady) > 0.25 * abs(adx),
              abs(bdx) > 0.25 * abs(bdy), abs(bdy) > 0.25 * abs(bdx),
              adx * ady * bdx * bdy < 0 else { return false }
        return segmentsIntersect(
            CGPoint(x: a0.x, y: a0.y), CGPoint(x: a1.x, y: a1.y),
            CGPoint(x: b0.x, y: b0.y), CGPoint(x: b1.x, y: b1.y)
        )
    }

    private static func isHorizontal(_ stroke: InkStroke) -> Bool {
        guard let first = stroke.points.first, let last = stroke.points.last,
              stroke.pathLength > 1 else { return false }
        let dx = last.x - first.x, dy = last.y - first.y
        let chord = hypot(dx, dy)
        return chord / stroke.pathLength >= 0.74
            && abs(dx) >= 0.84 * chord
            && abs(dy) <= 0.48 * chord
    }

    private static func isVertical(_ stroke: InkStroke) -> Bool {
        guard let first = stroke.points.first, let last = stroke.points.last,
              stroke.pathLength > 1 else { return false }
        let dx = last.x - first.x, dy = last.y - first.y
        let chord = hypot(dx, dy)
        return chord / stroke.pathLength >= 0.72
            && abs(dy) >= 0.80 * chord
            && abs(dx) <= 0.55 * chord
    }

    private static func isStraight(_ stroke: InkStroke) -> Bool {
        guard let first = stroke.points.first, let last = stroke.points.last,
              stroke.pathLength > 1 else { return false }
        return hypot(last.x - first.x, last.y - first.y) / stroke.pathLength >= 0.72
    }

    private static func segmentsIntersect(
        _ a: CGPoint, _ b: CGPoint, _ c: CGPoint, _ d: CGPoint
    ) -> Bool {
        func cross(_ p: CGPoint, _ q: CGPoint, _ r: CGPoint) -> CGFloat {
            (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
        }
        let c1 = cross(a, b, c), c2 = cross(a, b, d)
        let c3 = cross(c, d, a), c4 = cross(c, d, b)
        return c1 * c2 <= 0 && c3 * c4 <= 0
    }

    // MARK: - Isolated Vision for omitted ordinary glyphs

    private static func isolatedVisionCandidate(
        _ members: [InkStroke],
        glyphHeight: CGFloat
    ) -> InkRecoveryCandidate? {
        guard let raster = InkRasterizer.render(strokes: members, glyphHeight: max(glyphHeight, 8)) else {
            return nil
        }

        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = false
        request.recognitionLanguages = ["en-US"]
        request.revision = VNRecognizeTextRequestRevision3
        request.minimumTextHeight = 0

        let handler = VNImageRequestHandler(cgImage: raster.image, orientation: .up, options: [:])
        do { try handler.perform([request]) } catch { return nil }

        var scores: [String: Double] = [:]
        for observation in request.results ?? [] {
            for candidate in observation.topCandidates(8) {
                let canonical = canonicalSymbols(candidate.string)
                guard canonical.count == 1, let symbol = canonical.first,
                      allowedRecoveredSymbol(symbol) else { continue }
                scores[symbol] = max(scores[symbol] ?? 0, Double(candidate.confidence))
            }
        }
        guard let winner = scores.max(by: { $0.value < $1.value }), winner.value >= 0.08 else {
            return nil
        }
        let alternatives = scores
            .filter { $0.key != winner.key }
            .sorted { $0.value > $1.value }
            .prefix(5)
            .map { (symbol: $0.key, confidence: min(0.60, $0.value)) }

        // Isolated OCR deliberately never becomes high-confidence evidence. It
        // restores a missing mark; context/grammar may rerank it, and the UI can
        // ask for confirmation. Personalisation must not learn from this owner.
        return InkRecoveryCandidate(
            symbol: winner.key,
            confidence: min(0.72, max(0.18, winner.value)),
            alternatives: alternatives,
            approximate: true
        )
    }

    private static func canonicalSymbols(_ text: String) -> [String] {
        var result: [String] = []
        for character in text where !character.isWhitespace {
            let symbol = MathAlphabet.canonical[character] ?? String(character)
            if !symbol.isEmpty { result.append(symbol) }
        }
        return result
    }

    private static func allowedRecoveredSymbol(_ symbol: String) -> Bool {
        if MathAlphabet.isDigit(symbol) || MathAlphabet.isLetter(symbol) { return true }
        return Set([
            "+", "-", "=", "*", "/", "(", ")", "[", "]", ".", ",", ":",
            "<", ">", "<=", ">=", "!=", "±", "'", "%", "pi", "theta", "sqrt"
        ]).contains(symbol)
    }

    // MARK: - Reassembly

    private static func decodedGlyphs(
        from symbols: [ReadingSymbol],
        glyphHeight: CGFloat
    ) -> [DecodedGlyph] {
        let substantial = symbols.filter { $0.box.height >= 0.35 * glyphHeight }
        let tops = substantial.map(\.box.minY).sorted()
        let bottoms = substantial.map(\.box.maxY).sorted()
        let top = tops.isEmpty ? 0 : tops[tops.count / 2]
        let bodyHeight = tops.isEmpty ? max(glyphHeight, 1)
            : max(bottoms[bottoms.count / 2] - top, 1)

        return symbols.map { symbol in
            let raised = substantial.count >= 2
                && symbol.box.midY < top + 0.35 * bodyHeight
                && symbol.box.maxY < top + 0.72 * bodyHeight
                && symbol.box.height < 0.82 * bodyHeight
                && !MathAlphabet.binaryOperators.contains(symbol.symbol)
            return DecodedGlyph(
                symbol: symbol.symbol,
                box: symbol.box,
                confidence: symbol.confidence,
                alternatives: symbol.alternatives,
                isSuperscript: raised,
                strokeIndexes: symbol.strokeIndexes,
                approximate: symbol.approximate
            )
        }
    }

    private static func adding(
        _ symbol: String,
        confidence: Double,
        to alternatives: [(symbol: String, confidence: Double)]
    ) -> [(symbol: String, confidence: Double)] {
        var result = alternatives.filter { $0.symbol != symbol }
        result.append((symbol, min(1, max(0, confidence))))
        result.sort { $0.confidence > $1.confidence }
        return Array(result.prefix(6))
    }

    private static func summarise(_ lines: [ReadingLine]) -> Reading {
        let all = lines.flatMap(\.symbols)
        var minConfidence = 1.0
        var margin = 1.0
        var weakest: (id: String, index: Int, symbol: String, confidence: Double,
                      alternatives: [(symbol: String, confidence: Double)])?

        for (index, symbol) in all.enumerated() {
            let rival = symbol.alternatives.first?.confidence ?? 0
            minConfidence = min(minConfidence, symbol.confidence)
            margin = min(margin, max(0, min(1, symbol.confidence - rival)))
            if weakest == nil || symbol.confidence < weakest!.confidence {
                weakest = (symbol.id, index, symbol.symbol, symbol.confidence, symbol.alternatives)
            }
        }
        return Reading(
            lines: lines,
            text: lines.map(\.text).joined(separator: "\n"),
            minConfidence: all.isEmpty ? 1 : minConfidence,
            margin: all.isEmpty ? 1 : margin,
            weakest: weakest
        )
    }

    // MARK: - Regression

    /// Deterministic ownership regression based on the real `3n+2 -> n=`
    /// failure. Exact isolated-Vision identity is deliberately not asserted in
    /// CI; the invariant is stronger and model-independent: every Pencil stroke
    /// must remain owned by a visible symbol (or explicit '?').
    static func assertNoDisappearedInkInvariant() {
        func stroke(_ points: [(CGFloat, CGFloat)]) -> InkStroke {
            InkStroke(points: points.enumerated().map { i, p in
                InkPoint(x: p.0, y: p.1, w: 3, t: Double(i) / 120.0)
            })
        }

        let three = stroke([(20, 30), (28, 22), (40, 22), (47, 30), (38, 40), (48, 48), (40, 58), (26, 58)])
        let n = stroke([(70, 58), (70, 32), (72, 44), (82, 32), (92, 38), (92, 58)])
        let plusV = stroke([(118, 28), (118, 60)])
        let plusH = stroke([(103, 44), (133, 44)])
        let two = stroke([(150, 30), (158, 22), (170, 22), (178, 30), (170, 40), (151, 58), (180, 58)])
        let strokes = [three, n, plusV, plusH, two]
        let fullBox = strokes.dropFirst().reduce(strokes[0].bounds) { $0.union($1.bounds) }

        let fake = Reading(
            lines: [ReadingLine(
                text: "n=",
                box: fullBox,
                symbols: [
                    ReadingSymbol(id: "n0_0", symbol: "n", confidence: 0.8,
                                  alternatives: [], box: n.bounds,
                                  strokeIndexes: [1], approximate: false),
                    ReadingSymbol(id: "n0_1", symbol: "=", confidence: 0.7,
                                  alternatives: [], box: plusV.bounds.union(plusH.bounds),
                                  strokeIndexes: [2, 3], approximate: false)
                ],
                strokeIndexes: Array(strokes.indices),
                unread: false
            )],
            text: "n=",
            minConfidence: 0.7,
            margin: 0.7,
            weakest: nil
        )

        let recovered = recover(fake, strokes: strokes)
        let owned = Set(recovered.lines.flatMap(\.symbols).flatMap(\.strokeIndexes))
        let missing = Set(strokes.indices).subtracting(owned)
        let plusCorrected = recovered.lines.first?.symbols.contains(where: { $0.symbol == "+" }) ?? false
        let ok = missing.isEmpty && plusCorrected
        NSLog("PRIINK completeness invariant=%@ missing=%d plusCorrected=%@ read=%@",
              ok ? "PASS" : "FAIL", missing.count,
              plusCorrected ? "yes" : "NO", recovered.text as NSString)
        precondition(ok, "Native handwriting completeness invariant lost real Pencil ink")
    }
}

extension MathInkRecognizer {
    func readWithCompleteness(strokes: [InkStroke], overrides: [String: String]) -> Reading {
        InkCompletenessRecovery.recover(
            read(strokes: strokes, overrides: overrides),
            strokes: strokes
        )
    }
}
