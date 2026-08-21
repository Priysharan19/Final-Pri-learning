import Foundation

/// A recognition hypothesis from an online-ink engine.  The native structural
/// decoder can compare these with Vision/geometry rather than treating any
/// provider as ground truth.
struct OnlineInkHypothesis: Sendable {
    let text: String
    let latex: String?
    let confidence: Double
    let source: String
}

protocol OnlineInkRecognizing: Sendable {
    func recognize(strokes: [InkStroke]) async throws -> [OnlineInkHypothesis]
}

/// Mathpix's stroke endpoint consumes the same vector representation we already
/// have from PencilKit, avoiding an unnecessary bitmap/OCR round trip.
///
/// SECURITY: this client accepts only a short-lived app token.  A Mathpix
/// app_key must never be compiled into the iPad application.  Production code
/// should obtain app_token + strokes_session_id from an authenticated PRI
/// backend endpoint.
actor MathpixStrokeRecognizer: OnlineInkRecognizing {
    struct Session: Sendable {
        let appToken: String
        let strokesSessionID: String?
        let expiresAt: Date

        var isUsable: Bool { expiresAt.timeIntervalSinceNow > 15 }
    }

    enum Failure: Error { case unavailable, malformedResponse, http(Int) }

    private let sessionProvider: @Sendable () async throws -> Session
    private let urlSession: URLSession

    init(
        sessionProvider: @escaping @Sendable () async throws -> Session,
        urlSession: URLSession = .shared
    ) {
        self.sessionProvider = sessionProvider
        self.urlSession = urlSession
    }

    func recognize(strokes: [InkStroke]) async throws -> [OnlineInkHypothesis] {
        try Task.checkCancellation()
        let live = strokes.filter { !$0.isEmpty }
        guard !live.isEmpty else { return [] }

        let session = try await sessionProvider()
        guard session.isUsable else { throw Failure.unavailable }

        var request = URLRequest(url: URL(string: "https://api.mathpix.com/v3/strokes")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(session.appToken, forHTTPHeaderField: "app_token")

        var body: [String: Any] = [
            "strokes": [
                "strokes": [
                    "x": live.map { $0.points.map(\.x) },
                    "y": live.map { $0.points.map(\.y) }
                ]
            ],
            "formats": ["text", "latex_styled"],
            "metadata": ["improve_mathpix": false]
        ]
        if let id = session.strokesSessionID { body["strokes_session_id"] = id }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await urlSession.data(for: request)
        try Task.checkCancellation()
        guard let http = response as? HTTPURLResponse else { throw Failure.malformedResponse }
        guard (200..<300).contains(http.statusCode) else { throw Failure.http(http.statusCode) }
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw Failure.malformedResponse
        }

        let text = (json["text"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let latex = json["latex_styled"] as? String
        let confidence = max(0, min(1, json["confidence"] as? Double ?? json["confidence_rate"] as? Double ?? 0.5))
        guard !text.isEmpty || !(latex ?? "").isEmpty else { return [] }
        return [OnlineInkHypothesis(text: text, latex: latex, confidence: confidence, source: "mathpix-strokes")]
    }
}

/// Offline-first wrapper: local recognition is always available; a remote
/// engine is a cancellable rescue/ensemble signal only when the app explicitly
/// supplies one. Network failure therefore cannot prevent students writing.
actor HybridInkRecognizer {
    private let online: (any OnlineInkRecognizing)?

    init(online: (any OnlineInkRecognizing)? = nil) { self.online = online }

    func onlineHypotheses(for strokes: [InkStroke]) async -> [OnlineInkHypothesis] {
        guard let online else { return [] }
        do { return try await online.recognize(strokes: strokes) }
        catch is CancellationError { return [] }
        catch { return [] }
    }
}
