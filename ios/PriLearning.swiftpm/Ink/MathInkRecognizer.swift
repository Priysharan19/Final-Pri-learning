// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Handwriting recognition (native)
//
// Reads a page of Apple Pencil ink as maths, entirely on device. Vision is one
// source of symbol hypotheses; Pencil geometry and maths structure are other
// independent sources of evidence. A suspicious OCR segmentation is never
// accepted merely because it was the first non-empty result.
// ─────────────────────────────────────────────────────────────────────────────
import CoreGraphics
import Foundation
import ImageIO
import Vision

// MARK: - Result model

struct ReadingSymbol {
    var id: String
    var symbol: String
    var confidence: Double
    var alternatives: [(symbol: String, confidence: Double)]
    var box: CGRect
    var strokeIndexes: [Int]
    var approximate: Bool
}

struct ReadingLine {
    var text: String
    var box: CGRect
    var symbols: [ReadingSymbol]
    var strokeIndexes: [Int]
    var unread: Bool
}

struct Reading {
    var lines: [ReadingLine]
    var text: String
    var minConfidence: Double
    var margin: Double
    var weakest: (id: String, index: Int, symbol: String, confidence: Double,
                  alternatives: [(symbol: String, confidence: Double)])?
}

// MARK: - Recogniser

final class MathInkRecognizer {

    private var lineCache: [String: [DecodedGlyph]] = [:]
    private static let lineCacheLimit = 64

    /// Vision is synchronous at the request-handler call site, but VNRequest
    /// itself is cancellable. The generation invalidates the complete adaptive
    /// recognition pass, not only whichever Vision request happens to be active
    /// when the next Pencil contact arrives.
    private let visionLock = NSLock()
    private var activeVisionRequest: VNRequest?
    private var cancellationGeneration: UInt64 = 0

    static var trace = false
    static var traceLabel = "line"

    /// Candidates per Vision observation. The global beam below combines them
    /// across observations instead of greedily committing to each fragment.
    private static let candidateCount = 6
    private static let beamWidth = 12

    private static let lookalikes: [String: [String]] = [
        "0": ["o", "6", "8"], "1": ["l", "7", "/"], "2": ["z", "7"], "3": ["8", "5"],
        "4": ["9", "y"], "5": ["s", "6", "3"], "6": ["b", "0", "5"], "7": ["1", "2"],
        "8": ["3", "0", "b"], "9": ["4", "g", "q"],
        "x": ["*", "×", "k"], "y": ["4", "g"], "n": ["h", "u"], "u": ["v", "n"],
        "a": ["o", "d"], "b": ["6", "h"], "g": ["9", "q"], "l": ["1", "t"],
        "t": ["+", "l"], "s": ["5"], "z": ["2"], "o": ["0", "a"], "e": ["c"],
        "+": ["t", "*"], "-": ["_", "="], "=": ["-", "±"], "/": ["1", "\\"],
        "(": ["c", "["], ")": [")", "]"], ".": [",", "-"]
    ]

    func cancelActiveVision() {
        visionLock.lock()
        cancellationGeneration &+= 1
        let request = activeVisionRequest
        visionLock.unlock()
        request?.cancel()
    }

    private func generationSnapshot() -> UInt64 {
        visionLock.lock(); defer { visionLock.unlock() }
        return cancellationGeneration
    }

    private func generationIsCurrent(_ generation: UInt64) -> Bool {
        visionLock.lock(); defer { visionLock.unlock() }
        return generation == cancellationGeneration
    }

    // MARK: Entry point

    func read(strokes: [InkStroke], overrides: [String: String]) -> Reading {
        let generation = generationSnapshot()
        let live = strokes.filter { !$0.isEmpty }
        guard !live.isEmpty else {
            return Reading(lines: [], text: "", minConfidence: 1, margin: 1, weakest: nil)
        }

        let pageGlyph = InkLineSegmenter.pageGlyphSize(strokes)
        let fractions = FractionFinder.find(in: strokes, pageGlyph: pageGlyph)
        let consumed = Set(fractions.flatMap { $0.allStrokeIndexes })
        let masked = strokes.enumerated().map { index, stroke in
            consumed.contains(index) ? InkStroke(points: []) : stroke
        }
        var lines = InkLineSegmenter.segment(masked)

        if lines.isEmpty, let block = fractions.first {
            lines = [InkLine(strokeIndexes: [], strokes: [], bounds: block.bounds,
                             band: block.bounds.minY...block.bounds.maxY,
                             glyphHeight: pageGlyph)]
        }

        var readLines: [ReadingLine] = []
        for (lineIndex, line) in lines.enumerated() {
            guard generationIsCurrent(generation) else { break }
            let blocks = fractions.filter { block in
                let y = block.bar.midY
                return y >= line.band.lowerBound - line.glyphHeight
                    && y <= line.band.upperBound + line.glyphHeight
            }
            readLines.append(readLine(line, lineIndex: lineIndex, fractions: blocks,
                                      strokes: strokes, pageGlyph: pageGlyph,
                                      overrides: overrides,
                                      generation: generation))
        }
        return summarise(readLines)
    }

