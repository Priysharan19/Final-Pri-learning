// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Android shell activity (CP-06)
//
// One activity hosting one WebView that serves the SAME shared web build as the
// browser and the Apple shell. The shell adds only platform plumbing:
// bundled-origin loading, a hardened WebView, navigation lockdown, system-bar
// insets, lifecycle events, Back, release identity and the WebView floor.
// docs/cross-platform/ANDROID_ARCHITECTURE.md is the authority.
// ─────────────────────────────────────────────────────────────────────────────
package com.prilearning.app

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.os.SystemClock
import android.webkit.JsResult
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.prilearning.app.bridge.HostDescriptor
import com.prilearning.app.bridge.PriBridge
import com.prilearning.app.release.ReleaseIdentity
import com.prilearning.app.shell.AssetOrigin
import com.prilearning.app.shell.NavigationPolicy
import com.prilearning.app.shell.WebViewFloor

class MainActivity : ComponentActivity() {
    private companion object {
        // Renderer-crash recovery is rate limited across recreations in one process.
        val rendererCrashes = ArrayDeque<Long>()
        var recoveringFromCrash = false
        const val MAX_CRASHES = 2
        const val CRASH_WINDOW_MS = 30_000L
    }

    internal var webView: WebView? = null
        private set
    internal var bridge: PriBridge? = null
        private set
    private lateinit var root: FrameLayout
    private lateinit var assetLoader: WebViewAssetLoader

