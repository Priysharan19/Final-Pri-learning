// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · per-glyph consensus reader
//
// Whole-line Vision contributes context, but handwriting OCR can be confidently
// wrong about an individual glyph. This pass gives suspicious owned Pencil ink
// a second, shape-focused vote: the exact glyph is redrawn several times in a
// text-like strip and read again by Vision with language correction disabled.
//
// Important safety properties:
//   · user overrides (confidence == 1) are never touched;
//   · no new glyph is invented here — completeness recovery owns missing ink;
//   · agreement raises confidence, disagreement lowers it;
//   · an isolated vote replaces the contextual vote only when it is materially
//     stronger or the contextual owner was already approximate;
//   · all isolated decisions remain capped below production auto-mark certainty.
// ─────────────────────────────────────────────────────────────────────────────
import CoreGraphics
import Foundation
import Vision

private struct InkGlyphVote {
    var symbol: String
    var confidence: Double
    var alternatives: [(symbol: String, confidence: Double)]
}

enum InkGlyphConsensus {

    private static var cache: [String: InkGlyphVote?] = [:]
    private static let cacheLock = NSLock()
    private static let cacheLimit = 512

    static func rerank(_ reading: Reading, strokes: [InkStroke]) -> Reading {
        guard !reading.lines.isEmpty else { return reading }
        var lines = reading.lines
        var anyChanged = false

        for lineIndex in lines.indices {
            var symbols = lines[lineIndex].symbols
            guard !symbols.isEmpty else { continue }

            let glyphHeight = representativeGlyphHeight(symbols)
            var changed = false

            for i in symbols.indices {
                if symbols[i].confidence >= 0.995 { continue }
                if symbols[i].symbol.count > 1 && !["pi", "theta"].contains(symbols[i].symbol) {
                    continue
                }
                let members = symbols[i].strokeIndexes.compactMap {
                    strokes.indices.contains($0) ? strokes[$0] : nil
                }
                guard !members.isEmpty else { continue }

                let closeRival = symbols[i].alternatives.contains {
                    $0.symbol != symbols[i].symbol && $0.confidence >= symbols[i].confidence - 0.18
                }
                let suspicious = symbols[i].approximate || symbols[i].confidence < 0.86 || closeRival
                guard suspicious else { continue }

                guard let isolated = cachedVote(members: members, glyphHeight: glyphHeight) else {
                    continue
                }

                let old = symbols[i]
                if isolated.symbol == old.symbol {
                    symbols[i].confidence = min(
                        0.94,
                        max(old.confidence, 0.58 * old.confidence + 0.42 * isolated.confidence + 0.08)
                    )
                    symbols[i].alternatives = mergedAlternatives(
                        primary: old.symbol,
                        current: old.alternatives,
                        isolated: isolated.alternatives
                    )
                    if isolated.confidence >= 0.58 { symbols[i].approximate = false }
                    changed = true
                    continue
                }

                let shouldReplace =
                    (old.approximate && isolated.confidence >= 0.42)
                    || (old.confidence < 0.68 && isolated.confidence >= 0.50)
                    || (old.confidence < 0.82 && isolated.confidence >= 0.66)

                if shouldReplace {
                    symbols[i].symbol = isolated.symbol
                    symbols[i].confidence = min(0.82, isolated.confidence)
                    symbols[i].alternatives = mergedAlternatives(
                        primary: isolated.symbol,
                        current: [(old.symbol, min(0.74, old.confidence))] + old.alternatives,
                        isolated: isolated.alternatives
                    )
                    symbols[i].approximate = true
                    changed = true
                } else if isolated.confidence >= 0.38 {
                    symbols[i].confidence = min(old.confidence, 0.68)
                    symbols[i].alternatives = mergedAlternatives(
                        primary: old.symbol,
                        current: old.alternatives,
                        isolated: [(isolated.symbol, min(0.67, isolated.confidence))] + isolated.alternatives
                    )
                    symbols[i].approximate = true
                    changed = true
                }
            }

            guard changed else { continue }
            lines[lineIndex] = rebuildLine(
                lines[lineIndex],
                lineIndex: lineIndex,
                symbols: symbols,
                strokes: strokes,
                glyphHeight: glyphHeight
            )
            anyChanged = true
        }

        guard anyChanged else { return reading }
        return summarise(lines)
    }

    private static func cachedVote(
        members: [InkStroke],
        glyphHeight: CGFloat
    ) -> InkGlyphVote? {
        let key = digest(members, glyphHeight: glyphHeight)
        cacheLock.lock()
        if let existing = cache[key] {
            cacheLock.unlock()
            return existing
        }
        cacheLock.unlock()

        let first = visionVote(members: members, targetHeight: 82)
        var final = first
        if first == nil || (first?.confidence ?? 0) < 0.64 {
            let second = visionVote(members: members, targetHeight: 108)
            final = fuse(first, second)
        }

        cacheLock.lock()
        if cache.count >= cacheLimit { cache.removeAll(keepingCapacity: true) }
        cache[key] = final
        cacheLock.unlock()
        return final
    }

