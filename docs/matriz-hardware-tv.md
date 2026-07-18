# Matriz de homologação — players nativos de TV comercial

> Documento de risco (Fase 7, PRs 7.1–7.5). Registra o que foi efetivamente validado por
> plataforma/SoC, e não apenas "compila em CI". Build smoke em CI (`gradlew assembleDebug`,
> `ares-package`, `tizen build`) **não substitui** teste em hardware real — cada player só
> deve ser considerado "pronto para piloto" depois de pelo menos uma validação manual
> registrada aqui.

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
| Empacotamento (`ares-package`) | ⚠️ Best-effort em CI | Sem acesso a webOS TV SDK/CLI no ambiente de desenvolvimento local; workflow de CI tenta empacotar via `@webosose/ares-cli` (npm) |
| App nativa (kiosk) | 📝 Fonte entregue | `index.html` + bridge JS carregando o web-player em `<iframe>`/navegação direta |
| Bridge JS↔webOS | 📝 Stub | Comandos remotos (restart/reboot) usam `webOS.service.request` onde disponível; sem SDK nativo de RTSP equivalente ao ExoPlayer — depende do decoder de vídeo do próprio navegador webOS |
| Hardware físico testado | ❌ Nenhum | Pendente TV LG real ou emulador oficial (LG webOS TV Simulator) |

## Tizen (Samsung) — `apps/tizen-player`

| Item | Estado | Notas |
|---|---|---|
| Empacotamento (Tizen CLI) | ⚠️ Best-effort em CI | Sem Tizen Studio/CLI no ambiente local; workflow de CI documenta o comando mas pode não executar sem licença/SDK instalado no runner |
| App nativa (kiosk) | 📝 Fonte entregue | `config.xml` + `index.html`, mesmo padrão de bridge |
| Hardware físico testado | ❌ Nenhum | Pendente Samsung Smart TV real ou Tizen TV Emulator |

## Fire TV (Amazon) — `apps/firetv-player`

| Item | Estado | Notas |
|---|---|---|
| Base | ✅ Reaproveita `apps/androidtv-player` | Mesmo bridge Kotlin/Media3; manifest e launcher ajustados para Fire TV (sem categoria `LEANBACK_LAUNCHER` do Google, ícone/banner Amazon) |
| Build smoke (CI) | ✅ Automatizado | `.github/workflows/firetv.yml` |
| Hardware físico testado | ❌ Nenhum | Pendente Fire TV Stick/Cube real — Amazon Appstore tem processo de certificação próprio (fora do escopo deste PR) |

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
