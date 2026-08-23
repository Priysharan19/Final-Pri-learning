// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Local multimodal foundation-model runtime
//
// Loads PriInkFoundation only when a compatible Core ML asset has been bundled.
// DEBUG builds may exercise an unpromoted development checkpoint. RELEASE builds
// require a V3 asset plus `pri.productionReady=true`, which the exporter writes
// only after a passing locked final-holdout report matches the exact checkpoint
// SHA-256. One prediction consumes the original Pencil point stream AND a
// high-resolution raster. No request leaves the device. If the asset is absent
// or rejected, this runtime returns nil and the existing Pri recogniser remains
// available.
// ─────────────────────────────────────────────────────────────────────────────
import CoreGraphics
import CoreML
import Foundation

struct InkFoundationPrediction {
    var text: String
    var confidence: Double
    var agreement: [Int: [String: Double]]
}

final class InkFoundationRuntime {
    private let model: MLModel?
    private let vocab: [String]
    private let padID: Int
    private let bosID: Int
    private let eosID: Int
    private let maxPoints: Int
    private let maxTokens: Int
    private let featureDim: Int
    private let rasterHeight: Int
    private let rasterWidth: Int

    var isAvailable: Bool { model != nil && !vocab.isEmpty }

    init() {
        guard let loaded = Self.loadModel(),
              let metadata = loaded.modelDescription.metadata[.creatorDefinedKey] as? [String: String],
              Self.modelAllowedInThisBuild(metadata),
              let rawVocab = metadata["pri.vocab"] else {
            model = nil; vocab = []; padID = 0; bosID = 1; eosID = 2
            maxPoints = 768; maxTokens = 96; featureDim = 14
            rasterHeight = 128; rasterWidth = 512
            return
        }
        model = loaded
        vocab = rawVocab.split(separator: "|", omittingEmptySubsequences: false).map(String.init)
        padID = Int(metadata["pri.pad"] ?? "0") ?? 0
        bosID = Int(metadata["pri.bos"] ?? "1") ?? 1
        eosID = Int(metadata["pri.eos"] ?? "2") ?? 2
        maxPoints = Int(metadata["pri.maxPoints"] ?? "768") ?? 768
        maxTokens = Int(metadata["pri.maxTokens"] ?? "96") ?? 96
        featureDim = Int(metadata["pri.featureDim"] ?? "14") ?? 14
        rasterHeight = Int(metadata["pri.rasterHeight"] ?? "128") ?? 128
        rasterWidth = Int(metadata["pri.rasterWidth"] ?? "512") ?? 512
    }

    private static func modelAllowedInThisBuild(_ metadata: [String: String]) -> Bool {
        let modelID = metadata["pri.model"] ?? ""
#if DEBUG
        // Keep old unpromoted V2 development assets loadable for comparison,
        // but the current exporter writes V3. Neither DEBUG path is release
        // evidence and the normal fallback chain remains available.
        return modelID == "ink-foundation-v3" || modelID == "ink-foundation-v2"
#else
        // Production must not accidentally promote a stale V2 development
        // package merely because metadata was copied. Only coherent V3 export
        // plus the locked release flag is accepted.
        return modelID == "ink-foundation-v3"
            && metadata["pri.architectureVersion"] == "3"
            && metadata["pri.productionReady"] == "true"
#endif
    }

    func predict(strokes: [InkStroke]) -> InkFoundationPrediction? {
        guard let model, isAvailable, !strokes.isEmpty,
              featureDim == 14,
              let arrays = try? makeInputs(strokes: strokes) else { return nil }
        do {
            let provider = try MLDictionaryFeatureProvider(dictionary: [
                "points": MLFeatureValue(multiArray: arrays.points),
                "point_valid": MLFeatureValue(multiArray: arrays.valid),
                "raster": MLFeatureValue(multiArray: arrays.raster)
            ])
            let output = try model.prediction(from: provider)
            guard let logits = output.featureValue(for: "logits")?.multiArrayValue,
                  logits.shape.count == 3 else { return nil }
            return decode(logits)
        } catch {
            NSLog("Pri Learning: local ink foundation prediction failed: %@", error.localizedDescription)
            return nil
        }
    }

    // MARK: - Model discovery

