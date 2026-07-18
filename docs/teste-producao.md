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

## Teste manual — RTSP nativo no Electron player (Fase 5.C, PR 5.10)

O bridge RTSP (`apps/electron-player/src/main/rtsp-bridge.ts` + `ffmpeg-rtsp.ts`) tem
cobertura unitária (`pnpm --filter @easysignage/electron-player test`, com `ffmpeg`
mockado), mas o remux real com um stream RTSP verdadeiro só pode ser validado
manualmente — este é o "teste manual documentado" previsto no plano.

### Pré-requisitos

- `ffmpeg` no `PATH` (ou definir `FFMPEG_PATH=/caminho/para/ffmpeg`).
- API + CMS + web-player em execução (`pnpm dev` na raiz, ou os três serviços
  individualmente: `pnpm --filter @easysignage/api dev`,
  `pnpm --filter @easysignage/cms dev`, `pnpm --filter @easysignage/web-player dev`).
- Um stream RTSP acessível — uma câmara IP na rede local, ou um stream público de
  teste (ex.: gerar um em https://rtsp.stream/, gratuito, para testes pontuais).

### Passos

1. **Criar a fonte RTSP no CMS.** Biblioteca → filtro "Streams RTSP" → "Nova fonte
   RTSP". Preencha `rtsp://…` (ex.: o stream de teste do rtsp.stream) e grave.
   Requer plano com a feature `rtsp` ativa (Standard/Elite; ver `LicenseFeatureBanner`
   na própria página se estiver bloqueado).
2. **Publicar no device de teste.** Dispositivos → escolha (ou crie) um device →
   atribua o asset RTSP como conteúdo de teste (`PATCH /devices/:id/test-content`,
   já exposto na tela do device) ou adicione-o a uma playlist publicada.
3. **Compilar e correr o Electron player.**

   ```bash
   pnpm --filter @easysignage/electron-player build
   WEB_PLAYER_URL=http://localhost:3010 pnpm --filter @easysignage/electron-player exec electron .
   ```

   (Ajuste a porta se o `web-player` estiver a correr noutra — o script `dev` do
   `web-player` usa `3010` por padrão.)
4. **Parear o device** no ecrã que abrir (ou usar um device já pareado, reutilizando
   o token gravado). O player deve carregar o `web-player` dentro da janela Electron.
5. Quando o item RTSP entrar em exibição, o `RtspStreamView` chama
   `window.easysignage.rtsp.play(url, videoElement)` → o preload pede ao processo
   main (`ipcRenderer.invoke('rtsp:start', url)`) para abrir um stream → o main
   regista o URL e devolve `http://127.0.0.1:<porta>/rtsp/<id>` → o `<video>` aponta
   para esse URL local.
6. **Verificar:**
   - O vídeo deve começar a tocar em poucos segundos (tempo de arranque do ffmpeg
     + primeiro keyframe). Sem áudio (o remux descarta a faixa de áudio — `-an`).
   - Na consola onde o Electron foi lançado, **não deve haver** stack traces do
     `ffmpeg` (erros são filtrados com `-loglevel error`; se o stream falhar, o
     `<video>` fica em estado `unsupported`/`error`, visível no overlay do
     `RtspStreamView`).
   - Trocar de item na playlist (ou remover o conteúdo) deve terminar o processo
     `ffmpeg` — confirmar com `ps aux | grep ffmpeg` (Linux/macOS) ou o Gestor de
     Tarefas (Windows) que não sobra processo órfão.
   - Fechar a janela Electron (`window-all-closed` → `before-quit`) deve encerrar
     todos os processos `ffmpeg` e o servidor HTTP local.

### Limitações conhecidas

- `-c:v copy` não re-encoda vídeo: se a câmara enviar um codec que o Chromium não
  suporta nativamente (ex.: MJPEG bruto, H.265 em builds sem suporte), o `<video>`
  fica em `error`. Nesse caso, um encode explícito (`-c:v libx264`) seria o próximo
  passo — fora do escopo deste PR, ficou registado como possível iteração futura.
- Streams RTSP sobre UDP instáveis podem cortar a ligação; o wrapper usa
  `-rtsp_transport tcp` para reduzir esse risco.

---

## Teste manual — comandos remotos no Electron player (Fase 5.C, PR 5.11)

Os handlers (`apps/electron-player/src/main/remote-commands.ts`) têm cobertura
unitária com duplos de `child_process`/`electron`
(`pnpm --filter @easysignage/electron-player test`), mas o efeito real em SO/janela
só é visível manualmente.

### Passos

1. Compile e execute o Electron player (ver secção anterior) com um device já
   pareado.
2. Peça ao backend para enfileirar um comando para esse device
   (`POST /monitoring/devices/:deviceId/commands`, permissão `monitoring:write`;
   pode usar o `token` de um utilizador com sessão no CMS):

   ```bash
   curl -X POST "$API_URL/monitoring/devices/$DEVICE_ID/commands" \
     -H "Authorization: Bearer $USER_JWT" \
     -H "Content-Type: application/json" \
     -d '{"channel":"take_screenshot","payload":{}}'
   ```

   Canais suportados pelo player: `restart_player`, `clear_cache`, `open_url`
   (`payload.url`, precisa de `http(s)://`), `reboot_os`, `take_screenshot`.
3. O web-player faz polling de `GET /device/commands/pending` a cada 5 segundos
   (`startRemoteCommandsLoop` em `apps/web-player/src/remoteCommands.ts`) e delega
   a execução a `window.easysignage.commands.*` (exposto pelo `preload.ts`).
4. **Verificar por canal:**
   - `restart_player` — a janela Electron relança o processo (`app.relaunch()` +
     `app.exit()`); o player deve reaparecer em poucos segundos.
   - `clear_cache` — `session.defaultSession.clearCache()/clearStorageData()` e a
     janela recarrega; útil para forçar reload de conteúdo após uma publicação
     problemática.
   - `open_url` — a janela navega para a URL indicada (uso de diagnóstico; não há
     retorno automático ao conteúdo — recarregar manualmente ou usar
     `restart_player` para voltar).
   - `reboot_os` — **cuidado**: reinicia o SO onde o player está a correr
     (`shutdown /r /t 0` no Windows, `reboot` no Linux, `shutdown -r now` no
     macOS). Só testar em hardware descartável/VM.
   - `take_screenshot` — captura a janela inteira via `webContents.capturePage`
     e envia como JPEG para `POST /device/preview` (mesmo endpoint da
     pré-visualização periódica); confirmar em `GET /monitoring/devices/:id/preview`
     ou na tela de monitorização do CMS.
5. Em todos os casos, confirmar em
   `GET /monitoring/devices/:deviceId/commands` que o comando passou de
   `pending` para `acked` (ou `failed`, com `resultJson.error` a explicar o motivo
   — por exemplo `reboot_os` chamado a partir de um browser sem o bridge nativo).

### Limitações conhecidas

- `open_url` e `reboot_os` não têm um caminho de "undo" automático — são comandos
  de diagnóstico/operação avançada, a usar com o operador consciente do impacto.
- Sem o bridge nativo (ex.: a correr o `web-player` isolado no browser, sem
  Electron), `reboot_os` falha sempre (não há privilégio de SO no browser) e
  `restart_player`/`clear_cache` caem para um fallback best-effort
  (`window.location.reload()` / limpeza de `Cache Storage`).

---

*Ver também `docs/manual-instalacao-mini-pc.md` e `deploy/keys/README.md`.*