    // MARK: One line

    private func readLine(
        _ line: InkLine,
        lineIndex: Int,
        fractions: [FractionBlock],
        strokes: [InkStroke],
        pageGlyph: CGFloat,
        overrides: [String: String],
        generation: UInt64
    ) -> ReadingLine {
        var glyphs: [DecodedGlyph] = []
        var locked: Set<Int> = []
        var unread = false

        if !line.strokes.isEmpty, generationIsCurrent(generation) {
            let decoded = decodeGlyphs(
                strokeIndexes: line.strokeIndexes,
                strokes: strokes,
                glyphHeight: line.glyphHeight,
                generation: generation
            )
            glyphs = decoded
            unread = decoded.isEmpty
        }

        for block in fractions where generationIsCurrent(generation) {
            let numerator = readNested(block.numerator, strokes: strokes,
                                       pageGlyph: pageGlyph, generation: generation)
            let denominator = readNested(block.denominator, strokes: strokes,
                                         pageGlyph: pageGlyph, generation: generation)
            let text = "(\(numerator.isEmpty ? "?" : numerator))/(\(denominator.isEmpty ? "?" : denominator))"
            let glyph = DecodedGlyph(
                symbol: text,
                box: block.bounds,
                confidence: numerator.isEmpty || denominator.isEmpty ? 0.4 : 0.8,
                alternatives: [],
                isSuperscript: false,
                strokeIndexes: block.allStrokeIndexes
            )
            let insertAt = glyphs.firstIndex { $0.box.midX > block.bounds.midX } ?? glyphs.count
            glyphs.insert(glyph, at: insertAt)
            locked.insert(insertAt)
            locked = Set(locked.map { $0 >= insertAt && $0 != insertAt ? $0 + 1 : $0 })
            unread = false
        }

        guard generationIsCurrent(generation) else {
            return ReadingLine(text: "", box: line.bounds, symbols: [],
                               strokeIndexes: line.strokeIndexes, unread: true)
        }

        for i in glyphs.indices {
            let id = "n\(lineIndex)_\(i)"
            if let chosen = overrides[id] {
                glyphs[i].symbol = chosen
                glyphs[i].confidence = 1
                locked.insert(i)
            }
        }

        MathDecoder.repairBrackets(&glyphs, strokes: strokes, glyphHeight: line.glyphHeight)
        locked.formUnion(MathDecoder.lockFunctionNames(&glyphs))
        MathDecoder.applyContext(&glyphs, locked: locked)

        var radicalSpans: [Int: CGFloat] = [:]
        for (i, glyph) in glyphs.enumerated() where glyph.symbol == "sqrt" {
            let ink = glyph.strokeIndexes.compactMap { strokes.indices.contains($0) ? strokes[$0].bounds : nil }
            if let span = ink.dropFirst().reduce(ink.first) { $0?.union($1) }, span.width > glyph.box.width * 0.8 {
                radicalSpans[i] = span.maxX
            }
        }

        let text = MathDecoder.assemble(glyphs, radicalSpans: radicalSpans)
        let box = glyphs.isEmpty
            ? line.bounds
            : glyphs.dropFirst().reduce(glyphs[0].box) { $0.union($1.box) }

        let symbols = glyphs.enumerated().map { i, glyph in
            ReadingSymbol(
                id: "n\(lineIndex)_\(i)",
                symbol: glyph.symbol,
                confidence: glyph.confidence,
                alternatives: alternatives(for: glyph),
                box: glyph.box,
                strokeIndexes: glyph.strokeIndexes,
                approximate: glyph.approximate
            )
        }

        return ReadingLine(text: text, box: box, symbols: symbols,
                           strokeIndexes: line.strokeIndexes, unread: unread)
    }

