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
| **19.5** | Fase 4 — Controle remoto e monitoramento | **Parcial (MVP):** telemetria, overview, comandos (`wol`), **preview JPEG**, **realtime-gateway** com wall sync, painel de drift, **alertas automáticos** (`/alerts`). **Pendente:** dashboard agregado real (sem dados demo), e-mail/webhook. |
| **19.6** | Fase 5 — Robustez operacional | **Não iniciado** |
| **19.7** | Fase 6 — Multi-tenant comercial | **Parcial:** multi-tenant no modelo; **pendente:** quotas, branding. |

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
| `apps/electron-player` | Esqueleto. |
| `apps/media-worker` | Placeholder (thumbnails/transcode — Fase 2+). |
| `docker-compose.yml` | Postgres + API + CMS. |

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
| `/dashboard` | Parcial (overview com dados demo em partes) |
| `/settings` | **Licença** operacional (HWID, serial, limites players) |

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

## Documentos relacionados

| Documento | Conteúdo |
|-----------|----------|
| `digital_signage_arquitetura_roadmap.md` | Arquitetura e §19 |
| `docs/planejamento-layouts-zonas-video-wall.md` | Orientação, zonas, fit, video wall (planejamento) |
| `easysignage_diretrizes_interface_css.md` | Diretrizes de interface |
| `easysignage_automation_core.md` | WOL, automação futura |
| `docs/producao-e-auto-hospedagem.md` | Deploy |

---

## Próximos passos sugeridos

| Prioridade | Item |
|------------|------|
| 1 | Decoder RTSP no `electron-player` (`easysignage.rtsp.play`) |
| 2 | Dashboard real (sem dados demo) |
| 3 | Media-worker (thumbnails/transcode) |
| 4 | Campanhas com layout/wall; métricas de entrega |
| 5 | Notificações de alertas (e-mail/webhook) |

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

*Última atualização: 10 de julho de 2026 — pacote teste de produção instalável (Docker + staging + ZIP).*
