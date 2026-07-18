# Digital Signage Platform — Arquitetura Técnica Detalhada e Roadmap de Engenharia

## 1. Objetivo do Documento

Este documento define a arquitetura técnica inicial do produto de sinalização digital independente, com foco em:

- gestão centralizada de conteúdo
- operação de múltiplas telas remotas
- players web e Electron
- execução em navegadores de TVs e Android
- controle remoto de players
- funcionamento offline-first
- escalabilidade para operação multiunidade e multi-tenant

Além da arquitetura, este documento traduz a visão em um roadmap de engenharia executável pelo time.

---

## 2. Princípios de Arquitetura

1. **Offline-first no player**  
   O player deve continuar operando mesmo sem conexão.

2. **CMS centralizado, player desacoplado**  
   O servidor define estado desejado; o player sincroniza e executa localmente.

3. **Compatibilidade gradual de runtime**  
   A mesma plataforma deve suportar:
   - Electron player
   - browser desktop
   - browser Android
   - browser embarcado de TV, com degradação controlada

4. **Controle operacional antes de features visuais avançadas**  
   O diferencial do produto é gestão, publicação, monitoramento e confiabilidade.

5. **Protocolos simples no início**  
   REST + WebSocket. Evitar complexidade desnecessária no MVP.

6. **Multi-tenant por desenho, mesmo que desativado no MVP inicial**  
   Isso evita retrabalho estrutural.

---

## 3. Visão Geral da Solução

## 3.1 Componentes principais

- **Admin Web / CMS**
- **API Backend**
- **Realtime Gateway**
- **Media Pipeline**
- **Storage**
- **Banco relacional**
- **Fila de jobs**
- **Players**
  - Electron Player
  - Web Player
  - Browser Player para Android/TV
- **Serviços auxiliares**
  - Telemetria
  - Alertas
  - Atualização de software
  - Prova de execução

---

## 3.2 Diagrama macro

```text
┌─────────────────────────────────────────────────────────────────┐
│                        ADMIN / CMS WEB                          │
│ usuários, tenants, telas, playlists, campanhas, agendamento    │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTPS / JWT
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                          API BACKEND                            │
│ auth, RBAC, devices, playlists, schedules, publishing, logs     │
└───────────────┬──────────────────────┬──────────────────────────┘
                │                      │
                │                      │
                ▼                      ▼
      ┌──────────────────┐    ┌────────────────────┐
      │   POSTGRESQL     │    │   REDIS / QUEUES   │
      │ core data        │    │ jobs, cache, pubsub│
      └──────────────────┘    └────────────────────┘
                │                      │
                │                      ▼
                │             ┌────────────────────┐
                │             │   MEDIA PIPELINE    │
                │             │ thumb/transcode/etc │
                │             └─────────┬──────────┘
                │                       │
                ▼                       ▼
      ┌──────────────────┐    ┌────────────────────┐
      │ OBJECT STORAGE   │    │ REALTIME GATEWAY   │
      │ videos/images    │    │ ws/device commands │
      └─────────┬────────┘    └─────────┬──────────┘
                │                       │
                └──────────────┬────────┘
                               ▼
                    ┌───────────────────────┐
                    │        PLAYERS         │
                    │ Electron / Web / TV    │
                    │ Android Browser        │
                    └───────────────────────┘
```

---

## 4. Módulos de Sistema

## 4.1 CMS Web

Responsável por:

- login e sessão
- gestão de tenants
- gestão de usuários e papéis
- cadastro de players/dispositivos
- biblioteca de ativos
- playlists
- campanhas
- agendamento
- publicação
- monitoramento
- auditoria
- envio de comandos remotos

### Requisitos
- SPA web
- responsivo para operação em notebook
- UI orientada a operações em lote
- filtros por grupo, unidade, tags e status

### Stack sugerida
- React + TypeScript
- Next.js ou Vite SPA
- TanStack Query
- component library
- autenticação baseada em token/cookie seguro

---

## 4.2 API Backend

Responsável por:

- autenticação e autorização
- CRUD dos domínios centrais
- versionamento de publicações
- geração de snapshots de conteúdo por player
- endpoints de sincronização
- persistência de logs/telemetria
- auditoria
- orquestração de comandos remotos

### Stack sugerida
- Node.js + TypeScript
- framework: NestJS ou Fastify modular
- OpenAPI/Swagger
- ORM: Prisma ou Drizzle
- validação com Zod / class-validator

---

## 4.3 Realtime Gateway

Responsável por:

- conexão WebSocket entre servidor e players
- entrega de comandos
- presença online
- atualização de estado quase em tempo real
- fallback para polling quando WebSocket não for suportado

### Observação
TV browsers e alguns Android browsers podem ter restrições. Por isso, o protocolo deve aceitar:
- **modo A:** WebSocket
- **modo B:** polling de comando
- **modo C:** sincronização periódica pura

---

## 4.4 Media Pipeline

Responsável por:

- validação de upload
- geração de thumbnail
- extração de metadata
- transcodificação opcional
- normalização de formatos
- cálculo de hash para deduplicação
- publicação para storage/CDN

### Processos esperados
- imagem: validar formato e dimensões
- vídeo: duração, codec, bitrate, resolução
- PDF: geração de preview
- HTML/widget: validação mínima

---

## 4.5 Storage

### Opções
- S3 / MinIO / storage compatível

### Guardar
- vídeos
- imagens
- PDFs
- thumbnails
- pacotes de publicação
- screenshots de players
- logs brutos opcionais

---

## 4.6 Banco de Dados

### Banco principal
- PostgreSQL

### Motivos
- integridade relacional
- queries de agendamento
- multi-tenant
- auditoria
- histórico de publicação

---

## 4.7 Redis / Filas

Usos:

- filas de processamento
- cache
- pub/sub entre API e gateway realtime
- rate limit
- jobs de sincronização e atualização

---

## 5. Players

## 5.1 Electron Player

### Papel
Player principal para ambientes gerenciados com mini-PC, desktop ou appliance.

### Capacidades
- fullscreen / kiosk
- cache persistente local
- execução de vídeos e imagens
- renderização de páginas web
- execução de app web local de player
- watchdog e auto-recovery
- screenshot
- atualização automática
- comandos remotos
- coleta de métricas locais

### Componentes internos
- shell Electron
- renderer app
- sync agent
- asset manager
- playback engine
- health monitor
- command executor
- local database/cache

### Armazenamento local
- SQLite ou IndexedDB + filesystem
- diretório de cache de mídia
- config local
- logs locais
- fila de eventos offline

---

## 5.2 Web Player

### Papel
Player universal, acessado por URL, para:
- navegador desktop
- browser Android
- browser de TV

### Capacidades
- autenticação por pairing code ou token
- sync periódica
- reprodução de mídia suportada pelo browser
- execução de layouts simples
- fallback offline limitado via cache web

### Limitações
- auto-start depende do dispositivo
- cache controlado pelo browser
- suporte variável a codecs
- controle de fullscreen pode ser restrito
- screenshot local nem sempre possível

### Estratégia
O Web Player deve ser tratado como runtime com degradação controlada, não como equivalente absoluto ao Electron.

---

