# Estado do desenvolvimento — EasySignage

Documento de referência do que está implementado **até maio de 2026**. Complementa o roadmap arquitetural na raiz do repositório com o estado **concreto** do código e ligações explícitas às **fases de engenharia (§19)** e **fases de interface (§19.8)** de `digital_signage_arquitetura_roadmap.md`.

O próprio roadmap, em **§19** (início da secção), aponta para **este ficheiro** como *snapshot* e checklist de QA a manter após entregas.

---

## Alinhamento com o roadmap de engenharia (§19.1–19.7)

| Fase | Nome (roadmap) | Estado no código (mai/2026) |
|------|----------------|-----------------------------|
| **19.1** | Fase 0 — Fundação técnica | **Em grande parte feito:** monorepo pnpm/Turbo, Prisma + PostgreSQL, Nest API, Next CMS, `device-protocol`, web-player, Docker Compose. **Parcial:** CI/CD uniforme, Redis/filas em prod. |
| **19.2** | Fase 1 — Autenticação, tenants e dispositivos | **Feito (núcleo):** auth JWT, RBAC, sites, devices, pairing, heartbeat, `wakeMac` + WOL UDP. **Parcial:** Electron. |
| **19.3** | Fase 2 — Biblioteca e playlists | **Parcial avançado:** upload multipart, vários tipos no player (imagem, vídeo, PDF, HTML, URL), playlists + DnD no CMS. **Pendente:** cache offline robusto, media-worker ativo. |
| **19.4** | Fase 3 — Agendamento e publicação | **Parcial:** `Publication` + publicar no CMS; **`ScheduleRule` + motor** que escreve `current_item_json` no poll do player; **pendente:** campanhas, ack de publicação, manifest com hash. |
| **19.5** | Fase 4 — Controle remoto e monitoramento | **Parcial (MVP):** telemetria, overview, comandos (`wol`), **preview JPEG** (~1/s player, ~3,5 s CMS). **Pendente:** WebSocket gateway, alertas, dashboard agregado. |
| **19.6** | Fase 5 — Robustez operacional | **Não iniciado** |
| **19.7** | Fase 6 — Multi-tenant comercial | **Parcial:** multi-tenant no modelo; **pendente:** quotas, branding. |

---

## Alinhamento com fases de interface CMS (§19.8 / `easysignage_diretrizes_interface_css.md`)

| Fase UI | Estado (mai/2026) |
|---------|---------------------|
| UI-0, UI-1 | **Feitos** (tokens, shell, navegação). |
| UI-2 | **Iniciado** — `StatusBadge`, `ConnectionBadge`, `EmptyState` + classes `.badge` em `globals.css`. Falta extrair Table/Modal React. |
| UI-3 | **Em andamento** — devices/sites/login; badges de conexão nos devices. |
| UI-4 | **Avançado** — assets, playlists, agendamento (grelha + lista), publicação no device. |
| UI-5 | **Iniciado** — `/monitoring` com pré-visualização e tema escuro local (`.monitoring-theme-dark`). Alerts ainda placeholder. |
| UI-6 | **Não iniciado** |

---

## Funcionalidades recentes (motor de agenda e monitorização)

### Agendamento no player

- **`ScheduleEngineService`:** na janela ativa (dia ISO 1–7, minutos, prioridade), define `current_item_json` como playlist com `source: "schedule"`.
- **Fora da janela:** restaura `schedule_baseline_item_json` ou payload da publicação ativa.
- **Disparo:** `GET /device/state` e `POST /device/heartbeat` (cada ~3 s no web player).
- **CMS:** `POST /schedules/reapply` reaplica todas as regras do tenant.
- **Env:** `SCHEDULE_TIMEZONE` (omissão `Europe/Lisbon`).
- **Migração:** `schedule_baseline_item_json`, `active_schedule_rule_id` em `device_state`.

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

**Migração pendente** (se Postgres estiver parado): na pasta `apps/api`, `pnpm exec prisma migrate deploy`.

---

## Documentos relacionados

| Documento | Conteúdo |
|-----------|----------|
| `digital_signage_arquitetura_roadmap.md` | Arquitetura e §19 |
| `easysignage_diretrizes_interface_css.md` | Diretrizes de interface |
| `easysignage_automation_core.md` | WOL, automação futura |
| `docs/producao-e-auto-hospedagem.md` | Deploy |

---

*Última atualização: maio de 2026.*
