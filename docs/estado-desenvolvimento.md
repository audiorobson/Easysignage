# Estado do desenvolvimento — EasySignage

Documento de referência do que está implementado **até julho de 2026**. Complementa o roadmap arquitetural na raiz do repositório com o estado **concreto** do código e ligações explícitas às **fases de engenharia (§19)** e **fases de interface (§19.8)** de `digital_signage_arquitetura_roadmap.md`.

O próprio roadmap, em **§19** (início da secção), aponta para **este ficheiro** como *snapshot* e checklist de QA a manter após entregas.

---

## Alinhamento com o roadmap de engenharia (§19.1–19.7)

| Fase | Nome (roadmap) | Estado no código (jul/2026) |
|------|----------------|-----------------------------|
| **19.1** | Fase 0 — Fundação técnica | **Em grande parte feito:** monorepo pnpm/Turbo, Prisma + PostgreSQL, Nest API, Next CMS, `device-protocol`, web-player, Docker Compose. **Parcial:** CI em GitHub Actions (lint/test/build), Redis/filas em prod. |
| **19.2** | Fase 1 — Autenticação, tenants e dispositivos | **Feito (núcleo):** auth JWT, RBAC, sites, devices, pairing, heartbeat, `wakeMac` + WOL UDP. **Parcial:** Electron. |
| **19.3** | Fase 2 — Biblioteca e playlists | **Parcial avançado:** upload multipart, vários tipos no player (imagem, vídeo, PDF, HTML, URL, **RTSP**), playlists + DnD no CMS, **cache offline leve**. **RTSP:** servidor só configura `remoteUrl`; player liga directo à rede. **Distribuição:** `deploy/server-box` (Docker mini PC). **Pendente:** media-worker; decoder RTSP no electron-player. |
| **19.4** | Fase 3 — Agendamento e publicação | **Parcial avançado:** `Publication` + publicar no CMS; **`ScheduleRule` + motor** (playlist, layout ou video wall); **`Campaign` + motor** (playlist promocional com prioridade sobre agenda); **ack de publicação**; **manifest com `manifestRevision`**; CMS campanhas + agendamento. **Pendente:** métricas de entrega, campanhas com layout/wall. |
| **19.4b–19.5b** | **Layouts, zonas e video wall** | **Feito (L1–L5):** viewport, layouts multi-zona, fit, video wall, drift, WS sync, editor visual, agenda layout/wall, snap/guias, **templates custom por tenant**. |
| **19.5** | Fase 4 — Controle remoto e monitoramento | **Feito (MVP+):** telemetria, overview, comandos (`wol` + **reboot/restart/clear-cache/open-url/screenshot** via Electron), **preview JPEG**, **realtime-gateway** com wall sync, painel de drift, **alertas automáticos** (`/alerts`) com **notificação por webhook (HMAC) e e-mail (Resend)**. |
| **19.6** | Fase 5 — Robustez operacional | **Concluída (jul/2026 — PRs 5.1–5.18):** CI com Postgres real + migrations, Playwright E2E (CMS + web-player), cobertura Jest nos motores críticos; **proof-of-play** completo (modelo, ingestão, fila offline no web-player, relatório + export CSV, tela no CMS); **Electron real** (bridge RTSP via `ffmpeg`, executor de comandos remotos, watchdog + kiosk + autostart, auto-update); **fila Redis/BullMQ** + `media-worker` real (thumbnail/metadata/transcode); **dashboard sem dados demo** (uptime real via `Heartbeat`); **notificações de alerta** (webhook assinado + e-mail). Ver secções dedicadas abaixo. |
| **19.7** | Fase 6 — Multi-tenant comercial (enterprise readiness) | **Concluída (jul/2026 — PRs 6.1–6.6):** multi-tenant no modelo; **OpenAPI pública** exportada e verificada em CI (`contracts/openapi/openapi.json`); **audit log** (interceptor global + `/settings/audit`); **2FA (TOTP)** com QR code e desafio no login; **SSO OpenID Connect** por tenant (`/settings/sso`, login único); **quotas por tenant** (`maxDevices`/`maxUsers`/`planTier`, enforcement na criação de dispositivos); **branding por tenant** (logótipo/nome/cor aplicados no CMS, login e preview embutido). Ver secções dedicadas abaixo. |
| **19.10** | Fase 7 — Players nativos para hardware de TV comercial | **Concluída (jul/2026 — PRs 7.1–7.5):** wrappers de kiosk/WebView reaproveitando o `apps/web-player` para **Android TV** (Kotlin, RTSP nativo via Media3/ExoPlayer), **webOS** (LG, bridge via luna-service), **Tizen** (Samsung) e **Fire TV** (Amazon, base do Android TV); todos com bridge JS testado unitariamente e build/empacotamento automatizado em CI. **Risco residual explícito:** nenhuma plataforma validada em hardware/emulador oficial ainda — ver `docs/matriz-hardware-tv.md`. Ver secção dedicada abaixo. |