    private func readNested(
        _ indexes: [Int],
        strokes: [InkStroke],
        pageGlyph: CGFloat,
        generation: UInt64
    ) -> String {
        guard generationIsCurrent(generation) else { return "" }
        let members = indexes.compactMap { strokes.indices.contains($0) ? strokes[$0] : nil }
        guard !members.isEmpty else { return "" }
        let glyphHeight = InkLineSegmenter.pageGlyphSize(members)
        var glyphs = decodeGlyphs(strokeIndexes: indexes, strokes: strokes,
                                  glyphHeight: glyphHeight, generation: generation)
        guard generationIsCurrent(generation), !glyphs.isEmpty else { return "" }
        MathDecoder.repairBrackets(&glyphs, strokes: strokes, glyphHeight: glyphHeight)
        let locked = MathDecoder.lockFunctionNames(&glyphs)
        MathDecoder.applyContext(&glyphs, locked: locked)
        return MathDecoder.assemble(glyphs)
    }

    // MARK: Glyph clusters

    private struct GlyphCluster {
        var strokeIndexes: [Int]
        var bounds: CGRect
        var isRaised = false
    }

    private func clusters(of strokeIndexes: [Int], strokes: [InkStroke]) -> [GlyphCluster] {
        let ordered = strokeIndexes
            .filter { strokes.indices.contains($0) && !strokes[$0].isEmpty }
            .sorted { strokes[$0].bounds.minX < strokes[$1].bounds.minX }
        guard !ordered.isEmpty else { return [] }

        var result: [GlyphCluster] = []
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
            result.append(GlyphCluster(strokeIndexes: [index], bounds: bounds))
        }
        return result
    }

    private func markRaised(_ clusters: inout [GlyphCluster], glyphHeight: CGFloat) {
        let body = clusters.filter { $0.bounds.height >= 0.35 * glyphHeight }
        guard body.count >= 2 else { return }
        let tops = body.map { $0.bounds.minY }.sorted()
        let bottoms = body.map { $0.bounds.maxY }.sorted()
        let top = tops[tops.count / 2]
        let bodyHeight = max(bottoms[bottoms.count / 2] - top, 1)

        for i in clusters.indices {
            let box = clusters[i].bounds
            guard box.midY < top + 0.35 * bodyHeight,
                  box.maxY < top + 0.72 * bodyHeight,
                  box.height < 0.80 * bodyHeight,
                  i > 0 else { continue }
            clusters[i].isRaised = true
        }
    }

    // MARK: Reading a line

    private func decodeGlyphs(
        strokeIndexes: [Int],
        strokes: [InkStroke],
        glyphHeight: CGFloat,
        generation: UInt64
    ) -> [DecodedGlyph] {
        guard generationIsCurrent(generation) else { return [] }
        var marks = clusters(of: strokeIndexes, strokes: strokes)
        guard !marks.isEmpty else { return [] }
        markRaised(&marks, glyphHeight: glyphHeight)

        let members = strokeIndexes.compactMap { strokes.indices.contains($0) ? strokes[$0] : nil }
        let key = MathInkRecognizer.digest(of: members, glyphHeight: glyphHeight)
        if let cached = lineCache[key] {
            return MathInkRecognizer.reindex(cached, onto: marks)
        }

        guard let reading = read(
            members,
            glyphHeight: glyphHeight,
            label: MathInkRecognizer.traceLabel,
            expectedMarks: marks.count,
            generation: generation
        ) else { return [] }

        guard generationIsCurrent(generation) else { return [] }
        let symbols = MathInkRecognizer.symbols(of: reading.text)
        guard !symbols.isEmpty else { return [] }

        let exact = symbols.count == marks.count
        var glyphs: [DecodedGlyph] = []
        for (position, symbol) in symbols.enumerated() {
            let markIndex = exact
                ? position
                : min(marks.count - 1, position * marks.count / max(symbols.count, 1))
            let mark = marks[markIndex]
            let agreed = reading.agreement[position] ?? [:]
            let support = agreed[symbol] ?? 1
            let rivals = agreed
                .filter { $0.key != symbol }
                .sorted { $0.value > $1.value }
                .map { (symbol: $0.key, confidence: $0.value) }
            let raised = mark.isRaised && (exact || !MathAlphabet.binaryOperators.contains(symbol))
            glyphs.append(DecodedGlyph(
                symbol: symbol,
                box: mark.bounds,
                confidence: min(1, 0.45 * reading.confidence + 0.55 * support),
                alternatives: rivals,
                isSuperscript: raised,
                strokeIndexes: mark.strokeIndexes.sorted(),
                approximate: !exact
            ))
        }

        if MathInkRecognizer.trace {
            NSLog("PRIINK   marks=%d symbols=%d exact=%@ raised=%@",
                  marks.count, symbols.count, exact ? "yes" : "no",
                  glyphs.filter(\.isSuperscript).map(\.symbol).joined() as NSString)
        }

        if lineCache.count >= MathInkRecognizer.lineCacheLimit { lineCache.removeAll() }
        lineCache[key] = glyphs
        return glyphs
    }

    /// Shape-aware cache fingerprint. Bounding boxes + point counts are not
    /// sufficient: two different marks can share both and must never reuse the
    /// same OCR result. Representative normalized trajectory points make such
    /// collisions vanishingly unlikely while keeping this key cheap to build.
    private static func digest(of strokes: [InkStroke], glyphHeight: CGFloat) -> String {
        var parts: [String] = [String(format: "%.2f", glyphHeight)]
        for stroke in strokes {
            let b = stroke.bounds
            var component = String(format: "%.2f,%.2f,%.2f,%.2f,%d",
                                   b.minX, b.minY, b.maxX, b.maxY, stroke.points.count)
            let count = stroke.points.count
            if count > 0 {
                let sampleCount = min(9, count)
                for sample in 0..<sampleCount {
                    let index = sampleCount == 1 ? 0 : sample * (count - 1) / (sampleCount - 1)
                    let point = stroke.points[index]
                    let nx = b.width > 0 ? (point.x - b.minX) / b.width : 0
                    let ny = b.height > 0 ? (point.y - b.minY) / b.height : 0
                    component += String(format: ",%.3f,%.3f", nx, ny)
                }
            }
            parts.append(component)
        }
        return parts.joined(separator: ";")
    }

    private static func reindex(_ glyphs: [DecodedGlyph], onto marks: [GlyphCluster]) -> [DecodedGlyph] {
        guard !marks.isEmpty else { return glyphs }
        return glyphs.map { glyph in
            var updated = glyph
            if let mark = marks.first(where: { $0.bounds == glyph.box }) {
                updated.strokeIndexes = mark.strokeIndexes.sorted()
            }
            return updated
        }
    }

    private static func symbols(of text: String) -> [String] {
        var out: [String] = []
        for ch in text where !ch.isWhitespace {
            let symbol = MathAlphabet.canonical[ch] ?? String(ch)
            if !symbol.isEmpty { out.append(symbol) }
        }
        return out
    }

    // MARK: Vision + adaptive multi-view fusion

    private struct LineReading {
        var text: String
        var confidence: Double
        var agreement: [Int: [String: Double]]
    }

    private struct Beam {
        var text: String
        var confidenceSum: Double
        var pieces: Int
        var agreement: [Int: [String: Double]]

        var meanConfidence: Double {
            pieces == 0 ? 0 : confidenceSum / Double(pieces)
        }
    }

    private func read(
        _ strokes: [InkStroke],
        glyphHeight: CGFloat,
        label: String,
        expectedMarks: Int,
        generation: UInt64
    ) -> LineReading? {
        guard generationIsCurrent(generation) else { return nil }
        let primaryAttempt: (scale: CGFloat, level: VNRequestTextRecognitionLevel) = (1.0, .accurate)
        var readings: [LineReading] = []

        if let primary = runVisionAttempt(
            strokes,
            glyphHeight: glyphHeight,
            label: label,
            scale: primaryAttempt.scale,
            level: primaryAttempt.level,
            generation: generation
        ) {
            guard generationIsCurrent(generation) else { return nil }
            readings.append(primary)
            let count = Self.symbols(of: primary.text).count
            let grammar = MathGrammar.score(Self.respell(primary.text))
            if count == expectedMarks && grammar >= 0.45 {
                return primary
            }
            if Self.trace {
                NSLog("PRIINK   adaptive retry marks=%d primarySymbols=%d grammar=%.2f",
                      expectedMarks, count, grammar)
            }
        }

        let rescueAttempts: [(scale: CGFloat, level: VNRequestTextRecognitionLevel)] = [
            (1.45, .accurate),
            (1.90, .accurate),
            (1.00, .fast)
        ]
        for attempt in rescueAttempts {
            guard generationIsCurrent(generation) else { return nil }
            if let reading = runVisionAttempt(
                strokes,
                glyphHeight: glyphHeight,
                label: label,
                scale: attempt.scale,
                level: attempt.level,
                generation: generation
            ) {
                readings.append(reading)
            }
        }

        guard generationIsCurrent(generation), !readings.isEmpty else { return nil }
        return fuse(readings, expectedMarks: expectedMarks)
    }

    private func runVisionAttempt(
        _ strokes: [InkStroke],
        glyphHeight: CGFloat,
        label: String,
        scale: CGFloat,
        level: VNRequestTextRecognitionLevel,
        generation: UInt64
    ) -> LineReading? {
        guard generationIsCurrent(generation),
              let raster = InkRasterizer.render(
                strokes: strokes,
                glyphHeight: glyphHeight / scale
              ),
              generationIsCurrent(generation)
        else { return nil }
        let observations = recognizeText(in: raster.image, level: level, generation: generation)
        guard generationIsCurrent(generation) else { return nil }
        if MathInkRecognizer.trace {
            MathInkRecognizer.dump(raster.image, label: label)
            NSLog("PRIINK   %@ %dx%d level=%@ x%.2f observations=%d", label as NSString,
                  raster.pixelWidth, raster.pixelHeight,
                  level == .accurate ? "accurate" : "fast",
                  Double(scale), observations.count)
        }
        guard !observations.isEmpty else { return nil }
        return assemble(observations)
    }

    private func fuse(_ readings: [LineReading], expectedMarks: Int) -> LineReading {
        let grouped = Dictionary(grouping: readings) { Self.respell($0.text) }
        var winner = readings[0]
        var best = -Double.infinity

        for (canonical, group) in grouped {
            guard let representative = group.max(by: {
                readingScore($0, expectedMarks: expectedMarks) < readingScore($1, expectedMarks: expectedMarks)
            }) else { continue }
            let consensus = min(0.12, 0.04 * Double(max(0, group.count - 1)))
            let score = readingScore(representative, expectedMarks: expectedMarks) + consensus
            if score > best {
                best = score
                winner = representative
            }
            if Self.trace {
                NSLog("PRIINK   fusion \"%@\" views=%d score=%.3f",
                      canonical as NSString, group.count, score)
            }
        }

        let winnerSymbols = Self.symbols(of: winner.text)
        var tally: [Int: [String: Double]] = [:]
        for reading in readings where Self.symbols(of: reading.text).count == winnerSymbols.count {
            let ownSymbols = Self.symbols(of: reading.text)
            let weight = max(0.15, reading.confidence)
            for (position, symbol) in ownSymbols.enumerated() {
                tally[position, default: [:]][symbol, default: 0] += 0.65 * weight
            }
            for (position, votes) in reading.agreement {
                for (symbol, share) in votes {
                    tally[position, default: [:]][symbol, default: 0] += 0.35 * weight * share
                }
            }
        }
        winner.agreement = tally.mapValues { votes in
            let total = votes.values.reduce(0, +)
            guard total > 0 else { return votes }
            return votes.mapValues { $0 / total }
        }
        return winner
    }

    private func readingScore(_ reading: LineReading, expectedMarks: Int) -> Double {
        let canonical = Self.respell(reading.text)
        let count = Self.symbols(of: canonical).count
        let denominator = Double(max(expectedMarks, 1))
        let countFit = max(0, 1 - Double(abs(count - expectedMarks)) / denominator)
        return 0.42 * reading.confidence
            + 0.38 * MathGrammar.score(canonical)
            + 0.20 * countFit
    }

    private func assemble(_ observations: [VNRecognizedTextObservation]) -> LineReading? {
        let ordered = observations.sorted { $0.boundingBox.minX < $1.boundingBox.minX }
        var beams = [Beam(text: "", confidenceSum: 0, pieces: 0, agreement: [:])]

        for observation in ordered {
            let candidates = observation.topCandidates(Self.candidateCount)
            guard !candidates.isEmpty else { continue }
            var next: [Beam] = []

            for beam in beams {
                for candidate in candidates {
                    let spelled = Self.respell(candidate.string)
                    guard !spelled.isEmpty else { continue }
                    var extended = beam
                    let offset = Self.symbols(of: extended.text).count
                    extended.text += candidate.string
                    extended.confidenceSum += Double(candidate.confidence)
                    extended.pieces += 1
                    let localAgreement = agreement(with: candidate, among: candidates)
                    for (position, votes) in localAgreement {
                        extended.agreement[offset + position] = votes
                    }
                    next.append(extended)
                }
            }

            next.sort { lhs, rhs in
                if lhs.meanConfidence != rhs.meanConfidence {
                    return lhs.meanConfidence > rhs.meanConfidence
                }
                return Self.symbols(of: lhs.text).count > Self.symbols(of: rhs.text).count
            }
            beams = Array(next.prefix(Self.beamWidth))
            if beams.isEmpty { return nil }
        }

        guard !beams.isEmpty else { return nil }
        let winner = beams.max { lhs, rhs in
            finalBeamScore(lhs) < finalBeamScore(rhs)
        }!
        guard !Self.symbols(of: winner.text).isEmpty else { return nil }

        if Self.trace {
            NSLog("PRIINK   beam \"%@\" conf=%.2f grammar=%.2f",
                  winner.text as NSString, winner.meanConfidence,
                  MathGrammar.score(Self.respell(winner.text)))
        }
        return LineReading(text: winner.text,
                           confidence: winner.meanConfidence,
                           agreement: winner.agreement)
    }

    private func finalBeamScore(_ beam: Beam) -> Double {
        0.55 * beam.meanConfidence + 0.45 * MathGrammar.score(Self.respell(beam.text))
    }

    private func recognizeText(
        in image: CGImage,
        level: VNRequestTextRecognitionLevel,
        generation: UInt64
    ) -> [VNRecognizedTextObservation] {
        guard generationIsCurrent(generation) else { return [] }
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = level
        request.usesLanguageCorrection = false
        request.recognitionLanguages = ["en-US"]
        request.revision = VNRecognizeTextRequestRevision3
        request.minimumTextHeight = 0

        // Keep Vision interactive. `preferBackgroundProcessing` caused the
        // simulator benchmark to stop producing timely results. PencilKit is
        // protected instead by the native quiet window, utility-QoS queue and
        // explicit pen-down cancellation of this entire generation.
        visionLock.lock()
        guard generation == cancellationGeneration else {
            visionLock.unlock()
            return []
        }
        activeVisionRequest = request
        visionLock.unlock()
        defer {
            visionLock.lock()
            if activeVisionRequest === request { activeVisionRequest = nil }
            visionLock.unlock()
        }

        let handler = VNImageRequestHandler(cgImage: image, orientation: .up, options: [:])
        do {
            try handler.perform([request])
        } catch {
            return []
        }
        guard generationIsCurrent(generation) else { return [] }
        return request.results ?? []
    }

    private static var dumpCounter = 0
    static func dump(_ image: CGImage, label: String) {
        guard let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first
        else { return }
        dumpCounter += 1
        let url = directory.appendingPathComponent(String(format: "ink-%03d-%@.png", dumpCounter, label))
        guard let destination = CGImageDestinationCreateWithURL(
            url as CFURL, "public.png" as CFString, 1, nil) else { return }
        CGImageDestinationAddImage(destination, image, nil)
        CGImageDestinationFinalize(destination)
    }

    static func respell(_ text: String) -> String {
        symbols(of: text).joined()
    }

    private func agreement(
        with winner: VNRecognizedText,
        among candidates: [VNRecognizedText]
    ) -> [Int: [String: Double]] {
        let target = MathInkRecognizer.symbols(of: winner.string)
        var tally: [Int: [String: Double]] = [:]
        var weight: Double = 0

        for candidate in candidates {
            let spelled = MathInkRecognizer.symbols(of: candidate.string)
            guard spelled.count == target.count else { continue }
            let share = max(0.15, Double(candidate.confidence))
            weight += share
            for (position, symbol) in spelled.enumerated() {
                tally[position, default: [:]][symbol, default: 0] += share
            }
        }

        guard weight > 0 else { return [:] }
        return tally.mapValues { $0.mapValues { $0 / weight } }
    }

    private func alternatives(for glyph: DecodedGlyph) -> [(symbol: String, confidence: Double)] {
        var result = glyph.alternatives.filter { $0.symbol != glyph.symbol }
        for extra in Self.lookalikes[glyph.symbol] ?? [] {
            guard !result.contains(where: { $0.symbol == extra }), extra != glyph.symbol else { continue }
            result.append((extra, 0.2))
        }
        return Array(result.prefix(6))
    }

    // MARK: Summary

    private func summarise(_ lines: [ReadingLine]) -> Reading {
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
