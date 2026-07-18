package com.easysignage.firetv.bridge

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Duplo de teste de [PlayerActions] — regista as chamadas recebidas em vez de tocar hardware/OS real. */
private class FakePlayerActions : PlayerActions {
    var restartCalled = false
    var clearCacheCalled = false
    var openedUrl: String? = null
    var rebootCalled = false
    var screenshotCalled = false
    var rtspPlayedUrl: String? = null
    var rtspStoppedUrl: String? = null

    override fun restartPlayer(callback: BridgeCallback) {
        restartCalled = true
        callback(BridgeResult.Success())
    }

    override fun clearCache(callback: BridgeCallback) {
        clearCacheCalled = true
        callback(BridgeResult.Success())
    }

    override fun openUrl(url: String, callback: BridgeCallback) {
        openedUrl = url
        callback(BridgeResult.Success())
    }

    override fun rebootOs(callback: BridgeCallback) {
        rebootCalled = true
        callback(BridgeResult.Failure("reboot_os requer device owner (MDM) — ver docs/matriz-hardware-tv.md"))
    }

    override fun takeScreenshot(callback: BridgeCallback) {
        screenshotCalled = true
        callback(BridgeResult.Success("""{"base64":"AAA=","mime":"image/png"}"""))
    }

    override fun rtspPlay(url: String, callback: BridgeCallback) {
        rtspPlayedUrl = url
        callback(BridgeResult.Success())
    }

    override fun rtspStop(url: String) {
        rtspStoppedUrl = url
    }
}

class CommandDispatcherTest {

    @Test
    fun `restartPlayer delega em PlayerActions e responde sucesso`() {
        val actions = FakePlayerActions()
        val dispatcher = CommandDispatcher(actions)
        var result: BridgeResult? = null

        dispatcher.dispatch("commands.restartPlayer", "") { result = it }

        assertTrue(actions.restartCalled)
        assertTrue(result is BridgeResult.Success)
    }

    @Test
    fun `clearCache delega em PlayerActions`() {
        val actions = FakePlayerActions()
        val dispatcher = CommandDispatcher(actions)

        dispatcher.dispatch("commands.clearCache", "") {}

        assertTrue(actions.clearCacheCalled)
    }

    @Test
    fun `openUrl aceita http e https e passa a url para PlayerActions`() {
        val actions = FakePlayerActions()
        val dispatcher = CommandDispatcher(actions)

        dispatcher.dispatch("commands.openUrl", "https://exemplo.com/promo") {}

        assertEquals("https://exemplo.com/promo", actions.openedUrl)
    }

    @Test
    fun `openUrl rejeita url invalido sem chamar PlayerActions`() {
        val actions = FakePlayerActions()
        val dispatcher = CommandDispatcher(actions)
        var result: BridgeResult? = null

        dispatcher.dispatch("commands.openUrl", "javascript:alert(1)") { result = it }

        assertEquals(null, actions.openedUrl)
        assertTrue(result is BridgeResult.Failure)
    }

    @Test
    fun `rebootOs propaga a falha quando PlayerActions nao tem privilegio`() {
        val actions = FakePlayerActions()
        val dispatcher = CommandDispatcher(actions)
        var result: BridgeResult? = null

        dispatcher.dispatch("commands.rebootOs", "") { result = it }

        assertTrue(actions.rebootCalled)
        assertTrue(result is BridgeResult.Failure)
    }

    @Test
    fun `takeScreenshot devolve o payload base64 de PlayerActions`() {
        val actions = FakePlayerActions()
        val dispatcher = CommandDispatcher(actions)
        var result: BridgeResult? = null

        dispatcher.dispatch("commands.takeScreenshot", "") { result = it }

        assertTrue(actions.screenshotCalled)
        val success = result as BridgeResult.Success
        assertTrue(success.json.contains("base64"))
    }

    @Test
    fun `rtsp play delega a url e rtsp stop nao espera callback com sucesso`() {
        val actions = FakePlayerActions()
        val dispatcher = CommandDispatcher(actions)
        var playResult: BridgeResult? = null
        var stopResult: BridgeResult? = null

        dispatcher.dispatch("rtsp.play", "rtsp://camera.local/stream1") { playResult = it }
        dispatcher.dispatch("rtsp.stop", "rtsp://camera.local/stream1") { stopResult = it }

        assertEquals("rtsp://camera.local/stream1", actions.rtspPlayedUrl)
        assertEquals("rtsp://camera.local/stream1", actions.rtspStoppedUrl)
        assertTrue(playResult is BridgeResult.Success)
        assertTrue(stopResult is BridgeResult.Success)
    }

    @Test
    fun `rtsp play rejeita url vazio`() {
        val actions = FakePlayerActions()
        val dispatcher = CommandDispatcher(actions)
        var result: BridgeResult? = null

        dispatcher.dispatch("rtsp.play", "") { result = it }

        assertEquals(null, actions.rtspPlayedUrl)
        assertTrue(result is BridgeResult.Failure)
    }

    @Test
    fun `metodo desconhecido devolve falha sem tocar PlayerActions`() {
        val actions = FakePlayerActions()
        val dispatcher = CommandDispatcher(actions)
        var result: BridgeResult? = null

        dispatcher.dispatch("commands.doesNotExist", "") { result = it }

        assertTrue(result is BridgeResult.Failure)
        assertTrue((result as BridgeResult.Failure).message.contains("desconhecido"))
    }

    @Test
    fun `isHttpUrl valida esquemas http e https e rejeita outros`() {
        assertTrue(CommandDispatcher.isHttpUrl("http://a.com"))
        assertTrue(CommandDispatcher.isHttpUrl("https://a.com/x?y=1"))
        assertTrue(!CommandDispatcher.isHttpUrl("javascript:alert(1)"))
        assertTrue(!CommandDispatcher.isHttpUrl(""))
        assertTrue(!CommandDispatcher.isHttpUrl(null))
    }
}
