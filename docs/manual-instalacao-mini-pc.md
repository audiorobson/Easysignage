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

## 8. Player Electron em modo kiosk (mini PC dedicado à tela)

Aplica-se ao mini PC que fica **ligado à TV/monitor** a correr o `apps/electron-player`
(distinto do mini PC "servidor" das secções 2–3, embora possam ser a mesma máquina
numa instalação pequena).

### 8.1 Modo kiosk

Por padrão o player arranca em **kiosk fullscreen** (sem barra de menu, sem chrome de
janela) — ver `apps/electron-player/src/main/main.ts`. Para desativar durante
desenvolvimento (útil para abrir o DevTools, redimensionar, etc.):

```bash
# Windows (PowerShell)
$env:EASYSIGNAGE_KIOSK = "0"; pnpm --filter @easysignage/electron-player exec electron .

# Linux/macOS
EASYSIGNAGE_KIOSK=0 pnpm --filter @easysignage/electron-player exec electron .
```

### 8.2 Watchdog (recuperação automática)

O processo principal (`watchdog.ts`) fica atento ao renderer:

| Evento | Ação automática |
|--------|------------------|
| `render-process-gone` (crash/OOM/kill) | Destrói a janela e recria do zero |
| `unresponsive` (loop bloqueante) | Recarrega a página na mesma janela |
| `did-fail-load` (ex.: API/web-player ainda não arrancaram) | Nova tentativa de `loadURL` após 3s |

Se ocorrerem 5+ crashes em 60s, é registado um aviso de "possível crash loop" nos
logs (`stderr` do processo Electron) — útil para diagnosticar hardware com problema
recorrente (ex.: driver de GPU instável) sem deixar o player preso.

### 8.3 Arranque automático (autostart)

**Windows** — atalho na pasta de arranque do utilizador:

1. Crie um atalho para o executável empacotado (ou para
   `pnpm --filter @easysignage/electron-player exec electron .` dentro de um `.bat`,
   em builds a partir do código-fonte).
2. Pressione `Win+R`, digite `shell:startup` e Enter.
3. Cole o atalho nessa pasta — vai arrancar automaticamente no login do Windows.
4. Configure o Windows para **login automático** (`netplwiz` → desmarcar "Os
   utilizadores devem digitar um nome de utilizador e senha") para não depender de
   interação humana após um reboot (ex.: após o comando remoto `reboot_os`).

**Linux** — serviço `systemd --user` (recomendado, reinicia se o processo morrer,
complementando o watchdog interno):

```ini
# ~/.config/systemd/user/easysignage-player.service
[Unit]
Description=EasySignage Player (kiosk)
After=graphical-session.target

[Service]
ExecStart=/usr/bin/easysignage-player   # ou o caminho do binário empacotado
Restart=always
RestartSec=3
Environment=WEB_PLAYER_URL=http://localhost:3010

[Install]
WantedBy=graphical-session.target
```

```bash
systemctl --user enable --now easysignage-player.service
loginctl enable-linger "$USER"   # mantém o serviço --user ativo mesmo sem login gráfico completo
```

Configure também **autologin** no gestor de display (LightDM/GDM) para o mini PC
entrar direto na sessão gráfica após reboot.

### 8.4 Teste manual de crash simulado

1. Arranque o player normalmente (kiosk ou não).
2. Force o crash do renderer a partir do DevTools (`Ctrl+Shift+I` com kiosk
   desativado) executando `process.crash()` na consola, **ou** termine o processo
   filho do renderer no Gestor de Tarefas/`kill` (procure por um processo
   `electron` adicional — o renderer corre em processo separado do main).
3. **Esperado:** a janela deve reaparecer automaticamente em 1–2s (recriada pelo
   watchdog), sem precisar reiniciar a aplicação inteira.
4. Confirme no terminal onde o Electron foi lançado a mensagem
   `[watchdog] renderer terminou (...) — a recriar janela`.
5. Repita 5+ vezes rapidamente para validar o aviso de "possível crash loop" no
   log — não deve travar nem parar de tentar recuperar.

### Checklist de validação (kiosk + autostart)

- [ ] Player arranca em fullscreen sem chrome de janela (kiosk).
- [ ] `EASYSIGNAGE_KIOSK=0` desativa o kiosk (útil em DEV).
- [ ] Crash simulado do renderer é recuperado automaticamente (sem tela preta
      permanente).
- [ ] Reboot completo do mini PC (autologin + autostart) resulta no player a
      exibir conteúdo sem qualquer interação humana.
- [ ] Comando remoto `restart_player` (PR 5.11) funciona mesmo com autostart
      configurado (o processo relançado é redetetado pelo `systemd`/pasta de
      arranque, não gera duplicação de janelas).

---

*Ver também `docs/planejamento-distribuicao-licenciamento.md` e
`docs/teste-producao.md` (testes manuais de RTSP e comandos remotos).*