## 5.3 Browser Player em Android / TV

### Premissa
Rodar em:
- Chrome Android
- WebView Android
- browsers de smart TV
- navegadores embarcados

### Diretrizes
- usar interface simples e resiliente
- evitar animações pesadas
- evitar dependência de APIs modernas não amplamente suportadas
- permitir modo “lite”
- permitir política de sync por polling
- validar compatibilidade por matriz de device/browser

---

## 6. Modelo Operacional de Publicação

## 6.1 Conceito central: Desired State

O CMS não “manda tocar item por item”.
Ele publica um **estado desejado** para cada player.

Esse estado inclui:
- identidade do player
- versão de publicação
- playlist/layout efetivo
- janelas agendadas
- ativos requeridos
- regras de fallback
- configurações de runtime

O player:
1. consulta a versão atual
2. baixa delta ou snapshot
3. garante assets locais
4. ativa a nova publicação
5. confirma aplicação

---

## 6.2 Fluxo de publicação

```text
Usuário publica campanha
      ↓
CMS valida regras
      ↓
Backend gera release/version
      ↓
Resolve targeting (players/grupos/tags)
      ↓
Gera snapshot por player ou perfil de player
      ↓
Enfileira jobs de publicação
      ↓
Players recebem aviso (WS/polling)
      ↓
Players sincronizam assets
      ↓
Players ativam nova versão
      ↓
Players enviam confirmação
```

---

## 7. Domínio Funcional

## 7.1 Entidades principais

- Tenant
- User
- Role
- Site
- Screen
- Device
- DeviceGroup
- Tag
- Asset
- Playlist
- PlaylistItem
- Campaign
- Schedule
- Publication
- DeviceState
- Heartbeat
- Command
- PlaybackLog
- Alert
- SoftwareRelease

---

## 8. Estrutura de Banco de Dados

Abaixo está uma modelagem inicial orientada a MVP expandível.

## 8.1 Tabela: tenants

| campo | tipo | notas |
|---|---|---|
| id | uuid | pk |
| name | text | |
| slug | text | único |
| status | text | active, suspended |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

## 8.2 Tabela: users

| campo | tipo | notas |
|---|---|---|
| id | uuid | pk |
| tenant_id | uuid | fk tenants |
| name | text | |
| email | text | único por tenant ou global |
| password_hash | text | |
| status | text | invited, active, disabled |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

## 8.3 Tabela: roles

| campo | tipo |
|---|---|
| id | uuid |
| tenant_id | uuid |
| name | text |
| permissions_json | jsonb |

---

## 8.4 Tabela: user_roles

| campo | tipo |
|---|---|
| user_id | uuid |
| role_id | uuid |

---

## 8.5 Tabela: sites

Representa unidade física, loja, filial ou local.

| campo | tipo |
|---|---|
| id | uuid |
| tenant_id | uuid |
| name | text |
| code | text |
| timezone | text |
| address_json | jsonb |
| created_at | timestamptz |

---

## 8.6 Tabela: devices

Dispositivo lógico registrado.

| campo | tipo | notas |
|---|---|---|
| id | uuid | pk |
| tenant_id | uuid | |
| site_id | uuid | |
| name | text | |
| serial_number | text | opcional |
| platform | text | electron, web, android_browser, tv_browser |
| runtime_version | text | |
| status | text | provisioned, active, disabled |
| auth_token_hash | text | |
| last_seen_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

## 8.7 Tabela: screens

Em alguns casos um device controla uma tela; em outros, várias saídas.

| campo | tipo |
|---|---|
| id | uuid |
| tenant_id | uuid |
| device_id | uuid |
| name | text |
| resolution_w | int |
| resolution_h | int |
| orientation | text |
| is_primary | boolean |

---

## 8.8 Tabela: device_groups

| campo | tipo |
|---|---|
| id | uuid |
| tenant_id | uuid |
| name | text |
| description | text |

## 8.9 Tabela: device_group_members

| campo | tipo |
|---|---|
| group_id | uuid |
| device_id | uuid |

---

## 8.10 Tabela: tags

| campo | tipo |
|---|---|
| id | uuid |
| tenant_id | uuid |
| name | text |
| color | text |

## 8.11 Tabela: device_tags

| campo | tipo |
|---|---|
| device_id | uuid |
| tag_id | uuid |

---

## 8.12 Tabela: assets

| campo | tipo | notas |
|---|---|---|
| id | uuid | |
| tenant_id | uuid | |
| name | text | |
| kind | text | video, image, pdf, html, url, widget |
| mime_type | text | |
| storage_key | text | |
| file_size | bigint | |
| checksum_sha256 | text | |
| width | int | nullable |
| height | int | nullable |
| duration_ms | bigint | nullable |
| metadata_json | jsonb | |
| status | text | uploading, ready, failed |
| created_by | uuid | |
| created_at | timestamptz | |

---

## 8.13 Tabela: playlists

| campo | tipo |
|---|---|
| id | uuid |
| tenant_id | uuid |
| name | text |
| description | text |
| status | text |
| created_by | uuid |
| created_at | timestamptz |
| updated_at | timestamptz |

---

## 8.14 Tabela: playlist_items

| campo | tipo | notas |
|---|---|---|
| id | uuid | |
| playlist_id | uuid | |
| asset_id | uuid | nullable se widget embutido |
| item_type | text | asset, url, widget, html |
| config_json | jsonb | duração, url, widget config |
| position | int | |
| duration_ms | bigint | |
| transition | text | opcional |
| is_muted | boolean | |
| created_at | timestamptz | |

---

## 8.15 Tabela: campaigns

| campo | tipo |
|---|---|
| id | uuid |
| tenant_id | uuid |
| name | text |
| description | text |
| playlist_id | uuid |
| priority | int |
| status | text |
| created_by | uuid |
| created_at | timestamptz |

---

## 8.16 Tabela: schedules

| campo | tipo | notas |
|---|---|---|
| id | uuid | |
| tenant_id | uuid | |
| campaign_id | uuid | |
| timezone | text | |
| start_at | timestamptz | nullable |
| end_at | timestamptz | nullable |
| recurrence_rule | text | RRULE simplificada ou json |
| days_of_week | int[] | opcional |
| time_start | time | opcional |
| time_end | time | opcional |
| targeting_type | text | device, group, tag, site, all |
| targeting_json | jsonb | ids de destino |
| status | text | draft, active, paused |
| created_at | timestamptz | |

---

## 8.17 Tabela: publications

| campo | tipo |
|---|---|
| id | uuid |
| tenant_id | uuid |
| version | bigint |
| scope_type | text |
| scope_id | uuid |
| snapshot_json | jsonb |
| checksum | text |
| status | text |
| created_by | uuid |
| created_at | timestamptz |

---

## 8.18 Tabela: device_publications

| campo | tipo |
|---|---|
| device_id | uuid |
| publication_id | uuid |
| assigned_at | timestamptz |
| downloaded_at | timestamptz |
| activated_at | timestamptz |
| ack_status | text |

---

## 8.19 Tabela: heartbeats

