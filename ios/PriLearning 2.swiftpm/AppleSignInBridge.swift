// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · AppleSignInBridge (priNative `identity.appleSignIn`, CP-02)
//
// Runs the system Sign in with Apple sheet for the page and returns Apple's
// identity token. That is all it does: the Pri server verifies the token
// (issuer, audience, signature, nonce) and issues the session; this shell never
// decides who the person is and never touches the cloud session.
//
// Nonce handling follows Apple's documented pattern: the page asks the Pri
// server for a single-use nonce, hashes it with SHA-256 and sends ONLY the hex
// digest here; the digest goes on the request and Apple returns it in the
// identity token's `nonce` claim. The raw nonce never reaches this code.
//
// Reached only through NativeHostBridge, i.e. after WebShell's
// isTrustedSender gate (this shell's own web view, main frame, prilearning://app).
//
// Requires the Sign in with Apple capability (entitlement
// com.apple.developer.applesignin) on the app id — an Xcode/App Store Connect
// setting, not something this package can declare. Without it the controller
// fails and the page sees PROVIDER_ERROR. Uncompiled here: no macOS/Xcode in
// the authoring environment.
// ─────────────────────────────────────────────────────────────────────────────
import AuthenticationServices
import UIKit
import WebKit

final class AppleSignInBridge: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    private struct Job {
        let id: String
        let nonceDigest: String
        let reply: ([String: Any]) -> Void
        let fail: (_ code: String, _ message: String) -> Void
    }

    private weak var webView: WKWebView?
    private var controller: ASAuthorizationController?
    private var job: Job?

    func attach(to webView: WKWebView) {
        self.webView = webView
    }

    /// Tearing the shell down answers any sheet still open as CANCELLED so the
    /// page never waits on a reply that cannot come.
    func detach() {
        if let open = takeJob() { open.fail("CANCELLED", "The app view went away before Sign in with Apple finished.") }
        controller = nil
        webView = nil
    }

    // MARK: Request

    /// `payload.nonce` must be the lowercase hex SHA-256 digest of a server-issued
    /// nonce. One sheet at a time; a second request while one is open is refused
    /// rather than queued, because the person can only answer one sheet.
    func signIn(_ id: String, _ payload: [String: Any],
                reply: @escaping ([String: Any]) -> Void,
                fail: @escaping (_ code: String, _ message: String) -> Void) {
        guard let digest = payload["nonce"] as? String, Self.isNonceDigest(digest) else {
            return fail("BAD_REQUEST", "identity.appleSignIn needs the SHA-256 hex digest of a server-issued nonce.")
        }
        guard job == nil else { return fail("UNAVAILABLE", "A Sign in with Apple sheet is already open.") }
        guard webView?.window != nil || Self.foregroundWindow() != nil else {
            return fail("UNAVAILABLE", "No window to present from.")
        }

        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.email, .fullName]
        request.nonce = digest

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        job = Job(id: id, nonceDigest: digest, reply: reply, fail: fail)
        self.controller = controller
        controller.performRequests()
    }

    private static func isNonceDigest(_ value: String) -> Bool {
        guard value.utf8.count == 64, value.count == 64 else { return false }
        return value.allSatisfy { $0.isASCII && $0.isHexDigit && !$0.isUppercase }
    }

    private func takeJob() -> Job? {
        let open = job
        job = nil
        controller = nil
        return open
    }

    // MARK: ASAuthorizationControllerPresentationContextProviding

    /// The sheet is anchored to the window that holds the web view, so it sits
    /// over the page that asked for it (Stage Manager / multiple scenes).
    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        if let window = webView?.window { return window }
        if let window = Self.foregroundWindow() { return window }
        return ASPresentationAnchor()
    }

    private static func foregroundWindow() -> UIWindow? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let scene = scenes.first(where: { $0.activationState == .foregroundActive }) ?? scenes.first
        return scene?.keyWindow ?? scene?.windows.first
    }

    // MARK: ASAuthorizationControllerDelegate

    func authorizationController(controller: ASAuthorizationController,
                                 didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let open = takeJob() else { return }
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            return open.fail("PROVIDER_ERROR", "Apple returned an unexpected credential type.")
        }
        guard let tokenData = credential.identityToken,
              let token = String(data: tokenData, encoding: .utf8), !token.isEmpty else {
            return open.fail("PROVIDER_ERROR", "Apple did not return an identity token.")
        }

        var result: [String: Any] = ["identityToken": token, "nonce": open.nonceDigest]
        if let codeData = credential.authorizationCode,
           let code = String(data: codeData, encoding: .utf8), !code.isEmpty {
            result["authorizationCode"] = code
        }
        // Apple shares email and name on the first authorization only; later
        // sign-ins carry them inside the token, which the server reads itself.
        var user: [String: Any] = [:]
        if let email = credential.email?.trimmingCharacters(in: .whitespacesAndNewlines), !email.isEmpty {
            user["email"] = String(email.prefix(254))
        }
        if let components = credential.fullName {
            let name = PersonNameComponentsFormatter.localizedString(from: components, style: .default, options: [])
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if !name.isEmpty { user["fullName"] = String(name.prefix(160)) }
        }
        if !user.isEmpty { result["user"] = user }
        open.reply(result)
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        guard let open = takeJob() else { return }
        // Map into the closed priNative error set (docs §4.3). The person
        // dismissing the sheet is USER_CANCELLED; everything else is the
        // provider's failure, with Apple's code kept in the message for support.
        guard let authError = error as? ASAuthorizationError else {
            return open.fail("PROVIDER_ERROR", "Sign in with Apple failed (\((error as NSError).code)).")
        }
        switch authError.code {
        case .canceled:
            open.fail("USER_CANCELLED", "Sign in with Apple was cancelled.")
        case .notInteractive:
            open.fail("UNAVAILABLE", "Sign in with Apple cannot be shown right now.")
        default:
            // .failed, .invalidResponse, .notHandled, .unknown and any code a
            // newer SDK adds (e.g. .matchedExcludedCredential).
            open.fail("PROVIDER_ERROR", "Sign in with Apple failed (ASAuthorizationError \(authError.code.rawValue)).")
        }
    }
}
