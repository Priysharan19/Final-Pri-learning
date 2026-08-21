// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Optional stroke-native Core ML expert
//
// This adapter is deliberately non-authoritative. If a calibrated model with
// the exact 20-channel feature contract is bundled, it contributes an online-
// ink hypothesis and an independently trained symbol count. If the model is
// absent, stale, malformed or too small for the trace, the existing recognizer
// continues untouched.
// ─────────────────────────────────────────────────────────────────────────────
import CoreML
import Foundation

actor CoreMLStrokeRecognizer: OnlineInkRecognizing {
    enum Failure: Error {
        case modelUnavailable
        case contractMismatch
        case inputTooLong
        case malformedOutput
    }

    static let featureContract = "pri-ink-features-v1-20"
    static let sourceID = "pri-coreml-stroke-v1"

    private static let tokens: [String] = [
        "<blank>", "<unk>",
        "theta", "sqrt", "sin", "cos", "tan", "sec", "csc", "cot", "log", "ln", "pi",
        "<=", ">=", "!=", "±"
    ] + Array("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+-*/=^().,[]<>!'°%:|?").map(String.init)

    private let model: MLModel
    private let maxPoints: Int
    nonisolated let calibratedForProduction: Bool
    nonisolated let calibrationExamples: Int

    init(model: MLModel) throws {
        let metadata = model.modelDescription.metadata[MLModelMetadataKey.creatorDefinedKey] as? [String: String] ?? [:]
        guard metadata["pri.feature_contract"] == Self.featureContract,
              metadata["pri.acceptance_authority"] == "false" else {
            throw Failure.contractMismatch
        }
        let examples = Int(metadata["pri.calibration_examples"] ?? "0") ?? 0
        self.model = model
        self.maxPoints = max(1, Int(metadata["pri.max_points"] ?? "1024") ?? 1024)
        self.calibrationExamples = examples
        self.calibratedForProduction = examples > 0
    }

    static func bundled() -> CoreMLStrokeRecognizer? {
        guard let url = Bundle.main.url(forResource: "PriInkOnline", withExtension: "mlmodelc") else {
            return nil
        }
        let configuration = MLModelConfiguration()
        configuration.computeUnits = .all
        guard let model = try? MLModel(contentsOf: url, configuration: configuration) else { return nil }
        return try? CoreMLStrokeRecognizer(model: model)
    }

    func recognize(strokes: [InkStroke]) async throws -> [OnlineInkHypothesis] {
        try Task.checkCancellation()
        let tensor = InkFeatureTensor.build(strokes: strokes)
        guard !tensor.rows.isEmpty else { return [] }
        guard tensor.pointCount <= maxPoints else { throw Failure.inputTooLong }

        let points = try MLMultiArray(
            shape: [NSNumber(value: 1), NSNumber(value: maxPoints), NSNumber(value: tensor.featureCount)],
            dataType: .float32
        )
        let valid = try MLMultiArray(
            shape: [NSNumber(value: 1), NSNumber(value: maxPoints)], dataType: .float32
        )
        let zero = NSNumber(value: Float(0))
        let one = NSNumber(value: Float(1))
        for i in 0..<points.count { points[i] = zero }
        for i in 0..<valid.count { valid[i] = zero }

        for (time, row) in tensor.rows.enumerated() {
            valid[time] = one
            for (feature, value) in row.enumerated() {
                points[time * tensor.featureCount + feature] = NSNumber(value: value)
            }
        }
        try Task.checkCancellation()
        let provider = try MLDictionaryFeatureProvider(dictionary: ["points": points, "valid": valid])
        let prediction = try model.prediction(from: provider)
        try Task.checkCancellation()

        guard let tokenLogits = prediction.featureValue(for: "token_logits")?.multiArrayValue,
              let countLogits = prediction.featureValue(for: "count_logits")?.multiArrayValue else {
            throw Failure.malformedOutput
        }
        guard tokenLogits.shape.count == 3,
              tokenLogits.shape[1].intValue >= tensor.pointCount,
              tokenLogits.shape[2].intValue == Self.tokens.count else {
            throw Failure.malformedOutput
        }

        var collapsed: [Int] = []
        var emittedConfidences: [Double] = []
        var previous = -1
        for time in 0..<tensor.pointCount {
            let (winner, probability) = Self.argmaxProbability(tokenLogits, time: time)
            if winner != 0 && winner != previous {
                collapsed.append(winner)
                emittedConfidences.append(probability)
            }
            previous = winner
        }
        let text = collapsed.compactMap { index -> String? in
            guard Self.tokens.indices.contains(index), index > 1 else { return nil }
            return Self.tokens[index]
        }.joined()
        guard !text.isEmpty else { return [] }

        let count = Self.argmaxCount(countLogits)
        let confidence: Double
        if emittedConfidences.isEmpty {
            confidence = 0
        } else {
            let logMean = emittedConfidences.reduce(0.0) { $0 + log(max($1, 1e-8)) }
                / Double(emittedConfidences.count)
            confidence = min(1, max(0, exp(logMean)))
        }
        return [OnlineInkHypothesis(
            text: text,
            latex: nil,
            confidence: confidence,
            source: Self.sourceID,
            symbolCount: count
        )]
    }

    private static func argmaxProbability(_ logits: MLMultiArray, time: Int) -> (Int, Double) {
        let classes = tokens.count
        var values = Array(repeating: 0.0, count: classes)
        var winner = 0
        var maximum = -Double.infinity
        for cls in 0..<classes {
            let index = [NSNumber(value: 0), NSNumber(value: time), NSNumber(value: cls)]
            let value = logits[index].doubleValue
            values[cls] = value
            if value > maximum { maximum = value; winner = cls }
        }
        let denominator = values.reduce(0.0) { $0 + exp($1 - maximum) }
        return (winner, denominator > 0 ? exp(values[winner] - maximum) / denominator : 0)
    }

    private static func argmaxCount(_ logits: MLMultiArray) -> Int {
        guard logits.count > 0 else { return 0 }
        var winner = 0
        var maximum = -Double.infinity
        for index in 0..<logits.count {
            let value = logits[index].doubleValue
            if value > maximum { maximum = value; winner = index }
        }
        return winner
    }
}