    private static func loadModel() -> MLModel? {
        var bundles: [Bundle] = [Bundle.main]
        if let nested = Bundle.main.urls(forResourcesWithExtension: "bundle", subdirectory: nil) {
            bundles.append(contentsOf: nested.compactMap { Bundle(url: $0) })
        }
        var source: URL? = nil
        for bundle in bundles {
            for subdir in ["Models", "Resources/Models"] {
                if let compiled = bundle.url(forResource: "PriInkFoundation", withExtension: "mlmodelc", subdirectory: subdir) {
                    source = compiled
                    break
                }
                if let package = bundle.url(forResource: "PriInkFoundation", withExtension: "mlpackage", subdirectory: subdir) {
                    source = package
                    break
                }
            }
            if source != nil { break }
        }
        guard let source else { return nil }
        do {
            let url = source.pathExtension == "mlmodelc"
                ? source
                : try MLModel.compileModel(at: source)
            let configuration = MLModelConfiguration()
            configuration.computeUnits = .all
            return try MLModel(contentsOf: url, configuration: configuration)
        } catch {
            NSLog("Pri Learning: local ink foundation model could not load: %@", error.localizedDescription)
            return nil
        }
    }

    // MARK: - Feature parity with tools/ink-foundation/data.py

    private struct Inputs {
        let points: MLMultiArray
        let valid: MLMultiArray
        let raster: MLMultiArray
    }

    private static func index(_ values: Int...) -> [NSNumber] {
        values.map { NSNumber(value: $0) }
    }

    private func makeInputs(strokes: [InkStroke]) throws -> Inputs {
        let points = try MLMultiArray(
            shape: [NSNumber(value: 1), NSNumber(value: maxPoints), NSNumber(value: featureDim)],
            dataType: .float32
        )
        let valid = try MLMultiArray(
            shape: [NSNumber(value: 1), NSNumber(value: maxPoints)],
            dataType: .float32
        )
        let raster = try MLMultiArray(
            shape: [NSNumber(value: 1), NSNumber(value: 1), NSNumber(value: rasterHeight), NSNumber(value: rasterWidth)],
            dataType: .float32
        )
        for i in 0..<points.count { points[i] = NSNumber(value: 0.0) }
        for i in 0..<valid.count { valid[i] = NSNumber(value: 0.0) }
        for i in 0..<raster.count { raster[i] = NSNumber(value: 0.0) }

        let live = strokes.enumerated().filter { !$0.element.points.isEmpty }
        guard !live.isEmpty else { return Inputs(points: points, valid: valid, raster: raster) }
        let all = live.flatMap { $0.element.points }
        let minX = all.map(\.x).min() ?? 0, maxX = all.map(\.x).max() ?? 1
        let minY = all.map(\.y).min() ?? 0, maxY = all.map(\.y).max() ?? 1
        let scale = max(maxX - minX, maxY - minY, 1)
        let cx = (minX + maxX) / 2, cy = (minY + maxY) / 2

        var features: [[Float]] = []
        for (strokeIndex, stroke) in live {
            var previous: (x: CGFloat, y: CGFloat, t: TimeInterval)?
            for (pointIndex, p) in stroke.points.enumerated() {
                let x = (p.x - cx) / scale, y = (p.y - cy) / scale
                let time = p.t > 0 || pointIndex == 0 ? p.t : Double(pointIndex) / 120.0
                let dx: CGFloat, dy: CGFloat, dt: Double, speed: Double
                if let previous {
                    dx = x - previous.x; dy = y - previous.y
                    dt = min(0.2, max(0, time - previous.t))
                    speed = min(8, hypot(Double(dx), Double(dy)) / max(dt, 0.001)) / 8
                } else {
                    dx = 0; dy = 0; dt = 0; speed = 0
                }
                let azimuth = Double(p.azimuth)
                let altitude = min(Double.pi / 2, max(0, Double(p.altitude)))
                features.append([
                    Float(x), Float(y), Float(dx), Float(dy), Float(dt / 0.2), Float(speed),
                    Float(min(2, max(0, p.force)) / 2), Float(min(16, max(0, p.w)) / 8),
                    Float(sin(azimuth)), Float(cos(azimuth)), Float(altitude / (Double.pi / 2)),
                    pointIndex == 0 ? 1 : 0,
                    pointIndex == stroke.points.count - 1 ? 1 : 0,
                    Float(min(strokeIndex, 31)) / 31
                ])
                previous = (x, y, time)
            }
        }

        if features.count > maxPoints {
            var sampled: [[Float]] = []
            sampled.reserveCapacity(maxPoints)
            for i in 0..<maxPoints {
                let j = Int((Double(i) * Double(features.count - 1) / Double(maxPoints - 1)).rounded())
                sampled.append(features[j])
            }
            features = sampled
        }
        for i in 0..<features.count {
            valid[Self.index(0, i)] = NSNumber(value: 1.0)
            for f in 0..<featureDim {
                points[Self.index(0, i, f)] = NSNumber(value: features[i][f])
            }
        }
        fillRaster(strokes: strokes, into: raster)
        return Inputs(points: points, valid: valid, raster: raster)
    }