---

## Alinhamento com fases de interface CMS (§19.8 / `easysignage_diretrizes_interface_css.md`)

| Fase UI | Estado (jul/2026) |
|---------|---------------------|
| UI-0, UI-1 | **Feitos** (tokens, shell, navegação). |
| UI-2 | **Iniciado** — `StatusBadge`, `ConnectionBadge`, `PublicationSyncBadge`, `EmptyState`, `Modal`, `PageHeader` + classes `.badge` em `globals.css`. Falta extrair Table e fechar biblioteca. |
| UI-3 | **Avançado** — devices/sites/login; badges de conexão e sincronização de publicação nos devices. |
| UI-4 | **Avançado** — assets, playlists, agendamento (grelha + lista + layout/wall), publicação no device, editor de zonas. |
| UI-5 | **Avançado** — `/monitoring` com pré-visualização e tema NOC; `/video-walls` com saúde de sync; **`/alerts`** operacional. |
| UI-4b | **Feito** — aba Ecrã no device (viewport, galeria de templates, fit por zona). |
| UI-4c | **Feito** — editor visual em `/devices/:id/layout` (`LayoutZoneEditor`, snap/guias). |
| UI-5b | **Feito** — módulo video walls (`/video-walls`, wizard, painel drift/sync live). |
| UI-6 | **Não iniciado** |

---

## Funcionalidades recentes (Fase 3 — ack e cache)

### Ack de publicação no player

- **`GET /device/state`** expõe `contentRevision` (hash de sync + publicação + item + playlist).
- **`POST /device/heartbeat`** aceita `appliedPublicationVersion` e `appliedContentRevision` após o player carregar o conteúdo.
- **Web player:** invalida cache quando `contentRevision` muda; confirma ack no heartbeat seguinte.
- **CMS:** detalhe do device mostra `PublicationSyncBadge` e revisão confirmada.
- **Migração:** `applied_publication_version`, `applied_content_revision`, `applied_at` em `device_state`.

### Cache offline (Fase 2)

- **Cache API** para ficheiros de device (`deviceAssetCache.ts`).
- **Eviction** automática: mantém só URLs do manifesto/conteúdo atual.

---

## Funcionalidades recentes (motor de agenda e monitorização)

### Campanhas no player

- **`Campaign`:** playlist promocional com `scope` (device, group, site, all), calendário (`startAt`/`endAt`), janela horária opcional e `priority` (omissão 10).
- **`CampaignEngineService`:** seleciona campanha `active` aplicável; **prevalece sobre `ScheduleRule`** no heartbeat.
- **`current_item_json`:** `source: "campaign"`, `campaignId`, `type: "playlist"`.
- **API:** `GET/POST/PATCH/DELETE /campaigns`, `POST /:id/activate|pause|end`, `POST /campaigns/reapply`.
- **CMS:** `/campaigns` — lista, modal criar/editar, ativar/pausar.
- **Migração:** `campaigns`, `active_campaign_id` em `device_state` (`20260710020000_campaigns`).

### Agendamento no player

