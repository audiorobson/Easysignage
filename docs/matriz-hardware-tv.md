# Matriz de homologação — players nativos de TV comercial

> Documento de risco (Fase 7, PRs 7.1–7.5). Registra o que foi efetivamente validado por
> plataforma/SoC, e não apenas "compila em CI". Build smoke em CI (`gradlew assembleDebug`,
> `ares-package`, `tizen build`) **não substitui** teste em hardware real — cada player só
> deve ser considerado "pronto para piloto" depois de pelo menos uma validação manual
> registrada aqui.

## Resumo executivo (fechamento da Fase 7, PR 7.5)

| Plataforma | Fonte entregue | Testes automatizados | Build/empacotamento | Hardware físico validado |
|---|---|---|---|---|
| Android TV | ✅ | ✅ (JUnit) | ✅ local + CI | ❌ |
| webOS (LG) | ✅ | ✅ (`node --test`) | ✅ local + CI (`.ipk`) | ⚠️ Parcial (jul/2026) — ver seção dedicada |
| Tizen (Samsung) | ✅ | ✅ (`node --test`) | ⚠️ condicional a secrets (`.wgt`) | ❌ |
| Fire TV (Amazon) | ✅ | ✅ (JUnit, reaproveita Android TV) | ✅ local + CI | ❌ |

**Conclusão da fase:** as quatro plataformas têm wrapper de kiosk + bridge JS
implementados e testados unitariamente, com build/empacotamento automatizado (exceto
Tizen, que depende de secrets de assinatura ainda não configurados). **Nenhuma foi
validada em hardware ou emulador oficial da respectiva fabricante** — este é o principal
item de risco residual antes de qualquer piloto real, e é responsabilidade de quem for
conduzir o piloto preencher esta matriz com resultados reais por device.

### Próximos passos recomendados antes de um piloto

0. **Bloqueador confirmado em hardware real (jul/2026)**: `apps/web-player` (e o CMS) não
   rodam em motores anteriores ao Chrome 61 (~2017) porque dependem de
   `<script type="module">` nativo — ver "Notas da validação real" da seção webOS abaixo.
   Antes de qualquer piloto, decidir explicitamente entre (a) restringir o piloto a
   TVs/boxes com motor Chrome 61+/webOS 4.0+ equivalente, ou (b) investir em
   `@vitejs/plugin-legacy` + validar se React 19 funciona no motor alvo.
1. Obter ao menos um device físico por plataforma (ou emulador oficial onde aplicável:
   LG webOS TV Simulator, Tizen TV Emulator, Android TV emulator/Chromecast with Google TV
   real, Fire TV Stick de baixo custo) e atualizar cada seção desta matriz.
2. Validar RTSP com uma câmera/stream real em pelo menos Android TV (única plataforma com
   decodificação nativa implementada).
3. Configurar os secrets de assinatura Tizen (`TIZEN_AUTHOR_KEY`/`TIZEN_AUTHOR_KEY_PW`) e a
   variável `TIZEN_BUILD_ENABLED` se o piloto incluir Samsung.
4. Medir consumo de memória/CPU em sessão longa (>24h) por plataforma — nenhuma foi testada
   quanto a estabilidade de longa duração ainda.

## Como usar esta matriz

Cada linha é preenchida manualmente após testar num device físico (ou, na ausência
temporária de hardware, deixada como "não testado" — nunca marcada como validada sem
teste real). Atualize esta tabela sempre que:

- Um novo modelo/SoC for testado;
- Uma limitação for descoberta (decodificação, RTSP, autostart, updater);
- Uma versão de firmware do device quebrar/corrigir um comportamento.

## Android TV (`apps/androidtv-player`)

