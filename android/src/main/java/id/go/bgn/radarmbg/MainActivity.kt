package id.go.bgn.radarmbg

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.*
import android.widget.LinearLayout
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.google.android.material.bottomnavigation.BottomNavigationView
import com.google.android.material.progressindicator.LinearProgressIndicator

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var progressBar: LinearProgressIndicator
    private lateinit var errorContainer: LinearLayout
    private lateinit var bottomNav: BottomNavigationView

    private val BASE = "http://10.0.2.2/MBG-MONITORING/"
    private val URLS = mapOf(
        R.id.nav_home to "${BASE}index.html",
        R.id.nav_menu_today to "${BASE}menu-hari-ini.html",
        R.id.nav_distribution to "${BASE}distribusi-sebaran-sppg.html",
        R.id.nav_report to "${BASE}laporan-aduan.html"
    )

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.mainWebView)
        swipeRefresh = findViewById(R.id.swipeRefreshLayout)
        progressBar = findViewById(R.id.pageProgressBar)
        errorContainer = findViewById(R.id.errorContainer)
        bottomNav = findViewById(R.id.bottomNavigationView)

        setupWebView()
        setupBottomNav()
        setupSwipeRefresh()
        setupBackPress()

        // Retry button
        findViewById<View>(R.id.btnRetryConnection)?.setOnClickListener {
            errorContainer.visibility = View.GONE
            webView.visibility = View.VISIBLE
            webView.reload()
        }

        // Load home on start
        webView.loadUrl(URLS[R.id.nav_home]!!)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            loadsImagesAutomatically = true
            allowFileAccess = true
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            useWideViewPort = true
            loadWithOverviewMode = true
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url.toString()
                // Open external intents
                return when {
                    url.startsWith("https://wa.me") ||
                    url.startsWith("whatsapp://") ||
                    url.startsWith("https://www.google.com/maps") ||
                    url.startsWith("geo:") ||
                    url.startsWith("tel:") ||
                    url.startsWith("mailto:") -> {
                        try {
                            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                        true
                    }
                    else -> false
                }
            }

            override fun onPageFinished(view: WebView, url: String) {
                swipeRefresh.isRefreshing = false
                progressBar.visibility = View.GONE
                errorContainer.visibility = View.GONE
                webView.visibility = View.VISIBLE
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) {
                    swipeRefresh.isRefreshing = false
                    progressBar.visibility = View.GONE
                    webView.visibility = View.GONE
                    errorContainer.visibility = View.VISIBLE
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                progressBar.visibility = if (newProgress < 100) View.VISIBLE else View.GONE
                progressBar.progress = newProgress
            }
        }
    }

    private fun setupBottomNav() {
        bottomNav.setOnItemSelectedListener { item ->
            val url = URLS[item.itemId]
            if (url != null) {
                webView.loadUrl(url)
                errorContainer.visibility = View.GONE
                webView.visibility = View.VISIBLE
                progressBar.visibility = View.VISIBLE
                true
            } else false
        }
    }

    private fun setupSwipeRefresh() {
        swipeRefresh.setColorSchemeColors(
            getColor(R.color.bgn_primary),
            getColor(R.color.bgn_secondary),
            getColor(R.color.bgn_status_success)
        )
        swipeRefresh.setOnRefreshListener {
            webView.reload()
        }
    }

    private fun setupBackPress() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
    }
}
