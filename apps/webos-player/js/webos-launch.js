/**
 * Resolução do `playerUrl` de lançamento — reescrito (jul/2026) a partir do padrão
 * validado nos exemplos oficiais da LG (`webOS-TV-app-samples/AppLifecycle` e
 * `.../webOSTVJSLibrary/Launch_Parameters`):
 *
 *   window.addEventListener('load', function () {
 *     document.addEventListener('webOSLaunch', function (inData) { ... }, true);
 *     document.addEventListener('webOSRelaunch', function (inData) { ... }, true);
 *   });
 *
 * Duas correções em relação à primeira versão deste ficheiro (que vivia inline em
 * `index.html`):
 *
 * 1. Os listeners são registados em `window.onload` (depois de `webOSTV.js` e dos
 *    outros scripts já terem corrido), tal como nos exemplos oficiais — NÃO no topo do
 *    `<head>` antes de qualquer script. A documentação da LG confirma que `webOSLaunch`
 *    só é disparado depois de `DOMContentLoaded`, portanto não há corrida real a evitar
 *    aqui; tentar "adiantar-se" ao evento com `PalmSystem.launchParams` síncrono (usado
 *    numa iteração anterior) não é a API recomendada (está documentada como legada,
 *    "backward compatibility" apenas) e mostrou-se vazia/pouco fiável em testes reais.
 * 2. Cada evento (`webOSLaunch` OU `webOSRelaunch`) atualiza o iframe diretamente — um
 *    app webOS já em execução em background é apenas "reativado" com `webOSRelaunch`
 *    (sem reload da página), por isso não podemos resolver a URL apenas uma vez.
 *
 * O painel de debug on-screen (ver `renderDebug`) existe porque depurar via
 * `ares-inspect`/CDP através do túnel SSH do dispositivo real mostrou-se lento e, em
 * alguns casos, incapaz de capturar o estado exato no momento do lançamento — ver
 * README para detalhes. Ative com `?debug=1` na querystring de teste manual, ou deixe
 * `DEBUG_ENABLED` como está (mostra sempre) enquanto o player ainda está em validação de
 * campo; desligue antes de um piloto/produção real.
 */
(function (global) {
  var DEFAULT_PLAYER_URL = 'https://player.easysignage.example.com';
  var FALLBACK_TIMEOUT_MS = 5000;
  var DEBUG_ENABLED = true;

  var debugLines = [];

  function renderDebug(line) {
    debugLines.push(new Date().toISOString().slice(11, 19) + ' ' + line);
    if (debugLines.length > 12) debugLines.shift();
    if (!DEBUG_ENABLED) return;
    var el = global.document.getElementById('es-debug');
    if (!el) return;
    el.textContent = debugLines.join('\n');
    el.classList.add('es-debug--visible');
  }

  function setPlayerUrl(url, source) {
    if (!url) return;
    global.__easysignageCurrentPlayerUrl = url;
    renderDebug('playerUrl (' + source + '): ' + url);
    var iframe = global.document.getElementById('player-frame');
    if (iframe && iframe.src !== url) iframe.src = url;
  }

  function parseDetail(inData) {
    var detail = inData && inData.detail;
    if (typeof detail === 'string') {
      try {
        detail = JSON.parse(detail);
      } catch (e) {
        return null;
      }
    }
    return detail;
  }

  function readWebOSDevLaunchParams() {
    try {
      if (typeof global.webOSDev !== 'undefined' && global.webOSDev.launchParams) {
        return global.webOSDev.launchParams();
      }
    } catch (e) {
      /* webOSTV.js indisponível (teste fora de um device webOS real) */
    }
    return null;
  }

  function extractPlayerUrlFromEvent(inData) {
    var detail = parseDetail(inData);
    if (detail && detail.playerUrl) return detail.playerUrl;
    var devParams = readWebOSDevLaunchParams();
    if (devParams && devParams.playerUrl) return devParams.playerUrl;
    return null;
  }

  function initPage() {
    renderDebug('window.onload — a registar listeners webOSLaunch/webOSRelaunch');

    document.addEventListener(
      'webOSLaunch',
      function (inData) {
        renderDebug('webOSLaunch: ' + JSON.stringify((inData && inData.detail) || null));
        setPlayerUrl(extractPlayerUrlFromEvent(inData), 'webOSLaunch');
      },
      true
    );

    document.addEventListener(
      'webOSRelaunch',
      function (inData) {
        renderDebug('webOSRelaunch: ' + JSON.stringify((inData && inData.detail) || null));
        setPlayerUrl(extractPlayerUrlFromEvent(inData), 'webOSRelaunch');
        try {
          if (typeof PalmSystem !== 'undefined' && PalmSystem.activate) PalmSystem.activate();
        } catch (e) {
          /* PalmSystem indisponível fora de um device webOS real */
        }
      },
      true
    );

    // Cobre chamadas a `webOSDev.launchParams()` já disponíveis no momento do load (caso
    // o evento já tenha ocorrido antes deste listener existir) e o teste manual fora de
    // um device real (browser/simulador), onde não há eventos webOS nem PalmSystem.
    var devParamsAtLoad = readWebOSDevLaunchParams();
    if (devParamsAtLoad && devParamsAtLoad.playerUrl) {
      setPlayerUrl(devParamsAtLoad.playerUrl, 'webOSDev.launchParams@load');
    } else {
      var qs = new URLSearchParams(global.location.search).get('playerUrl');
      if (qs) setPlayerUrl(qs, 'querystring');
    }

    // Nunca deixa o iframe sem `src` para sempre se nada acima resolver a tempo.
    global.setTimeout(function () {
      if (!global.__easysignageCurrentPlayerUrl) {
        renderDebug('nenhuma fonte resolveu playerUrl em ' + FALLBACK_TIMEOUT_MS + 'ms — usando placeholder');
        setPlayerUrl(DEFAULT_PLAYER_URL, 'fallback-timeout');
      }
    }, FALLBACK_TIMEOUT_MS);
  }

  global.addEventListener('load', initPage, false);
})(typeof window !== 'undefined' ? window : globalThis);