    private static func visionVote(
        members: [InkStroke],
        targetHeight: CGFloat
    ) -> InkGlyphVote? {
        guard let image = renderRepeatedGlyph(members, targetHeight: targetHeight) else { return nil }

        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = false
        request.recognitionLanguages = ["en-US"]
        request.revision = VNRecognizeTextRequestRevision3
        request.minimumTextHeight = 0

        let handler = VNImageRequestHandler(cgImage: image, orientation: .up, options: [:])
        do { try handler.perform([request]) } catch { return nil }

        var scores: [String: Double] = [:]
        for observation in request.results ?? [] {
            for candidate in observation.topCandidates(8) {
                let symbols = canonicalSymbols(candidate.string).filter(allowedSymbol)
                guard !symbols.isEmpty else { continue }
                let counts = Dictionary(grouping: symbols, by: { $0 }).mapValues(\.count)
                guard let dominant = counts.max(by: { $0.value < $1.value }) else { continue }
                let ratio = Double(dominant.value) / Double(symbols.count)
                guard ratio >= 0.55 else { continue }
                let repetition = min(1.0, 0.35 + 0.16 * Double(dominant.value))
                let score = Double(candidate.confidence) * (0.48 + 0.52 * ratio) * repetition
                scores[dominant.key] = max(scores[dominant.key] ?? 0, score)
            }
        }

        guard !scores.isEmpty else { return nil }
        let ordered = scores.sorted { $0.value > $1.value }
        let winner = ordered[0]
        let runner = ordered.dropFirst().first?.value ?? 0
        let margin = max(0, winner.value - runner)
        let calibrated = min(0.84, max(0.16, 0.20 + 0.78 * winner.value + 0.34 * margin))
        guard calibrated >= 0.24 else { return nil }

        let alternatives = ordered.dropFirst().prefix(5).map {
            (symbol: $0.key, confidence: min(0.64, max(0.08, 0.18 + 0.65 * $0.value)))
        }
        return InkGlyphVote(symbol: winner.key, confidence: calibrated, alternatives: alternatives)
    }

    private static func fuse(_ a: InkGlyphVote?, _ b: InkGlyphVote?) -> InkGlyphVote? {
        guard let a else { return b }
        guard let b else { return a }
        if a.symbol == b.symbol {
            return InkGlyphVote(
                symbol: a.symbol,
                confidence: min(0.88, max(a.confidence, b.confidence) + 0.10),
                alternatives: mergedAlternatives(
                    primary: a.symbol,
                    current: a.alternatives,
                    isolated: b.alternatives
                )
            )
        }
        let gap = abs(a.confidence - b.confidence)
        guard gap >= 0.18 else { return nil }
        return a.confidence > b.confidence ? a : b
    }

    private static func renderRepeatedGlyph(
        _ strokes: [InkStroke],
        targetHeight: CGFloat
    ) -> CGImage? {
        guard let first = strokes.first, !first.isEmpty else { return nil }
        let bounds = strokes.dropFirst().reduce(first.bounds) { $0.union($1.bounds) }
        guard bounds.width.isFinite, bounds.height.isFinite else { return nil }

        let scale = targetHeight / max(bounds.height, 1)
        let glyphWidth = max(8, bounds.width * scale)
        let tileWidth = max(92, glyphWidth + 48)
        let tileCount = 5
        let topPad: CGFloat = 28
        let bottomPad: CGFloat = 28
        let width = Int((CGFloat(tileCount) * tileWidth).rounded(.up))
        let height = Int((targetHeight + topPad + bottomPad).rounded(.up))
        guard width > 0, height > 0, width <= 2400, height <= 400 else { return nil }

        let colorSpace = CGColorSpaceCreateDeviceGray()
        guard let context = CGContext(
            data: nil,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.none.rawValue
        ) else { return nil }

        context.setFillColor(gray: 1, alpha: 1)
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        context.translateBy(x: 0, y: CGFloat(height))
        context.scaleBy(x: 1, y: -1)
        context.setStrokeColor(gray: 0, alpha: 1)
        context.setLineCap(.round)
        context.setLineJoin(.round)
        context.setShouldAntialias(true)
        context.setLineWidth(max(2.8, 0.065 * targetHeight))

        for tile in 0..<tileCount {
            let baseX = CGFloat(tile) * tileWidth + (tileWidth - glyphWidth) / 2
            let map: (InkPoint) -> CGPoint = { point in
                CGPoint(
                    x: baseX + (point.x - bounds.minX) * scale,
                    y: topPad + (point.y - bounds.minY) * scale
                )
            }
            for stroke in strokes {
                guard let firstPoint = stroke.points.first else { continue }
                if stroke.points.count == 1 {
                    let p = map(firstPoint)
                    let r = max(1.8, 0.035 * targetHeight)
                    context.fillEllipse(in: CGRect(x: p.x - r, y: p.y - r, width: 2 * r, height: 2 * r))
                    continue
                }
                context.beginPath()
                context.move(to: map(firstPoint))
                for index in 1..<(stroke.points.count - 1) {
                    let current = map(stroke.points[index])
                    let next = map(stroke.points[index + 1])
                    context.addQuadCurve(
                        to: CGPoint(x: (current.x + next.x) / 2, y: (current.y + next.y) / 2),
                        control: current
                    )
                }
                context.addLine(to: map(stroke.points[stroke.points.count - 1]))
                context.strokePath()
            }
        }
        return context.makeImage()
    }