- **`ScheduleEngineService`:** na janela ativa (dia ISO 1–7, minutos, prioridade), define `current_item_json` com `source: "schedule"` — **playlist**, **layout multi-zona** (`layoutId`) ou **tile de video wall** (`videoWallId`).
- **Layout:** só regras com `scope=device`; usa `DevicesService.buildLayoutCurrentItem`.
- **Video wall:** em grupo aplica só a devices que são tiles da parede; usa `VideoWallsService.buildTileCurrentItem`.
- **Fora da janela:** restaura `schedule_baseline_item_json` ou payload da publicação ativa.
- **Disparo:** `GET /device/state` e `POST /device/heartbeat` (cada ~3 s no web player).
- **CMS:** `POST /schedules/reapply` reaplica todas as regras do tenant; modal com tipo de conteúdo (Playlist | Layout | Video wall).
- **Env:** `SCHEDULE_TIMEZONE` (omissão `Europe/Lisbon`).
- **Migração:** `schedule_baseline_item_json`, `active_schedule_rule_id` em `device_state`; `layout_id` / `video_wall_id` opcionais em `schedule_rule` (`20260710010000_schedule_layout_wall`).

### Alertas automáticos

- **Tipos:** `device_offline`, `device_offline_long`, `playback_fault`, `publication_sync_pending`.
- **Avaliação:** a cada `POST /device/heartbeat` + `POST /alerts/evaluate` (CMS).
- **Ciclo:** aberto → reconhecido (ack) → resolvido automaticamente quando a condição desaparece.
- **API:** `GET /alerts`, `GET /alerts/summary`, `PATCH /alerts/:id/ack`.
- **Migração:** `alerts` (`20260710030000_alerts`).

### Monitorização

- Preview JPEG: `POST /device/preview`, `GET /monitoring/devices/:id/preview`.
- CMS: polling da miniatura ~3,5 s (sem reload da página).
- WOL: `POST /monitoring/devices/:id/commands` com `channel: "wol"`.

---

## Monorepo

| Pacote | Descrição |
|--------|-----------|
| `apps/api` | NestJS: domínios acima + Swagger `/docs`. |
| `apps/cms` | Next.js: gestão + agendamento + monitorização + video walls. |
| `apps/web-player` | Vite: playback multi-zona, wall tile, captura de preview. |
| `apps/realtime-gateway` | WebSocket: rooms por parede, `wall.sync`/`wall.tick`, broadcast interno. |
| `apps/electron-player` | **Real (Fase 5.C):** bridge RTSP nativo (`ffmpeg` → fMP4/HTTP local), executor de comandos remotos (restart/clear-cache/open-url/reboot/screenshot), watchdog + kiosk + autostart documentado, auto-update (`electron-updater` + `SoftwareRelease`). |
| `apps/media-worker` | Worker BullMQ/Redis real: consome `asset.uploaded`, gera miniatura (sharp/ffmpeg), extrai metadados (dimensões, duração, codecs) e **normaliza vídeo fora do padrão para MP4 H.264/AAC** — PR 5.15/5.16. |
| `docker-compose.yml` | Postgres + Redis + API + media-worker + CMS. |

---

## Páginas CMS

| Rota | Estado |
|------|--------|
| `/devices`, `/sites` | Operacional |
| `/assets` | Operacional (upload, URL, **RTSP**) |
| `/playlists`, `/groups` | Operacional |
| `/devices/:id/layout` | Operacional (editor visual de zonas) |
| `/layout-templates` | Operacional (templates sistema + custom JSON) |
| `/scheduling` | Operacional (regras + timeline + playlist/layout/wall) |
| `/video-walls`, `/video-walls/new`, `/video-walls/:id` | Operacional (paredes + sync) |
| `/monitoring` | Operacional (overview + preview) |
| `/campaigns` | Operacional (CRUD, ativar/pausar, reaplicar) |
| `/alerts` | Operacional (offline, playback, sync pendente, ack) |
| `/reports` (proof-of-play) | Operacional (filtro por device/período/asset + export CSV) |
| `/dashboard` | Operacional — sem dados demo (uptime real via `Heartbeat`) |
| `/settings` | Operacional — **Licença** (HWID, serial, limites players) + **Notificações de alerta** (webhook/e-mail) |