| campo | tipo |
|---|---|
| id | bigserial |
| tenant_id | uuid |
| device_id | uuid |
| received_at | timestamptz |
| is_online | boolean |
| app_version | text |
| os_version | text |
| ip_address | inet |
| metrics_json | jsonb |

---

## 8.20 Tabela: device_state

Último estado conhecido por device.

| campo | tipo |
|---|---|
| device_id | uuid |
| tenant_id | uuid |
| current_publication_id | uuid |
| current_item_json | jsonb |
| last_sync_at | timestamptz |
| storage_free_mb | int |
| cpu_percent | numeric |
| memory_percent | numeric |
| network_status | text |
| screenshot_asset_id | uuid |
| updated_at | timestamptz |

---

## 8.21 Tabela: commands

| campo | tipo |
|---|---|
| id | uuid |
| tenant_id | uuid |
| device_id | uuid |
| command_type | text |
| payload_json | jsonb |
| requested_by | uuid |
| status | text |
| requested_at | timestamptz |
| delivered_at | timestamptz |
| executed_at | timestamptz |
| result_json | jsonb |

### Exemplos de command_type
- restart_player
- reload_runtime
- clear_cache
- refresh_publication
- take_screenshot
- open_url
- reboot_os
- update_app

---

## 8.22 Tabela: playback_logs

| campo | tipo |
|---|---|
| id | bigserial |
| tenant_id | uuid |
| device_id | uuid |
| publication_id | uuid |
| playlist_id | uuid |
| asset_id | uuid |
| item_type | text |
| event_type | text |
| started_at | timestamptz |
| ended_at | timestamptz |
| duration_ms | bigint |
| metadata_json | jsonb |

### event_type
- started
- completed
- skipped
- error

---

## 8.23 Tabela: alerts

| campo | tipo |
|---|---|
| id | uuid |
| tenant_id | uuid |
| device_id | uuid |
| alert_type | text |
| severity | text |
| status | text |
| title | text |
| message | text |
| first_seen_at | timestamptz |
| last_seen_at | timestamptz |
| acknowledged_by | uuid |
| acknowledged_at | timestamptz |

---

## 8.24 Tabela: software_releases

| campo | tipo |
|---|---|
| id | uuid |
| platform | text |
| version | text |
| channel | text |
| package_asset_id | uuid |
| checksum | text |
| mandatory | boolean |
| created_at | timestamptz |

---

## 9. Índices recomendados

- devices(tenant_id, last_seen_at)
- assets(tenant_id, kind, status)
- schedules(tenant_id, status)
- heartbeats(device_id, received_at desc)
- playback_logs(device_id, started_at desc)
- commands(device_id, status, requested_at desc)
- publications(tenant_id, version desc)
- device_publications(device_id, assigned_at desc)

---

## 10. API — Endpoints Principais

Abaixo, um desenho inicial de endpoints.

## 10.1 Auth

### POST `/api/v1/auth/login`
Login do usuário CMS. O JWT inclui `permissions` (array; `*` = admin via role com `all: true` no seed).

### GET `/api/v1/auth/me`
Usuário atual e permissões efetivas (requer Bearer). *Não usa* `PermissionsGuard` — qualquer JWT válido.

### POST `/api/v1/auth/refresh`
Renova sessão/token.

### POST `/api/v1/auth/logout`

---

## 10.2 Tenants / Users

### GET `/api/v1/me`
*Planejado como alias; hoje use* **`GET /api/v1/auth/me`** (ver 10.1).

### GET `/api/v1/users`
### POST `/api/v1/users`
### PATCH `/api/v1/users/:id`

### GET `/api/v1/roles`
### POST `/api/v1/roles`

---

## 10.3 Sites / Devices

### GET `/api/v1/sites`
### POST `/api/v1/sites`

### GET `/api/v1/devices`
Lista com filtros por query (implementado: site via `siteId`, **plataforma** `platform`, **status**, **online** `true` \| `false` — último heartbeat dentro de 5 min). *Grupo/tag: fase posterior.*

### GET `/api/v1/devices/:id/state` (JWT)
Visão agregada para o CMS: dados do device, flag `online`, registro em `device_state` e último heartbeat.

### POST `/api/v1/devices`
Cadastro manual ou pré-provisionamento.

### GET `/api/v1/devices/:id`
### PATCH `/api/v1/devices/:id`
### DELETE `/api/v1/devices/:id`

### POST `/api/v1/devices/:id/pair`
Emparelhamento do player.

### GET `/api/v1/devices/:id/heartbeats`
### GET `/api/v1/devices/:id/playback-logs`

---

## 10.4 Device Groups / Tags

### GET `/api/v1/device-groups`
### POST `/api/v1/device-groups`
### POST `/api/v1/device-groups/:id/members`

### GET `/api/v1/tags`
### POST `/api/v1/tags`
### POST `/api/v1/devices/:id/tags`

---

## 10.5 Assets

### GET `/api/v1/assets`
### POST `/api/v1/assets/upload`
Upload com URL assinada ou multipart.

### GET `/api/v1/assets/:id`
### PATCH `/api/v1/assets/:id`
### DELETE `/api/v1/assets/:id`

### GET `/api/v1/assets/:id/download-url`

---

## 10.6 Playlists

### GET `/api/v1/playlists`
### POST `/api/v1/playlists`
### GET `/api/v1/playlists/:id`
### PATCH `/api/v1/playlists/:id`
### DELETE `/api/v1/playlists/:id`

### POST `/api/v1/playlists/:id/items`
### PATCH `/api/v1/playlists/:id/items/:itemId`
### DELETE `/api/v1/playlists/:id/items/:itemId`
### POST `/api/v1/playlists/:id/reorder`

---

## 10.7 Campaigns / Schedules

### GET `/api/v1/campaigns`
### POST `/api/v1/campaigns`
### PATCH `/api/v1/campaigns/:id`

### GET `/api/v1/schedules`
### POST `/api/v1/schedules`
### PATCH `/api/v1/schedules/:id`
### DELETE `/api/v1/schedules/:id`

### POST `/api/v1/publish`
Cria publicação a partir de campanhas/schedules ativos.

Payload esperado:
```json
{
  "targetType": "group",
  "targetIds": ["..."],
  "note": "Publicação semanal"
}
```

---

## 10.8 Commands

### POST `/api/v1/devices/:id/commands`
Cria comando remoto.

### GET `/api/v1/devices/:id/commands`
### GET `/api/v1/commands/:id`

---

## 10.9 Monitoring / Alerts

### GET `/api/v1/dashboard/overview`
Resumo:
- total de devices
- online
- offline
- alertas críticos
- últimas falhas

### GET `/api/v1/alerts`
### PATCH `/api/v1/alerts/:id/ack`

---

## 10.10 Device Sync API

Esses endpoints são consumidos pelos players.

### POST `/device-api/v1/register`
Registro inicial do player.

### POST `/device-api/v1/pair`
Emparelhamento por código/token.

### POST `/device-api/v1/heartbeat`
Envia estado do player.

Exemplo:
```json
{
  "deviceId": "uuid",
  "appVersion": "1.0.0",
  "platform": "electron",
  "metrics": {
    "cpuPercent": 18.2,
    "memoryPercent": 42.1,
    "storageFreeMb": 24800
  },
  "currentPublicationId": "uuid",
  "currentItem": {
    "type": "asset",
    "assetId": "uuid",
    "position": 2
  }
}
```

