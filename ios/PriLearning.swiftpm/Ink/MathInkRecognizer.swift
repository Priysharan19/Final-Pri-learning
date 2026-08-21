// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Handwriting recognition (native)
//
// Reads a page of Apple Pencil ink as maths, entirely on device, using the
// same Vision handwriting model that reads a photograph of a page in Notes —
// then decodes its answer as maths rather than as English.
//
//   strokes
//     → stacked fractions lifted out (bar + what sits above and below it)
//     → lines found from the ink itself
//     → each line redrawn at the size Vision reads best, black on white
//     → Vision, several candidate readings per line
//     → each candidate scored as MATHS, not as prose; best one taken
//     → characters tied back to the strokes that made them, so a power is
//       decided by where the ink actually sits and a correction can be learnt
//     → ^(…), (…)/(…), sqrt(…) — the grammar the marker already speaks
//
// A line Vision returns nothing for is reported as unread rather than
// silently dropped, and the web engine reads that line instead.
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
    /// The box is a fair guess rather than a fact — see DecodedGlyph.
    var approximate: Bool
}

struct ReadingLine {
    var text: String
    var box: CGRect
    var symbols: [ReadingSymbol]
    var strokeIndexes: [Int]
    /// True when Vision produced nothing for this line's ink. The web engine
    /// takes the line over rather than the student losing a step.
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

    /// Lines already read, keyed by their ink. Recognition runs after every
    /// stroke, and a page of working is mostly lines that have not changed
    /// since the last one — re-reading all of them to find out what the last
    /// mark was is most of the cost of writing a long answer.
    private var lineCache: [String: [DecodedGlyph]] = [:]
    private static let lineCacheLimit = 64

    /// Turns on a per-observation, per-glyph trace in the system log. Used by
    /// the self-check; off in the app.
    static var trace = false
    /// Names the dumps for whichever case is being read.
    static var traceLabel = "line"

    /// Candidate readings pulled from Vision per line. More than a handful
    /// stops paying: past the top few they are near-duplicates, and each one
    /// costs a grammar score.
    private static let candidateCount = 6

    /// Alternatives offered in tap-to-correct when Vision's own candidates
    /// agree — the marks a reader would plausibly confuse this one with.
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

    // MARK: Entry point