---

## Comandos úteis (raiz)

```bash
pnpm dev              # API + CMS + web-player (turbo)
pnpm build            # compilar
pnpm start            # API + CMS produção local (após build)
pnpm docker:compose   # stack Docker
```

**Migrações aplicadas:** `20260709220000_device_viewport`, `20260709223000_layout_templates`, `20260709233000_video_walls`, `20260710010000_schedule_layout_wall`, `20260710020000_campaigns`, `20260710030000_alerts`.

---

## Fontes RTSP (jul/2026)

Integração de **streaming RTSP** como tipo de asset — o servidor **apenas configura**; o player **liga-se directamente** à câmara/encoder na rede (sem proxy de mídia na API).

| Camada | Entrega |
|--------|---------|
| **shared-types** | `AssetKind: 'rtsp'`, `stream-sources.ts` (`validateRemoteStreamUrl`, `isRemoteStreamKind`, `maskStreamUrl`) |
| **API** | `POST /assets` com `{ name, remoteUrl, kind: 'rtsp' }` (ou inferência por `rtsp://`); `PATCH` em assets remotos; `GET .../file` → `400 RTSP_DIRECT_PLAY` |
| **CMS** | Filtro «Streams RTSP», modal «Nova fonte RTSP», pré-visualização com ícone dedicado |
| **Web player** | `mediaLoader` lê só `meta.remoteUrl`; `RtspStreamView` + ponte `window.easysignage.rtsp` para Electron futuro |
| **Electron** | Preload documentado; decoder nativo **pendente** |

**Fluxo:** CMS grava URL → device obtém `GET /device/assets/:id/meta` → player abre `rtsp://…` na LAN.

**Limitação:** browsers não reproduzem `rtsp://` nativamente; o web-player mostra overlay informativo. Reprodução real exige `electron-player` ou Android com bridge `easysignage.rtsp.play()`.

**Teste manual:** CMS → Biblioteca → Streams RTSP → criar fonte → adicionar a playlist → publicar no device → player mostra URL/estado (web) ou stream (Electron, quando implementado).

---

## Entregas — layouts, zonas e video wall (jul/2026)

### Fase L1 — Viewport (**feito**, jul/2026)

| Camada | Entrega |
|--------|---------|
| **shared-types** | `DeviceViewport`, presets, `normalizeDeviceViewport`, `computeViewportFitScale` |
| **API / Prisma** | Campos `viewportWidth`, `viewportHeight`, `displayOrientation`; `PATCH /devices/:id/viewport`; `viewport` em `GET /device/state` |
| **CMS** | Secção «Ecrã (viewport)» no detalhe do device (presets, orientação, pré-visualização) |
| **Web player** | Canvas lógico com rotação e escala para caber no ecrã físico |

**Teste manual sugerido:** no CMS, definir 1080×1920 retrato num device pareado → confirmar rotação no player (`localhost:3010`).

### Fase L2 — Zonas (**feito**, jul/2026)

| Camada | Entrega |
|--------|---------|
| **shared-types** | `LayoutCurrentItem`, `SYSTEM_LAYOUT_TEMPLATES`, helpers de frame |
| **API / Prisma** | `LayoutTemplate`, `DeviceLayout`; `GET /layout-templates`; `PUT /devices/:id/layout`; `layoutId` em test-content/publish |
| **CMS** | Secção «Layout multi-zona» com galeria, bindings por zona, aplicar/publicar |
| **Web player** | `LayoutStage` + `ZonePlayer` — playlists independentes por zona |

**Teste manual:** template `split_h_2` com duas playlists → player mostra metades do ecrã em loop.

### Fase L3 — Fit de conteúdo (**feito**, jul/2026)