### GET `/device-api/v1/publication/current`
Retorna a publicação atual aplicável ao device.

### POST `/device-api/v1/publication/ack`
Confirma:
- downloaded
- activated
- failed

### GET `/device-api/v1/assets/manifest`
Retorna manifest de assets necessários.

### GET `/device-api/v1/commands/pending`
Fallback para polling.

### POST `/device-api/v1/commands/:id/ack`
### POST `/device-api/v1/playback-events`
### POST `/device-api/v1/screenshots`

---

## 11. WebSocket / Realtime Events

## 11.1 Eventos servidor → player

- `publication.updated`
- `command.created`
- `device.config.updated`
- `software.update.available`

## 11.2 Eventos player → servidor

- `device.online`
- `device.state.changed`
- `command.result`
- `playback.event`

---

## 12. Modelo de Pairing / Provisionamento

## 12.1 Opção inicial recomendada
Provisionamento por **pairing code**.

Fluxo:
1. Player inicia sem vínculo
2. Gera código curto temporário
3. Operador abre CMS > Adicionar dispositivo
4. Digita código
5. Servidor emite token do device
6. Player armazena token e entra em operação

### Vantagens
- simples para Electron e browser
- funciona em Android/TV
- reduz atrito de onboarding

---

## 13. Estratégia Offline-first

## 13.1 Regras

- player deve manter última publicação válida localmente
- assets devem ficar em cache persistente
- comandos críticos devem ter fila local
- playback logs devem ser enfileirados offline
- quando a internet volta, o player:
  - envia heartbeats acumulados relevantes
  - envia playback logs pendentes
  - sincroniza comandos/publicações

## 13.2 Política de ativação de publicação
Uma publicação só ativa quando:
- manifesto foi baixado
- assets obrigatórios estão íntegros
- validação local foi aprovada

---

## 14. Engine de Reprodução

## 14.1 Requisitos mínimos

- scheduler local baseado em relógio e timezone
- resolução de prioridade entre campanhas
- reprodução sequencial de playlist
- timeout e fallback de páginas web
- fallback para asset alternativo quando URL falhar
- tratamento de erro sem tela preta permanente

## 14.2 Estratégia recomendada
Criar engine declarativa baseada em “runtime state”:

```text
device state
  -> publication
  -> active schedule window
  -> resolved playlist
  -> current item
  -> playback timer
  -> next item
```

---

## 15. Compatibilidade de Conteúdo

## 15.1 Tipos do MVP
- vídeo mp4/h264
- imagem jpg/png/webp
- pdf renderizado ou convertido
- url externa
- html embutido simples
- widgets leves

## 15.2 Política de compatibilidade
No MVP, padronizar formatos suportados:
- preferir MP4 H.264 + AAC
- preferir imagens otimizadas
- limitar PDFs muito grandes
- controlar iframes e CSP para URLs externas

---

## 16. Segurança

## 16.1 CMS
- JWT com expiração curta + refresh seguro
- RBAC por tenant
- trilha de auditoria
- rate limiting
- 2FA opcional em fase posterior

## 16.2 Device API
- token exclusivo por device
- rotação opcional de token
- validação de fingerprint quando possível
- TLS obrigatório

## 16.3 Conteúdo
- URLs externas com allowlist opcional
- sanitização de HTML embutido
- antivírus/validação de uploads em fase posterior

---

## 17. Observabilidade

## 17.1 Logs
- API logs
- auth logs
- command logs
- playback logs
- sync logs

## 17.2 Métricas
- devices online
- taxa de heartbeat
- falha por plataforma
- tempo de publicação
- assets inválidos
- taxa de comando executado

## 17.3 Alertas
- device offline > X minutos
- publication failure
- storage insuficiente
- crash loop do player
- alta taxa de erro em web content

---

## 18. Deploy e Ambientes

## 18.1 Ambientes
- dev
- staging
- production

## 18.2 Backend
- deploy em VPS, serviços gerenciados ou orquestração (por exemplo Kubernetes) conforme maturidade
- empacotamento em container (Docker/OCI) é **opcional** e **não faz parte da base do repositório** — o time não mantém `docker-compose` nem imagens geradas pelo projeto como pré-requisito de desenvolvimento
- storage separado
- CDN opcional

## 18.3 Players
- canal stable
- canal beta
- auto-update controlado por rollout

## 18.4 Desenvolvimento local (sem Docker no repositório)
- PostgreSQL, Redis e storage compatível com S3 (por exemplo MinIO ou bucket em nuvem) são **pré-requisitos externos**: instalação nativa no SO, serviço gerenciado ou VM — o que o time preferir.
- O repositório **não** inclui `docker-compose`, `Dockerfile` ou imagens geradas como parte do fluxo padrão de desenvolvimento; containerização permanece opcional para deploy, não para o dia a dia local obrigatório.
- A documentação de setup deve listar variáveis de ambiente (`.env`) e versões mínimas de serviços, sem impor um stack containerizado único.

---

## 19. Roadmap de Engenharia

> **Snapshot do repositório (manutenção):** o ficheiro [`docs/estado-desenvolvimento.md`](docs/estado-desenvolvimento.md) consolida, de forma breve, o alinhamento às fases **§19.1–19.7**, às fases de interface **§19.8** e uma **checklist de testes manuais** por módulo. Use-o como ponto único a **atualizar** após cada entrega significativa. O presente documento continua a ser a **especificação normativa** (arquitetura, requisitos e roadmap detalhado); evite duplicar tabelas de “estado atual” aqui — prefira linkar o `docs/` ou integrar notas pontuais só em **§19.0** quando forem decisões de sprint.

## 19.0 Posicionamento atual (abril/2026)

### Capacidade funcional comprovada (estado atual de desenvolvimento)

No estado do repositório **nesta data**, o seguinte fluxo está **funcional** para desenvolvimento e demonstração (não confundir com **publicação versionada** ou agendamento — ver §19.4):

| Passo | O que está garantido |
|-------|----------------------|
| **1. Iniciar players web** | O **web player** (`apps/web-player`, tipicamente `http://localhost:3010` em dev) arranca com Vite; aponta para a API (`VITE_API_URL` ou default `http://localhost:3001/api/v1`). |
| **2. Conectar ao servidor** | **Pareamento** com código gerado no CMS (detalhe do device); o player obtém **token de device**, passa a enviar **heartbeat** e a ler **estado** (`GET /device/state`) em ciclo. O dispositivo aparece **online** no CMS quando há heartbeat recente. |
| **3. Enviar conteúdo (assets ou listas)** | No CMS, no detalhe do dispositivo, **Conteúdo de teste**: escolher **imagem única (asset)** ou **playlist** e **Aplicar**. A API grava `current_item_json` com `{ type: "image", assetId }` ou `{ type: "playlist", playlistId }`. O player obtém ficheiros via `GET /device/assets/:id/file` e, em modo playlist, o **manifest** via `GET /device/playlists/:id/manifest`, exibindo **sequência em loop** (MVP: slides de imagem). |

