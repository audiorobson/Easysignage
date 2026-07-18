/**
 * Ponte `window.easysignage` para o Tizen TV (Samsung) — PR 7.3, mesmo contrato exposto
 * pelo Electron/Android TV/webOS. Roda no mesmo contexto JS da webapp Tizen; usa o objeto
 * global `tizen` (injetado pelo runtime da TV) quando disponível, com fallback seguro
 * quando não está (ex.: navegador comum durante desenvolvimento).
 */
(function (global) {
  var createDispatcher = global.EasySignageCommandDispatcher
    ? global.EasySignageCommandDispatcher.createDispatcher
    : require('./command-dispatcher').createDispatcher;

  function hasTizenApi() {
    return typeof global.tizen !== 'undefined';
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
    // Não há API pública de reinício de sistema para apps Tizen TV de terceiros —
    // reboot/power está restrito a apps assinadas como partner/platform. Ver
    // docs/matriz-hardware-tv.md.
    rebootOs: function () {
      return Promise.resolve({
        ok: false,
        error: 'reboot_os não suportado por privilégio de app pública no Tizen TV',
      });
    },
    // Sem API pública de captura de tela para apps de terceiros no Tizen TV.
    takeScreenshot: function () {
      return Promise.resolve({ ok: false, error: 'take_screenshot não suportado no Tizen TV' });
    },
    // Sem decodificador RTSP nativo exposto ao runtime web do Tizen — apenas o que o
    // motor de renderização (Chromium embarcado) suportar nativamente via <video>.
    rtspPlay: function () {
      return Promise.resolve({ ok: false, error: 'RTSP nativo não implementado no Tizen TV' });
    },
    rtspStop: function () {
      return Promise.resolve({ ok: true });
    },
  };

  var dispatch = createDispatcher(actions);

  global.easysignage = {
    platform: {
      name: 'tizen',
      getInfo: function () {
        if (!hasTizenApi()) {
          return Promise.resolve({ platform: 'tizen', tizenApiAvailable: false });
        }
        return new Promise(function (resolve) {
          try {
            global.tizen.systeminfo.getPropertyValue(
              'BUILD',
              function (build) {
                resolve({ platform: 'tizen', tizenApiAvailable: true, model: build.model });
              },
              function () {
                resolve({ platform: 'tizen', tizenApiAvailable: true });
              }
            );
          } catch (e) {
            resolve({ platform: 'tizen', tizenApiAvailable: true, error: String(e) });
          }
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
      check: function () { return Promise.resolve({ ok: false, error: 'not implemented' }); },
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
