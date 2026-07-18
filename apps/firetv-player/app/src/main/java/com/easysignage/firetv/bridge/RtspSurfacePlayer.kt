package com.easysignage.firetv.bridge

import android.content.Context
import android.util.Log
import android.view.SurfaceView
import android.view.View
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.rtsp.RtspMediaSource

/**
 * Reproduz um stream RTSP num [SurfaceView] nativo posicionado por trás da WebView
 * (ver `activity_main.xml` — `surface_rtsp` fica abaixo de `webview` no `FrameLayout`, e a
 * WebView é tornada transparente pelo [com.easysignage.firetv.MainActivity]).
 *
 * Equivalente Android do bridge RTSP nativo do Electron (`apps/electron-player/src/main/ffmpeg-rtsp.ts`),
 * mas usa o decoder nativo do Media3/ExoPlayer em vez de remuxar via `ffmpeg` para HTTP local.
 *
 * Limitação conhecida (ver `docs/matriz-hardware-tv.md`): cobre o ecrã completo — não há hoje
 * composição por zona como no player web/Electron.
 */
class RtspSurfacePlayer(context: Context, private val surfaceView: SurfaceView) {
    private var player: ExoPlayer? = null
    private var currentUrl: String? = null

    fun play(url: String, onStatus: (playing: Boolean, error: String?) -> Unit) {
        stop()
        currentUrl = url
        surfaceView.visibility = View.VISIBLE

        val exoPlayer = ExoPlayer.Builder(surfaceView.context).build()
        exoPlayer.setVideoSurfaceView(surfaceView)
        exoPlayer.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_READY) onStatus(true, null)
            }

            override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                Log.w(TAG, "Falha ao reproduzir RTSP: $url", error)
                onStatus(false, error.message ?: "Erro desconhecido a reproduzir RTSP")
            }
        })

        val mediaSource = RtspMediaSource.Factory().createMediaSource(MediaItem.fromUri(url))
        exoPlayer.setMediaSource(mediaSource)
        exoPlayer.prepare()
        exoPlayer.playWhenReady = true
        player = exoPlayer
    }

    fun stop() {
        player?.release()
        player = null
        currentUrl = null
        surfaceView.visibility = View.GONE
    }

    fun isPlaying(url: String): Boolean = currentUrl == url && player != null

    companion object {
        private const val TAG = "RtspSurfacePlayer"
    }
}
