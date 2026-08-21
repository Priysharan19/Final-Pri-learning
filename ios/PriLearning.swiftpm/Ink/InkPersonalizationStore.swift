// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Bounded native handwriting personalization
//
// A student's ambiguous shapes are usually consistent: their 1, y, theta or x
// tends to look the same every time. Global recognition remains the authority,
// while repeated EXPLICIT corrections provide weak evidence for future
// low-confidence readings made by the SAME profile.
//
// Privacy / safety properties:
// - profile-scoped: one student's hand never influences another student's
// - stores feature vectors only, never raw Pencil coordinates or images
// - bounded per profile and per symbol
// - requires repeated examples before making a suggestion
// - only compares symbols inside known visual-confusion families
// - never overrides a high-confidence global reading
// - can be reset per profile or completely
// ─────────────────────────────────────────────────────────────────────────────
import CoreGraphics
import Foundation

final class InkPersonalizationStore {

    static let shared = InkPersonalizationStore()

    struct Suggestion {
        var symbol: String
        var confidence: Double
        var distance: Double
        var margin: Double
    }

    private struct Sample: Codable {
        // Optional so a pre-profile v1 store can still decode. Unscoped legacy
        // rows are intentionally ignored rather than assigned to the next user.
        var profile: String?
        var symbol: String
        var features: [Double]
        var created: TimeInterval
    }

    private let lock = NSLock()
    private let defaults: UserDefaults
    private let key = "pri.nativeInk.personalization.v1"
    private let maxTotalSamples = 384
    private let maxSamplesPerProfile = 96
    private let maxSamplesPerSymbol = 12
    private let minimumSamplesForInfluence = 2
    private var samples: [Sample] = []