| Item | Estado | Notas |
|---|---|---|
| Build smoke (CI) | ✅ Automatizado | `.github/workflows/androidtv.yml` — `assembleDebug` + `testDebugUnitTest` |
| Build local (dev) | ✅ Validado | `compileSdk 34`, `minSdk 23`, AGP 8.7.2, Kotlin 2.2.10, JDK 17 |
| Kiosk WebView (fullscreen/leanback) | ✅ Validado (emulador) | `MainActivity` — `WindowInsetsControllerCompat` immersive sticky |
| Bridge JS↔Kotlin (`window.easysignage`) | ✅ Validado (unit) | `CommandDispatcherTest` cobre roteamento; falta teste end-to-end na WebView real |
| RTSP nativo (Media3/ExoPlayer + `SurfaceView`) | ⚠️ Não testado em hardware | Implementado (`RtspSurfacePlayer`); requer validação com stream RTSP real numa TV/box física |
| `restart_player` / `clear_cache` / `open_url` | ✅ Validado (unit) | Via `CommandDispatcher` |
| `reboot_os` | ⚠️ Limitação conhecida | Requer app provisionada como *device owner* (MDM); sem isso, falha graciosamente |
| `take_screenshot` | ⚠️ Limitação conhecida | `View.draw(Canvas)` não captura o `SurfaceView` do RTSP quando visível |
| Auto-update nativo | ❌ Não implementado | Bridge expõe stub (`window.easysignage.updater`); lógica de download/instalação de APK é trabalho futuro |
| Autostart no boot | 📝 Documentado, não testado | Ver `docs/manual-instalacao-mini-pc.md` (seção Electron); Android TV requer `RECEIVE_BOOT_COMPLETED` + `BroadcastReceiver` — ainda não implementado neste módulo |
| Hardware físico testado | ❌ Nenhum ainda | Pendente: pelo menos um device físico (ex.: Chromecast with Google TV, NVIDIA Shield, TV box genérico com Android TV/AOSP) antes de piloto |

## webOS (LG) — `apps/webos-player`

| Item | Estado | Notas |
|---|---|---|
| Empacotamento (`ares-package`) | ✅ Validado localmente | `npm run package` gera `.ipk` real via `@webosose/ares-cli` (npm, sem SDK completo instalado); `.github/workflows/webos.yml` repete o smoke em CI |
| Testes unitários do bridge | ✅ Validado | `node --test` sobre `command-dispatcher.js` (roteamento puro, sem DOM/webOS) |
| App nativa (kiosk) | ✅ Validado em TV real (jul/2026) | `index.html` + bridge JS carregando o web-player em `<iframe>`; instalado e lançado com sucesso numa LG TV real (webOS) — ver detalhes abaixo |
| Bridge JS↔webOS | 📝 Implementado com fallback gracioso | Comandos remotos (restart/reboot) usam `webOS.service.request` (luna-service) quando `webOSTV.js` está presente; sem SDK nativo de RTSP equivalente ao ExoPlayer — depende do decoder de vídeo do próprio navegador webOS. Ainda não exercitado em device real (só a shell kiosk + parâmetro de launch foram validados) |
| Parâmetro de launch (`playerUrl`) | ✅ Corrigido e validado em TV real (jul/2026) — 2 ciclos | `js/webos-launch.js` reescrito a partir do padrão oficial `webOS-TV-app-samples` da LG (`window.onload` → `webOSLaunch`/`webOSRelaunch`); confirmado visualmente (screenshot via CDP `Page.captureScreenshot`) que o `<iframe>` carrega e renderiza a URL correta, incluindo em relançamentos com URL diferente (app já em execução) |
| Hardware físico / simulador testado | ⚠️ Parcial — 1 TV LG real (jul/2026) | Instalação (`ares-install`), lançamento (`ares-launch`) e renderização do `apps/web-player` real confirmados visualmente numa TV LG real via rede local. **Não testado ainda**: RTSP, `reboot_os`, `take_screenshot`, autostart no boot, sessão de longa duração. Ver "Notas da validação real" abaixo |

### Notas da validação real (jul/2026)

Primeira instalação em hardware físico desta fase — encontrados e corrigidos problemas
reais em duas rodadas (2 bugs de compatibilidade no `@webosose/ares-cli` do npm, 2 bugs de
lógica no `apps/webos-player` em si). Detalhes completos, incluindo o procedimento de
pareamento manual (`prisoner` + chave via HTTP do Key Server, já que o CLI do npm não
implementa `ares-novacom --getkey`), estão documentados em `apps/webos-player/README.md`.

