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

## Teste manual — auto-update do Electron player (Fase 5.C, PR 5.13)

A comparação de versão/canal tem cobertura unitária completa
(`packages/shared-types/src/software-release.test.ts`,
`apps/web-player/src/updateChecker.test.ts`,
`apps/electron-player/src/main/auto-updater.test.ts`), mas o fluxo real de
download/instalação do `electron-updater` só é validável manualmente — requer
uma build empacotada e um artefacto publicado, que ainda não fazem parte deste
ambiente de testes (ver Fase 10, PR 10.4).

### Passos (verificar só a deteção de update, sem instalar nada)

1. Publique uma release "mais nova" no catálogo (utilizador com `settings.write`):

   ```bash
   curl -X POST "$API_URL/releases" \
     -H "Authorization: Bearer $USER_JWT" \
     -H "Content-Type: application/json" \
     -d '{"version":"9.9.9","channel":"stable","downloadUrl":"https://example.com/fake.zip"}'
   ```

2. Com o web-player/Electron a correr (device pareado), o
   `startUpdateCheckLoop` (`apps/web-player/src/updateChecker.ts`) consulta
   `GET /device/releases/latest` a cada 6h (chamada imediata no arranque) e
   compara com `APP_VERSION` (`0.0.1` no código atual — qualquer release
   publicada será "mais nova").
3. **Verificar:** no terminal do Electron deve aparecer
   `[auto-updater] update disponível: v9.9.9 (canal stable)` — vindo de
   `handleUpdateAvailable` via IPC `updater:notifyAvailable`. Fora de uma build
   empacotada (`app.isPackaged === false`, o caso normal em DEV), a mensagem
   seguinte é `a correr fora de build empacotada — a ignorar` — é o
   comportamento esperado, não é uma falha.
4. Para simular canal beta: `PATCH` o device (via SQL direto,
   `UPDATE devices SET update_channel = 'beta' WHERE id = '...'`, não há UI no
   CMS ainda) e publique uma release `channel: "beta"` — deve continuar a
   detetar.

### Limitações conhecidas

- Não existe ainda pipeline real de publicação de instaladores assinados (GHCR/S3)
  — o `downloadUrl` de teste acima não resulta numa instalação real, só valida a
  deteção/decisão de update.
- Sem UI no CMS para gerir `update_channel` por device nem para publicar releases
  — por agora é só API (`POST /releases`, `GET /releases`).

## Teste manual — normalização de vídeo no media-worker (Fase 5.D, PR 5.16)

O detetor de formato (`needsNormalization`) e o comando `ffmpeg` de
recodificação têm cobertura unitária completa
(`apps/media-worker/src/normalization.test.ts`); a miniatura real exibida em
`/assets` (em vez do ícone de placeholder) tem cobertura Playwright
(`apps/e2e/tests/assets-smoke.spec.ts`). Falta apenas validar manualmente a
recodificação em si com um `ffmpeg` real instalado.

### Passos

1. Suba `postgres` + `redis` (`pnpm docker:compose` ou equivalente) e o
   `apps/media-worker` com `ffmpeg` instalado no `PATH` (`ffmpeg -version`).
2. Faça upload de um vídeo fora do formato recomendado — ex. um `.webm`
   (VP9/Opus) ou um `.mov` com HEVC — pela biblioteca de assets no CMS.
3. **Verificar no log do `media-worker`:** o job `asset.uploaded` é
   consumido, o detetor identifica o formato como fora do padrão e o
   `ffmpeg` é invocado com `-c:v libx264 -c:a aac -movflags +faststart`.
4. **Verificar no banco:** `SELECT storage_key, mime_type, video_codec,
   audio_codec, processed_at FROM assets WHERE id = '...'` deve mostrar
   `mime_type = 'video/mp4'`, `video_codec = 'h264'`, `audio_codec = 'aac'`
   (ou `NULL` se o vídeo original não tinha áudio) e `processed_at`
   preenchido. O ficheiro original é removido do storage após a
   recodificação bem-sucedida.
5. **Verificar na UI:** em `/assets`, o badge "A processar…" (visível
   enquanto `processed_at` é `NULL`) desaparece depois do worker concluir, e
   a pré-visualização mostra a miniatura extraída do vídeo já normalizado.
6. Repita o upload com um `.mp4` já em H.264/AAC — o log deve indicar que a
   normalização foi ignorada (formato já recomendado) e apenas a miniatura é
   (re)gerada.

