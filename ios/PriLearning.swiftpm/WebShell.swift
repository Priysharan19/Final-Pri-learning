// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · WebShell
// Hosts the bundled Pri Learning build in a WKWebView served over a custom
// prilearning:// scheme (so IndexedDB/localStorage persist in the app sandbox).
// Native integrations:
//   • priShare message handler → iOS share sheet for backups / task packs /
//     progress files (AirDrop, Files, Mail…)
//   • WKDownload for any blob downloads → share sheet
//   • external http(s) links open in Safari
//   • camera/file inputs work natively for photo attach and imports
// ─────────────────────────────────────────────────────────────────────────────
import SwiftUI
import WebKit

struct WebShell: UIViewRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(LocalSchemeHandler(), forURLScheme: "prilearning")
        config.websiteDataStore = WKWebsiteDataStore.default()
        config.allowsInlineMediaPlayback = true
        config.defaultWebpagePreferences.allowsContentJavaScript = true

        // Tell the web app it is running inside the native shell.
        let nativeFlag = WKUserScript(
            source: "window.__PRI_NATIVE__ = true;",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        )
        config.userContentController.addUserScript(nativeFlag)
        config.userContentController.add(context.coordinator, name: "priShare")

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        // Apple Pencil never scrolls — fingers scroll, the Pencil draws.
        // Keeping the Pencil out of the scroll view's gesture arbitration
        // removes the recognition delay that makes web inking feel laggy.
        webView.scrollView.panGestureRecognizer.allowedTouchTypes =
            [NSNumber(value: UITouch.TouchType.direct.rawValue)]
        webView.allowsBackForwardNavigationGestures = false
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 10 / 255, green: 10 / 255, blue: 9 / 255, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor
        if #available(iOS 16.4, *) {
            webView.isInspectable = true   // Safari Web Inspector while developing
        }

        webView.load(URLRequest(url: URL(string: "prilearning://app/")!))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    // MARK: - Coordinator

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, WKDownloadDelegate {
        private var downloadDestination: URL?

        // ── Share bridge: the web app posts {filename, content} for export ──
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "priShare",
                  let body = message.body as? [String: Any],
                  let filename = body["filename"] as? String,
                  let content = body["content"] as? String else { return }
            let safeName = filename
                .components(separatedBy: CharacterSet(charactersIn: "/\\:"))
                .joined(separator: "-")
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(safeName)
            do {
                try content.data(using: .utf8)?.write(to: url, options: .atomic)
                presentShareSheet(for: url)
            } catch {
                // Nothing sensible to do beyond not crashing — the web side
                // falls back to its own download path on the next attempt.
            }
        }

        // ── Navigation policy ──
        func webView(_ webView: WKWebView,
                     decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if navigationAction.shouldPerformDownload {
                decisionHandler(.download)
                return
            }
            if let url = navigationAction.request.url,
               let scheme = url.scheme?.lowercased(),
               scheme == "http" || scheme == "https" {
                // The app itself is fully local — anything http(s) is an
                // outbound link, which belongs in Safari.
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }

        func webView(_ webView: WKWebView,
                     decidePolicyFor navigationResponse: WKNavigationResponse,
                     decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
            if !navigationResponse.canShowMIMEType {
                decisionHandler(.download)
                return
            }
            decisionHandler(.allow)
        }

        // target="_blank" links (e.g. the printable paper) open in-place.
        func webView(_ webView: WKWebView,
                     createWebViewWith configuration: WKWebViewConfiguration,
                     for navigationAction: WKNavigationAction,
                     windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let url = navigationAction.request.url {
                if let scheme = url.scheme?.lowercased(), scheme == "http" || scheme == "https" {
                    UIApplication.shared.open(url)
                } else {
                    webView.load(navigationAction.request)
                }
            }
            return nil
        }

        // ── Blob/anchor downloads → temp file → share sheet ──
        func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
            download.delegate = self
        }

        func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
            download.delegate = self
        }

        func download(_ download: WKDownload,
                      decideDestinationUsing response: URLResponse,
                      suggestedFilename: String,
                      completionHandler: @escaping (URL?) -> Void) {
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(suggestedFilename)
            try? FileManager.default.removeItem(at: url)
            downloadDestination = url
            completionHandler(url)
        }

        func downloadDidFinish(_ download: WKDownload) {
            if let url = downloadDestination {
                presentShareSheet(for: url)
                downloadDestination = nil
            }
        }

        func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
            downloadDestination = nil
        }

        // ── iOS share sheet (iPad requires a popover anchor) ──
        private func presentShareSheet(for url: URL) {
            DispatchQueue.main.async {
                let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
                guard let scene = scenes.first(where: { $0.activationState == .foregroundActive }) ?? scenes.first,
                      let root = scene.keyWindow?.rootViewController else { return }
                var top = root
                while let presented = top.presentedViewController { top = presented }
                let activity = UIActivityViewController(activityItems: [url], applicationActivities: nil)
                if let popover = activity.popoverPresentationController {
                    popover.sourceView = top.view
                    popover.sourceRect = CGRect(x: top.view.bounds.midX, y: 96, width: 1, height: 1)
                    popover.permittedArrowDirections = []
                }
                top.present(activity, animated: true)
            }
        }
    }
}