    func read(strokes: [InkStroke], overrides: [String: String]) -> Reading {
        let live = strokes.filter { !$0.isEmpty }
        guard !live.isEmpty else {
            return Reading(lines: [], text: "", minConfidence: 1, margin: 1, weakest: nil)
        }

        let pageGlyph = InkLineSegmenter.pageGlyphSize(strokes)
        let fractions = FractionFinder.find(in: strokes, pageGlyph: pageGlyph)
        let consumed = Set(fractions.flatMap { $0.allStrokeIndexes })

        // Fraction ink is hidden from line finding so a numerator does not
        // become a line of its own — but the indexes stay original, so every
        // symbol still points at the stroke the student drew.
        let masked = strokes.enumerated().map { index, stroke in
            consumed.contains(index) ? InkStroke(points: []) : stroke
        }
        var lines = InkLineSegmenter.segment(masked)

        // A page that is nothing but a fraction has no ordinary line to hang
        // it on; one is opened at the fraction's own position.
        if lines.isEmpty, let block = fractions.first {
            lines = [InkLine(strokeIndexes: [], strokes: [], bounds: block.bounds,
                             band: block.bounds.minY...block.bounds.maxY,
                             glyphHeight: pageGlyph)]
        }

        var readLines: [ReadingLine] = []
        for (lineIndex, line) in lines.enumerated() {
            let blocks = fractions.filter { block in
                let y = block.bar.midY
                return y >= line.band.lowerBound - line.glyphHeight
                    && y <= line.band.upperBound + line.glyphHeight
            }
            readLines.append(readLine(line, lineIndex: lineIndex, fractions: blocks,
                                      strokes: strokes, pageGlyph: pageGlyph,
                                      overrides: overrides))
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
        overrides: [String: String]
    ) -> ReadingLine {

        var glyphs: [DecodedGlyph] = []
        var locked: Set<Int> = []
        var unread = false

        if !line.strokes.isEmpty {
            let decoded = decodeGlyphs(
                strokeIndexes: line.strokeIndexes,
                strokes: strokes,
                glyphHeight: line.glyphHeight
            )
            glyphs = decoded
            unread = decoded.isEmpty
        }

        // Fractions arrive already read; they are placed by where their bar
        // sits among the line's other marks.
        for block in fractions {
            let numerator = readNested(block.numerator, strokes: strokes, pageGlyph: pageGlyph)
            let denominator = readNested(block.denominator, strokes: strokes, pageGlyph: pageGlyph)
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

        // Student corrections outrank everything, including the grammar pass.
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

        // A radical takes everything sitting under its bar; the bar's reach is
        // the width of the ink the radical itself was drawn with.
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

    /// Read a numerator, denominator or other nested run as a plain string.
    private func readNested(_ indexes: [Int], strokes: [InkStroke], pageGlyph: CGFloat) -> String {
        let members = indexes.compactMap { strokes.indices.contains($0) ? strokes[$0] : nil }
        guard !members.isEmpty else { return "" }
        let glyphHeight = InkLineSegmenter.pageGlyphSize(members)
        var glyphs = decodeGlyphs(strokeIndexes: indexes, strokes: strokes, glyphHeight: glyphHeight)
        guard !glyphs.isEmpty else { return "" }
        MathDecoder.repairBrackets(&glyphs, strokes: strokes, glyphHeight: glyphHeight)
        let locked = MathDecoder.lockFunctionNames(&glyphs)
        MathDecoder.applyContext(&glyphs, locked: locked)
        return MathDecoder.assemble(glyphs)
    }

    // MARK: Glyph clusters

    /// One written mark and the strokes that make it. Vision tells us WHAT was
    /// written; the clusters tell us WHERE each mark sits — which is what
    /// decides a power, and what ties a correction back to the ink.
    private struct GlyphCluster {
        var strokeIndexes: [Int]
        var bounds: CGRect
        var isRaised = false
    }

    /// Group a line's strokes into marks by horizontal overlap. The two
    /// strokes of an '=', the three of a '4' and the cross of an 'x' share a
    /// column and come out as one mark; neighbouring characters do not.
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

    /// Mark the clusters that sit as powers, measured against the band the
    /// line's full-height marks occupy — the student's own ink, not a text
    /// model's guess at where a glyph was.
    private func markRaised(_ clusters: inout [GlyphCluster], glyphHeight: CGFloat) {
        let body = clusters.filter { $0.bounds.height >= 0.35 * glyphHeight }
        guard body.count >= 2 else { return }
        let tops = body.map { $0.bounds.minY }.sorted()
        let bottoms = body.map { $0.bounds.maxY }.sorted()
        let top = tops[tops.count / 2]
        let bodyHeight = max(bottoms[bottoms.count / 2] - top, 1)

        for i in clusters.indices {
            let box = clusters[i].bounds
            // Centre in the top third of the body, clear of the baseline, and
            // smaller than a body mark. A '+' sits at mid height and fails the
            // first test, which is what keeps operators off the exponent.
            guard box.midY < top + 0.35 * bodyHeight,
                  box.maxY < top + 0.72 * bodyHeight,
                  box.height < 0.80 * bodyHeight,
                  i > 0                                    // nothing to carry it
            else { continue }
            clusters[i].isRaised = true
        }
    }

    // MARK: Reading a line

    /// Read one line's ink. The line is read WHOLE — Vision is at its best
    /// with the most context it can get, and a line read whole came back
    /// materially better than the same line read a mark at a time — and the
    /// characters it returns are laid onto the marks underneath them.
    private func decodeGlyphs(
        strokeIndexes: [Int],
        strokes: [InkStroke],
        glyphHeight: CGFloat
    ) -> [DecodedGlyph] {
        var marks = clusters(of: strokeIndexes, strokes: strokes)
        guard !marks.isEmpty else { return [] }
        markRaised(&marks, glyphHeight: glyphHeight)

        let members = strokeIndexes.compactMap { strokes.indices.contains($0) ? strokes[$0] : nil }

        let key = MathInkRecognizer.digest(of: members, glyphHeight: glyphHeight)
        if let cached = lineCache[key] {
            // The cached glyphs describe the same ink, but the stroke indexes
            // are the page's and the page may have been renumbered by an
            // eraser, so those are re-taken from this call's marks.
            return MathInkRecognizer.reindex(cached, onto: marks)
        }

        guard let reading = read(members, glyphHeight: glyphHeight, label: MathInkRecognizer.traceLabel) else { return [] }

        let symbols = MathInkRecognizer.symbols(of: reading.text)
        guard !symbols.isEmpty else { return [] }

        // Characters map onto marks one for one when the counts agree, which
        // is the ordinary case: a mark is a character. When they disagree —
        // two digits written joined up, a mark Vision merged — they are spread
        // across the marks in proportion, which keeps boxes and stroke
        // ownership sensible even though it can no longer be exact.
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
            // On a proportional mapping an operator is never called a power:
            // the mark under it is not reliably the one it came from.
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

    /// Identifies a line by the shape of its ink: how many marks, where each
    /// one sits, and how much was drawn. Two lines with the same digest read
    /// the same, and one more stroke anywhere changes it.
    private static func digest(of strokes: [InkStroke], glyphHeight: CGFloat) -> String {
        var parts: [String] = [String(format: "%.1f", glyphHeight)]
        for stroke in strokes {
            let b = stroke.bounds
            parts.append(String(format: "%.1f,%.1f,%.1f,%.1f,%d",
                                b.minX, b.minY, b.maxX, b.maxY, stroke.points.count))
        }
        return parts.joined(separator: ";")
    }

    private static func reindex(_ glyphs: [DecodedGlyph], onto marks: [GlyphCluster]) -> [DecodedGlyph] {
        guard !marks.isEmpty else { return glyphs }
        return glyphs.map { glyph in
            var updated = glyph
            // Same geometry, so the mark under a glyph is the one whose box
            // matches the box the glyph was given when it was first read.
            if let mark = marks.first(where: { $0.bounds == glyph.box }) {
                updated.strokeIndexes = mark.strokeIndexes.sorted()
            }
            return updated
        }
    }

    /// One spelling per mark, as an array of symbols.
    private static func symbols(of text: String) -> [String] {
        var out: [String] = []
        for ch in text where !ch.isWhitespace {
            let symbol = MathAlphabet.canonical[ch] ?? String(ch)
            if !symbol.isEmpty { out.append(symbol) }
        }
        return out
    }

    // MARK: Vision

    private struct LineReading {
        var text: String
        var confidence: Double
        /// position → symbol → how much of Vision's other readings back it.
        var agreement: [Int: [String: Double]]
    }

    /// Vision, with a ladder behind it. A line of two or three marks is short
    /// enough that the detector can decide there is no text in the picture at
    /// all; drawn larger, or read with the faster model, the same ink comes
    /// back. A step the student wrote is worth three attempts.
    private func read(_ strokes: [InkStroke], glyphHeight: CGFloat, label: String) -> LineReading? {
        let attempts: [(scale: CGFloat, level: VNRequestTextRecognitionLevel)] = [
            (1.0, .accurate), (1.9, .accurate), (1.0, .fast)
        ]
        for attempt in attempts {
            guard let raster = InkRasterizer.render(
                strokes: strokes,
                glyphHeight: glyphHeight / attempt.scale
            ) else { continue }
            let observations = recognizeText(in: raster.image, level: attempt.level)
            if MathInkRecognizer.trace {
                MathInkRecognizer.dump(raster.image, label: label)
                NSLog("PRIINK   %@ %dx%d level=%@ x%.1f observations=%d", label as NSString,
                      raster.pixelWidth, raster.pixelHeight,
                      attempt.level == .accurate ? "accurate" : "fast",
                      Double(attempt.scale), observations.count)
            }
            guard !observations.isEmpty else { continue }
            if let reading = assemble(observations) { return reading }
        }
        return nil
    }

    /// Left to right across however many pieces Vision split the line into.
    private func assemble(_ observations: [VNRecognizedTextObservation]) -> LineReading? {
        let ordered = observations.sorted { $0.boundingBox.minX < $1.boundingBox.minX }
        var text = ""
        var agreement: [Int: [String: Double]] = [:]
        var confidence: Double = 0
        var pieces = 0

        for observation in ordered {
            let candidates = observation.topCandidates(Self.candidateCount)
            guard let winner = bestCandidate(candidates) else { continue }
            let offset = MathInkRecognizer.symbols(of: text).count
            for (position, votes) in self.agreement(with: winner.candidate, among: candidates) {
                agreement[offset + position] = votes
            }
            text += winner.candidate.string
            confidence += Double(winner.candidate.confidence)
            pieces += 1
            if MathInkRecognizer.trace {
                NSLog("PRIINK   obs \"%@\" conf=%.2f", winner.candidate.string as NSString,
                      Double(winner.candidate.confidence))
            }
        }

        guard pieces > 0, !MathInkRecognizer.symbols(of: text).isEmpty else { return nil }
        return LineReading(text: text, confidence: confidence / Double(pieces), agreement: agreement)
    }

    private func recognizeText(
        in image: CGImage,
        level: VNRequestTextRecognitionLevel
    ) -> [VNRecognizedTextObservation] {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = level
        // Language correction is what turns "2x" into "2a" and "cos" into
        // "cost". A maths line is not English and must not be spell-checked.
        request.usesLanguageCorrection = false
        request.recognitionLanguages = ["en-US"]
        request.revision = VNRecognizeTextRequestRevision3
        request.minimumTextHeight = 0

        let handler = VNImageRequestHandler(cgImage: image, orientation: .up, options: [:])
        do {
            try handler.perform([request])
        } catch {
            return []
        }
        return request.results ?? []
    }

    /// Vision ranks candidates by how likely the MARKS are. On a maths line
    /// that is only half the question, so each candidate is also scored on
    /// whether it says something a maths line is allowed to say.
    private func bestCandidate(
        _ candidates: [VNRecognizedText]
    ) -> (candidate: VNRecognizedText, score: Double)? {
        var best: (candidate: VNRecognizedText, score: Double)?
        for candidate in candidates {
            let spelled = MathInkRecognizer.respell(candidate.string)
            guard !spelled.isEmpty else { continue }
            let score = 0.55 * Double(candidate.confidence) + 0.45 * MathGrammar.score(spelled)
            if best == nil || score > best!.score { best = (candidate, score) }
        }
        return best
    }

    /// Writes what Vision was actually shown to the app's Documents directory,
    /// so a bad reading can be told apart from a bad picture.
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

    /// One spelling per mark, before anything is judged on it.
    static func respell(_ text: String) -> String {
        symbols(of: text).joined()
    }

    /// How much Vision's other readings back each character of the winner.
    /// Agreement across independent candidates is a far better calibrated
    /// signal than the model's own score, which for handwriting sits low even
    /// when it is right — and it is what stops the app stopping to ask about
    /// a reading it is actually sure of.
    private func agreement(
        with winner: VNRecognizedText,
        among candidates: [VNRecognizedText]
    ) -> [Int: [String: Double]] {
        let target = MathInkRecognizer.symbols(of: winner.string)
        var tally: [Int: [String: Double]] = [:]
        var weight: Double = 0

        for candidate in candidates {
            let spelled = MathInkRecognizer.symbols(of: candidate.string)
            // Only same-length readings line up mark for mark; a reading that
            // split a glyph differently votes on nothing.
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
