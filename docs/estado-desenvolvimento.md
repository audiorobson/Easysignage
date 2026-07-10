# Estado do desenvolvimento — EasySignage

Documento de referência do que está implementado **até julho de 2026**. Complementa o roadmap arquitetural na raiz do repositório com o estado **concreto** do código e ligações explícitas às **fases de engenharia (§19)** e **fases de interface (§19.8)** de `digital_signage_arquitetura_roadmap.md`.

O próprio roadmap, em **§19** (início da secção), aponta para **este ficheiro** como *snapshot* e checklist de QA a manter após entregas.

---

## Alinhamento com o roadmap de engenharia (§19.1–19.7)

| Fase | Nome (roadmap) | Estado no código (jul/2026) |
|------|----------------|-----------------------------|
| **19.1** | Fase 0 — Fundação técnica | **Em grande parte feito:** monorepo pnpm/Turbo, Prisma + PostgreSQL, Nest API, Next CMS, `device-protocol`, web-player, Docker Compose. **Parcial:** CI em GitHub Actions (lint/test/build), Redis/filas em prod. |
| **19.2** | Fase 1 — Autenticação, tenants e dispositivos | **Feito (núcleo):** auth JWT, RBAC, sites, devices, pairing, heartbeat, `wakeMac` + WOL UDP. **Parcial:** Electron. |
| **19.3** | Fase 2 — Biblioteca e playlists | **Parcial avançado:** upload multipart, vários tipos no player (imagem, vídeo, PDF, HTML, URL), playlists + DnD no CMS, **cache offline leve** (Cache API + eviction por manifest). **Pendente:** media-worker ativo. |
| **19.4** | Fase 3 — Agendamento e publicação | **Parcial avançado:** `Publication` + publicar no CMS; **`ScheduleRule` + motor**; **ack de publicação** (`appliedPublicationVersion`, `contentRevision` no heartbeat); **manifest com `manifestRevision`**; CMS mostra estado de sincronização. **Pendente:** campanhas. |
| **19.4b–19.5b** | **Layouts, zonas e video wall** | **L1–L4 + drift + WS sync** — viewport, layouts, fit, video wall, painel drift, push `wall.sync`/`wall.tick`. Editor/templates L5 pendente. |
| **19.5** | Fase 4 — Controle remoto e monitoramento | **Parcial (MVP):** telemetria, overview, comandos (`wol`), **preview JPEG**, **realtime-gateway** com wall sync. **Pendente:** alertas, dashboard agregado. |
| **19.6** | Fase 5 — Robustez operacional | **Não iniciado** |
| **19.7** | Fase 6 — Multi-tenant comercial | **Parcial:** multi-tenant no modelo; **pendente:** quotas, branding. |

---

## Alinhamento com fases de interface CMS (§19.8 / `easysignage_diretrizes_interface_css.md`)

| Fase UI | Estado (jul/2026) |
|---------|---------------------|
| UI-0, UI-1 | **Feitos** (tokens, shell, navegação). |
| UI-2 | **Iniciado** — `StatusBadge`, `ConnectionBadge`, `PublicationSyncBadge`, `EmptyState` + classes `.badge` em `globals.css`. Falta extrair Table/Modal React. |
| UI-3 | **Em andamento** — devices/sites/login; badges de conexão e sincronização de publicação nos devices. |
| UI-4 | **Avançado** — assets, playlists, agendamento (grelha + lista), publicação no device. |
| UI-5 | **Iniciado** — `/monitoring` com pré-visualização e tema NOC. Alerts ainda placeholder. |
| UI-4b–5b | **Planejado** — editor de layout/zonas e módulo video wall ([`planejamento-layouts-zonas-video-wall.md`](planejamento-layouts-zonas-video-wall.md)). |
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

### Agendamento no player

- **`ScheduleEngineService`:** na janela ativa (dia ISO 1–7, minutos, prioridade), define `current_item_json` com `source: "schedule"` — **playlist**, **layout multi-zona** (`layoutId`) ou **tile de video wall** (`videoWallId`).
- **Layout:** só regras com `scope=device`; usa `DevicesService.buildLayoutCurrentItem`.
- **Video wall:** em grupo aplica só a devices que são tiles da parede; usa `VideoWallsService.buildTileCurrentItem`.
- **Fora da janela:** restaura `schedule_baseline_item_json` ou payload da publicação ativa.
- **Disparo:** `GET /device/state` e `POST /device/heartbeat` (cada ~3 s no web player).
- **CMS:** `POST /schedules/reapply` reaplica todas as regras do tenant; modal com tipo de conteúdo (Playlist | Layout | Video wall).
- **Env:** `SCHEDULE_TIMEZONE` (omissão `Europe/Lisbon`).
- **Migração:** `schedule_baseline_item_json`, `active_schedule_rule_id` em `device_state`; `layout_id` / `video_wall_id` opcionais em `schedule_rule` (`20260710010000_schedule_layout_wall`).

### Monitorização

- Preview JPEG: `POST /device/preview`, `GET /monitoring/devices/:id/preview`.
- CMS: polling da miniatura ~3,5 s (sem reload da página).
- WOL: `POST /monitoring/devices/:id/commands` com `channel: "wol"`.

---

## Monorepo

| Pacote | Descrição |
|--------|-----------|
| `apps/api` | NestJS: domínios acima + Swagger `/docs`. |
| `apps/cms` | Next.js: gestão + agendamento + monitorização. |
| `apps/web-player` | Vite: playback + captura de preview. |
| `apps/electron-player` | Esqueleto. |
| `docker-compose.yml` | Postgres + API + CMS. |

---

## Páginas CMS

| Rota | Estado |
|------|--------|
| `/devices`, `/sites`, `/assets`, `/playlists`, `/groups` | Operacional |
| `/scheduling` | Operacional (regras + timeline + reaplicar agenda) |
| `/monitoring` | Operacional (overview + preview) |
| `/dashboard`, `/campaigns`, `/alerts`, `/settings` | Placeholder ou mínimo |

---

## Comandos úteis (raiz)

```bash
pnpm dev              # API + CMS + web-player (turbo)
pnpm build            # compilar
pnpm start            # API + CMS produção local (após build)
pnpm docker:compose   # stack Docker
```

**Migrações aplicadas:** `20260709220000_device_viewport`, `20260709223000_layout_templates`.

---

## Planejamento futuro — layouts, zonas e video wall (jul/2026)

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

### Fases L5 (parcial / pendente)

| Área | Escopo |
|------|--------|
| **Polimento (L5)** | Templates custom por tenant |

**Documento normativo:** [`docs/planejamento-layouts-zonas-video-wall.md`](planejamento-layouts-zonas-video-wall.md)  
**Fases sugeridas:** L1 (viewport) → L2 (zonas) → L3 (fit) → L4 (video wall).

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

*Última atualização: julho de 2026.*
