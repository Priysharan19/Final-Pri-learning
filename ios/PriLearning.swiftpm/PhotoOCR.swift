import Foundation
import UIKit
import Vision
import WebKit

// Native, offline photo handwriting reader. Vision is deliberately treated as
// an OCR candidate generator, not a marker: the web layer exposes/editable text
// and never auto-submits what Vision guessed.
final class PhotoOCRBridge {
    private let queue = DispatchQueue(label: "com.prilearning.photo.ocr", qos: .userInitiated)

    func handle(_ body: Any, webView: WKWebView?) {
        guard let message = body as? [String: Any],
              let req = message["reqId"] as? NSNumber,
              let dataURL = message["dataURL"] as? String else { return }
        let reqId = req.intValue
        queue.async { [weak webView] in
            do {
                let result = try Self.recognize(dataURL: dataURL)
                self.emit([
                    "reqId": reqId, "ok": true, "text": result.text,
                    "answer": result.answer, "confidence": result.confidence,
                    "lines": result.lines, "engine": "apple-vision-photo-v1"
                ], to: webView)
            } catch {
                self.emit([
                    "reqId": reqId, "ok": false,
                    "error": error.localizedDescription,
                    "engine": "apple-vision-photo-v1"
                ], to: webView)
            }
        }
    }

    private struct OCRResult {
        let text: String
        let answer: String
        let confidence: Double
        let lines: [[String: Any]]
    }

    private enum OCRError: LocalizedError {
        case badImage, noText
        var errorDescription: String? {
            switch self {
            case .badImage: return "That photo could not be decoded. Try retaking it closer to the page."
            case .noText: return "No readable handwriting was found. Try brighter light and fill more of the frame with the working."
            }
        }
    }

    private static func recognize(dataURL: String) throws -> OCRResult {
        guard let comma = dataURL.firstIndex(of: ","),
              let data = Data(base64Encoded: String(dataURL[dataURL.index(after: comma)...]), options: .ignoreUnknownCharacters),
              let image = UIImage(data: data), let cgImage = image.cgImage else { throw OCRError.badImage }

        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = false
        request.recognitionLanguages = ["en-US"]
        request.customWords = ["sin", "cos", "tan", "theta", "sqrt", "pi", "log", "ln", "dx", "dy"]
        request.minimumTextHeight = 0.010
        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        try handler.perform([request])

        let observations = (request.results ?? []).sorted { a, b in
            if abs(a.boundingBox.midY - b.boundingBox.midY) > 0.025 { return a.boundingBox.midY > b.boundingBox.midY }
            return a.boundingBox.minX < b.boundingBox.minX
        }
        var lines: [[String: Any]] = []
        var texts: [String] = []
        var confidences: [Double] = []
        for observation in observations {
            guard let top = observation.topCandidates(3).first else { continue }
            let text = normalizeMath(top.string)
            guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { continue }
            let conf = Double(top.confidence)
            texts.append(text)
            confidences.append(conf)
            lines.append([
                "text": text, "confidence": conf,
                "box": ["x": observation.boundingBox.minX, "y": observation.boundingBox.minY,
                        "w": observation.boundingBox.width, "h": observation.boundingBox.height]
            ])
        }
        guard !texts.isEmpty else { throw OCRError.noText }
        let joined = texts.joined(separator: "\n")
        let answer = answerCandidate(from: texts)
        let confidence = confidences.reduce(0, +) / Double(max(confidences.count, 1))
        return OCRResult(text: joined, answer: answer, confidence: confidence, lines: lines)
    }

    private static func normalizeMath(_ raw: String) -> String {
        var s = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        for (a, b) in [("−", "-"), ("–", "-"), ("—", "-"), ("×", "*"), ("·", "*"), ("÷", "/"), ("＝", "=")] {
            s = s.replacingOccurrences(of: a, with: b)
        }
        s = s.replacingOccurrences(of: #"\s*([=+\-*/<>])\s*"#, with: "$1", options: .regularExpression)
        return s
    }

    private static func answerCandidate(from lines: [String]) -> String {
        guard var last = lines.reversed().first(where: { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }) else { return "" }
        last = last.replacingOccurrences(of: #"^(?i)\s*(ans(?:wer)?\s*[:=]\s*)"#, with: "", options: .regularExpression)
        if let eq = last.lastIndex(of: "=") {
            let rhs = String(last[last.index(after: eq)...]).trimmingCharacters(in: .whitespacesAndNewlines)
            if !rhs.isEmpty { return rhs }
        }
        return last.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func emit(_ payload: [String: Any], to webView: WKWebView?) {
        guard JSONSerialization.isValidJSONObject(payload),
              let data = try? JSONSerialization.data(withJSONObject: payload),
              var json = String(data: data, encoding: .utf8) else { return }
        json = json.replacingOccurrences(of: "\u{2028}", with: "\\u2028")
                   .replacingOccurrences(of: "\u{2029}", with: "\\u2029")
        DispatchQueue.main.async { [weak webView] in
            webView?.evaluateJavaScript("window.__priPhotoReceive && window.__priPhotoReceive(\(json));")
        }
    }
}
