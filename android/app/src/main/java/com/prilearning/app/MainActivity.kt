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
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.webkit.RenderProcessGoneDetail
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
    internal var webView: WebView? = null
        private set
    internal var bridge: PriBridge? = null
        private set
    private lateinit var root: FrameLayout
    private lateinit var assetLoader: WebViewAssetLoader

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
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
        val priBridge = PriBridge(view, descriptor)
        if (!priBridge.install()) {
            // Fail closed: without origin-scoped messaging the shell offers no
            // native capabilities, so it does not load the app half-working.
            showUpdateScreen(getString(R.string.webview_unsupported_body))
            return
        }
        webView = view
        bridge = priBridge
        root.addView(view, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                priBridge.requestBack {
                    val wv = webView
                    if (wv != null && wv.canGoBack()) wv.goBack() else finish()
                }
            }
        })

        if (savedInstanceState == null || !view.restoreStateSafely(savedInstanceState)) {
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
    }

    private inner class ShellClient : WebViewClient() {
        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
            assetLoader.shouldInterceptRequest(request.url)

        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
            when (NavigationPolicy.decide(request.url)) {
                NavigationPolicy.Decision.LOAD_IN_APP -> false
                NavigationPolicy.Decision.OPEN_EXTERNALLY -> { openExternally(request.url); true }
                NavigationPolicy.Decision.BLOCK -> true
            }

        override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
            bridge?.documentStarted()
        }

        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
            // The renderer died (memory pressure or crash): rebuild and reload.
            // Drafts survive because the page persists them to localStorage.
            recreate()
            return true
        }
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