### Limitações conhecidas

- Sem `ffmpeg` no `PATH` do `media-worker`, a normalização falha
  silenciosamente e o asset mantém o ficheiro original — o pipeline síncrono
  da API (upload) já cobre a miniatura na maioria dos casos, mas o vídeo
  fica sem ser recodificado até haver `ffmpeg` disponível num reprocessamento
  futuro.
- Vídeos muito longos/grandes podem exceder o timeout de recodificação
  configurado (5 min) — o worker regista a falha e preserva o ficheiro
  original em vez de travar a fila.

---

## Teste manual — notificações de alerta por webhook/e-mail (Fase 5.E, PR 5.18)

O disparo (webhook assinado + e-mail via Resend) e a normalização de dados
(`parseEmailList`, `signWebhookBody`) têm cobertura unitária completa
(`apps/api/src/notifications/alert-notifications.service.spec.ts`,
`apps/api/src/settings/settings.service.spec.ts`,
`apps/api/src/alerts/alerts.service.spec.ts`) e a UI de configuração tem
cobertura Playwright (`apps/e2e/tests/settings-notifications-smoke.spec.ts`).
Falta apenas validar manualmente a entrega real a um endpoint HTTP/e-mail
externo.

### Passos

1. Em `/settings` no CMS, na secção "Notificações de alerta", configure:
   - **URL do webhook**: um endpoint que aceite `POST` (ex. um bin de teste
     como `https://webhook.site/<id>` ou um servidor local).
   - **Segredo do webhook** (opcional): qualquer string; será usado para
     assinar o corpo em HMAC-SHA256 no header `X-EasySignage-Signature`.
   - **E-mails**: um ou mais endereços válidos, separados por vírgula.
   - Defina `RESEND_API_KEY` no `.env` da API para o envio de e-mail ser
     real (sem a chave, o `NullEmailSender` apenas regista um aviso no log).
2. Provoque a abertura de um alerta — ex. desligue um dispositivo pareado e
   aguarde o `AlertsService` marcar `heartbeat_missing` como aberto (ver
   `docs/manual-instalacao-mini-pc.md` para o intervalo de heartbeat).
3. **Verificar o webhook:** o endpoint configurado deve receber um `POST`
   JSON com `{ tenantId, alertId, alertType, deviceId, severity, message,
   status: "open", occurredAt }` e, se um segredo foi definido, o header
   `X-EasySignage-Signature` com a assinatura HMAC-SHA256 do corpo bruto.
4. **Verificar o e-mail:** cada endereço configurado deve receber um e-mail
   com assunto `[EasySignage] Alerta aberto — <tipo>` e corpo com os
   detalhes do dispositivo/alerta.
5. Resolva o alerta (reconecte o dispositivo) e confirme que chega um novo
   disparo com `status: "resolved"` (webhook) e assunto `[EasySignage]
   Alerta resolvido — <tipo>` (e-mail).
6. Repita sem `RESEND_API_KEY`/URL de webhook configurados — o alerta deve
   continuar a abrir/resolver normalmente na API (o disparo é *best-effort*:
   falhas são registadas em log e nunca bloqueiam a operação principal).

### Limitações conhecidas

- O disparo é *fire-and-forget*: não há fila de retry — se o webhook
  estiver indisponível no momento exato da abertura/resolução, a
  notificação é perdida (fica só o registo do alerta em si, consultável na
  tela de alertas do CMS).
- O segredo do webhook é armazenado em texto simples na base de dados
  (mascarado apenas na UI); tratar o acesso à base de dados como sensível.

## Teste manual — 2FA/TOTP no login do CMS (Fase 6, PR 6.3)

O fluxo completo (setup → confirmação → login com desafio → desativação) tem
cobertura unitária completa (`apps/api/src/auth/totp.spec.ts`,
`apps/api/src/auth/auth.service.spec.ts`, `apps/api/src/auth/jwt.strategy.spec.ts`).
Falta apenas validar manualmente a experiência ponta-a-ponta com uma app de
autenticação real (Google Authenticator, Authy, 1Password…), por isso não
há E2E Playwright automatizado para esta PR — evita também ativar 2FA na
conta `admin@demo.local` partilhada por todas as outras specs de E2E.

### Passos

1. Faça login normalmente no CMS e abra `/settings/security`.
2. Clique em "Ativar 2FA" — a tela mostra um QR code e a chave manual
   (`otpauth://totp/EasySignage:<email>?secret=...`).
