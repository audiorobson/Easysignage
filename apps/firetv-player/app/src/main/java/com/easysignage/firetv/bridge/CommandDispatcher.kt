package com.easysignage.firetv.bridge

/**
 * Núcleo puro (sem dependências de Android) do bridge JS↔Kotlin — recebe o `method`/`arg`
 * enviados pelo shim JS injetado (`assets/easysignage-bridge.js`) e delega em [PlayerActions].
 *
 * Mantido deliberadamente sem `org.json`/framework Android para poder ser testado com JUnit puro
 * em `src/test` (ver [PR 7.1] "teste unitário do bridge").
 */
class CommandDispatcher(private val actions: PlayerActions) {

    fun dispatch(method: String, arg: String, callback: BridgeCallback) {
        when (method) {
            "commands.restartPlayer" -> actions.restartPlayer(callback)
            "commands.clearCache" -> actions.clearCache(callback)
            "commands.openUrl" -> {
                if (!isHttpUrl(arg)) {
                    callback(BridgeResult.Failure("URL inválido (use http:// ou https://)"))
                } else {
                    actions.openUrl(arg, callback)
                }
            }
            "commands.rebootOs" -> actions.rebootOs(callback)
            "commands.takeScreenshot" -> actions.takeScreenshot(callback)
            "rtsp.play" -> {
                if (arg.isBlank()) {
                    callback(BridgeResult.Failure("URL RTSP vazio"))
                } else {
                    actions.rtspPlay(arg, callback)
                }
            }
            "rtsp.stop" -> {
                actions.rtspStop(arg)
                callback(BridgeResult.Success())
            }
            "updater.notifyUpdateAvailable" -> {
                // Sem auto-update nativo nesta PR — apenas confirma o recebimento (ver PR 5.13 no Electron).
                callback(BridgeResult.Success())
            }
            else -> callback(BridgeResult.Failure("Método desconhecido: $method"))
        }
    }

    companion object {
        private val HTTP_URL_REGEX = Regex("^https?://\\S+$", RegexOption.IGNORE_CASE)

        fun isHttpUrl(url: String?): Boolean = url != null && HTTP_URL_REGEX.matches(url.trim())
    }
}
