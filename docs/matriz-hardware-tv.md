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
| webOS (LG) | ✅ | ✅ (`node --test`) | ✅ local + CI (`.ipk`) | ❌ |
| Tizen (Samsung) | ✅ | ✅ (`node --test`) | ⚠️ condicional a secrets (`.wgt`) | ❌ |
| Fire TV (Amazon) | ✅ | ✅ (JUnit, reaproveita Android TV) | ✅ local + CI | ❌ |

**Conclusão da fase:** as quatro plataformas têm wrapper de kiosk + bridge JS
implementados e testados unitariamente, com build/empacotamento automatizado (exceto
Tizen, que depende de secrets de assinatura ainda não configurados). **Nenhuma foi
validada em hardware ou emulador oficial da respectiva fabricante** — este é o principal
item de risco residual antes de qualquer piloto real, e é responsabilidade de quem for
conduzir o piloto preencher esta matriz com resultados reais por device.

### Próximos passos recomendados antes de um piloto

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
| App nativa (kiosk) | 📝 Fonte entregue | `index.html` + bridge JS carregando o web-player em `<iframe>` |
| Bridge JS↔webOS | 📝 Implementado com fallback gracioso | Comandos remotos (restart/reboot) usam `webOS.service.request` (luna-service) quando `webOSTV.js` está presente; sem SDK nativo de RTSP equivalente ao ExoPlayer — depende do decoder de vídeo do próprio navegador webOS |
| Hardware físico / simulador testado | ❌ Nenhum | Pendente TV LG real ou emulador oficial (LG webOS TV Simulator) — `.ipk` nunca foi instalado/lançado num runtime webOS real |

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
