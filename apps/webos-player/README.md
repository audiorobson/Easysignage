# `apps/webos-player`

Wrapper webOS TV (LG) para o `apps/web-player` — PR 7.2 do
[roadmap de nível de mercado](../../digital_signage_arquitetura_roadmap.md). Mesma
estratégia do `apps/androidtv-player`/Electron: uma app webOS mínima que abre o
web-player num `<iframe>` em kiosk fullscreen e expõe `window.easysignage` com o mesmo
contrato (`platform`, `rtsp`, `commands`, `updater`).

Este módulo **não faz parte do workspace pnpm** (ver `pnpm-workspace.yaml`) — usa `npm`
com sua própria toolchain (`@webosose/ares-cli`), consistente com o `androidtv-player`
(Gradle) e futuros `tizen-player`/`firetv-player`.

## Estrutura

- `appinfo.json` — manifesto da app webOS (id, ícones, resolução, permissões).
- `index.html` — kiosk shell; carrega `webOSTV.js` (se presente), `js/command-dispatcher.js`,
  `js/webos-bridge.js` e `js/webos-launch.js`, e injeta o `apps/web-player` real num
  `<iframe>`. Inclui um painel de debug on-screen (`#es-debug`) — ver secção abaixo.
- `js/command-dispatcher.js` — lógica pura de roteamento de comandos (UMD: funciona tanto
  com `require` no Node/testes quanto como `<script>` clássico no browser webOS).
- `js/webos-bridge.js` — implementação das ações (`restartPlayer`, `clearCache`, `openUrl`,
  `rebootOs`, `takeScreenshot`, `rtspPlay`/`rtspStop`) usando `webOS.service.request`
  (luna-service) quando disponível, com fallback gracioso caso contrário.
- `js/webos-launch.js` — resolução do `playerUrl` de lançamento (`webOSLaunch`/
  `webOSRelaunch`), reescrito a partir do padrão oficial validado da LG (ver secção
  abaixo). Inclui o painel de debug on-screen.
- `test/command-dispatcher.test.js` — testes com o runner nativo do Node
  (`node --test`), sem dependências extra.

## Comandos

```bash
npm install
npm test               # node --test test/*.test.js
npm run package         # ares-package . -o dist  →  dist/*.ipk
```

`npm run package` requer `@webosose/ares-cli` (instalado como devDependency). Validado
localmente gerando um `.ipk` com sucesso — isto valida a estrutura do manifesto, **não**
substitui teste em hardware real (TV LG ou LG webOS TV Simulator).

## `webOSTV.js`

O SDK oficial da LG distribui `webOSTV.js` fora do npm (licença própria). Para testar
funcionalidades de luna-service (ex.: `rebootOs`) num device/simulador real, copie o
ficheiro do SDK instalado (`.../lib/webostv/webOSTV.js`) para a raiz deste diretório antes
de empacotar. Sem o ficheiro, o bridge detecta a ausência e retorna erro graciosamente em
vez de lançar exceção — ver `js/webos-bridge.js`.

## Configuração do URL do web-player

`js/webos-launch.js` obtém a URL via parâmetro de launch **`playerUrl`**, entregue pelo
runtime webOS através do evento `webOSLaunch`/`webOSRelaunch` (`inData.detail`) — **não**
via `window.location.search`, apesar de ser o padrão comum noutras plataformas.

