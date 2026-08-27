import WebKit

/// Dedicated WKWebView message endpoint for Pri Explain. Keeping this separate
/// from the shell coordinator prevents teaching-model requests from sharing the
/// PencilKit, photo OCR or file/share bridge namespaces.
final class ExplainModelMessageHandler: NSObject, WKScriptMessageHandler {
    private let bridge = ExplainModelBridge()

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        bridge.handle(message.body, webView: message.webView)
    }
}
