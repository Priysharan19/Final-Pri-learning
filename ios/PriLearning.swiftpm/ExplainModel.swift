import Foundation
import WebKit

#if canImport(FoundationModels)
import FoundationModels
#endif

// Pri Explain V4 · native on-device teaching model.
//
// This bridge never marks work and never decides mathematical truth. The model
// receives the already-verified solution plus diagnosis context and proposes a
// presentation storyboard. The web layer validates every returned expression
// through storyboard.js before it can replace the local director.
final class ExplainModelBridge {
    func handle(_ body: Any, webView: WKWebView?) {
        guard let message = body as? [String: Any],
              let req = message["reqId"] as? NSNumber,
              let payload = message["payload"] as? [String: Any] else { return }
        let reqId = req.intValue

        Task { [weak self, weak webView] in
            let result = await Self.generate(payload: payload)
            self?.emit(reqId: reqId, result: result, to: webView)
        }
    }

    private static func generate(payload: [String: Any]) async -> [String: Any] {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            return await generateWithFoundationModels(payload: payload)
        }
        #endif
        return [
            "ok": false,
            "engine": "local-director",
            "reason": "Apple Foundation Models is unavailable on this OS"
        ]
    }

    #if canImport(FoundationModels)
    @available(iOS 26.0, *)
    private static func generateWithFoundationModels(payload: [String: Any]) async -> [String: Any] {
        let model = SystemLanguageModel.default
        switch model.availability {
        case .available:
            break
        case .unavailable(let reason):
            return [
                "ok": false,
                "engine": "apple-foundation-models",
                "reason": availabilityReason(reason)
            ]
        }

        guard JSONSerialization.isValidJSONObject(payload),
              let data = try? JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys]),
              let evidenceJSON = String(data: data, encoding: .utf8) else {
            return [
                "ok": false,
                "engine": "apple-foundation-models",
                "reason": "Teaching evidence could not be encoded"
            ]
        }

        let instructions = """
        You are Pri Learning's teaching director for a maths worked explanation.
        You control presentation only. Never decide whether an answer is correct.
        Use only exact mathematical expressions listed in verifiedMath. Never invent
        equations, numerical results, diagrams, marks or checkpoint answers. Prefer
        short scenes, one conceptual change at a time, and a prediction checkpoint
        immediately before an important verified transformation. If a first wrong
        attempt exists, begin with replay_attempt and explain the diagnosed pattern
        without treating the student's wrong expression as mathematical truth.
        """

        let prompt = """
        Create a concise personalised storyboard from this verified teaching evidence.
        Use 2 to 12 scenes. Action kind must match its fields. For transform_equation,
        copy before and after exactly from verifiedMath. For focus_math, copy expression
        exactly from verifiedMath. Use checkpoint only as a question with no answer.

        EVIDENCE JSON:
        \(evidenceJSON)
        """

        do {
            let session = LanguageModelSession(instructions: instructions)
            let response = try await session.respond(to: prompt, generating: GeneratedStoryboard.self)
            return [
                "ok": true,
                "engine": "apple-foundation-models",
                "storyboard": storyboardDictionary(response.content)
            ]
        } catch {
            return [
                "ok": false,
                "engine": "apple-foundation-models",
                "reason": String(describing: error)
            ]
        }
    }

    @available(iOS 26.0, *)
    private static func availabilityReason(_ reason: SystemLanguageModel.Availability.UnavailableReason) -> String {
        switch reason {
        case .deviceNotEligible:
            return "This iPad does not support Apple Intelligence"
        case .appleIntelligenceNotEnabled:
            return "Apple Intelligence is not enabled"
        case .modelNotReady:
            return "The on-device model is not ready"
        @unknown default:
            return "The on-device model is unavailable"
        }
    }

    @available(iOS 26.0, *)
    private static func storyboardDictionary(_ generated: GeneratedStoryboard) -> [String: Any] {
        [
            "version": 3,
            "source": "apple-foundation-models-v1",
            "scenes": generated.scenes.enumerated().map { index, scene in
                [
                    "id": "apple-model-\(index)",
                    "heading": scene.heading,
                    "lines": scene.lines,
                    "narration": scene.narration,
                    "concept": scene.concept,
                    "actions": scene.actions.compactMap(actionDictionary)
                ] as [String: Any]
            }
        ]
    }

    @available(iOS 26.0, *)
    private static func actionDictionary(_ action: GeneratedAction) -> [String: Any]? {
        switch action.kind {
        case "replay_attempt":
            return ["kind": "replay_attempt"]
        case "transform_equation":
            return ["kind": action.kind, "before": action.before, "after": action.after]
        case "focus_math":
            return ["kind": action.kind, "expression": action.expression, "tokens": action.tokens, "label": action.label]
        case "show_figure":
            return ["kind": action.kind, "mode": action.mode]
        case "checkpoint":
            return ["kind": action.kind, "prompt": action.prompt]
        default:
            // Guided generation constrains this already. Returning nil here is a
            // second native boundary; the JavaScript verifier still validates the
            // entire storyboard and rejects unsafe/malformed plans wholesale.
            return nil
        }
    }

    @available(iOS 26.0, *)
    @Generable(description: "A short maths teaching storyboard using only supplied verified mathematics")
    private struct GeneratedStoryboard {
        @Guide(description: "Ordered teaching scenes", .minimumCount(2), .maximumCount(12))
        var scenes: [GeneratedScene]
    }

    @available(iOS 26.0, *)
    @Generable(description: "One concise scene in a worked maths explanation")
    private struct GeneratedScene {
        @Guide(description: "Short pedagogical heading with no invented maths")
        var heading: String

        @Guide(description: "Zero to three short explanation lines", .maximumCount(3))
        var lines: [String]

        @Guide(description: "One short sentence suitable for spoken Australian English")
        var narration: String

        @Guide(description: "Concept label such as algebra, graph, geometry, calculus, statistics, diagnosis or checkpoint")
        var concept: String

        @Guide(description: "One or two visual actions for this scene", .minimumCount(1), .maximumCount(2))
        var actions: [GeneratedAction]
    }

    @available(iOS 26.0, *)
    @Generable(description: "A whitelisted visual teaching action")
    private struct GeneratedAction {
        @Guide(
            description: "Action kind",
            .anyOf(["replay_attempt", "transform_equation", "focus_math", "show_figure", "checkpoint"])
        )
        var kind: String

        @Guide(description: "For transform_equation only: exact verified expression before the change")
        var before: String

        @Guide(description: "For transform_equation only: exact verified expression after the change")
        var after: String

        @Guide(description: "For focus_math only: exact verified expression to focus")
        var expression: String

        @Guide(description: "For focus_math only: zero to four substrings that occur in expression", .maximumCount(4))
        var tokens: [String]

        @Guide(description: "For focus_math only: short non-mathematical label")
        var label: String

        @Guide(description: "For checkpoint only: prediction question; never include its answer")
        var prompt: String

        @Guide(
            description: "For show_figure only: existing figure animation mode",
            .anyOf(["graph", "geometry", "calculus", "statistics", "figure"])
        )
        var mode: String
    }
    #endif

    private func emit(reqId: Int, result: [String: Any], to webView: WKWebView?) {
        var payload = result
        payload["reqId"] = reqId
        guard JSONSerialization.isValidJSONObject(payload),
              let data = try? JSONSerialization.data(withJSONObject: payload),
              var json = String(data: data, encoding: .utf8) else { return }
        json = json.replacingOccurrences(of: "\u{2028}", with: "\\u2028")
                   .replacingOccurrences(of: "\u{2029}", with: "\\u2029")
        DispatchQueue.main.async { [weak webView] in
            webView?.evaluateJavaScript("window.__priExplainModelReceive && window.__priExplainModelReceive(\(json));")
        }
    }
}