- **Pareamento SSH**: o pacote `@webosose/ares-cli` do npm não busca a chave SSH do Key
  Server automaticamente (funcionalidade `webospro`-only, `NOT_IMPLEMENTED` no código) —
  foi necessário buscar a chave manualmente via `GET http://<IP>:9991/webos_rsa` e
  registá-la manualmente no `novacom-devices.json`.
- **Bug `isDate`**: `ssh2-streams` (dependência transitiva) usa `util.isDate`, removido em
  Node.js recente → `ares-install` falhava com `TypeError: isDate is not a function`.
  Corrigido localmente (patch em `node_modules`, não versionado).
- **Bug de permissão**: `ares-install` tenta `rm -rf /media/developer/temp` antes de
  instalar; no `prisoner` sandboxed desta TV, o diretório pai não é gravável por esse
  usuário → `Permission denied`. Corrigido removendo o `rm -rf` (mantendo só `mkdir -p`).
- **Bug 1 no `apps/webos-player`**: `index.html` lia `?playerUrl=` da querystring, que o
  webOS nunca preenche para apps web — corrigido para usar o evento `webOSLaunch`.
- **Bug 2 no `apps/webos-player`** (encontrado na 2ª rodada, depois de relançar um app já
  em execução): a `Promise` que resolvia o `playerUrl` só disparava uma vez — um
  `webOSRelaunch` subsequente (app reativado em background, **sem reload de página**, é o
  comportamento documentado do webOS) com um `playerUrl` diferente era ignorado. Corrigido
  reescrevendo `js/webos-launch.js` a partir do padrão oficial `webOS-TV-app-samples` da
  LG: listeners registados em `window.onload`, atualizando o `<iframe>` a cada evento
  (`webOSLaunch` OU `webOSRelaunch`), não só na primeira resolução.
- **Confirmado visualmente**: screenshot capturada via CDP (`Page.captureScreenshot`)
  mostra o `apps/web-player` carregado (tela preta = idle esperado, sem conteúdo agendado
  para este device ainda não pareado no CMS) e o painel de debug on-screen confirmando o
  evento `webOSLaunch` recebido com o `playerUrl` correto, sem erros de console.
