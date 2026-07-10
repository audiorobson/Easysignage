# Teste de produção — EasySignage Server Box

Guia rápido para validar uma instalação **real** (Docker, licenciamento, CMS, players) antes do go-live comercial.

---

## Opção A — A partir do monorepo (recomendado para DEV)

Requisitos: Docker Desktop, Node 22, pnpm 9.

### Windows (um comando)

```powershell
pnpm prod:test
```

### Linux

```bash
chmod +x deploy/release/prod-test.sh
./deploy/release/prod-test.sh
```

O script:
1. Gera chaves **staging** (`deploy/keys/staging-public.pem` + privada local)
2. Compila `license-core` e constrói as 3 imagens Docker
3. Executa `install.ps1` / `install.sh` (HWID, `.env`, chave pública)
4. Sobe `postgres`, `api`, `cms`, `realtime-gateway`

### Acesso inicial

| Item | Valor |
|------|--------|
| CMS | http://localhost:3000 |
| API | http://localhost:3001/api/v1 |
| Utilizador | `admin@demo.local` |
| Password | `admin123` |

O seed corre automaticamente no primeiro arranque da API (`prisma migrate deploy` + `seed`).

---

## Activar licença (teste)

1. CMS → **Definições → Licença** → copie o **Hardware ID** (`ES-…`).
2. No posto de desenvolvimento, gere um serial Standard:

```bash
pnpm license:gen-staging-keys    # só na primeira vez
pnpm license:test-serial -- --hwid ES-XXXXXXXX --tier STD
```

3. Cole o serial no CMS ou grave em `deploy/server-box/config/license.key`.
4. Se usou ficheiro: `docker compose -f docker-compose.yml -f docker-compose.build.yml restart api` (na pasta `deploy/server-box`).

### Planos disponíveis no teste

| Tier | Players | Features extra |
|------|---------|----------------|
| LITE | 2 | — |
| STD | 20 | campanhas, video walls, RTSP, alertas |
| ELITE | 999 | igual STD (futuro: multi-site) |

---

## Opção B — Pacote ZIP (mini PC sem código-fonte)

```bash
pnpm release:zip
# dist/release/easysignage-server-box-dev.zip
```

1. Descompacte no mini PC.
2. Execute `install.ps1` ou `install.sh` na pasta extraída.
3. Edite `.env` com o **IP LAN** do mini PC.
4. Configure imagens GHCR no `.env` (após tag `v*` no GitHub) **ou** importe imagens Docker pré-buildadas.

```env
EASYSIGNAGE_VERSION=1.0.0
EASYSIGNAGE_API_IMAGE=ghcr.io/audiorobson/easysignage-api:1.0.0
EASYSIGNAGE_CMS_IMAGE=ghcr.io/audiorobson/easysignage-cms:1.0.0
EASYSIGNAGE_RT_IMAGE=ghcr.io/audiorobson/easysignage-realtime-gateway:1.0.0
```

5. `docker compose up -d`

O ZIP **não inclui** código para build local — apenas compose + config + manual.

---

## Checklist de validação

- [ ] `docker compose ps` — 4 serviços `running` (postgres, api, cms, realtime-gateway)
- [ ] Login CMS com `admin@demo.local`
- [ ] HWID visível em Definições
- [ ] Serial staging aceite (plano Standard)
- [ ] Parear 1 player (trial ou licenciado)
- [ ] Upload de imagem em Biblioteca
- [ ] Com STD: criar campanha e video wall (banners não bloqueiam)
- [ ] Logs API sem erro de `license-public.pem`

```bash
docker compose -f deploy/server-box/docker-compose.yml logs -f api
```

---

## Gerador Electron (staging)

```bash
EASYSIGNAGE_LICENSE_ENV=staging pnpm --filter @easysignage/license-generator dev
```

Usa `deploy/keys/staging-private.pem` (não commitada).

---

## Passagem para produção comercial

1. Gerar par Ed25519 **comercial** (fora do repo).
2. Substituir `config/license-public.pem` no mini PC.
3. Publicar imagens com tag `v*` (workflow `release.yml` → GHCR).
4. Distribuir ZIP + manual; **nunca** incluir chave privada staging/comercial no pacote cliente.

---

*Ver também `docs/manual-instalacao-mini-pc.md` e `deploy/keys/README.md`.*
