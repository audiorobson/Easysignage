package com.easysignage.androidtv.bridge

/** Resultado de um comando despachado pela ponte JS↔Kotlin — ver [CommandDispatcher]. */
sealed class BridgeResult {
    data class Success(val json: String = "null") : BridgeResult()
    data class Failure(val message: String) : BridgeResult()
}

typealias BridgeCallback = (BridgeResult) -> Unit

/**
 * Ações nativas que o [CommandDispatcher] delega — implementadas por [com.easysignage.androidtv.MainActivity]
 * e injetadas por interface para permitir testar o *dispatch* em JVM puro (sem Android/Robolectric),
 * no mesmo espírito das interfaces `*Deps` do `apps/electron-player` (ex.: `RestartPlayerDeps`).
 */
interface PlayerActions {
    /** Relança a Activity — equivalente ao `relaunch()+exit()` do Electron, mas dentro do processo Android. */
    fun restartPlayer(callback: BridgeCallback)

    /** Limpa cache/armazenamento da WebView e recarrega a página. */
    fun clearCache(callback: BridgeCallback)

    /** Navega a WebView para `url` (mesma página, sem abrir o browser do sistema). */
    fun openUrl(url: String, callback: BridgeCallback)

    /**
     * Reinicia o sistema operativo (não apenas a app). Requer o dispositivo provisionado como
     * *device owner* (MDM) ou uma build de sistema/assinada com a plataforma — ver
     * `docs/matriz-hardware-tv.md`. Em dispositivos sem esse privilégio, devolve [BridgeResult.Failure].
     */
    fun rebootOs(callback: BridgeCallback)

    /** Captura o conteúdo atual da WebView e devolve `{ "base64": "...", "mime": "image/png" }`. */
    fun takeScreenshot(callback: BridgeCallback)

    /**
     * Inicia a reprodução de um stream RTSP num `SurfaceView` nativo posicionado por trás da
     * WebView (a WebView fica com fundo transparente) — não é um `<video>` do DOM como no
     * Electron/browser. Limitação conhecida: cobre todo o ecrã, não uma zona específica do
     * layout — ver `docs/matriz-hardware-tv.md`.
     */
    fun rtspPlay(url: String, callback: BridgeCallback)

    /** Para a reprodução RTSP nativa e esconde o `SurfaceView`. */
    fun rtspStop(url: String)
}
