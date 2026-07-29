/**
 * Shim injetado em `onPageFinished` (ver MainActivity.kt) — expõe `window.easysignage` no mesmo
 * formato que `apps/web-player/src/easysignage-bridge.ts` espera, delegando no objeto Java
 * `AndroidBridge` (ver EasySignageJsBridge.kt) através de um registo de promessas pendentes,
 * porque `@JavascriptInterface` só permite chamadas síncronas/primitivas — o resultado chega
 * depois via `window.__easysignageResolve`/`__easysignageReject` (chamados por
 * `WebView.evaluateJavascript` do lado nativo).
 */
(function () {
  if (window.easysignage) return; // já injetado (ex.: navegação SPA sem reload de página)

  var pending = {};
  var nextId = 0;

  function callBridge(method, arg) {
    return new Promise(function (resolve, reject) {
      var id = 'r' + (++nextId);
      pending[id] = { resolve: resolve, reject: reject };
      try {
        window.AndroidBridge.invoke(method, arg == null ? '' : String(arg), id);
      } catch (e) {
        delete pending[id];
        reject(e);
      }
    });
  }

  window.__easysignageResolve = function (id, resultJson) {
    var p = pending[id];
    if (!p) return;
    delete pending[id];
    try {
      p.resolve(resultJson ? JSON.parse(resultJson) : undefined);
    } catch (e) {
      p.resolve(undefined);
    }
  };

  window.__easysignageReject = function (id, message) {
    var p = pending[id];
    if (!p) return;
    delete pending[id];
    p.reject(new Error(message));
  };

  window.easysignage = {
    platform: 'android',
    rtsp: {
      play: function (url, videoElement) {
        // O SurfaceView nativo fica por trás da WebView — o <video> do DOM é apenas ocultado.
        if (videoElement && videoElement.style) {
          videoElement.style.visibility = 'hidden';
        }
        return callBridge('rtsp.play', url);
      },
      stop: function (url) {
        callBridge('rtsp.stop', url);
      },
    },
    commands: {
      restartPlayer: function () {
        return callBridge('commands.restartPlayer', '');
      },
      clearCache: function () {
        return callBridge('commands.clearCache', '');
      },
      openUrl: function (url) {
        return callBridge('commands.openUrl', url);
      },
      rebootOs: function () {
        return callBridge('commands.rebootOs', '');
      },
      takeScreenshot: function () {
        return callBridge('commands.takeScreenshot', '');
      },
    },
    updater: {
      notifyUpdateAvailable: function (release) {
        return callBridge('updater.notifyUpdateAvailable', JSON.stringify(release));
      },
    },
  };

  if (window.__easysignageBridgeReady) {
    window.__easysignageBridgeReady();
  }
})();