**Resumo:** iniciar web player → parear → atribuir **asset** ou **playlist** no CMS → o player **sincroniza e reproduz** está **operacional** no modo **conteúdo de teste**. O que **não** faz parte deste estado: campanhas, janelas de agendamento, publicação nomeada/versionada nem push em tempo real obrigatório (polling continua como mecanismo principal no player web).

### Onde estamos no roadmap de engenharia

| Macrofase | Situação | Observação |
|-----------|----------|------------|
| **Fase 0** — Fundação técnica | **Majoritariamente atendida** | Monorepo (pnpm + Turbo), Next (CMS), Nest (API), Prisma/Postgres, `pnpm dev` com API `:3001`, CMS `:3000`, web-player `:3010`, realtime-gateway `:3020`, workers placeholder. Testes Jest na API + smoke HTTP. Itens transversais (CI/CD formal, OpenAPI publicado, matriz de runtimes documentada) em evolução contínua. |
| **Fase 1** — Auth, tenants e dispositivos | **Concluída (MVP)** — refinamentos opcionais | RBAC no JWT, sites/devices, pareamento, heartbeat, estado operacional no CMS; web player com heartbeat (60s) e polling de estado (~3s); Electron com `WEB_PLAYER_URL`. |
| **Fase 2** — Biblioteca e playlists | **Em andamento — núcleo de playlist no modo “teste” fechado** | **Feito:** `Asset` + upload imagem (JSON/base64); `Playlist` + `PlaylistItem`; API CMS `GET/POST/PATCH/DELETE /playlists`, itens, `POST .../reorder`; permissões `playlists.read` / `playlists.write`; `PATCH /devices/:id/test-content` com **`assetId` ou `playlistId`** (exatamente um) → `current_item_json` como `{ type: "image", assetId }` ou `{ type: "playlist", playlistId }`; device API `GET /device/playlists/:id/manifest` + ficheiros de asset; **CMS** rotas `/playlists` (lista, nova, detalhe com itens), detalhe do device com modo **Asset vs Playlist**; **web player** imagem única ou **sequência** (manifest, slides `image/*`, duração por item, loop). **Ainda não é “publicação versionada”** (isso é Fase 3): não há campanha, schedule nem `Publication` ativa — só conteúdo de teste no `device_state`. **Pendente Fase 2 plena:** vídeo, thumbnails/metadata, upload multipart, cache offline robusto, paridade Electron além do shell. |
| **Fase 3** — Publicação versionada | **Iniciada (base)** | Modelo `Publication` (versão monotónica por device), `POST /devices/:id/publish`, `GET /devices/:id/publications`, `device_state.current_publication_id` com FK; CMS com **Publicar versão** + histórico. Player web **inalterado** (continua a ler `current_item_json`). **Pendente:** agendamento, campanhas, ack explícito, manifest com hash. |
| **Fases 4+** | Não iniciadas como macroentrega | Comandos remotos ricos, monitoramento avançado — §19.5 em diante. |

**Em uma frase:** Fases **0–1** fechadas para MVP; **Fase 2** tem **biblioteca + playlists + atribuição ao device + playback em sequência no web player** no fluxo de **teste**; o próximo salto macro é **publicação versionada e agendamento** (§19.4), consolidando Fase 2 com mídia avançada e robustez de player em paralelo onde fizer sentido.

### Onde estamos no plano de interface (CMS)

| Fase UI | Situação (abr/2026) |
|---------|---------------------|
| **UI-0** Fundação visual | **Concluída** — `apps/cms`: `globals.css` com tokens (`:root` + `[data-theme="dark"]`), Inter (`next/font`), reset/base e utilitários CSS (botões, inputs, tabela, cards). |
| **UI-1** Shell | **Concluído** — Sidebar + topbar, grupo `(app)`, container até 1440px, itens futuros como “Em breve”, página `/dashboard` (stub). |
| **UI-2** Biblioteca de componentes | **Pendente** — Extrair componentes React reutilizáveis; badges de status (device/publicação); modal/drawer; skeleton. |
| **UI-3** Migração telas Fase 1 | **Em andamento** — Listagem de devices com filtros (site, plataforma, status, conexão) e detalhe com seção de estado operacional; **falta** biblioteca compartilhada (UI-2) e badges formais por tipo de status cadastral. |
| **UI-4** Conteúdo e publicação | **Em andamento** — `/assets` (upload lista); `/playlists` (lista, criar, detalhe com itens); detalhe do device: **Conteúdo de teste** com escolha **asset ou playlist** (sincroniza com `current_item_json`). **Pendente:** DnD/reorder visual forte, preview em miniatura, upload com progresso, telas de “publicação” quando existir backend §19.4. |
| **UI-5 a UI-6** | Não iniciadas | Amarradas às fases 19.5–19.7 de backend. |

### Tarefas já executadas (registro)

**Interface (CMS), alinhadas a `easysignage_diretrizes_interface_css.md`:**

- [x] Tokens globais e base CSS (UI-0).
- [x] Tipografia Inter e tema claro como padrão administrativo (UI-0).
- [x] Shell com navegação lateral e topbar; rotas `dashboard`, `devices`, `sites` no shell (UI-1).
- [x] Migração visual das telas existentes de login, devices (lista, novo, `[id]`) e sites para o novo layout (UI-3 parcial).
- [x] Redirecionamento pós-login para `/dashboard`; home `/` envia para dashboard ou login.
- [x] Listagem de devices com filtros alinhados à API (site, plataforma, status, online/offline) e coluna de conexão (UI-3 parcial).
- [x] Detalhe do device com leitura de estado operacional via API (`/devices/:id/state`) e indicador online/offline (UI-3 parcial).

**Engenharia (referência — validar no repositório ao planejar sprints):**

- [x] Monorepo e apps (`api`, `cms`, players, workers, etc.) conforme arquitetura deste documento.
- [x] Fluxos de Fase 1 no CMS: autenticação, listagem/detalhe/cadastro de device, pairing, sites.
- [x] API CMS: `GET /devices` com query `siteId`, `platform`, `status`, `online` (`true` \| `false`; online = heartbeat nos últimos 5 min); `GET /devices/:id/state` agregando device, `device_state` e último heartbeat.
- [x] **RBAC mínimo:** permissões no JWT a partir de `roles` / `permissions_json`; `PermissionsGuard` + `RequirePermissions` em `sites` e `devices`; constantes `devices.read` \| `devices.write`, `sites.read` \| `sites.write`.
- [x] **GET `/auth/me`** para inspecionar sessão e permissões.
- [x] **Seed:** usuário `viewer@demo.local` (somente leitura) além do admin.
- [x] **Web Player:** heartbeat periódico (60s) após pareamento; métricas opcionais (`memory`).
- [x] **Electron:** janela carrega URL do web-player via `WEB_PLAYER_URL`.
- [x] **MVP conteúdo imagem (Fase 2 parcial — validado):**
  - **Prisma:** modelo `Asset` (tenant, nome, `mimeType`, `storageKey`, `fileSize`, etc.); migração aplicável ao Postgres.
  - **API CMS (JWT):** `GET/POST /assets` (upload via JSON: `name`, `mimeType`, `dataBase64` aceitando data URL); limite de imagem decodificada ~8 MB; Prisma Client gerado em `src/generated/prisma-client` (evita EPERM no Windows no store pnpm) + **assets copiados para `dist`** via `nest-cli.json`.
  - **API device:** `GET /device/state` expõe `currentItem`; `GET /device/assets/:assetId/file` faz stream do ficheiro com `DeviceAuthGuard`.
  - **API CMS:** `PATCH /devices/:id/test-content` com `{ assetId }` — atualiza `device_state.current_item_json` e `last_sync_at`.
  - **Infra API:** `bodyLimit` Fastify aumentado (default 20 MB) para corpos JSON com base64; CORS via `CORS_ORIGINS` (incl. web player `:3010` em dev).
  - **CMS:** página **Assets** no shell; detalhe do device com seleção de asset para “conteúdo de teste”.
  - **Web Player:** após parear, polling do estado e reprodução da imagem (Authorization Bearer no fetch do binário; `objectURL` para `<img>`).
