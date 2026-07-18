# EasySignage

Plataforma de **sinalização digital** (digital signage) para gestão centralizada de conteúdo, operação de múltiplas telas remotas e monitorização em tempo quase real.

Monorepo **pnpm + Turbo** com API NestJS, CMS Next.js, web player (Vite/React) e documentação de arquitetura executável.

**Repositório:** [github.com/audiorobson/Easysignage](https://github.com/audiorobson/Easysignage)

---

## Visão geral

```text
┌─────────────────┐     HTTPS/JWT      ┌─────────────────┐
│   CMS (Next)    │ ─────────────────► │  API (NestJS)   │
│   :3000         │                    │  :3001          │
└─────────────────┘                    └────────┬────────┘
                                              │
┌─────────────────┐     device token          │ PostgreSQL
│  Web Player     │ ◄─────────────────────────┘
│  (Vite) :3010   │   polling estado + heartbeat
└─────────────────┘
```

| Componente | Porta (dev) | Função |
|------------|-------------|--------|
| **CMS** | 3000 | Administração: devices, assets, playlists, agendamento, monitorização |
| **API** | 3001 | Auth, RBAC, conteúdo, publicações, telemetria, device API |
| **Web Player** | 3010 | Pareamento, playback, cache offline, preview JPEG |
| **Realtime Gateway** | 3020 | WebSocket (placeholder — push futuro) |

---

## Início rápido

### Pré-requisitos

- Node.js 22+
- pnpm 9.15+
- PostgreSQL 16 (local, Docker ou remoto)
- Redis 7 (opcional em dev — fila de jobs de mídia; sem ele, a API só regista um aviso e usa o processamento síncrono existente)

### Instalação

```bash
git clone https://github.com/audiorobson/Easysignage.git
cd Easysignage
pnpm install
```

Copie `.env.example` para `.env` na raiz e ajuste `DATABASE_URL` e `JWT_SECRET`.  
Na API (`apps/api`), pode usar um `.env` próprio com a mesma `DATABASE_URL`.

### Base de dados

```bash
# Windows (script PowerShell)
pnpm db:setup

# Ou manualmente na API
cd apps/api
pnpm exec prisma migrate deploy
pnpm exec prisma db seed
```

**Utilizadores de demo (seed):**

| Email | Senha | Permissões |
|-------|-------|------------|
| `admin@demo.local` | `admin123` | Administrador |
| `viewer@demo.local` | `viewer123` | Somente leitura |

### Desenvolvimento

```bash
pnpm dev          # API + CMS + web-player (Turbo)
pnpm build        # Compilar todos os pacotes
pnpm test         # Testes (API)
pnpm docker:compose   # Stack Docker (Postgres + Redis + API + CMS)
```

| URL | Descrição |
|-----|-----------|
| http://localhost:3000 | CMS |
| http://localhost:3001/api/v1/health | Healthcheck API |
| http://localhost:3001/api/v1/docs | Swagger (dev) |
| http://localhost:3010 | Web Player |

---

## Estrutura do repositório

```text
Easysignage/
├── .github/workflows/
│   └── ci.yml                    # CI: install → test → build
├── apps/
│   ├── api/                      # NestJS + Prisma + PostgreSQL
│   │   ├── prisma/
│   │   │   ├── schema.prisma     # Modelo de dados
│   │   │   ├── migrations/       # Migrações SQL
│   │   │   └── seed.ts           # Dados iniciais
│   │   └── src/
│   │       ├── auth/             # JWT, login
│   │       ├── assets/           # Biblioteca de mídia
│   │       ├── playlists/        # Playlists + manifest
│   │       ├── devices/          # CRUD, publicação, test-content
│   │       ├── device-api/       # API do player (state, heartbeat, ack)
│   │       ├── schedules/        # Motor de agendamento
│   │       ├── monitoring/       # Overview, preview, comandos WOL
│   │       ├── groups/           # Grupos de devices
│   │       ├── sites/            # Sites / unidades
│   │       ├── telemetry/        # Telemetria e preview JPEG
│   │       └── public/           # Pareamento (pair)
│   ├── cms/                      # Next.js 15 — painel administrativo
│   │   └── src/
│   │       ├── app/(app)/        # Rotas autenticadas
│   │       │   ├── devices/      # Dispositivos
│   │       │   ├── assets/       # Biblioteca
│   │       │   ├── playlists/    # Playlists (DnD)
│   │       │   ├── scheduling/   # Regras de agenda
│   │       │   ├── monitoring/   # Monitorização + preview
│   │       │   ├── sites/        # Sites
│   │       │   └── groups/       # Grupos
│   │       ├── components/       # Shell, UI, previews
│   │       └── lib/              # Cliente API, utilitários
│   ├── web-player/               # Vite + React — player no browser
│   │   └── src/
│   │       ├── App.tsx           # Pareamento, playback, preview
│   │       └── deviceAssetCache.ts  # Cache API offline
│   ├── electron-player/          # Shell Electron (carrega web-player)
│   ├── media-worker/             # Pipeline de mídia (placeholder)
│   └── realtime-gateway/         # WebSocket (placeholder)
├── packages/
│   ├── device-protocol/          # Contratos partilhados device ↔ API
│   └── shared-types/             # Tipos TypeScript comuns
├── contracts/
│   └── openapi/                  # OpenAPI (futuro)
├── docker/
│   ├── api.Dockerfile
│   ├── cms.Dockerfile
│   └── entrypoint-api.sh
├── docs/
│   ├── estado-desenvolvimento.md # Snapshot do DEV (atualizar por sprint)
│   ├── producao-e-auto-hospedagem.md
│   └── troubleshooting-desenvolvimento.md
├── scripts/
│   ├── setup-db.ps1              # Setup Postgres (Windows)
│   └── check-dev-env.ps1
├── docker-compose.yml
├── package.json                  # Scripts raiz (turbo)
├── pnpm-workspace.yaml
├── turbo.json
├── digital_signage_arquitetura_roadmap.md   # Arquitetura + roadmap §19
├── easysignage_diretrizes_interface_css.md
├── easysignage_automation_core.md
└── easysignage_content_integration.md
```

### Pacotes npm

| Pacote | Caminho | Descrição |
|--------|---------|-----------|
| `@easysignage/api` | `apps/api` | Backend REST |
| `@easysignage/cms` | `apps/cms` | CMS web |
| `@easysignage/web-player` | `apps/web-player` | Player browser |
| `@easysignage/electron-player` | `apps/electron-player` | Player desktop |
| `@easysignage/media-worker` | `apps/media-worker` | Worker de mídia |
| `@easysignage/realtime-gateway` | `apps/realtime-gateway` | Gateway WS |
| `@easysignage/device-protocol` | `packages/device-protocol` | Protocolo device |
| `@easysignage/shared-types` | `packages/shared-types` | Tipos partilhados |

---

## Estado do desenvolvimento

Resumo (julho/2026). Detalhe em [`docs/estado-desenvolvimento.md`](docs/estado-desenvolvimento.md).

| Fase | Estado |
|------|--------|
| **0 — Fundação** | Monorepo, API, CMS, player, Docker, CI GitHub Actions |
| **1 — Auth + devices** | MVP fechado (JWT, RBAC, pairing, heartbeat) |
| **2 — Biblioteca + playlists** | Upload multipart, 5 tipos de mídia, cache offline leve |
| **3 — Publicação + agenda** | Publications, schedule engine, ack do player, manifest com hash |
| **4 — Monitorização** | Telemetria, preview JPEG, WOL |
| **5+** | Em planeamento |

### Fluxo demonstrável

1. Iniciar web player (`:3010`)
2. Criar device no CMS e **parear** com código
3. Atribuir **asset** ou **playlist** (teste ou publicação versionada)
4. Player sincroniza e reproduz; CMS mostra estado de sincronização

---

## Scripts úteis

```bash
pnpm dev              # Desenvolvimento (API + CMS + player)
pnpm build            # Build de produção
pnpm start            # API + CMS (após build)
pnpm test             # Testes
pnpm lint             # Lint (por pacote)
pnpm format           # Prettier
pnpm prisma:generate  # Gerar Prisma Client
pnpm check:env        # Verificar ambiente (Windows)
```

---

## Documentação

| Documento | Conteúdo |
|-----------|----------|
| [`digital_signage_arquitetura_roadmap.md`](digital_signage_arquitetura_roadmap.md) | Arquitetura normativa e roadmap §19 |
| [`docs/estado-desenvolvimento.md`](docs/estado-desenvolvimento.md) | Estado concreto do código |
| [`easysignage_diretrizes_interface_css.md`](easysignage_diretrizes_interface_css.md) | Design system CMS |
| [`docs/producao-e-auto-hospedagem.md`](docs/producao-e-auto-hospedagem.md) | Deploy e produção |
| [`docs/troubleshooting-desenvolvimento.md`](docs/troubleshooting-desenvolvimento.md) | Resolução de problemas |

---

## Stack

- **Backend:** NestJS 10, Fastify, Prisma, PostgreSQL, JWT, Swagger
- **CMS:** Next.js 15, React 19, CSS tokens customizados
- **Player:** Vite 6, React 19, Cache API
- **Tooling:** pnpm workspaces, Turbo, TypeScript 5.7, Jest, Prettier

---

## Licença

Projeto privado. Todos os direitos reservados.
