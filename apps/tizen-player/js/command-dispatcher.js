/**
 * Lógica pura de despacho de comandos remotos (PR 7.3) — idêntica em espírito a
 * `apps/webos-player/js/command-dispatcher.js` e `apps/androidtv-player`
 * (`CommandDispatcher.kt`): recebe `{ method, args }`, valida o essencial e delega para
 * uma implementação de plataforma injetada, sem depender de `window`/`document`/`tizen`
 * diretamente — o que torna este módulo testável com Node puro (ver `test/`).
 *
 * UMD simples: expõe `module.exports` para `node --test` e `global.EasySignageCommandDispatcher`
 * para o `<script>` clássico carregado pelo `index.html` (sem bundler nesta app).
 */
(function (root, factory) {
  var exported = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  }
  root.EasySignageCommandDispatcher = exported;
})(typeof window !== 'undefined' ? window : globalThis, function () {

function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

/**
 * @param {{restartPlayer: Function, clearCache: Function, openUrl: Function, rebootOs: Function, takeScreenshot: Function, rtspPlay: Function, rtspStop: Function}} actions
 */
function createDispatcher(actions) {
  return async function dispatch(method, args) {
    switch (method) {
      case 'restartPlayer':
        return actions.restartPlayer();
      case 'clearCache':
        return actions.clearCache();
      case 'openUrl': {
        const url = args && args[0];
        if (!isHttpUrl(url)) {
          return { ok: false, error: 'openUrl requer uma URL http(s) válida' };
        }
        return actions.openUrl(url);
      }
      case 'rebootOs':
        return actions.rebootOs();
      case 'takeScreenshot':
        return actions.takeScreenshot();
      case 'rtspPlay': {
        const url = args && args[0];
        if (typeof url !== 'string' || url.length === 0) {
          return { ok: false, error: 'rtspPlay requer uma URL' };
        }
        return actions.rtspPlay(url);
      }
      case 'rtspStop':
        return actions.rtspStop();
      default:
        return { ok: false, error: `Método desconhecido: ${method}` };
    }
  };
}

  return { createDispatcher: createDispatcher, isHttpUrl: isHttpUrl };
});