    private static let families: [[String]] = [
        ["1", "l", "I", "|", "y", "(", ")"],
        ["0", "o", "O", "theta"],
        ["2", "z", "Z"],
        ["5", "s", "S"],
        ["6", "b", "G"],
        ["7", "T", "1"],
        ["8", "B", "3"],
        ["9", "g", "q", "4"],
        ["x", "*", "×", "4", "k"],
        ["r", "v", "u"],
        ["c", "("]
    ]

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        load()
    }

    func sampleCount(profile rawProfile: String? = nil) -> Int {
        lock.lock(); defer { lock.unlock() }
        guard let profile = Self.profile(rawProfile) else { return samples.count }
        return samples.filter { $0.profile == profile }.count
    }

    func reset(profile rawProfile: String? = nil) {
        lock.lock()
        if let profile = Self.profile(rawProfile) {
            samples.removeAll { $0.profile == profile }
            persistLocked()
        } else {
            samples.removeAll()
            defaults.removeObject(forKey: key)
        }
        lock.unlock()
    }

    /// Learn only from a correction whose symbol was tied to exact Pencil
    /// strokes. Callers enforce that ownership rule before reaching this API.
    func learn(profile rawProfile: String, symbol rawSymbol: String, strokes: [InkStroke]) {
        guard let profile = Self.profile(rawProfile) else { return }
        let symbol = Self.canonical(rawSymbol)
        guard Self.family(containing: symbol) != nil,
              let vector = Self.features(strokes), vector.count == Self.featureCount else { return }

        lock.lock()
        defer { lock.unlock() }

        // A repeated callback for the same correction should not fill the
        // bounded store with copies. Only almost-identical feature vectors are
        // collapsed; natural variation from the same writer is independent
        // evidence and must remain available for personalization.
        let existingForSymbol = samples.filter { $0.profile == profile && $0.symbol == symbol }
        if existingForSymbol.contains(where: { Self.distance($0.features, vector) < 0.002 }) {
            return
        }

        samples.append(Sample(profile: profile, symbol: symbol, features: vector,
                              created: Date().timeIntervalSince1970))

        // Keep the newest examples of this symbol for this hand.
        let same = samples.indices.filter {
            samples[$0].profile == profile && samples[$0].symbol == symbol
        }
        if same.count > maxSamplesPerSymbol {
            let remove = same.sorted { samples[$0].created < samples[$1].created }
                .prefix(same.count - maxSamplesPerSymbol)
            for index in remove.sorted(by: >) { samples.remove(at: index) }
        }

        // Bound each profile independently so a sibling cannot evict another
        // sibling's entire hand just by using the app more often.
        let own = samples.indices.filter { samples[$0].profile == profile }
        if own.count > maxSamplesPerProfile {
            let remove = own.sorted { samples[$0].created < samples[$1].created }
                .prefix(own.count - maxSamplesPerProfile)
            for index in remove.sorted(by: >) { samples.remove(at: index) }
        }

        // A final device-wide cap prevents abandoned profiles accumulating
        // indefinitely. Eviction is oldest-first and never changes attribution.
        if samples.count > maxTotalSamples {
            samples.sort { $0.created < $1.created }
            samples.removeFirst(samples.count - maxTotalSamples)
        }
        persistLocked()
    }

    /// A personal suggestion is intentionally weaker than a global recognizer.
    /// It needs at least two corrected examples, a close feature match and a
    /// useful margin over the next trained symbol in the same ambiguity family.
    func suggestion(
        profile rawProfile: String,
        for strokes: [InkStroke],
        current rawCurrent: String,
        alternatives rawAlternatives: [String],
        globalConfidence: Double
    ) -> Suggestion? {
        guard let profile = Self.profile(rawProfile),
              globalConfidence < 0.86,
              let vector = Self.features(strokes) else { return nil }
        let current = Self.canonical(rawCurrent)
        guard let family = Self.family(containing: current) else { return nil }
        let explicit = Set(rawAlternatives.map(Self.canonical))

        lock.lock()
        let snapshot = samples.filter { $0.profile == profile }
        lock.unlock()

        var scores: [(symbol: String, distance: Double, count: Int)] = []
        for symbol in family where symbol != current {
            let own = snapshot.filter { $0.symbol == symbol }
            guard own.count >= minimumSamplesForInfluence else { continue }
            let distances = own.map { Self.distance($0.features, vector) }.sorted()
            let take = min(3, distances.count)
            let mean = distances.prefix(take).reduce(0, +) / Double(take)
            // If Vision independently offered the symbol, that signal earns a
            // small preference without making either engine authoritative.
            let adjusted = max(0, mean - (explicit.contains(symbol) ? 0.025 : 0))
            scores.append((symbol, adjusted, own.count))
        }
        guard !scores.isEmpty else { return nil }
        scores.sort { $0.distance < $1.distance }
        let best = scores[0]
        let secondDistance = scores.dropFirst().first?.distance ?? 1.0
        let margin = secondDistance - best.distance

        // Conservative normalized-feature gates. They are deliberately not
        // tuned to the ten-expression Vision benchmark.
        guard best.distance <= 0.24, margin >= 0.055 else { return nil }
        let closeness = max(0, min(1, 1 - best.distance / 0.24))
        let repetition = min(1, Double(best.count) / 5.0)
        let confidence = min(0.82, 0.58 + 0.16 * closeness + 0.08 * repetition)
        return Suggestion(symbol: best.symbol, confidence: confidence,
                          distance: best.distance, margin: margin)
    }

    // MARK: - Feature extraction

    private static let featureCount = 12

    /// Translation- and scale-normalized features that describe how a glyph was
    /// produced, not where it happened to sit on the page. The last feature can
    /// use the online timing/pressure signal when real Pencil data supplies it;
    /// synthetic and legacy strokes simply fall back to zero.
    private static func features(_ strokes: [InkStroke]) -> [Double]? {
        let live = strokes.filter { !$0.isEmpty }
        guard !live.isEmpty else { return nil }
        let box = live.dropFirst().reduce(live[0].bounds) { $0.union($1.bounds) }
        let width = max(Double(box.width), 0.5)
        let height = max(Double(box.height), 0.5)
        let diagonal = max(hypot(width, height), 1)
        let totalLength = live.reduce(0.0) { $0 + Double($1.pathLength) }

        var straightness = 0.0
        var horizontal = 0.0
        var vertical = 0.0
        var diagonalMotion = 0.0
        var endpointClosure = 0.0
        var timedSpeed: [Double] = []
        var forces: [Double] = []

        for stroke in live {
            guard let first = stroke.points.first, let last = stroke.points.last else { continue }
            let dx = Double(last.x - first.x)
            let dy = Double(last.y - first.y)
            let chord = hypot(dx, dy)
            let length = max(Double(stroke.pathLength), 0.001)
            straightness += chord / length
            horizontal += abs(dx) / max(chord, 0.001)
            vertical += abs(dy) / max(chord, 0.001)
            diagonalMotion += min(abs(dx), abs(dy)) / max(chord, 0.001)
            endpointClosure += chord / diagonal
            if let duration = stroke.duration, duration > 0.004 {
                timedSpeed.append(min(1, (length / diagonal) / max(duration * 18, 0.001)))
            }
            if let force = stroke.meanForce { forces.append(min(1, max(0, Double(force)))) }
        }
        let count = Double(live.count)
        let intersection = crossingScore(live)
        let loopish = live.contains { stroke in
            guard let first = stroke.points.first, let last = stroke.points.last else { return false }
            let local = stroke.bounds
            let d = max(hypot(Double(local.width), Double(local.height)), 1)
            return stroke.points.count >= 7
                && hypot(Double(last.x - first.x), Double(last.y - first.y)) / d < 0.34
                && Double(stroke.pathLength) / d > 1.55
        } ? 1.0 : 0.0

        func mean(_ values: [Double], fallback: Double = 0) -> Double {
            values.isEmpty ? fallback : values.reduce(0, +) / Double(values.count)
        }

        return [
            min(1, count / 4.0),
            min(1, width / height / 2.5),
            min(1, height / width / 4.0),
            min(1, totalLength / diagonal / 4.5),
            min(1, straightness / count),
            min(1, horizontal / count),
            min(1, vertical / count),
            min(1, diagonalMotion / count),
            min(1, endpointClosure / count),
            intersection,
            loopish,
            0.72 * mean(timedSpeed) + 0.28 * mean(forces)
        ]
    }

    private static func crossingScore(_ strokes: [InkStroke]) -> Double {
        guard strokes.count >= 2 else { return 0 }
        var crosses = 0
        for i in 0..<(strokes.count - 1) {
            guard let a0 = strokes[i].points.first, let a1 = strokes[i].points.last else { continue }
            for j in (i + 1)..<strokes.count {
                guard let b0 = strokes[j].points.first, let b1 = strokes[j].points.last else { continue }
                if segmentsIntersect(CGPoint(x: a0.x, y: a0.y), CGPoint(x: a1.x, y: a1.y),
                                     CGPoint(x: b0.x, y: b0.y), CGPoint(x: b1.x, y: b1.y)) {
                    crosses += 1
                }
            }
        }
        return min(1, Double(crosses) / 2.0)
    }

    private static func segmentsIntersect(_ p: CGPoint, _ p2: CGPoint,
                                          _ q: CGPoint, _ q2: CGPoint) -> Bool {
        let r = CGPoint(x: p2.x - p.x, y: p2.y - p.y)
        let s = CGPoint(x: q2.x - q.x, y: q2.y - q.y)
        let denominator = r.x * s.y - r.y * s.x
        guard abs(denominator) > 0.0001 else { return false }
        let qp = CGPoint(x: q.x - p.x, y: q.y - p.y)
        let t = (qp.x * s.y - qp.y * s.x) / denominator
        let u = (qp.x * r.y - qp.y * r.x) / denominator
        return t > 0.08 && t < 0.92 && u > 0.08 && u < 0.92
    }

    private static let weights: [Double] = [
        0.70, 0.90, 0.75, 0.85, 0.70, 0.65, 0.65, 0.60, 0.65, 1.00, 1.00, 0.30
    ]

    private static func distance(_ a: [Double], _ b: [Double]) -> Double {
        guard a.count == featureCount, b.count == featureCount else { return 1 }
        var weighted = 0.0
        var weight = 0.0
        for i in 0..<featureCount {
            let w = weights[i]
            let delta = a[i] - b[i]
            weighted += w * delta * delta
            weight += w
        }
        return sqrt(weighted / max(weight, 0.001))
    }

    // MARK: - Persistence / families

    private static func profile(_ raw: String?) -> String? {
        let value = raw?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !value.isEmpty, value.count <= 160 else { return nil }
        return value
    }

    private static func canonical(_ symbol: String) -> String {
        switch symbol {
        case "×", "✕": return "*"
        case "O": return "0"
        default: return symbol
        }
    }

    private static func family(containing symbol: String) -> [String]? {
        families.first { $0.contains(symbol) }
    }

    private func load() {
        guard let data = defaults.data(forKey: key),
              let decoded = try? JSONDecoder().decode([Sample].self, from: data) else { return }
        // Keep bounded modern rows. Legacy nil-profile rows decode but can
        // influence nobody, so discard them during the first scoped load.
        samples = Array(decoded.filter { Self.profile($0.profile) != nil }.suffix(maxTotalSamples))
    }

    private func persistLocked() {
        guard let data = try? JSONEncoder().encode(samples) else { return }
        defaults.set(data, forKey: key)
    }
}