    override fun onCreate(savedInstanceState: Bundle?) {
        // The shell paints a fixed dark background behind the bars, so the bar
        // icons are always light (auto would pick dark icons in light mode).
        enableEdgeToEdge(SystemBarStyle.dark(Color.TRANSPARENT), SystemBarStyle.dark(Color.TRANSPARENT))
        super.onCreate(savedInstanceState)
        root = FrameLayout(this).apply { setBackgroundColor(Color.rgb(10, 10, 9)) }
        setContentView(root)
        // Edge-to-edge (mandatory from API 35): the WebView is letterboxed inside
        // system bars, cutout and keyboard, like the Apple shell, so the page's
        // own layout needs no inset arithmetic.
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.ime()
            )
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }

        val webViewPackage = WebViewCompat.getCurrentWebViewPackage(this)
        if (!WebViewFloor.isSupported(webViewPackage?.versionName)) {
            showUpdateScreen(getString(R.string.webview_update_body))
            return
        }
        assetLoader = AssetOrigin.loader(assets)
        val view = createWebView()
        val descriptor = HostDescriptor.json(
            HostDescriptor.Shell(BuildConfig.VERSION_NAME, BuildConfig.VERSION_CODE.toString(), BuildConfig.APPLICATION_ID),
            ReleaseIdentity.read(assets)
        )
        // Back is enabled exactly while the page has declared it wants it (a
        // sheet is open or it has in-app history). Otherwise the system default
        // runs: predictive back-to-home, and the task moves to the background.
        val backCallback = object : OnBackPressedCallback(false) {
            override fun handleOnBackPressed() {
                if (bridge?.deliverBack() != true) {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        }
        val priBridge = PriBridge(view, descriptor) { wanted -> backCallback.isEnabled = wanted }
        if (!priBridge.install()) {
            // Fail closed: without origin-scoped messaging the shell offers no
            // native capabilities, so it does not load the app half-working.
            showUpdateScreen(getString(R.string.webview_unsupported_body))
            return
        }
        webView = view
        bridge = priBridge
        root.addView(view, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

        onBackPressedDispatcher.addCallback(this, backCallback)

        // After a renderer crash the saved state may be what crashed it: start fresh.
        val restore = savedInstanceState != null && !recoveringFromCrash
        recoveringFromCrash = false
        if (!restore || !view.restoreStateSafely(savedInstanceState!!)) {
            view.loadUrl(AssetOrigin.START_URL)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun createWebView(): WebView = WebView(this).apply {
        setBackgroundColor(Color.rgb(10, 10, 9))
        with(settings) {
            javaScriptEnabled = true
            domStorageEnabled = true           // localStorage + IndexedDB
            allowFileAccess = false            // assets come only via WebViewAssetLoader
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setSupportMultipleWindows(false)
            mediaPlaybackRequiresUserGesture = true
            setGeolocationEnabled(false)
            safeBrowsingEnabled = true
            // textZoom stays at its default so the system font scale reaches the page.
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(settings, false) // the page owns its theme
        }
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        webViewClient = ShellClient()
        webChromeClient = ShellChrome()
    }

    private inner class ShellClient : WebViewClient() {
        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
            if (NavigationPolicy.isUnservedBundledHost(request.url)) AssetOrigin.notFound()
            else assetLoader.shouldInterceptRequest(request.url)

        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
            when (NavigationPolicy.decide(request.url, request.isForMainFrame, request.hasGesture())) {
                NavigationPolicy.Decision.LOAD_IN_APP -> false
                NavigationPolicy.Decision.OPEN_EXTERNALLY -> { openExternally(request.url); true }
                NavigationPolicy.Decision.BLOCK -> true
            }

        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
            // The renderer died (memory pressure or crash). The dead WebView must
            // not be touched again, so it is removed and destroyed first. Drafts
            // survive because the page persists them to localStorage. A renderer
            // that keeps dying gets a native screen instead of a recreate loop.
            root.removeView(view)
            view.destroy()
            webView = null
            bridge = null
            val now = SystemClock.elapsedRealtime()
            while (rendererCrashes.isNotEmpty() && now - rendererCrashes.first() > CRASH_WINDOW_MS) rendererCrashes.removeFirst()
            rendererCrashes.addLast(now)
            if (rendererCrashes.size > MAX_CRASHES) {
                showCrashScreen()
            } else {
                recoveringFromCrash = true
                recreate()
            }
            return true
        }
    }

    /** window.alert/confirm get real native dialogs (the WebView default
     *  silently suppresses them, so a confirm() would always answer false). */
    private inner class ShellChrome : WebChromeClient() {
        override fun onJsAlert(view: WebView, url: String?, message: String?, result: JsResult): Boolean {
            AlertDialog.Builder(this@MainActivity).setMessage(message)
                .setPositiveButton(android.R.string.ok) { _, _ -> result.confirm() }
                .setOnCancelListener { result.cancel() }.show()
            return true
        }

        override fun onJsConfirm(view: WebView, url: String?, message: String?, result: JsResult): Boolean {
            AlertDialog.Builder(this@MainActivity).setMessage(message)
                .setPositiveButton(android.R.string.ok) { _, _ -> result.confirm() }
                .setNegativeButton(android.R.string.cancel) { _, _ -> result.cancel() }
                .setOnCancelListener { result.cancel() }.show()
            return true
        }
    }

    private fun showCrashScreen() {
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(64, 64, 64, 64)
        }
        column.addView(TextView(this).apply {
            text = getString(R.string.renderer_crash_body); textSize = 16f; setTextColor(Color.LTGRAY); setPadding(0, 0, 0, 24)
        })
        column.addView(Button(this).apply {
            text = getString(R.string.renderer_crash_retry)
            setOnClickListener { rendererCrashes.clear(); recoveringFromCrash = true; recreate() }
        })
        root.addView(column)
    }

    private fun openExternally(uri: Uri) {
        try { startActivity(Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)) }
        catch (_: ActivityNotFoundException) { /* no handler: stay in the app */ }
    }

    override fun onResume() { super.onResume(); webView?.onResume(); bridge?.setLifecycle("active") }
    override fun onPause() { bridge?.setLifecycle("inactive"); webView?.onPause(); super.onPause() }
    override fun onStop() { bridge?.setLifecycle("background"); super.onStop() }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView?.saveState(outState)
    }

    override fun onDestroy() {
        webView?.let { root.removeView(it); it.destroy() }
        webView = null
        super.onDestroy()
    }

    private fun WebView.restoreStateSafely(state: Bundle): Boolean =
        try { restoreState(state) != null } catch (_: Exception) { false }

    private fun showUpdateScreen(body: String) {
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(64, 64, 64, 64)
        }
        column.addView(TextView(this).apply {
            text = getString(R.string.webview_update_title); textSize = 22f; setTextColor(Color.WHITE)
        })
        column.addView(TextView(this).apply {
            text = body; textSize = 16f; setTextColor(Color.LTGRAY); setPadding(0, 24, 0, 24)
        })
        column.addView(Button(this).apply {
            text = getString(R.string.webview_update_button)
            setOnClickListener { openExternally(Uri.parse("market://details?id=com.google.android.webview")) }
        })
        root.addView(column)
    }
}
