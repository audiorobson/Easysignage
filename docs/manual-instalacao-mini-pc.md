# Manual de instalação — EasySignage no mini PC

Guia para instalar o **EasySignage Server Box** num mini PC (Windows ou Linux) na rede local.

---

## 1. Requisitos

| Item | Mínimo |
|------|--------|
| CPU | x64, 4 núcleos |
| RAM | 4 GB (8 GB recomendado) |
| Disco | SSD 64 GB |
| Rede | Ethernet fixa na LAN |
| SO | Windows 10/11 ou Ubuntu 22.04+ |
| Software | Docker Desktop (Win) ou Docker Engine + Compose (Linux) |

Portas no mini PC: **3000** (CMS), **3001** (API), **3020** (sync video wall / WebSocket).

---

## 2. Windows — Docker Desktop

1. Instale [Docker Desktop](https://www.docker.com/products/docker-desktop/).
2. Active WSL2 se o instalador pedir.
3. Descompacte o pacote `easysignage-server-*.zip` em `C:\EasySignage` (ou outra pasta).
4. Abra PowerShell na pasta `deploy\server-box`.
5. Execute:

```powershell
.\install.ps1
```

6. Edite `.env`: `JWT_SECRET`, `POSTGRES_PASSWORD`, `NEXT_PUBLIC_API_URL` com o **IP do mini PC** (ex. `http://192.168.1.100:3001/api/v1`).

Se estiver no monorepo (com código-fonte):

```powershell
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

Se instalou só o ZIP (sem código-fonte), configure imagens GHCR no `.env` e:

```powershell
docker compose up -d
```

7. Abra no browser: `http://localhost:3000` ou `http://IP-DO-MINI-PC:3000`.

---

## 3. Linux

```bash
cd deploy/server-box
chmod +x install.sh
./install.sh
nano .env   # JWT_SECRET, passwords, NEXT_PUBLIC_API_URL
# Monorepo:
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
# Só ZIP (GHCR):
# docker compose up -d
```

Opcional — arranque automático: `restart: unless-stopped` já está no compose.

---

## 4. Primeira configuração e licença

1. Inicie sessão no CMS com as credenciais iniciais do seed:

| Campo | Valor |
|-------|--------|
| Email | `admin@demo.local` |
| Password | `admin123` |

*(Criadas automaticamente no primeiro arranque da API.)*

2. Vá a **Definições → Licença**.
3. Copie o **Hardware ID** (`ES-…`).
4. Envie ao fornecedor EasySignage.
5. Receba o **serial** e cole em Definições ou grave em `config/license.key`:

```
ESGN1.<payload>.<assinatura>
```

6. Reinicie a API se usou ficheiro:

```bash
docker compose restart api
```

### Planos

| Plano | Players |
|-------|---------|
| Lite | 2 |
| Standard | 20 |
| Elite | Ilimitado |

Sem licença válida: modo **trial** (1 player).

---

## 5. Parear players

1. No CMS: **Dispositivos** → criar device → obter código de pareamento.
2. No player (browser `http://IP:3010` ou app Electron): introduzir código.
3. O player liga-se à API na LAN — o streaming RTSP vai **directo** à câmara, não pelo servidor.

---

## 6. Backup

Copie regularmente:

- `deploy/server-box/data/postgres/`
- `deploy/server-box/data/uploads/`
- `deploy/server-box/config/` (hardware.id + license.key)

---

## 7. Resolução de problemas

| Problema | Acção |
|----------|--------|
| CMS não abre | `docker compose ps` — verificar contentor `cms` |
| «Limite de players» | Ver Definições → Licença; upgrade de plano |
| Licença rejeitada | HWID deve coincidir com o mini PC onde foi gerada |
| API não lê licença | Verificar montagem `./config:/config:ro` e ficheiro `license.key` |

Logs: `docker compose logs -f api`

---

*Ver também `docs/planejamento-distribuicao-licenciamento.md`.*