    private func fillRaster(strokes: [InkStroke], into output: MLMultiArray) {
        let live = strokes.filter { !$0.points.isEmpty }
        guard !live.isEmpty else { return }
        let all = live.flatMap(\.points)
        let minX = all.map(\.x).min() ?? 0, maxX = all.map(\.x).max() ?? 1
        let minY = all.map(\.y).min() ?? 0, maxY = all.map(\.y).max() ?? 1
        let spanX = max(maxX - minX, 1), spanY = max(maxY - minY, 1)
        let pad: CGFloat = 8
        let scale = min((CGFloat(rasterWidth) - 2 * pad) / spanX,
                        (CGFloat(rasterHeight) - 2 * pad) / spanY)
        let ox = (CGFloat(rasterWidth) - spanX * scale) / 2 - minX * scale
        let oy = (CGFloat(rasterHeight) - spanY * scale) / 2 - minY * scale

        var pixels = [UInt8](repeating: 0, count: rasterWidth * rasterHeight)
        let colorSpace = CGColorSpaceCreateDeviceGray()
        pixels.withUnsafeMutableBytes { raw in
            guard let base = raw.baseAddress,
                  let context = CGContext(
                    data: base,
                    width: rasterWidth,
                    height: rasterHeight,
                    bitsPerComponent: 8,
                    bytesPerRow: rasterWidth,
                    space: colorSpace,
                    bitmapInfo: CGImageAlphaInfo.none.rawValue
                  ) else { return }
            context.setFillColor(gray: 0, alpha: 1)
            context.fill(CGRect(x: 0, y: 0, width: rasterWidth, height: rasterHeight))
            context.translateBy(x: 0, y: CGFloat(rasterHeight))
            context.scaleBy(x: 1, y: -1)
            context.setStrokeColor(gray: 1, alpha: 1)
            context.setFillColor(gray: 1, alpha: 1)
            context.setLineCap(.round)
            context.setLineJoin(.round)
            context.setShouldAntialias(true)

            let map: (InkPoint) -> CGPoint = { p in
                CGPoint(x: p.x * scale + ox, y: p.y * scale + oy)
            }
            for stroke in live {
                guard let first = stroke.points.first else { continue }
                let width = max(1, stroke.meanWidth * max(scale, 0.5))
                context.setLineWidth(width)
                if stroke.points.count == 1 {
                    let c = map(first), r = max(1, width / 2)
                    context.fillEllipse(in: CGRect(x: c.x-r, y: c.y-r, width: 2*r, height: 2*r))
                    continue
                }
                context.beginPath()
                context.move(to: map(first))
                for p in stroke.points.dropFirst() { context.addLine(to: map(p)) }
                context.strokePath()
            }
        }
        for y in 0..<rasterHeight {
            for x in 0..<rasterWidth {
                let value = Float(pixels[y * rasterWidth + x]) / 255
                output[Self.index(0, 0, y, x)] = NSNumber(value: value)
            }
        }
    }

    // MARK: - Parallel sequence decode

    private func decode(_ logits: MLMultiArray) -> InkFoundationPrediction? {
        let slots = min(maxTokens, logits.shape[1].intValue)
        let classes = min(vocab.count, logits.shape[2].intValue)
        guard slots > 0, classes > 0 else { return nil }
        var pieces: [String] = []
        var agreement: [Int: [String: Double]] = [:]
        var confidences: [Double] = []

        for slot in 0..<slots {
            var raw: [(id: Int, logit: Double)] = []
            raw.reserveCapacity(classes)
            var maxLogit = -Double.infinity
            for id in 0..<classes {
                let v = logits[Self.index(0, slot, id)].doubleValue
                raw.append((id, v))
                maxLogit = max(maxLogit, v)
            }
            var denom = 0.0
            let unnormalised = raw.map { item -> (Int, Double) in
                let p = exp(item.logit - maxLogit)
                denom += p
                return (item.id, p)
            }
            let ranked = unnormalised
                .map { ($0.0, $0.1 / max(denom, 1e-12)) }
                .sorted { $0.1 > $1.1 }
            guard let top = ranked.first else { break }
            if top.0 == eosID || top.0 == padID { break }
            if top.0 == bosID { continue }
            guard vocab.indices.contains(top.0) else { continue }
            let token = vocab[top.0]
            if token.hasPrefix("<") { continue }
            pieces.append(token)
            confidences.append(top.1)
            var candidates: [String: Double] = [:]
            for (id, p) in ranked.prefix(6) where vocab.indices.contains(id) {
                let candidate = vocab[id]
                if !candidate.hasPrefix("<") { candidates[candidate] = p }
            }
            agreement[pieces.count - 1] = candidates
        }
        guard !pieces.isEmpty else { return nil }
        let mean = confidences.reduce(0, +) / Double(confidences.count)
        let weakest = confidences.min() ?? mean
        return InkFoundationPrediction(
            text: pieces.joined(),
            confidence: 0.65 * mean + 0.35 * weakest,
            agreement: agreement
        )
    }
}
