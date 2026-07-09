# Produção empacotada e auto-hospedagem — EasySignage

Documento de **planeamento** alinhado ao estado em `estado-desenvolvimento.md` e ao roadmap (§19). Não substitui um runbook de deploy da tua organização; define opções e passos típicos.

---

## 1. Estado de desenvolvimento atual (resumo)

| Área | Situação |
|------|----------|
| Monorepo | pnpm + Turbo; `pnpm build` por pacote. |
| API | Nest + Fastify; Prisma; Swagger em `/docs` (desligar em prod com `SWAGGER=0`). |
| CMS | Next.js 15; `NEXT_PUBLIC_API_URL` para o browser. |
| Player | Web (Vite); Electron esqueleto. |
| Infra no repo | **Sem** `Dockerfile` / `docker-compose` oficiais na raiz (roadmap: Docker opcional para deploy). |
| CI/CD | Scripts `lint`/`test`/`build` por turbo; pipeline de release a fechar por equipa. |

**Conclusão:** o código **compila** e corre em dev; **empacotamento de produção** (imagens, compose, Helm) é **trabalho a acrescentar**, não algo já fechado no repositório.

---

## 2. Continuidade recomendada (produto + plataforma)

Ordem sugerida, cruzada com o roadmap §19.0.1:

1. **Produto (Fase 2–3):** multipart/cache de média, manifest com hash, ack no player, agendamento mínimo.  
2. **Plataforma:** testes e2e smoke, CI em PR, endurecer env de produção (`JWT_SECRET`, `SWAGGER=0`, limites de body).  
3. **Empacotamento:** imagens Docker (API, CMS, opcional web-player estático) + `docker compose` para um host único; depois opcional K8s.  
4. **Observabilidade (Fase 5):** logs estruturados, healthchecks já existentes na API (`/api/v1/health`).

---

## 3. Preparar a aplicação para “rodar em produção empacotada”

### 3.1 Componentes a publicar

| Componente | Artefacto típico | Notas |
|------------|------------------|--------|
| **API** | Imagem Node ou `node dist/main.js` | `pnpm --filter @easysignage/api build`; `prisma migrate deploy` no arranque ou job separado. |
| **CMS** | `next build` + `next start` **ou** export estático se no futuro for possível (hoje usa rotas dinâmicas/API). | Variáveis `NEXT_PUBLIC_*` no **build** se mudarem por ambiente. |
| **Web player** | Ficheiros estáticos (`vite build`) servidos por Nginx/CDN. | `VITE_API_URL` / API pública para pareamento. |
| **PostgreSQL** | Serviço gerido ou contentor dedicado | Backup e versão suportada pelo Prisma. |
| **Objeto (S3)** | MinIO, AWS S3, etc. | Já previsto no `.env` da API (`S3_*`). |

### 3.2 Variáveis e segurança (checklist)

- `DATABASE_URL`, `JWT_SECRET` fortes, `SWAGGER=0` em produção.  
- `CORS_ORIGINS` e `CMS_ORIGIN` com os **domínios reais** HTTPS do CMS e do player.  
- TLS terminado no reverse proxy (Nginx, Caddy, Traefik) ou no load balancer.  
- Ficheiros de upload: path persistente no contentor ou **sempre** S3/compatível em produção.  
- Revisar `BODY_LIMIT_BYTES` / limites de upload face ao tráfego esperado.

### 3.3 Empacotamento concreto (o que falta no repo)

- **Dockerfile** multi-stage por app (`api`, `cms`) com `pnpm install --frozen-lockfile` e `NODE_ENV=production`.  
- **docker-compose.yml** (opcional) com: `postgres`, `api`, `cms`, `minio` opcional, redes e volumes.  
- **Entrypoint** da API: `prisma migrate deploy && node dist/main.js`.  
- Documentar **portas** expostas (ex.: API 3001 só interna; proxy público em 443).

---

## 4. Opções de auto-hospedagem

Todas assumem que **tu** operas a infra (vs. SaaS gerido). Combinações comuns:

### 4.1 Uma máquina virtual (VPS) — mais simples

- **Exemplos:** Hetzner, OVH, DigitalOcean, Linode, VPS local.  
- **Stack:** Ubuntu LTS + Docker Compose **ou** systemd + Node + Nginx.  
- **Prós:** baixo custo, previsível. **Contras:** ponto único de falha sem réplicas.

### 4.2 Docker Compose num único host (recomendado para começar produção pequena)

- Postgres + API + CMS + (opcional) MinIO + reverse proxy num servidor.  
- **Prós:** reprodutível, próximo do dev. **Contras:** escalabilidade horizontal manual.

### 4.3 Kubernetes leve (k3s, k0s, MicroK8s)

- Para várias instâncias ou evolução futura.  
- **Prós:** rollouts, secrets, ingress. **Contras:** curva de aprendizagem e manutenção.

### 4.4 Bare metal / VM sem Docker

- Instalar Node LTS, PostgreSQL nativos, Nginx, buildar artefactos (`pnpm build`, copiar `dist`, `next start`).  
- **Prós:** sem camada de contentores. **Contras:** mais passos manuais e drift entre servidores.

### 4.5 NAS / homelab

- Muitos NAS suportam Docker; útil para **piloto** ou demo interna, não para SLA alto sem backup e monitorização.

### 4.6 “Quase auto-hospedado”

- **PaaS com VM dedicada** (Fly.io machines, Railway, Render com instância fixa): menos ops, ainda com controlo da app; custo e modelo de rede variam.

---

## 5. Docker no repositório (implementado)

| Ficheiro | Função |
|----------|--------|
| `docker-compose.yml` | Postgres 16 + API (porta 3001) + CMS (3000). |
| `docker/api.Dockerfile` | Build com `pnpm`, `pnpm deploy` da API, `prisma migrate deploy` no entrypoint. |
| `docker/cms.Dockerfile` | Build Next com `DOCKER_BUILD=1` (standalone). |
| `docker/entrypoint-api.sh` | Migrações + `node dist/main.js`. |
| `.dockerignore` | Reduz contexto de build. |
| `docker/README.md` | Comandos rápidos. |

**Comando:** na raiz, `docker compose up --build` ou `pnpm docker:compose`.

Produção real: colocar um **reverse proxy** (TLS) à frente, segredos fortes, backups do volume `easysignage_pg`, e ajustar `NEXT_PUBLIC_API_URL` ao domínio público da API.

---

*Última atualização: abril de 2026.*
