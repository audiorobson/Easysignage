# `apps/firetv-player`

Wrapper nativo Fire TV (Amazon, Kotlin) para o `apps/web-player` — PR 7.4 do
[roadmap de nível de mercado](../../digital_signage_arquitetura_roadmap.md). Reaproveita
integralmente a base do `apps/androidtv-player` (mesmo bridge JS↔Kotlin, mesmo RTSP nativo
via Media3/ExoPlayer) com `applicationId`/`namespace` próprios
(`com.easysignage.firetv`) e o manifest ajustado às recomendações da Amazon para Fire OS
(ver seção "Diferenças do Android TV" abaixo).

Este módulo é **isolado do resto do monorepo pnpm/Turbo** — é um projeto Gradle/Android
padrão dentro de `apps/firetv-player/`, sem dependências do `package.json` raiz.

## Estrutura

Idêntica ao `apps/androidtv-player` (ver o README daquele módulo para detalhes de cada
arquivo):

- `app/src/main/java/com/easysignage/firetv/MainActivity.kt` — WebView kiosk + watchdog.
- `app/src/main/java/com/easysignage/firetv/bridge/` — `PlayerActions`, `CommandDispatcher`
  (testável em JVM pura), `EasySignageJsBridge`, `RtspSurfacePlayer` (Media3/ExoPlayer).
- `app/src/main/assets/easysignage-bridge.js` — mesmo shim `window.easysignage`.
- `app/src/test/.../CommandDispatcherTest.kt` — mesmos testes JUnit puros.

## Diferenças do Android TV

Conforme a [documentação oficial da Amazon](https://developer.amazon.com/docs/fire-tv/differences-from-android-tv-development.html),
Fire OS honra `LEANBACK_LAUNCHER` mas recomenda:

- `<uses-feature android:name="android.software.leanback" android:required="false" />`
  (em vez de `required="true"`) — Fire OS não garante reportar essa feature da mesma
  forma que devices Android TV "puros".
- Declarar `android.hardware.touchscreen` e `android.hardware.faketouch` como
  `required="false"`.

Fora isso, o manifest, o bridge e o RTSP nativo são idênticos ao `androidtv-player`.

## Build local

Requer JDK 17 e o Android SDK (`compileSdk 34`, `minSdk 23`). Com o Android Studio
instalado, o JDK vem embutido em `Android Studio/jbr`:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
cd apps/firetv-player
./gradlew.bat assembleDebug        # gera app/build/outputs/apk/debug/app-debug.apk
./gradlew.bat testDebugUnitTest    # testes do bridge
```

Em Linux/macOS, use `./gradlew` (sem `.bat`) e ajuste `JAVA_HOME` para o seu JDK 17.

`local.properties` (com `sdk.dir`) é gerado localmente e **não é versionado** — o CI
(`.github/workflows/firetv.yml`) usa `android-actions/setup-android` em vez dele.

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
  visível no momento da captura, ele não aparece no bitmap.
- Auto-update nativo ainda não está implementado neste módulo.
- Certificação/distribuição via Amazon Appstore tem processo próprio (Test Criteria,
  classificação de device support) não coberto por este PR — instalação direta
  (side-load/ADB) é suficiente para piloto.
- Build smoke em CI (`gradlew assembleDebug`) não substitui teste em hardware real —
  nenhum Fire TV Stick/Cube físico foi usado para validar esta entrega ainda.