- [x] **Playlists no modo teste (Fase 2 — incremento entregue):**
  - **Prisma:** `Playlist`, `PlaylistItem` (migração `playlists`).
  - **API CMS:** CRUD playlists + itens + reorder; `playlists.read` / `playlists.write`; seed viewer com leitura de playlists.
  - **API device + device state:** `PATCH /devices/:id/test-content` aceita `{ playlistId }` ou `{ assetId }`; `GET /device/playlists/:playlistId/manifest` para o player montar a sequência.
  - **CMS:** `/playlists`, `/playlists/new`, `/playlists/[id]`; device `[id]` com radio Asset / Playlist e sincronização com `current_item_json`.
  - **Web Player:** ramo playlist (manifest, rotação de slides, imagens apenas no MVP atual).

*(Itens não marcados [x] nas seções 19.4+ permanecem planejados, não implementados como macroentrega.)*

### 19.0.1 Continuidade de desenvolvimento (prioridade sugerida)

Ordem pensada para **fechar Fase 2** e **abrir Fase 3** sem retrabalho estrutural:

1. **Consolidar Fase 2 (produto e operação)**  
   - Upload **multipart** e/ou URLs assinadas; reduzir dependência de base64 no CMS.  
   - **Vídeo** no pipeline (upload, tipo no asset, player web com `<video>` onde aplicável).  
   - **Thumbnails / metadata** mínimos para biblioteca (filas no `media-worker` quando deixar de ser placeholder).  
   - **Cache offline** no web player (Cache API / IndexedDB) e política de eviction; alinhar com princípio offline-first do §2.  
   - **Electron:** download + cache local explícito além de abrir o web player.

2. **Continuar Fase 3 (publicação real)**  
   - **Feito (base):** tabela `publications`, versão por device, `POST /devices/:id/publish`, histórico no CMS.  
   - **Seguinte:** **manifest** com hash/tamanhos, **ack** de aplicação no player, **agendamento** mínimo (janela ou regra simples).  
   - CMS: timeline / comparar versões (opcional).

3. **Plataforma e qualidade (paralelo)**  
   - **OpenAPI** exportada ou gerada a partir dos controllers; contratos device-api documentados. **(Estado abr/2026:** UI Swagger em `/docs` na API Nest com `@nestjs/swagger`; esquemas `access-token` e `device-token`; desativar exposição com `SWAGGER=0` em produção. Completar documentação nos DTOs com `@ApiProperty` conforme necessidade.)  
   - **CI** (lint, test, build) em PR.  
   - **Testes e2e** smoke (pareamento + um slide + playlist curta).  
   - **UI-2:** componentes compartilhados (badges, tabelas) para não divergir das diretrizes.

4. **Escalabilidade e custo (quando houver tráfego)**  
   - CDN ou object storage para assets; reduzir streaming direto pela API Nest.  
   - Ajustar **intervalos** de polling/heartbeat por ambiente; opcionalmente empurrar atualizações via **realtime-gateway** já presente no monorepo.

5. **Layouts, zonas e video wall (§19.4b–19.5b)** — após consolidação de mídia e pareamento  
   - **L1:** viewport (orientação + resolução) no device e player.  
   - **L2:** templates multi-zona + `current_item_json.type = "layout"`.  
   - **L3:** modos de fit (native, contain, cover, stretch).  
   - **L4:** video wall sincronizada (tiles + `sync.epochMs`).  
   - Plano detalhado: [`docs/planejamento-layouts-zonas-video-wall.md`](docs/planejamento-layouts-zonas-video-wall.md).

**Entregue nesta linha:** primeiro modelo de **Publication** (histórico + publicação ativa); sync do player continua via `current_item_json` (sem mudança no web player).

**Próximo incremento único recomendado:** **(A)** vídeo + multipart **ou** **(B)** agendamento mínimo + janela de ativação **ou** **(C)** player lê `publicationId`/versão para invalidar cache — conforme prioridade.

---

## 19.1 Fase 0 — Fundação técnica

### Objetivo
Criar base de projeto, padrões, pipelines e contratos.

### Tarefas
- definir stack final
- criar monorepo
- configurar CI/CD
- configurar lint, formatter e testes
- configurar ambiente local: PostgreSQL, Redis e storage compatível com S3 (instalação nativa no SO, serviços gerenciados ou instâncias remotas — **sem Docker obrigatório no repositório**)
- criar schema inicial de banco
- gerar OpenAPI base
- criar design system mínimo do CMS (tokens e base conforme `easysignage_diretrizes_interface_css.md`; plano de fases em **19.8**)
- definir convenções de logs e erros
- definir protocolo device-api
- definir matriz de runtimes suportados

### Entregáveis
- repositório base
- pipelines funcionando
- banco inicial
- documentação de setup
- contratos de API v1

---

## 19.2 Fase 1 — Autenticação, tenants e dispositivos

### Objetivo
Ter login administrativo e cadastro/pareamento de players.

### Backend
- auth de usuários
- tenants
- RBAC básico **(evolução: JWT com `permissions`, guards em rotas CMS, seed admin/viewer)**
- CRUD de sites
- CRUD de devices
- pairing de device
- endpoint de heartbeat
- endpoint de estado do device

### CMS
- login
- listagem de dispositivos
- detalhes do dispositivo
- tela de pairing
- filtros por status/site/plataforma
- **(evolução)** filtros por conexão online/offline na listagem; detalhe com bloco de estado operacional (telemetria quando disponível)

### Player Electron
- bootstrap básico
- provisioning
- armazenar token
- heartbeat periódico **(via shell carregando web-player; `WEB_PLAYER_URL`)**
- tela idle / não pareado

### Web Player
- boot por URL
- pairing code
- heartbeat básico **(evolução: intervalo automático 60s após parear)**

### QA
- fluxo de pareamento ponta a ponta
- reconexão
- atualização de status online/offline

### Entregáveis
- primeiro device aparece online no CMS

---

## 19.3 Fase 2 — Biblioteca de mídia e playlists

### Objetivo
Publicar conteúdo simples.

### Estado no repositório (abr/2026)