| Camada | Entrega |
|--------|---------|
| **shared-types** | `ContentFitMode`, `normalizeContentDisplay`, helpers CSS |
| **API** | `display` em bindings de layout e em test-content/publish legado |
| **CMS** | Seletor de fit por zona e em conteúdo full-screen; largura/altura alvo opcionais |
| **Web player** | 5 modos CSS: native, contain, cover, stretch, center |

**Teste manual:** zona com `cover` vs `contain` na mesma imagem 16:9 numa zona 4:3.

### Fase L4 — Video wall (**feito**, jul/2026)

| Camada | Entrega |
|--------|---------|
| **shared-types** | `WallTileCurrentItem`, `computeTileCrop`, `wallTileMediaTransform`, `isWallTileCurrentItem` |
| **API / Prisma** | `VideoWall`, `VideoWallTile`; `GET/POST/PATCH /video-walls`; `PUT /:id/tiles`; `POST /:id/publish` e `/sync`; `videoWallId` em test-content/publish |
| **CMS** | `/video-walls` (lista, criar, detalhe com grelha de tiles, publicar, re-sync); entrada na navegação |
| **Web player** | `WallTileStage` — crop do canvas virtual, arranque sincronizado por `sync.epochMs` |

**Teste manual:** parede 2×1, dois devices no mesmo site, playlist com imagem larga — metades alinhadas após publicar.

### L4.4 — Monitorização de drift (**feito**, jul/2026)

| Camada | Entrega |
|--------|---------|
| **shared-types** | `WallPlaybackSync`, `computeWallDriftMs`, `classifyWallDrift`, `parseWallSyncFromSnapshot` |
| **API** | `playbackSync` no heartbeat; `GET /video-walls/:id/health` com deriva por tile |
| **Web player** | `WallTileStage` reporta drift a cada 2s no heartbeat |
| **CMS** | Painel «Saúde de sync» na página da parede (poll 5s, tema NOC) |

### L5.1 — WebSocket sync (**feito**, jul/2026)

| Camada | Entrega |
|--------|---------|
| **device-protocol** | Mensagens `wall.sync`, `wall.tick`, auth/subscribe |
| **realtime-gateway** | WS auth (device/CMS), rooms, ticks 1s, `POST /internal/broadcast` |
| **API** | `RealtimeService` notifica gateway em publish/sync |
| **Web player** | `connectWallRealtime` — correção via `wall.tick` |
| **CMS** | Saúde de sync atualiza em tempo real via WS |

### UI-4c — Editor visual de zonas (**feito**, jul/2026)

| Camada | Entrega |
|--------|---------|
| **CMS** | `LayoutZoneEditor` — galeria de templates, canvas proporcional, clique em zona, inspector com playlist/fit/pré-visualização |
| **Rota** | `/devices/:id/layout` — editor dedicado; aba Ecrã com atalho e mini-preview |

### L5.2 — Agenda layout / video wall (**feito**, jul/2026)

| Camada | Entrega |
|--------|---------|
| **API** | `ScheduleRule` com `layoutId` / `videoWallId` opcionais; validação «exatamente um» conteúdo; motor aplica layout ou tile |
| **CMS** | `ScheduleRuleModal` — seletor Playlist \| Layout \| Video wall; carrega layout do device e lista de walls; timeline/lista com `contentLabel` |

### L5.3 — Snap + guias no editor (**feito**, jul/2026)

| Camada | Entrega |
|--------|---------|
| **API** | `frame` opcional em bindings de layout; `buildLayoutCurrentItem` usa override |
| **CMS** | Grelha 5%, guias de alinhamento, inputs X/Y/W/H com snap; «Repor geometria do template» |

### L5.4 — Templates custom por tenant (**feito**, jul/2026)

| Camada | Entrega |
|--------|---------|
| **shared-types** | `validateLayoutTemplateZones`, `isReservedLayoutTemplateSlug` |
| **API** | `POST/PATCH/DELETE /layout-templates`; só tenant edita/elimina os seus; validação de zonas JSON |
| **CMS** | `/layout-templates` — galeria sistema + custom, modal criar/editar com JSON e pré-visualização |