A implementação segue o padrão **oficial e validado** da LG (ver
[`webOS-TV-app-samples/AppLifecycle`](https://github.com/webOS-TV-app-samples/AppLifecycle)
e [`.../webOSTVJSLibrary/Launch_Parameters`](https://github.com/webOS-TV-app-samples/webOSTVJSLibrary)),
confirmado por dois ciclos de validação em hardware real (PR 7.2, jul/2026):

```js
window.addEventListener('load', function () {
  document.addEventListener('webOSLaunch', function (inData) { /* ... */ }, true);
  document.addEventListener('webOSRelaunch', function (inData) { /* ... */ }, true);
});
```

Dois pontos importantes descobertos durante a validação real:

1. **Não é preciso "correr" contra o evento.** A documentação da LG confirma que
   `webOSLaunch` só é disparado depois de `DOMContentLoaded` — registar o listener em
   `window.onload` (como nos exemplos oficiais) é seguro. Uma primeira tentativa que lia
   `PalmSystem.launchParams` sincronamente *antes* do evento (para "evitar uma corrida")
   revelou-se desnecessária e, na prática, menos fiável (`PalmSystem` é legado — ver aviso
   da LG: "future support is not guaranteed").
2. **Um app já em execução não recarrega a página.** `ares-launch`/reabrir o ícone com um
   app já em background dispara apenas `webOSRelaunch` (o mesmo processo é "reativado"),
   nunca um reload. A primeira versão deste ficheiro resolvia uma `Promise` apenas uma vez
   e ignorava relançamentos subsequentes com um `playerUrl` diferente — corrigido para
   atualizar o `<iframe>` diretamente em **cada** evento (`webOSLaunch` OU
   `webOSRelaunch`), não só no primeiro.

```bash
npx ares-launch com.easysignage.webosplayer -d MinhaTV -p "playerUrl=http://192.168.1.7:3010"
```

> Aponte `playerUrl` para o **`apps/web-player`** real (porta padrão `3010`, `vite --host`
> para expor na LAN), não para o CMS (`apps/cms`, porta `3000`) — ver aviso abaixo.

### Painel de debug on-screen

`index.html`/`js/webos-launch.js` incluem um painel de debug (`#es-debug`, texto verde no
topo da tela) que mostra em tempo real os eventos recebidos e o `playerUrl` resolvido.
Foi adicionado porque depurar via `ares-inspect`/Chrome DevTools através do túnel SSH do
device real mostrou-se lento (segundos de latência por chamada) e, em pelo menos um caso,
incapaz de capturar o estado exato no momento do lançamento a tempo. `DEBUG_ENABLED` está
`true` por defeito enquanto o player está em validação de campo — **defina como `false`
em `js/webos-launch.js` antes de qualquer piloto/produção real**, para não expor logs na
tela do cliente.

### ⚠️ Não aponte `playerUrl` para o CMS

O CMS (`apps/cms`) é uma ferramenta administrativa em Next.js 15 + React 19 — **não** foi
desenhado para rodar dentro do player. Numa TV LG real de geração mais antiga (validada em
jul/2026: motor `Chrome/53.0.2785.34`, ~2016), o bundle JS do CMS não conseguiu hidratar
(a página trava no HTML estático inicial, "Redirecionando…", sem erro capturável via
DevTools remoto) — a app fica com `document.readyState` permanentemente em `"interactive"`.
Isto **não é um bug do player**: é apenas evidência de que o motor Chromium embutido em TVs
mais antigas é muito mais antigo do que o alvo de build padrão do Next.js/React modernos.
O `apps/web-player` (Vite + React 19, sem SSR/hidratação) carregou corretamente na mesma TV
(`readyState: "complete"`, sem erros de console) — é o app correto para apontar `playerUrl`.
Se hardware muito antigo (motor pré-Chrome ~80) precisar ser suportado oficialmente no
futuro, `apps/web-player` provavelmente também vai precisar de um alvo de build mais
conservador (`vite build --target=es2015` + polyfills) — ainda não avaliado; ver
`docs/matriz-hardware-tv.md`.

## Pareamento com uma TV LG real (`ares-setup-device`)

O pacote `@webosose/ares-cli` publicado no npm (usado por este módulo) **não implementa**
o comando `ares-novacom --getkey`/fluxo automático de obtenção da chave SSH a partir do
Key Server da TV (`inDevice.type === 'webospro'` está marcado como `NOT_IMPLEMENTED` em
`lib/base/novacom.js`, e não há nenhum código que chame o endpoint HTTP do Key Server).
Isto é diferente do CLI completo distribuído pela LG via SDK Manager, que inclui esse
fluxo. Passos que funcionam com o pacote npm, validados numa TV real:

1. `npx ares-setup-device -a "MinhaTV" -i "host=<IP>" -i "port=9922" -i "username=prisoner" -i "passphrase=<PASSPHRASE_DO_KEY_SERVER>"`
   — use sempre `prisoner` (não `developer`, reservado ao emulador) para uma TV real.
2. Com o Key Server ligado no app Developer Mode da TV, obtenha a chave manualmente:
   `Invoke-WebRequest http://<IP_DA_TV>:9991/webos_rsa -OutFile $HOME/.ssh/MinhaTV_webos`
   (ou `curl` em Linux/macOS). Devolve uma chave RSA PEM cifrada com a passphrase.
3. Edite `%APPDATA%/.webos/ose/novacom-devices.json` (Windows) ou
   `~/.webos/ose/novacom-devices.json` (Linux/macOS) e adicione ao device:
   `"privateKey": { "openSsh": "MinhaTV_webos" }` — o nome do ficheiro em `~/.ssh`.
4. Teste com `npx ares-device -d MinhaTV --system` (pode falhar por permissão numa API
   específica, mas erro de auth SSH some).

**Bugs de compatibilidade encontrados e corrigidos localmente** (não fazem parte do
código deste módulo — são patches em `node_modules`, perdidos a cada reinstalação; ver
histórico do PR 7.2 para o diagnóstico completo):

- `ssh2-streams` (dependência do `ares-cli`) usa `util.isDate`, removido em versões
  recentes do Node.js → `TypeError: isDate is not a function` ao instalar (`ares-install`).
  Corrigido substituindo por um fallback (`Object.prototype.toString.call(d) === '[object Date]'`)
  diretamente em `ssh2-streams/lib/sftp.js`.
- `ares-install` sempre tenta `rm -rf /media/developer/temp && mkdir -p ...` antes de
  enviar o `.ipk`. Em TVs de retalho (usuário `prisoner` sandboxed/"jail"), o diretório
  pai `/media/developer` não é gravável pelo `prisoner` (só `temp/` já existe e é 777) —
  o `rm -rf` falha com `Permission denied`. Corrigido removendo o `rm -rf` de
  `ares-cli/lib/install.js` (mantendo apenas o `mkdir -p`, inofensivo se já existir).
- `ares-device -i`/`-c` (system-info, screenshot) retornam `Denied method call` — API de
  sistema bloqueada para apps de terceiros nesta TV/firmware (esperado, ver limitações).

## Limitações conhecidas (ver `docs/matriz-hardware-tv.md`)

- Sem decodificador RTSP nativo exposto ao runtime web do webOS — `rtsp.play` retorna
  `{ ok: false }` explicitamente em vez de tentar (e falhar silenciosamente) via `<video>`.
- `take_screenshot` não tem API pública equivalente para apps de terceiros no webOS TV.
- `reboot_os` via `luna://com.webos.service.tvpower/power` normalmente requer privilégios
  de app de sistema/assinada — apps comuns instaladas por side-load provavelmente recebem
  `onFailure`.
- Empacotamento (`ares-package`) foi validado localmente; instalação/lançamento em
  hardware ou simulador reais ainda não foi testada — ver
  `docs/matriz-hardware-tv.md`.