| Área | Situação |
|------|----------|
| Upload de assets (imagem) | **Sim** — API + CMS; disco local em dev; tipos imagem comuns |
| Metadata / thumbnails | **Não** |
| CRUD playlists / items | **Sim** — API + CMS; reorder de itens |
| Player: item único via `current_item_json` | **Sim** (modo teste) |
| Player: sequência (playlist) via manifest + `current_item_json` tipo `playlist` | **Sim** (modo teste; imagens na playlist) |
| Player: conteúdo via publicação versionada (snapshot em `publications` + `current_publication_id`) | **Parcial** — mesmo playback que teste (`current_item_json`); histórico e versão na API/CMS |
| Agendamento / campanha | **Não** |

### Backend
- upload de assets **(evolução: imagens entregues; vídeo/multipart/metadata pendentes)**
- metadata extraction
- thumbnails
- CRUD de playlists
- CRUD de playlist items

### CMS
- biblioteca de mídia
- upload com progresso
- editor simples de playlist
- preview de itens

### Player Electron
- download de asset
- cache local
- playback de vídeo/imagem
- loop de playlist local

### Web Player
- playback de vídeo/imagem
- cache web básico

### QA
- validar tipos suportados
- medir tempos de sync
- validar reexecução após reinício do player

### Entregáveis
- player executa playlist simples publicada

---

## 19.4 Fase 3 — Agendamento e publicação versionada

### Objetivo
Transformar playlists em operação real.

### Backend
- campaigns
- schedules
- motor de resolução de agendamento
- publicação versionada
- manifest de assets
- ack de publicação

### CMS
- cadastro de campanhas
- agenda por grupo/site/device
- publicação manual
- timeline básica

### Player Electron
- sync de publicação
- ativação segura
- scheduler local por timezone
- fallback para última publicação válida

### Web Player
- sync periódica
- aplicação de publicação

### QA
- conflito entre campanhas
- fusos horários
- queda de conexão durante troca de publicação

### Entregáveis
- múltiplos devices com agenda diferente e controle central

---

## 19.5 Fase 4 — Controle remoto e monitoramento

### Objetivo
Ganhar capacidade operacional.

### Backend
- commands
- polling de comandos
- realtime gateway
- alerts
- screenshots endpoint
- dashboard overview

### CMS
- enviar comando remoto
- acompanhar status do comando
- dashboard de health
- alertas e ack

### Player Electron
- executar restart/reload/clear-cache/open-url/screenshot
- retornar resultado do comando
- watchdog

### Web Player
- suportar refresh/open-url onde viável
- polling de comandos

### QA
- confiabilidade de comando
- timeout
- execução idempotente
- screenshot remoto

### Entregáveis
- operação remota básica pronta

---

## 19.6 Fase 5 — Robustez operacional

> **Status (jul/2026): concluída.** PRs 5.1–5.18 entregues — ver detalhe por sub-fase na secção "Fase 5 — Núcleo operacional e confiabilidade" de [`docs/estado-desenvolvimento.md`](docs/estado-desenvolvimento.md). O objetivo e escopo abaixo permanecem como referência normativa da fase.

### Objetivo
Preparar produto para ambientes reais.

### Backend
- auditoria
- retenção de logs
- reprocessamento de jobs
- limites por tenant
- observabilidade estruturada

### CMS
- histórico de publicação
- histórico de comandos
- filtros avançados
- auditoria de usuário

### Player Electron
- auto-update
- crash recovery
- fila offline de eventos
- limpeza de cache inteligente

### Web / TV / Android
- modo lite
- matriz de compatibilidade
- fallback de funcionalidades

### QA
- testes de longa duração
- rede instável
- storage cheio
- desligamento abrupto

### Entregáveis
- baseline operacional para pilotos reais

---

## 19.7 Fase 6 — Multi-tenant e expansão comercial

### Objetivo
Escalar para operação SaaS ou white-label.

### Backend
- isolamento completo por tenant
- quotas
- branding por tenant
- roles avançados
- API keys

### CMS
- visão por tenant
- perfis por unidade/região
- operação em lote

### Produto
- onboarding guiado
- relatórios
- prova de exibição
- templates/wizards

---

## 19.8 Plano de desenvolvimento da interface (CMS)

**Referência normativa:** `easysignage_diretrizes_interface_css.md` — tokens, paleta, tipografia, componentes, navegação, telas e acessibilidade.

**Posicionamento:** ver **19.0** para fase de engenharia e tabela de fases UI. Em síntese: **UI-0 e UI-1 concluídos**; **UI-3 em andamento**; **UI-2 pendente** antes de fechar o “pronto” da interface Fase 1; **UI-4 iniciada** com `/assets` e conteúdo de teste no detalhe do device (MVP Fase 2 parcial).

### Situação atual do repositório (abril/2026)

- **App:** `apps/cms` (Next.js 15, React 19).
- **Funcional:** redirecionamento pós-login para `/dashboard`, login com tenant/e-mail/senha, listagem e detalhe de devices, criação de device, fluxo de pairing, página de sites — alinhado à **Fase 1** do roadmap de engenharia; **página `/assets`** (upload/lista de imagens) e **bloco de conteúdo de teste** no detalhe do device (MVP **Fase 2 parcial**).
- **Interface:** **tema claro** como padrão, **tokens CSS** (`globals.css`), **Inter**, **shell** com sidebar e topbar (rotas sob layout `(app)`), página **Dashboard** em stub. As telas citadas usam **classes globais** em substituição ao protótipo escuro anterior; **componentes React nomeados** e **badges de estado** ainda não extraídos (próximo passo UI-2 / fechamento UI-3).

### Princípios de execução (espelhando o documento de diretrizes)

1. **Clareza e operação antes de decoração** — tabelas, filtros, status e feedback primeiro.
2. **Tema claro robusto no CMS** — dark reservado a monitoramento/NOC e preparado via tokens (`[data-theme="dark"]`).
3. **Consistência radical** — um único sistema de tokens e componentes reutilizáveis.
4. **Estados como identidade** — badges e semântica para device, publicação e comandos, conforme seções 14 e 15 das diretrizes.
5. **Desktop-first** — tablet/mobile como secundários, conforme seção 16.

### Fases de interface (paralelas e dependentes das fases 19.1–19.7)

| Fase UI | Nome | Objetivo | Entregáveis principais | Status (abr/2026) |
|--------|------|----------|-------------------------|---------------------|
| **UI-0** | Fundação visual | Aplicar tokens globais, base CSS e tipografia | `globals.css` com `:root` e bloco dark; Inter; reset/base; foco visível | **Feito** |
| **UI-1** | Shell da aplicação | Navegação e layout administrativos | Sidebar + itens 12.1 (stubs “Em breve”); topbar; container até 1440px | **Feito** |
| **UI-2** | Biblioteca de componentes | Padronizar interação e densidade | Botões (hierarquia 13.1), inputs e estados 13.2, tabela 13.4, card 13.5, badge de status 14.x, modal/drawer 13.6–13.7; skeleton (18.2) | **Pendente** (hoje há só classes CSS) |
| **UI-3** | Migração das telas Fase 1 | Alinhar fluxos já existentes às diretrizes | Light default; componentes + tokens; tabelas/filtros; badges; empty/erro (18.1–18.3) | **Em andamento** |
| **UI-4** | Conteúdo e publicação (Fase roadmap 2–3) | Playlists, assets, agendamento | Grid/lista de assets, editor de playlist com drag-and-drop claro, telas de agendamento com calendário/timeline — sempre seguindo densidade e telas 15.4–15.6 | **Iniciado (MVP)** — lista/upload de assets e conteúdo de teste no device; **falta** playlist editor, agendamento, DnD |
| **UI-5** | Operação e monitoramento (Fase roadmap 4–5) | Dark theme em dashboards operacionais | Módulos Monitoring/Alerts com **dark theme** por padrão ou toggle; dashboard overview (15.1); lista de alertas (15.8); logs e comandos legíveis | **Não iniciado** |
| **UI-6** | Polimento e escala | Acessibilidade e multi-tenant visual | WCAG mínimo (19); microinterações discretas (17); preparação para branding por tenant (Fase 6 produto) sem quebrar tokens base | **Não iniciado** |

