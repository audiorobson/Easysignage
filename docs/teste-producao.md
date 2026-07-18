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

*Ver também `docs/manual-instalacao-mini-pc.md` e `deploy/keys/README.md`.*
