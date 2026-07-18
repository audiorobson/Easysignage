package com.easysignage.firetv

import android.annotation.SuppressLint
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.graphics.Bitmap
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.view.SurfaceView
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebStorage
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.easysignage.firetv.bridge.BridgeResult
import com.easysignage.firetv.bridge.CommandDispatcher
import com.easysignage.firetv.bridge.EasySignageJsBridge
import com.easysignage.firetv.bridge.PlayerActions
import com.easysignage.firetv.bridge.RtspSurfacePlayer
import java.io.ByteArrayOutputStream

/**
 * Activity única do kiosk (PR 7.1) — carrega o `apps/web-player` numa WebView em modo
 * fullscreen/leanback e expõe `window.easysignage` (ver `assets/easysignage-bridge.js`) para os
 * mesmos comandos remotos/RTSP já suportados no Electron (Fase 5.C).
 */
class MainActivity : AppCompatActivity(), PlayerActions {

    private lateinit var webView: WebView
    private lateinit var surfaceRtsp: SurfaceView
    private lateinit var rtspPlayer: RtspSurfacePlayer
    private val mainHandler = Handler(Looper.getMainLooper())
    private var reloadRetries = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        enableKioskFullscreen()

        webView = findViewById(R.id.webview)
        surfaceRtsp = findViewById(R.id.surface_rtsp)
        rtspPlayer = RtspSurfacePlayer(this, surfaceRtsp)

        configureWebView(webView)
        webView.addJavascriptInterface(EasySignageJsBridge(webView, CommandDispatcher(this)), "AndroidBridge")
        webView.loadUrl(BuildConfig.WEB_PLAYER_URL)
    }

    override fun onDestroy() {
        rtspPlayer.stop()
        webView.destroy()
        super.onDestroy()
    }

    /** Kiosk: sem barra de navegação/estado; back button não sai da app (ver docs/matriz-hardware-tv.md). */
    @Suppress("DEPRECATION")
    private fun enableKioskFullscreen() {
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).let { controller ->
            controller.hide(WindowInsetsCompat.Type.systemBars())
            controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    override fun onBackPressed() {
        // Kiosk: ignora o botão "voltar" do comando — apenas `commands.restartPlayer`/`reboot_os`
        // remotos saem do ecrã actual. Ver PR 5.12 (Electron) para o mesmo racional.
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView(webView: WebView) {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            cacheMode = WebSettings.LOAD_DEFAULT
            allowFileAccess = false
            allowContentAccess = false
        }
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String?) {
                reloadRetries = 0
                view.evaluateJavascript(loadBridgeScript(), null)
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError
            ) {
                if (!request.isForMainFrame) return
                scheduleReload()
            }
        }
    }

    /** Watchdog simples: nova tentativa com backoff crescente até 60s — mesma ideia do PR 5.12 no Electron. */
    private fun scheduleReload() {
        reloadRetries += 1
        val delayMs = minOf(60_000L, 2_000L * reloadRetries)
        mainHandler.postDelayed({ webView.loadUrl(BuildConfig.WEB_PLAYER_URL) }, delayMs)
    }

    private fun loadBridgeScript(): String =
        assets.open("easysignage-bridge.js").bufferedReader(Charsets.UTF_8).use { it.readText() }

    // ---------------------------------------------------------------------------------------
    // PlayerActions — executor dos comandos remotos (ver docs/teste-producao.md, PR 7.1)
    // ---------------------------------------------------------------------------------------

    override fun restartPlayer(callback: (BridgeResult) -> Unit) {
        callback(BridgeResult.Success())
        mainHandler.post { recreate() }
    }

    override fun clearCache(callback: (BridgeResult) -> Unit) {
        webView.clearCache(true)
        WebStorage.getInstance().deleteAllData()
        CookieManager.getInstance().removeAllCookies(null)
        webView.loadUrl(BuildConfig.WEB_PLAYER_URL)
        callback(BridgeResult.Success())
    }

    override fun openUrl(url: String, callback: (BridgeResult) -> Unit) {
        webView.loadUrl(url)
        callback(BridgeResult.Success())
    }

    /**
     * Requer `DevicePolicyManager` com a app como *device owner* (provisionamento MDM) — sem
     * esse privilégio, a plataforma Android não permite reiniciar o SO a partir de uma app comum.
     */
    override fun rebootOs(callback: (BridgeResult) -> Unit) {
        try {
            val dpm = getSystemService(DEVICE_POLICY_SERVICE) as DevicePolicyManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && dpm.isDeviceOwnerApp(packageName)) {
                dpm.reboot(ComponentName(packageName, MainActivity::class.java.name))
                callback(BridgeResult.Success())
            } else {
                callback(
                    BridgeResult.Failure(
                        "reboot_os requer a app provisionada como device owner (MDM) — ver docs/matriz-hardware-tv.md"
                    )
                )
            }
        } catch (e: Exception) {
            callback(BridgeResult.Failure(e.message ?: "Falha ao reiniciar o sistema"))
        }
    }

    /**
     * Usa `View.draw(Canvas)` em vez de `PixelCopy` — o overload de `PixelCopy.request` para
     * `View` genérico só existe a partir da API 31 e o resultado seria idêntico para o conteúdo
     * do WebView (não há `SurfaceView` sobreposto quando não há RTSP ativo). Limitação conhecida:
     * se o RTSP nativo (`SurfaceView`) estiver visível, ele não aparece neste screenshot — ver
     * `docs/matriz-hardware-tv.md`.
     */
    override fun takeScreenshot(callback: (BridgeResult) -> Unit) {
        try {
            val bitmap = Bitmap.createBitmap(webView.width, webView.height, Bitmap.Config.ARGB_8888)
            val canvas = android.graphics.Canvas(bitmap)
            webView.draw(canvas)
            callback(BridgeResult.Success(bitmapToResultJson(bitmap)))
        } catch (e: Exception) {
            callback(BridgeResult.Failure(e.message ?: "Falha ao capturar screenshot"))
        }
    }

    override fun rtspPlay(url: String, callback: (BridgeResult) -> Unit) {
        webView.setBackgroundColor(Color.TRANSPARENT)
        rtspPlayer.play(url) { playing, error ->
            if (playing) callback(BridgeResult.Success()) else callback(BridgeResult.Failure(error ?: "Falha RTSP"))
        }
    }

    override fun rtspStop(url: String) {
        rtspPlayer.stop()
        webView.setBackgroundColor(Color.WHITE)
    }

    private fun bitmapToResultJson(bitmap: Bitmap): String {
        val stream = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
        val base64 = Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
        return "{\"base64\":\"$base64\",\"mime\":\"image/png\"}"
    }
}