### Melhorias opcionais (L5+)

| Área | Escopo |
|------|--------|
| **Editor** | Drag-and-drop de zonas (hoje: inputs numéricos + snap) |
| **Templates** | Importar JSON de template de sistema com um clique; upload de ficheiro `.json` |

**Documento normativo:** [`docs/planejamento-layouts-zonas-video-wall.md`](planejamento-layouts-zonas-video-wall.md) — §2 descreve o baseline *antes* de L1; o estado actual está nas tabelas acima.  
**Sequência concluída:** L1 → L5.4 (viewport … templates custom).

---

## Fase 5 — Núcleo operacional e confiabilidade (concluída, jul/2026)

Fecha o backlog interno ("Próximos passos sugeridos" da revisão anterior) e as maiores lacunas identificadas na pesquisa de mercado: qualidade automatizada, proof-of-play, Electron real e pipeline de mídia real.

### 5.A — Fundação de qualidade

| PR | Entrega |
|----|---------|
| 5.1 | CI (`.github/workflows/ci.yml`) com serviço `postgres:16` real + `prisma migrate deploy` antes dos testes de integração |
| 5.2 | Playwright E2E (`apps/e2e`) — smoke API (pareamento → publicação ponta-a-ponta) e CMS (login, assets, reports, settings) |
| 5.3 | Cobertura Jest ampliada em `schedule-engine`, `campaign-engine`, `alerts.service`, cálculo de drift de video wall |
| 5.4 | Sincronização com `main` + branch protection exigindo CI verde |

### 5.B — Proof of play

| PR | Entrega |
|----|---------|
| 5.5 | Modelo `PlaybackLog` (device, asset/playlist, tipo, evento, duração) + migration + tipos em `shared-types` |
| 5.6 | `POST /device/playback-events` (lote) no device-api, com `DeviceAuthGuard` |
| 5.7 | Web-player emite eventos com fila offline (IndexedDB) e retry/flush ao voltar online |
| 5.8 | `GET /monitoring/playback-logs` com filtros (device/período/asset) + export CSV |
| 5.9 | Tela `/reports` no CMS — tabela filtrável + botão de export |

### 5.C — Electron player real

| PR | Entrega |
|----|---------|
| 5.10 | Bridge RTSP nativo — `ffmpeg` remuxa RTSP → fragmented MP4 servido por HTTP local; renderer consome via `<video>`/MSE |
| 5.11 | Executor de comandos remotos — `restart_player`, `clear_cache`, `open_url`, `reboot_os`, `take_screenshot`, com ack via `POST /device-api/commands/:id/ack` |
| 5.12 | Watchdog (auto-relança renderer em crash), modo kiosk fullscreen, scripts de autostart documentados |
| 5.13 | Auto-update — modelo `SoftwareRelease` (versão/canal) + `electron-updater`; comparador semver/canal em `shared-types` |

### 5.D — Media pipeline real

| PR | Entrega |
|----|---------|
| 5.14 | Fila Redis/BullMQ (`docker-compose.yml` + `deploy/server-box`); API publica job `asset.uploaded` |
| 5.15 | `apps/media-worker` real — consome a fila, gera thumbnail (sharp/ffmpeg) e extrai duração/resolução/codec |
| 5.16 | Normalização de vídeo fora do padrão para MP4 H.264/AAC; CMS exibe thumbnails reais + badge "A processar…" com polling em `/assets` |

### 5.E — Dashboard real e notificações

| PR | Entrega |
|----|---------|
| 5.17 | Dashboard sem dados demo — histórico de disponibilidade agregado de `Heartbeat` via `GET /monitoring/uptime-history` |
| 5.18 | Notificações de alerta — webhook por tenant (HMAC-SHA256) + e-mail (Resend) quando um `Alert` é aberto/re-aberto/resolvido; configuração em `/settings` (`GET/PATCH /settings/notifications`) |

---

## Fase 6 — Enterprise readiness (concluída, jul/2026)

