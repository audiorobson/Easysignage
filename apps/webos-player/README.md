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
- `index.html` — kiosk shell; carrega `webOSTV.js` (se presente), `js/command-dispatcher.js`
  e `js/webos-bridge.js`, e injeta o `apps/web-player` real num `<iframe>`.
- `js/command-dispatcher.js` — lógica pura de roteamento de comandos (UMD: funciona tanto
  com `require` no Node/testes quanto como `<script>` clássico no browser webOS).
- `js/webos-bridge.js` — implementação das ações (`restartPlayer`, `clearCache`, `openUrl`,
  `rebootOs`, `takeScreenshot`, `rtspPlay`/`rtspStop`) usando `webOS.service.request`
  (luna-service) quando disponível, com fallback gracioso caso contrário.
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

`index.html` lê `?playerUrl=` da query string, com fallback para um placeholder. Ajuste a
URL real no dispositivo (via `ares-launch` com parâmetros, ou editando o valor por defeito
antes de empacotar para produção).

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
