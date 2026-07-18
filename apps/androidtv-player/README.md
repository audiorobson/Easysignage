# `apps/androidtv-player`

Wrapper nativo Android TV (Kotlin) para o `apps/web-player` — PR 7.1 do
[roadmap de nível de mercado](../../digital_signage_arquitetura_roadmap.md). Não é uma
reescrita do motor de playback: carrega o web-player numa `WebView` em modo kiosk
(fullscreen, leanback, sem barra de navegação) e expõe uma ponte JS↔Kotlin
(`window.easysignage`) equivalente à do Electron (`easysignage-bridge.ts`), para que o
mesmo código de player funcione nas duas plataformas.

Este módulo é **isolado do resto do monorepo pnpm/Turbo** — é um projeto Gradle/Android
padrão dentro de `apps/androidtv-player/`, sem dependências do `package.json` raiz.

## Estrutura

- `app/src/main/java/.../MainActivity.kt` — activity única; WebView kiosk + watchdog de
  reload em crash/erro de carregamento.
- `app/src/main/java/.../bridge/` — `PlayerActions` (interface), `CommandDispatcher`
  (roteamento puro, testável em JVM sem Android), `EasySignageJsBridge`
  (`@JavascriptInterface` exposto à WebView), `RtspSurfacePlayer` (RTSP nativo via
  Media3/ExoPlayer num `SurfaceView` posicionado atrás da WebView).
- `app/src/main/assets/easysignage-bridge.js` — shim injetado na WebView que expõe
  `window.easysignage.{platform,rtsp,commands,updater}` com chamadas assíncronas
  baseadas em Promise.
- `app/src/test/.../CommandDispatcherTest.kt` — testes JUnit puros (sem emulador) da
  lógica de despacho de comandos.

## Build local

Requer JDK 17 e o Android SDK (`compileSdk 34`, `minSdk 23`). Com o Android Studio
instalado, o JDK vem embutido em `Android Studio/jbr`:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
cd apps/androidtv-player
./gradlew.bat assembleDebug        # gera app/build/outputs/apk/debug/app-debug.apk
./gradlew.bat testDebugUnitTest    # testes do bridge
```

Em Linux/macOS, use `./gradlew` (sem `.bat`) e ajuste `JAVA_HOME` para o seu JDK 17.

`local.properties` (com `sdk.dir`) é gerado localmente e **não é versionado** — o CI
(`.github/workflows/androidtv.yml`) usa `android-actions/setup-android` em vez dele.

## Configuração do URL do web-player

Por padrão o kiosk carrega `gradle.properties` → `webPlayerUrl` (placeholder). Para
apontar para uma instância real:

```powershell
./gradlew.bat assembleDebug -PwebPlayerUrl=https://player.suaempresa.com/player/DEVICE_ID
```

ou edite `gradle.properties` antes de gerar o build final de produção.

## Limitações conhecidas (ver `docs/matriz-hardware-tv.md`)

- `reboot_os` requer a app provisionada como *device owner* via MDM — sem esse
  provisionamento a plataforma recusa `DevicePolicyManager.reboot()` e o comando
  retorna falha (sem crash).
- `take_screenshot` usa `View.draw(Canvas)`; se houver RTSP nativo (`SurfaceView`)
  visível no momento da captura, ele não aparece no bitmap (composição por hardware
  fora do canvas software da WebView).
- Auto-update nativo (equivalente ao `electron-updater`) ainda não está implementado
  neste módulo — o bridge expõe `window.easysignage.updater` como stub para o web-player
  não precisar de feature-detection especial, mas a lógica de download/instalação de APK
  fica para uma iteração futura.
- Build smoke em CI (`gradlew assembleDebug`) não substitui teste em hardware real —
  cada entrega desta fase deve ser validada manualmente em pelo menos um device físico
  antes de ser considerada pronta para piloto.