Fecha "Fase 6 — multi-tenant comercial" do roadmap arquitetural e a lacuna de vendas B2B maiores identificada na pesquisa de mercado (SSO, 2FA, audit log, OpenAPI, quotas, branding).

| PR | Entrega |
|----|---------|
| 6.1 | OpenAPI pública — `contracts/openapi/openapi.json` gerado por script (`export:openapi`), validado estruturalmente e verificado/publicado como artefacto em CI |
| 6.2 | Audit log — modelo `AuditLog`, interceptor Nest global em mutações (POST/PUT/PATCH/DELETE) com sanitização de dados sensíveis, `GET /audit-logs` e tela `/settings/audit` com filtros |
| 6.3 | 2FA (TOTP) — `otplib`/`qrcode`, campos `totpSecret`/`totpEnabled` em `User`, setup com QR code, desafio de 2FA no login (`/auth/login/2fa`), tela `/settings/security` |
| 6.4 | SSO OpenID Connect por tenant — `openid-client`, configuração por tenant (`ssoEnabled`/`ssoIssuerUrl`/`ssoClientId`/`ssoClientSecret`), fluxo authorization code completo, tela `/settings/sso` e botão de login único |
| 6.5 | Quotas por tenant — campos `planTier`/`maxDevices`/`maxUsers` em `Tenant`, `TenantQuotaService` com *enforcement* na criação de dispositivos (403 ao exceder), `GET /settings/quota` e painel de uso em `/settings` |
| 6.6 | Branding por tenant — campos `brandName`/`brandLogoUrl`/`brandPrimaryColor` em `Tenant`, `GET/PATCH /settings/branding` (autenticado) e `GET /public/tenants/:slug/branding` (público), tela `/settings/branding`, aplicado na barra lateral do CMS, na tela de login e no preview embutido de playlists |

---

## Fase 7 — Players nativos de TV comercial (concluída, jul/2026)

Fecha o maior gap de alcance de mercado vs. Xibo/OptiSigns/ScreenCloud identificado na pesquisa: rodar o `apps/web-player` nativamente em hardware de TV comercial, sem reescrever o motor de playback por plataforma — wrappers finos de kiosk/WebView reaproveitando o mesmo contrato de bridge (`window.easysignage`) já usado no Electron.

| PR | Entrega |
|----|---------|
| 7.1 | `apps/androidtv-player` — app Kotlin (compileSdk 34, AGP 8.7.2), WebView kiosk fullscreen/leanback, `CommandDispatcher`/`PlayerActions` testáveis em JVM pura (JUnit), RTSP nativo via Media3/ExoPlayer num `SurfaceView` atrás da WebView, handlers `restart_player`/`clear_cache`/`open_url`/`reboot_os`/`take_screenshot`, CI dedicado (`androidtv.yml`) |
| 7.2 | `apps/webos-player` — app webOS (LG), `window.easysignage` via `webOS.service.request` (luna-service) com fallback gracioso, roteamento puro testado com `node --test`, empacotamento validado localmente e em CI gerando `.ipk` real via `@webosose/ares-cli` |
| 7.3 | `apps/tizen-player` — app Tizen (Samsung), bridge via API global `tizen` (`tizen.systeminfo`), reboot/screenshot retornam indisponibilidade explícita (sem privilégio partner/platform), testes unitários sempre em CI; empacotamento `.wgt` assinado condicional a secrets de assinatura (ainda não configurados) |
| 7.4 | `apps/firetv-player` — reaproveita integralmente a base do `androidtv-player` (`com.easysignage.firetv`), manifest ajustado por recomendação da Amazon (`android.software.leanback` `required="false"`, `faketouch` declarado); build local e CI validados |
| 7.5 | `docs/matriz-hardware-tv.md` — matriz de homologação por plataforma/SoC, com resumo executivo e riscos explícitos; nenhuma das quatro plataformas foi validada em hardware/emulador oficial ainda — tratado como pré-requisito explícito antes de qualquer piloto |

