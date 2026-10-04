// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · LocalSchemeHandler
// Serves the bundled web build (Resources/Web) over prilearning://app/…
// A custom scheme (rather than file://) gives the page a stable origin, so
// IndexedDB and localStorage persist in the app's sandbox across launches.
// SPA routes without a file extension fall back to index.html.
// ─────────────────────────────────────────────────────────────────────────────
import WebKit

final class LocalSchemeHandler: NSObject, WKURLSchemeHandler {

    /// Root of the bundled web build inside the app bundle. Depending on how
    /// the package is built (Swift Playground on iPad, Xcode app playground),
    /// resources land either directly in the main bundle or inside a nested
    /// SwiftPM resource bundle — so search all of them at runtime instead of
    /// relying on the compile-time `Bundle.module` accessor, which Xcode does
    /// not synthesize for app playgrounds.
    private lazy var webRoot: URL? = {
        var bundles: [Bundle] = [Bundle.main]
        if let nested = Bundle.main.urls(forResourcesWithExtension: "bundle", subdirectory: nil) {
            bundles.append(contentsOf: nested.compactMap { Bundle(url: $0) })
        }
        for bundle in bundles {
            for subdirectory in ["Web", "Resources/Web"] {
                if let index = bundle.url(forResource: "index", withExtension: "html", subdirectory: subdirectory) {
                    return index.deletingLastPathComponent()
                }
            }
        }
        return nil
    }()

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }

        var path = url.path
        if path.isEmpty || path == "/" { path = "/index.html" }
        // React Router routes ("/practice", "/exams/abc") have no extension —
        // they are the app shell, not files.
        if (path as NSString).pathExtension.isEmpty { path = "/index.html" }

        guard let root = webRoot else {
            urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist))
            return
        }

        let fileURL = root.appendingPathComponent(String(path.dropFirst()))
        guard let data = FileManager.default.contents(atPath: fileURL.path) else {
            urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist))
            return
        }

        let ext = fileURL.pathExtension.lowercased()
        let mime = Self.mimeType(for: ext)
        let isText = mime.hasPrefix("text/") || mime.contains("javascript")
            || mime.contains("json") || mime.contains("svg")

        // An HTTPURLResponse (not a bare URLResponse) so the bundled page is
        // governed by the same enforced Content-Security-Policy the Pri
        // platform server sends for the web build. WebKit honours CSP headers
        // delivered through a WKURLSchemeHandler exactly as it does over HTTPS.
        var headers = Self.securityHeaders
        headers["Content-Type"] = isText ? "\(mime); charset=utf-8" : mime
        headers["Content-Length"] = String(data.count)
        guard let response = HTTPURLResponse(
            url: url,
            statusCode: 200,
            httpVersion: "HTTP/1.1",
            headerFields: headers
        ) else {
            urlSchemeTask.didFailWithError(URLError(.cannotParseResponse))
            return
        }
        urlSchemeTask.didReceive(response)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }

    /// Mirror of server/platform/headers.js contentSecurityPolicy(): scripts are
    /// only the hashed Vite chunks served from this origin (prilearning://app),
    /// style-src keeps 'unsafe-inline' for React style attributes, KaTeX inline
    /// layout and the ink guard's injected <style>, images/media may be data:
    /// or blob: (canvas exports, photo capture, downloads), fonts are the
    /// bundled KaTeX woff2 files. connect-src stays 'self': the web code never
    /// talks to the cloud from WebKit in a native shell — every /v1 request goes
    /// through NativeCloudBridge (priNative.cloud), which owns the session
    /// cookies outside the web view (CP-07). The static regression test
    /// client/test/native-shell-csp-check.mjs reads this list and refuses any
    /// directive weaker than the server policy.
    static let contentSecurityPolicyDirectives: [String] = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "worker-src 'self'",
        "manifest-src 'self'",
        "media-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'"
    ]

    static let contentSecurityPolicy: String = contentSecurityPolicyDirectives.joined(separator: "; ")

    static let securityHeaders: [String: String] = [
        "Content-Security-Policy": contentSecurityPolicy,
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Cache-Control": "no-cache"
    ]

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        // Responses are served synchronously from the bundle — nothing to cancel.
    }

    private static func mimeType(for ext: String) -> String {
        switch ext {
        case "html":               return "text/html"
        case "js", "mjs":          return "text/javascript"
        case "css":                return "text/css"
        case "svg":                return "image/svg+xml"
        case "png":                return "image/png"
        case "jpg", "jpeg":        return "image/jpeg"
        case "ico":                return "image/x-icon"
        case "json", "webmanifest", "map":
                                   return "application/json"
        case "woff2":              return "font/woff2"
        case "woff":               return "font/woff"
        case "ttf":                return "font/ttf"
        case "txt":                return "text/plain"
        default:                   return "application/octet-stream"
        }
    }
}