    private static func rebuildLine(
        _ original: ReadingLine,
        lineIndex: Int,
        symbols: [ReadingSymbol],
        strokes: [InkStroke],
        glyphHeight: CGFloat
    ) -> ReadingLine {
        let sorted = symbols.sorted {
            if abs($0.box.midX - $1.box.midX) > 0.5 { return $0.box.midX < $1.box.midX }
            return $0.box.midY < $1.box.midY
        }
        let substantial = sorted.filter { $0.box.height >= 0.35 * glyphHeight }
        let tops = substantial.map(\.box.minY).sorted()
        let bottoms = substantial.map(\.box.maxY).sorted()
        let top = tops.isEmpty ? 0 : tops[tops.count / 2]
        let bodyHeight = tops.isEmpty ? max(glyphHeight, 1) : max(bottoms[bottoms.count / 2] - top, 1)

        var glyphs = sorted.map { symbol -> DecodedGlyph in
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

        MathDecoder.repairBrackets(&glyphs, strokes: strokes, glyphHeight: glyphHeight)
        var locked = Set(glyphs.indices.filter { glyphs[$0].confidence >= 0.995 })
        locked.formUnion(MathDecoder.lockFunctionNames(&glyphs))
        MathDecoder.applyContext(&glyphs, locked: locked)
        let text = MathDecoder.assemble(glyphs)
        let rebuilt = glyphs.enumerated().map { index, glyph in
            ReadingSymbol(
                id: "n\(lineIndex)_\(index)",
                symbol: glyph.symbol,
                confidence: glyph.confidence,
                alternatives: glyph.alternatives,
                box: glyph.box,
                strokeIndexes: glyph.strokeIndexes,
                approximate: glyph.approximate
            )
        }
        let box = rebuilt.isEmpty
            ? original.box
            : rebuilt.dropFirst().reduce(rebuilt[0].box) { $0.union($1.box) }
        return ReadingLine(
            text: text,
            box: box,
            symbols: rebuilt,
            strokeIndexes: original.strokeIndexes,
            unread: rebuilt.isEmpty
        )
    }

    private static func representativeGlyphHeight(_ symbols: [ReadingSymbol]) -> CGFloat {
        let extents = symbols
            .filter { !$0.box.isEmpty }
            .map { max($0.box.width, $0.box.height) }
            .sorted()
        return max(8, extents.isEmpty ? 24 : extents[extents.count / 2])
    }

    private static func canonicalSymbols(_ text: String) -> [String] {
        var result: [String] = []
        for character in text where !character.isWhitespace {
            let symbol = MathAlphabet.canonical[character] ?? String(character)
            if !symbol.isEmpty { result.append(symbol) }
        }
        return result
    }

    private static func allowedSymbol(_ symbol: String) -> Bool {
        if MathAlphabet.isDigit(symbol) || MathAlphabet.isLetter(symbol) { return true }
        return Set(["+", "-", "=", "*", "/", "(", ")", "[", "]", ".", ",", ":", "'", "%"]).contains(symbol)
    }

    private static func mergedAlternatives(
        primary: String,
        current: [(symbol: String, confidence: Double)],
        isolated: [(symbol: String, confidence: Double)]
    ) -> [(symbol: String, confidence: Double)] {
        var best: [String: Double] = [:]
        for candidate in current + isolated where candidate.symbol != primary {
            best[candidate.symbol] = max(best[candidate.symbol] ?? 0, candidate.confidence)
        }
        return best.map { (symbol: $0.key, confidence: $0.value) }
            .sorted { $0.confidence > $1.confidence }
            .prefix(6)
            .map { $0 }
    }

    private static func digest(_ strokes: [InkStroke], glyphHeight: CGFloat) -> String {
        var parts = [String(format: "%.2f", glyphHeight)]
        for stroke in strokes {
            let b = stroke.bounds
            var part = String(format: "%.2f,%.2f,%.2f,%.2f,%d", b.minX, b.minY, b.maxX, b.maxY, stroke.points.count)
            if !stroke.points.isEmpty {
                let sampleCount = min(7, stroke.points.count)
                for sample in 0..<sampleCount {
                    let index = sampleCount == 1 ? 0 : sample * (stroke.points.count - 1) / (sampleCount - 1)
                    let p = stroke.points[index]
                    part += String(format: ",%.2f,%.2f", p.x, p.y)
                }
            }
            parts.append(part)
        }
        return parts.joined(separator: ";")
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
}

extension MathInkRecognizer {
    func readWithGlyphConsensus(strokes: [InkStroke], overrides: [String: String]) -> Reading {
        InkGlyphConsensus.rerank(
            readWithCompleteness(strokes: strokes, overrides: overrides),
            strokes: strokes
        )
    }
}