3. Digitalize o QR code com a app de autenticação (ou introduza a chave
   manualmente) e introduza o código de 6 dígitos gerado para confirmar.
4. A tela deve passar a mostrar "2FA ativado". Faça logout.
5. Faça login novamente com o mesmo tenant/e-mail/palavra-passe — em vez de
   entrar directamente, o CMS deve pedir o código de verificação (ecrã
   "Verificação em duas etapas").
6. Introduza o código atual da app de autenticação — deve entrar
   normalmente no dashboard.
7. Volte a `/settings/security` e desative o 2FA introduzindo um código
   válido — confirme que o próximo login já não pede o código.

### Limitações conhecidas

- Não há códigos de recuperação (*backup codes*): se o utilizador perder o
  dispositivo com a app de autenticação, só um administrador com acesso
  direto à base de dados pode repor `totp_enabled = false` manualmente.
- Não há SSO/2FA obrigatório por política de tenant nesta PR — a ativação é
  por utilizador, de forma voluntária.

## Teste manual — SSO OpenID Connect por tenant (Fase 6, PR 6.4)

O fluxo OIDC completo (discovery → authorization URL → troca do código →
validação do id_token → emissão de sessão) tem um teste de integração real
contra um IdP OIDC mínimo em memória (`apps/api/src/sso/testing/fake-oidc-provider.ts`,
usado em `apps/api/src/sso/sso.service.spec.ts`) — não um mock da biblioteca,
mas um servidor HTTP real com JWKS e endpoint de token que assina
`id_token`s reais em RS256. Falta apenas validar manualmente com um provedor
comercial real (Azure AD, Okta, Google Workspace…), por isso não há E2E
Playwright para esta PR (o fluxo passa por um redirecionamento para um
domínio externo, fora do controlo do CMS/API em CI).

### Passos

1. Registe uma aplicação OIDC no provedor de identidade (ex. Azure AD →
   "App registrations"). Tipo: "Web", *redirect URI*: copie o valor exibido
   em `/settings/sso` no CMS (ex. `http://localhost:3001/api/v1/auth/sso/callback`).
2. Anote o **Issuer URL** (ex. `https://login.microsoftonline.com/<tenant-id>/v2.0`),
   o **Client ID** e gere um **Client secret**.
3. Garanta que já existe, no EasySignage, um `User` com o mesmo e-mail da
   conta que vai usar para testar o SSO (o login único não cria utilizadores
   automaticamente — ver "Limitações conhecidas").
4. Em `/settings/sso` no CMS, ative o SSO e preencha Issuer URL/Client
   ID/Client secret. Guarde.
5. Faça logout e, na tela de login, introduza o slug do tenant e clique em
   "Entrar com SSO (OIDC)" — deve ser redirecionado para o provedor.
6. Após autenticar no provedor, deve voltar para
   `/login/sso-callback` no CMS e, em seguida, para o `/dashboard` já
   autenticado.
7. Teste o caso de erro: tente o SSO com uma conta cujo e-mail não existe no
   EasySignage — deve voltar para `/login/sso-callback` com uma mensagem de
   erro clara, sem sessão.

### Limitações conhecidas

- **Sem SAML** — apenas OpenID Connect está implementado (`openid-client`);
  organizações que só suportam SAML 2.0 ficam de fora nesta versão.
- **Sem provisionamento automático (JIT)** — o SSO só autentica utilizadores
  que já existem no tenant (por e-mail); não há hoje nenhum módulo de
  gestão de utilizadores na aplicação (utilizadores são criados via seed),
  por isso criar contas automaticamente a partir do IdP fica para quando
  esse módulo existir.
- **Estado do fluxo em memória** — o `state`/`nonce` pendentes de cada
  tentativa de login SSO ficam num `Map` em memória do processo Node (TTL de
  10 minutos); numa implantação horizontalmente escalada (múltiplas
  instâncias da API), o pedido de callback deve cair na mesma instância que
  gerou o `state`, ou terá de migrar para um armazenamento partilhado
  (Redis) — aceitável para o modelo de implantação atual (single-instance
  self-hosted ou SaaS de instância única).
- **Cache de discovery de 10 minutos** — alterar a configuração de SSO de um
  tenant pode demorar até 10 minutos para ter efeito, devido ao cache do
  documento de *discovery* do provedor.
