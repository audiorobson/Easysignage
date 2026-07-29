package com.easysignage.androidtv.bridge

import android.webkit.JavascriptInterface
import android.webkit.WebView

/**
 * Objeto exposto à WebView como `AndroidBridge` (`addJavascriptInterface`) — chamado pelo shim
 * `assets/easysignage-bridge.js`. Fica deliberadamente "burro": só faz marshalling entre a
 * chamada síncrona da WebView e o [CommandDispatcher] assíncrono, devolvendo o resultado via
 * `evaluateJavascript` na *main thread* (obrigatório para `WebView`).
 */
class EasySignageJsBridge(
    private val webView: WebView,
    private val dispatcher: CommandDispatcher
) {
    @JavascriptInterface
    fun invoke(method: String, arg: String, requestId: String) {
        dispatcher.dispatch(method, arg) { result ->
            webView.post {
                val script = when (result) {
                    is BridgeResult.Success ->
                        "window.__easysignageResolve && window.__easysignageResolve('${escape(requestId)}', '${escape(result.json)}');"
                    is BridgeResult.Failure ->
                        "window.__easysignageReject && window.__easysignageReject('${escape(requestId)}', '${escape(result.message)}');"
                }
                webView.evaluateJavascript(script, null)
            }
        }
    }

    companion object {
        /** Escapa para uso dentro de uma string literal `'...'` de JavaScript injetado via `evaluateJavascript`. */
        fun escape(value: String): String =
            value.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "")
    }
}
