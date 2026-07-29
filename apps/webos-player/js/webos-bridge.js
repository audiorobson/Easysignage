/**
 * Ponte `window.easysignage` para o webOS TV (PR 7.2) — mesmo contrato exposto pelo
 * Electron (`easysignage-bridge.ts`) e pelo Android TV (`easysignage-bridge.js`), para que
 * `apps/web-player` funcione sem feature-detection especial por plataforma.
 *
 * Diferença chave: aqui não há processo nativo separado — este script roda no mesmo
 * contexto JS da webapp webOS, então as implementações chamam diretamente as APIs do
 * `webOSTV.js` (carregado pelo runtime do dispositivo; ver README) quando disponíveis, com
 * fallback seguro (retorna erro, nunca lança) quando não estão.
 */
(function (global) {
  var createDispatcher = global.EasySignageCommandDispatcher
    ? global.EasySignageCommandDispatcher.createDispatcher
    : require('./command-dispatcher').createDispatcher;

  function hasWebOsService() {
    return typeof global.webOS !== 'undefined' && typeof global.webOS.service !== 'undefined';
  }

  function callLunaService(uri, method, params) {
    return new Promise(function (resolve) {
      if (!hasWebOsService()) {
        resolve({ ok: false, error: 'webOSTV.js indisponível — fora de um device webOS real' });
        return;
      }
      global.webOS.service.request(uri, {
        method: method,
        parameters: params || {},
        onSuccess: function () {
          resolve({ ok: true });
        },
        onFailure: function (err) {
          resolve({ ok: false, error: (err && err.errorText) || 'Falha na chamada luna-service' });
        },
      });
    });
  }

  var actions = {
    restartPlayer: function () {
      global.location.reload();
      return Promise.resolve({ ok: true });
    },
    clearCache: function () {
      try {
        global.localStorage.clear();
      } catch (e) {
        // ambiente sem localStorage (ex.: teste) — segue sem falhar.
      }
      if (global.caches && global.caches.keys) {
        global.caches
          .keys()
          .then(function (keys) {
            return Promise.all(keys.map(function (k) { return global.caches.delete(k); }));
          })
          .finally(function () {
            global.location.reload();
          });
        return Promise.resolve({ ok: true });
      }
      global.location.reload();
      return Promise.resolve({ ok: true });
    },
    openUrl: function (url) {
      global.location.href = url;
      return Promise.resolve({ ok: true });
    },
    // Requer permissão privilegiada (app de sistema/signage assinada); apps de terceiros
    // comuns não conseguem reiniciar o SO no webOS — ver docs/matriz-hardware-tv.md.
    rebootOs: function () {
      return callLunaService('luna://com.webos.service.tvpower/power', 'reboot', {});
    },
    // Sem API pública de captura de tela para apps de terceiros no webOS TV.
    takeScreenshot: function () {
      return Promise.resolve({ ok: false, error: 'take_screenshot não suportado no webOS TV' });
    },
    // Sem decodificador RTSP nativo exposto ao runtime web do webOS — apenas o que o
    // motor de renderização (Chromium embarcado) suportar nativamente via <video>.
    rtspPlay: function () {
      return Promise.resolve({ ok: false, error: 'RTSP nativo não implementado no webOS TV' });
    },
    rtspStop: function () {
      return Promise.resolve({ ok: true });
    },
  };

  var dispatch = createDispatcher(actions);

  global.easysignage = {
    platform: {
      name: 'webos',
      getInfo: function () {
        return Promise.resolve({
          platform: 'webos',
          userAgent: global.navigator ? global.navigator.userAgent : 'unknown',
        });
      },
    },
    rtsp: {
      play: function (url) { return dispatch('rtspPlay', [url]); },
      stop: function () { return dispatch('rtspStop', []); },
    },
    commands: {
      restartPlayer: function () { return dispatch('restartPlayer', []); },
      clearCache: function () { return dispatch('clearCache', []); },
      openUrl: function (url) { return dispatch('openUrl', [url]); },
      rebootOs: function () { return dispatch('rebootOs', []); },
      takeScreenshot: function () { return dispatch('takeScreenshot', []); },
    },
    updater: {
      // Auto-update nativo não implementado nesta iteração (ver README) — stub para o
      // web-player não precisar de feature-detection especial.
      check: function () { return Promise.resolve({ ok: false, error: 'not implemented' }); },
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