- **Achado crítico para o roadmap — `apps/web-player` também não roda nesta TV (motor
  pré-2017)**: a mesma TV real usa um motor `Chrome/53.0.2785.34` (~2016). Primeiro
  suspeitou-se que só o CMS (Next.js/React 19, SSR) falhava — mas uma investigação mais
  funda revelou a causa raiz exata e ela também bloqueia o `apps/web-player`:
  - `document.createElement('script').noModule` retorna `false` nesta TV → o motor **não
    reconhece `<script type="module">`** (recurso só existe a partir do Chrome 61,
    set/2017). Navegadores que não reconhecem `type="module"` simplesmente **ignoram o
    script por completo**, sem disparar nenhum erro (`window.onerror` fica vazio,
    `document.readyState` chega a `"complete"` normalmente).
  - O servidor de desenvolvimento do Vite (`apps/web-player`) **sempre** serve o app via
    ESM nativo (`<script type="module" src="/src/main.tsx">`) — isso é intrínseco à
    arquitetura de dev do Vite, não há flag para desativar. Confirmado via CDP: o
    `<div id="root">` fica permanentemente vazio, zero requisições de rede para
    `src/main.tsx`/chunks, zero erros de console — o app React nunca chega a executar
    uma linha de JS.
  - Pareamento (`POST /public/devices/pair`) e atribuição de playlist foram validados
    **diretamente pela API** (simulando o que o player faria) e funcionam corretamente —
    o dispositivo fica `active` com a playlist publicada. O que falha é exclusivamente a
    *renderização visual* nesta TV específica, não a lógica de pareamento/CMS.
  - **Implicação**: qualquer TV/box com motor anterior ao Chrome 61 (~2017) não vai
    conseguir rodar `apps/web-player` (nem o CMS) enquanto servido via Vite dev — e mesmo
    um build de produção (`vite build`) usa `type="module"` por padrão. Suportar esta
    classe de hardware oficialmente exigiria configurar
    [`@vitejs/plugin-legacy`](https://github.com/vitejs/vite/tree/main/packages/plugin-legacy)
    (bundle `nomodule` transpilado + polyfills) — **não avaliado ainda** se isso é
    suficiente, já que React 19 em si também pode depender de APIs de runtime não
    presentes em engines tão antigos (independente de sintaxe/módulos). Tratar como item
    de risco residual explícito antes de qualquer piloto que inclua TVs desta geração.

## Tizen (Samsung) — `apps/tizen-player`

| Item | Estado | Notas |
|---|---|---|
| Testes unitários do bridge | ✅ Validado | `node --test` sobre `command-dispatcher.js`, sempre roda em CI |
| Empacotamento (`.wgt` assinado) | ⚠️ Condicional em CI | Tizen Studio CLI não está disponível via npm (ferramenta Java ~1 GB da Samsung); `.github/workflows/tizen.yml` usa `sourcetoad/tizen-build-action` mas só executa se os secrets `TIZEN_AUTHOR_KEY`/`TIZEN_AUTHOR_KEY_PW` (e a variável `TIZEN_BUILD_ENABLED`) estiverem configurados no repositório — **ainda não estão** |
| App nativa (kiosk) | 📝 Fonte entregue | `config.xml` (perfil `tv-samsung`) + `index.html`, mesmo padrão de bridge; trata tecla "voltar" do controlo remoto (`tizenhwkey`) |
| Bridge JS↔Tizen | 📝 Implementado com fallback gracioso | `tizen.systeminfo` para `platform.getInfo`; sem API pública de reboot/screenshot para apps de terceiros |
| Hardware físico / emulador testado | ❌ Nenhum | Pendente Samsung Smart TV real ou Tizen TV Emulator — `.wgt` nunca foi gerado nem instalado |

## Fire TV (Amazon) — `apps/firetv-player`

| Item | Estado | Notas |
|---|---|---|
| Base | ✅ Reaproveita `apps/androidtv-player` | Mesmo bridge Kotlin/Media3 (`com.easysignage.firetv`); manifest ajustado por recomendação da Amazon (`android.software.leanback` `required="false"`, `faketouch` declarado) — Fire OS honra `LEANBACK_LAUNCHER` igual ao Android TV |
| Build local | ✅ Validado | `gradlew testDebugUnitTest assembleDebug` — `BUILD SUCCESSFUL` |
| Build smoke (CI) | ✅ Automatizado | `.github/workflows/firetv.yml` |
| Hardware físico testado | ❌ Nenhum | Pendente Fire TV Stick/Cube real — Amazon Appstore tem processo de certificação próprio (Test Criteria, classificação de device support) fora do escopo deste PR; instalação direta (side-load/ADB) é suficiente para piloto |

## Riscos gerais desta fase

- **Decodificação de vídeo**: cada SoC/firmware tem limites diferentes de codec/bitrate/
  resolução para `<video>` HTML e para decoders nativos (ExoPlayer/RTSP). Sem testes em
  hardware real, assuma o pior caso (H.264 Main Profile, 1080p30) até validação.
- **RTSP**: só o Android TV tem decodificação nativa implementada (Media3/ExoPlayer). Nas
  demais plataformas, RTSP depende do suporte do motor de renderização do próprio SO —
  não há garantia de funcionamento sem teste manual dedicado.
- **Autostart/kiosk**: cada plataforma tem seu próprio mecanismo (Device Owner no Android,
  serviço/registro de app padrão no webOS/Tizen); nenhum foi validado em produção ainda.
- **Certificação em loja**: Amazon Appstore, LG Content Store e Samsung Seller Office têm
  processos de revisão próprios não cobertos por este roadmap — tratar como etapa
  adicional antes de distribuição pública (o piloto pode usar instalação direta/side-load).
