# `apps/tizen-player`

Wrapper Tizen TV (Samsung) para o `apps/web-player` — PR 7.3 do
[roadmap de nível de mercado](../../digital_signage_arquitetura_roadmap.md). Mesma
estratégia dos demais players desta fase (Android TV, webOS): app mínima que abre o
web-player num `<iframe>` em kiosk fullscreen e expõe `window.easysignage` com o mesmo
contrato (`platform`, `rtsp`, `commands`, `updater`).

Este módulo **não faz parte do workspace pnpm** (ver `pnpm-workspace.yaml`).

## Estrutura

- `config.xml` — manifesto W3C Widget + extensões `tizen:` (id, privilégios, perfil `tv-samsung`).
- `index.html` — kiosk shell; carrega `js/command-dispatcher.js` e `js/tizen-bridge.js`, e
  injeta o `apps/web-player` real num `<iframe>`. Trata a tecla "voltar" do controlo remoto
  (`tizenhwkey`) fechando a app em vez de navegar no histórico.
- `js/command-dispatcher.js` — lógica pura de roteamento (idêntica em espírito à do
  `apps/webos-player`), testável com `node --test` sem depender do runtime Tizen.
- `js/tizen-bridge.js` — implementação das ações usando o objeto global `tizen` quando
  disponível (`tizen.systeminfo` para `platform.getInfo`), com fallback gracioso quando
  não está (ex.: navegador comum durante desenvolvimento).
- `test/command-dispatcher.test.js` — testes com o runner nativo do Node.

## Comandos

```bash
npm test    # node --test test/*.test.js
```

## Build/empacotamento (`.wgt`)

Diferente do webOS (`ares-cli` no npm), o Tizen Studio CLI **não está disponível via npm**
— é uma ferramenta Java distribuída pela Samsung, tipicamente de ~1 GB. Este módulo não
tenta baixá-la/instalá-la localmente. O CI (`.github/workflows/tizen.yml`) usa a GitHub
Action `sourcetoad/tizen-build-action`, que instala o Tizen Studio CLI sob demanda e gera
o `.wgt`; a etapa de empacotamento assinado só executa se os secrets
`TIZEN_AUTHOR_KEY`/`TIZEN_AUTHOR_KEY_PW` estiverem configurados no repositório (ainda não
estão — ver `docs/matriz-hardware-tv.md`). Os testes unitários do bridge sempre correm,
independentemente disso.

Para build local, instale o [Tizen Studio](https://developer.tizen.org/development/tizen-studio/download)
com a extensão TV, depois:

```bash
tizen build-web -- apps/tizen-player
tizen package -t wgt -s <seu-certificado> -- apps/tizen-player/.buildResult
```

## Limitações conhecidas (ver `docs/matriz-hardware-tv.md`)

- Sem decodificador RTSP nativo exposto ao runtime web do Tizen.
- `reboot_os` e `take_screenshot` não têm API pública para apps de terceiros no Tizen TV
  (reboot/power está restrito a apps assinadas como partner/platform) — o bridge retorna
  `{ ok: false }` explicitamente em vez de tentar chamadas que falhariam silenciosamente.
- Build/empacotamento real (`.wgt` assinado) ainda não foi validado — depende de Tizen
  Studio local ou dos secrets de assinatura no CI.
- Nenhum hardware/emulador Tizen real foi usado para validar esta entrega.
