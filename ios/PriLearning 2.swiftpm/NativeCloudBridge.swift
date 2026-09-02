// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · NativeCloudBridge
//
// The bundled app runs from `prilearning://`, so browser fetch cannot safely
// share the production HTTPS cookie/origin model. This bridge keeps the cloud
// session entirely in URLSession/HTTPCookieStorage and exposes only bounded
// `/v1` JSON requests to the web layer. JavaScript never supplies a destination
// origin and never receives the session or CSRF cookies.
// ─────────────────────────────────────────────────────────────────────────────
import Foundation
import WebKit

final class NativeCloudBridge {
    static let responseEvent = "pri:native-cloud-response"
    static var isConfigured: Bool { configuredOrigin != nil }

    private static let maxRequestBytes = 1 * 1024 * 1024
    private static let maxResponseBytes = 2 * 1024 * 1024
    private static let allowedMethods: Set<String> = ["GET", "POST", "PATCH", "DELETE"]

    private weak var webView: WKWebView?
    private let cookieStorage: HTTPCookieStorage
    private lazy var session: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.httpCookieStorage = cookieStorage
        configuration.httpShouldSetCookies = true
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        configuration.urlCache = nil
        configuration.timeoutIntervalForRequest = 60
        configuration.timeoutIntervalForResource = 75
        return URLSession(configuration: configuration)
    }()
    private let taskLock = NSLock()
    private var tasks: [String: URLSessionDataTask] = [:]

    init(cookieStorage: HTTPCookieStorage = .shared) {
        self.cookieStorage = cookieStorage
    }

    func attach(to webView: WKWebView) {
        self.webView = webView
    }

    func detach() {
        taskLock.lock()
        let running = Array(tasks.values)
        tasks.removeAll()
        taskLock.unlock()
        running.forEach { $0.cancel() }
        webView = nil
    }

    func handle(_ raw: Any) {
        guard let body = raw as? [String: Any],
              let requestId = body["id"] as? String,
              !requestId.isEmpty,
              requestId.count <= 120,
              let action = body["action"] as? String else { return }

        if action == "cancel" {
            cancel(requestId)
            return
        }
        guard action == "request" else {
            respond(requestId, error: BridgeError.invalidRequest)
            return
        }
        perform(requestId, body: body)
    }

    private func perform(_ requestId: String, body: [String: Any]) {
        guard let origin = Self.configuredOrigin else {
            respond(requestId, error: BridgeError.notConfigured)
            return
        }
        guard let path = body["path"] as? String,
              Self.validPath(path),
              let methodRaw = body["method"] as? String else {
            respond(requestId, error: BridgeError.invalidRequest)
            return
        }
        let method = methodRaw.uppercased()
        guard Self.allowedMethods.contains(method),
              let url = Self.url(origin: origin, path: path) else {
            respond(requestId, error: BridgeError.invalidRequest)
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.timeoutInterval = 60
        request.httpShouldHandleCookies = true
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("ios-native-v1", forHTTPHeaderField: "X-Pri-Client")

        if let rid = body["requestId"] as? String, Self.safeHeader(rid) {
            request.setValue(rid, forHTTPHeaderField: "X-Pri-Request-Id")
        }
        if let idempotency = body["idempotencyKey"] as? String, Self.safeHeader(idempotency) {
            request.setValue(idempotency, forHTTPHeaderField: "Idempotency-Key")
        }

        if method != "GET", let csrf = csrfCookie(for: origin) {
            request.setValue(csrf, forHTTPHeaderField: "X-Pri-CSRF")
        }

        if let text = body["body"] as? String {
            guard let data = text.data(using: .utf8), data.count <= Self.maxRequestBytes else {
                respond(requestId, error: BridgeError.requestTooLarge)
                return
            }
            request.httpBody = data
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        let task = session.dataTask(with: request) { [weak self] data, response, error in
            guard let self else { return }
            self.removeTask(requestId)
            if let error {
                if (error as NSError).code == NSURLErrorCancelled { return }
                self.respond(requestId, error: BridgeError.network(error.localizedDescription))
                return
            }
            guard let http = response as? HTTPURLResponse else {
                self.respond(requestId, error: BridgeError.badResponse)
                return
            }
            let payload = data ?? Data()
            guard payload.count <= Self.maxResponseBytes else {
                self.respond(requestId, error: BridgeError.responseTooLarge)
                return
            }
            guard let text = String(data: payload, encoding: .utf8) else {
                self.respond(requestId, error: BridgeError.badResponse)
                return
            }
            self.respond(
                requestId,
                status: http.statusCode,
                body: text,
                serverRequestId: http.value(forHTTPHeaderField: "X-Pri-Request-Id")
            )
        }
        storeTask(task, id: requestId)
        task.resume()
    }

    private func csrfCookie(for origin: URL) -> String? {
        cookieStorage.cookies(for: origin)?.first(where: { $0.name == "pri_csrf" })?.value
    }

    private func storeTask(_ task: URLSessionDataTask, id: String) {
        taskLock.lock()
        let previous = tasks.updateValue(task, forKey: id)
        taskLock.unlock()
        previous?.cancel()
    }

    private func removeTask(_ id: String) {
        taskLock.lock()
        tasks.removeValue(forKey: id)
        taskLock.unlock()
    }

    private func cancel(_ id: String) {
        taskLock.lock()
        let task = tasks.removeValue(forKey: id)
        taskLock.unlock()
        task?.cancel()
    }

    private func respond(
        _ requestId: String,
        status: Int? = nil,
        body: String? = nil,
        serverRequestId: String? = nil,
        error: Error? = nil
    ) {
        var detail: [String: Any] = ["id": requestId]
        if let status { detail["status"] = status }
        if let body { detail["body"] = body }
        if let serverRequestId, Self.safeHeader(serverRequestId) { detail["requestId"] = serverRequestId }
        if let error {
            detail["error"] = [
                "code": Self.errorCode(error),
                "message": error.localizedDescription
            ]
        }
        emit(detail)
    }

    private func emit(_ detail: [String: Any]) {
        guard JSONSerialization.isValidJSONObject(detail),
              let data = try? JSONSerialization.data(withJSONObject: detail),
              var json = String(data: data, encoding: .utf8) else { return }
        json = json.replacingOccurrences(of: "\u{2028}", with: "\\u2028")
                   .replacingOccurrences(of: "\u{2029}", with: "\\u2029")
        DispatchQueue.main.async { [weak self] in
            guard let webView = self?.webView else { return }
            let script = "window.dispatchEvent(new CustomEvent('" + Self.responseEvent + "',{detail:" + json + "}));"
            webView.evaluateJavaScript(script, completionHandler: nil)
        }
    }

    private static func errorCode(_ error: Error) -> String {
        if let bridge = error as? BridgeError { return bridge.code }
        return "NATIVE_CLOUD_ERROR"
    }

    private static func safeHeader(_ value: String) -> Bool {
        !value.isEmpty && value.count <= 160 && value.unicodeScalars.allSatisfy { scalar in
            scalar.value >= 0x21 && scalar.value <= 0x7E
        }
    }

    private static func validPath(_ path: String) -> Bool {
        path.hasPrefix("/v1/") && path.count <= 200 && !path.contains("..") &&
            !path.contains("\\") && !path.contains("?") && !path.contains("#")
    }

    private static func url(origin: URL, path: String) -> URL? {
        guard var components = URLComponents(url: origin, resolvingAgainstBaseURL: false) else { return nil }
        components.path = path
        components.query = nil
        components.fragment = nil
        guard let candidate = components.url,
              candidate.scheme == origin.scheme,
              candidate.host == origin.host,
              candidate.port == origin.port else { return nil }
        return candidate
    }

    private static var configuredOrigin: URL? {
        let environment = ProcessInfo.processInfo.environment["PRI_CLOUD_ORIGIN"]
        let plist = Bundle.main.object(forInfoDictionaryKey: "PRICloudOrigin") as? String
        #if DEBUG
        let development = UserDefaults.standard.string(forKey: "PRICloudOrigin")
        #else
        let development: String? = nil
        #endif
        for value in [environment, plist, development] {
            if let origin = validateOrigin(value) { return origin }
        }
        return nil
    }

    private static func validateOrigin(_ raw: String?) -> URL? {
        guard let text = raw?.trimmingCharacters(in: .whitespacesAndNewlines),
              !text.isEmpty,
              var components = URLComponents(string: text),
              components.user == nil,
              components.password == nil,
              components.query == nil,
              components.fragment == nil,
              components.host != nil,
              components.path.isEmpty || components.path == "/" else { return nil }
        let scheme = components.scheme?.lowercased()
        #if DEBUG
        let local = ["localhost", "127.0.0.1", "::1"].contains(components.host?.lowercased() ?? "")
        guard scheme == "https" || (scheme == "http" && local) else { return nil }
        #else
        guard scheme == "https" else { return nil }
        #endif
        components.path = ""
        components.query = nil
        components.fragment = nil
        return components.url
    }
}

private enum BridgeError: LocalizedError {
    case invalidRequest
    case notConfigured
    case requestTooLarge
    case responseTooLarge
    case badResponse
    case network(String)

    var code: String {
        switch self {
        case .invalidRequest: return "NATIVE_CLOUD_BAD_REQUEST"
        case .notConfigured: return "CLOUD_DISABLED"
        case .requestTooLarge: return "CLOUD_REQUEST_TOO_LARGE"
        case .responseTooLarge: return "CLOUD_RESPONSE_TOO_LARGE"
        case .badResponse: return "CLOUD_BAD_RESPONSE"
        case .network: return "CLOUD_NETWORK_ERROR"
        }
    }

    var errorDescription: String? {
        switch self {
        case .invalidRequest: return "The native cloud request is invalid."
        case .notConfigured: return "The native Pri cloud origin is not configured. Offline learning remains available."
        case .requestTooLarge: return "The cloud request exceeded the native safety limit."
        case .responseTooLarge: return "The cloud response exceeded the native safety limit."
        case .badResponse: return "The cloud service returned an invalid response."
        case .network(let message): return "The cloud service is unavailable: \(message)"
        }
    }
}