### Dependências e ordem recomendada

- **UI-0 → UI-1 → UI-2** são pré-requisitos para qualquer tela nova “oficial”; evita dívidas em telas já migradas no **UI-3**.
- **UI-3** deve acompanhar ou fechar imediatamente após **UI-2**, para não duplicar trabalho nas páginas atuais de `devices`, `sites`, `login`.
- **UI-4** e **UI-5** amarram às entregas de backend das fases 19.3–19.5; especificações de tela continuam nas seções **15** das diretrizes.

### Critério de pronto para a “interface Fase 1”

Para considerar a interface da Fase 1 alinhada ao plano:

1. CMS administrativo em **tema claro** por padrão, com tokens aplicados. — **Atendido**
2. **Shell** com sidebar + topbar coerentes com o documento de diretrizes (itens inativos podem apontar para “Em breve” se a rota não existir). — **Atendido**
3. Telas **login**, **devices** (lista, novo, detalhe), **sites** e **pairing** usando componentes compartilhados e badges de estado onde couber. — **Parcial** (falta biblioteca de componentes e badges)
4. Nenhuma cor primária substituindo semântica (vermelho só erro/destaque crítico; verde para sucesso/online, conforme seção 6.5). — **Atendido** na base de tokens; revisar ao introduzir novos componentes

---

## 19.9 Layouts, zonas e video wall (§19.4b–19.5b)

> **Planejamento detalhado:** [`docs/planejamento-layouts-zonas-video-wall.md`](docs/planejamento-layouts-zonas-video-wall.md)

### Objetivo

Permitir que operadores configurem **como** o conteúdo ocupa o ecrã — não apenas **o quê** reproduzir:

- **Orientação e resolução** por dispositivo (retrato, paisagem, virado).
- **Zonas** com subdivisões pré-definidas e fontes distintas por zona.
- **Modo de exibição** por zona/fonte (nativo, esticado, letterbox, etc.).
- **Video wall** — vários devices como tiles sincronizados de um canvas virtual.

### Posição no roadmap

| Relação | Notas |
|---------|-------|
| **§8.7 `screens`** | Materializa a tabela `screens` do modelo lógico; pode fundir-se em `Device` + `DeviceLayout` no MVP |
| **§19.3–19.4** | Estende `current_item_json`, `Publication` e agenda — **retrocompatível** com `asset`/`playlist` full-screen |
| **§19.5** | Video wall usa telemetria de drift + comandos; evolui para WebSocket no `realtime-gateway` |
| **§19.8 UI** | Fases UI-4b (editor de layout), UI-5b (monitorização de wall) |

### Macrofases de entrega

| Fase | Nome | Entregável principal |
|------|------|----------------------|
| **L1** | Viewport | `orientation` + resolução lógica; player com rotação CSS |
| **L2** | Zonas | `LayoutTemplate` + `type: "layout"` + player multi-zona |
| **L3** | Fit | `ContentFitMode` + resolução alvo opcional |
| **L4** | Video wall | `VideoWall` + tiles + sync por `epochMs` |
| **L5** | Polimento | Templates tenant, editor avançado, wall + agenda |

### Critérios de pronto (resumo)

- **L1:** CMS define retrato 1080×1920; player exibe rodado; online/preview coerentes.
- **L2:** Template `split_h_2` com duas playlists em loop independente.
- **L4:** Parede 2×1 com imagem/vídeo contínuo; drift de arranque &lt; 100 ms (MVP).

### Estado (jul/2026)

**Não iniciado** — especificação e integração documentadas; implementação após consolidação de mídia, design enterprise e pareamento (estado atual do repositório).

---

## 20. Distribuição por Times

## 20.1 Backend Team
Responsável por:
- auth
- domínio core
- schedules
- publications
- commands
- observabilidade
- integrações internas

## 20.2 Frontend CMS Team
Responsável por:
- interface de gestão
- dashboards
- editor de playlists
- editor de layouts/zonas e video walls (§19.9)
- monitoramento
- UX operacional

## 20.3 Player Team
Responsável por:
- Electron shell
- Web runtime
- sync engine
- playback engine
- viewport, multi-zona e video wall tile (§19.9)
- cache
- commands
- health monitor

## 20.4 QA / Platform
Responsável por:
- automação
- matriz de device/browser
- ambientes
- testes de carga e resiliência

---

## 21. Critérios de Pronto por Macroentrega

## Pareamento
- device pareia em menos de 2 minutos
- aparece online no painel
- mantém heartbeat estável

## Publicação
- playlist publicada chega ao player
- player baixa assets e ativa publicação
- reinício do player não perde estado

## Agendamento
- campanha respeita timezone
- troca de programação sem travamento
- fallback local funciona offline

## Controle remoto
- comando enviado aparece no player
- status fica auditável
- resultado é persistido

## Monitoramento
- painel reflete online/offline
- alertas disparam corretamente
- screenshot e estado atual disponíveis quando suportado

---

## 22. Riscos Técnicos Principais

1. **Diferenças entre browsers de TV**
   - Mitigar com modo lite e matriz homologada.

2. **Cache inconsistente em runtime web**
   - Tratar Electron como experiência premium; web como compatibilidade.

3. **Páginas web externas instáveis**
   - Implementar timeout, health e fallback.

4. **Publicação parcial de assets**
   - Ativação somente após verificação de integridade.

5. **Complexidade precoce no agendamento**
   - Começar com modelo claro e expandir recorrência depois.

6. **Escopo excessivo no editor visual**
   - Adiar editor complexo para depois do core operacional.

---

## 23. Recomendação Final de Execução

A ordem certa para construir é:

1. **Device onboarding**
2. **Playback simples e confiável**
3. **Publicação versionada**
4. **Agendamento**
5. **Comandos remotos**
6. **Monitoramento e robustez**
7. **Expansão multi-tenant e analytics**

Essa sequência preserva o que mais importa: produto funcional, vendável e operável.

---

## 24. Próximo Documento Recomendado

Após este documento, o ideal é produzir três artefatos complementares:

1. **Especificação de APIs v1 em OpenAPI**
2. **ADR de arquitetura** com decisões técnicas formais
3. **Backlog inicial em épicos e stories** para execução do time