**Nota de risco (herdada do roadmap):** build smoke em CI não substitui teste em hardware real. Cada player desta fase deve ser validado manualmente em pelo menos um device físico antes de ser considerado "pronto para piloto" — ver `docs/matriz-hardware-tv.md`.

---

## Documentos relacionados

| Documento | Conteúdo |
|-----------|----------|
| `digital_signage_arquitetura_roadmap.md` | Arquitetura e §19 |
| `docs/planejamento-layouts-zonas-video-wall.md` | Orientação, zonas, fit, video wall (planejamento) |
| `easysignage_diretrizes_interface_css.md` | Diretrizes de interface |
| `easysignage_automation_core.md` | WOL, automação futura |
| `docs/producao-e-auto-hospedagem.md` | Deploy |
| `docs/teste-producao.md` | Testes manuais de produção (RTSP, comandos remotos, auto-update, normalização de vídeo, notificações de alerta) |
| `docs/matriz-hardware-tv.md` | Matriz de homologação dos players nativos de TV por plataforma/SoC (Fase 7) |

---

## Próximos passos sugeridos

Fases 5 (núcleo operacional), 6 (enterprise readiness) e 7 (players nativos de TV) estão
**concluídas** — ver secções dedicadas acima. O trabalho corrente segue o roadmap de nível
de mercado (Fases 8–10):

| Prioridade | Item | Fase |
|------------|------|------|
| 1 | Marketplace de widgets/apps (clima, RSS, relógio, sandbox no player) | 8 — Widgets |
| 2 | Geração de conteúdo por IA (texto/roteiro, imagem, "AI Studio" no CMS) | 9 — IA generativa |
| 3 | Revisão de segurança, runbook operacional, release v1.0.0 | 10 — Lançamento GA |
| — | Validação em hardware físico real dos players de TV (nenhuma plataforma testada ainda) | 7 (risco residual) — ver `docs/matriz-hardware-tv.md` |

---

---

## Distribuição e licenciamento (jul/2026 — em implementação)

| Componente | Estado |
|------------|--------|
| `packages/license-core` | **Feito** — Ed25519, tiers Lite/Std/Elite, HWID |
| API `LicenseModule` | **Feito** — status, apply, limite no `pair` |
| `deploy/server-box` | **Feito** — compose, install.ps1/sh, volumes config |
| `deploy/hwid/generate-hwid.mjs` | **Feito** — Win/Linux no host |
| `apps/license-generator` | **MVP** — Electron gerador de serial |
| CMS `/settings` | **Feito** — HWID, activar licença, funcionalidades por plano |
| `docs/manual-instalacao-mini-pc.md` | **Feito** — guia cliente |
| `realtime-gateway` no server-box | **Feito** — compose + Dockerfile |
| CMS banners por feature | **Feito** — campanhas, walls, RTSP, alertas |
| `docs/teste-producao.md` | **Feito** — guia instalacao teste |
| Script `pnpm prod:test` | **Feito** — build + compose + seed |
| Pacote ZIP `release:zip` | **Feito** — `dist/release/*.zip` |
| Imagens GHCR publicadas | **Pendente** — requer tag `v*` no repositório |
| Chave privada produção (cofre) | **Pendente** — processo comercial do fornecedor |

---

*Última atualização: 18 de julho de 2026 — Fase 7 (players nativos de TV comercial) concluída: Android TV, webOS, Tizen e Fire TV, todos com bridge JS↔nativo testado unitariamente e build/empacotamento automatizado em CI (validação em hardware físico real ainda pendente — ver `docs/matriz-hardware-tv.md`). Fase 6 (enterprise readiness) já concluída anteriormente: OpenAPI pública, audit log, 2FA (TOTP), SSO OpenID Connect, quotas por tenant e branding por tenant. Fase 5 (núcleo operacional e confiabilidade) também concluída: proof-of-play, Electron real (RTSP/comandos/watchdog/auto-update), media pipeline real (fila + thumbnail/transcode), dashboard sem dados demo e notificações de alerta.*
