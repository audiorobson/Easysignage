# Troubleshooting de desenvolvimento (EasySignage)

Referência rápida para erros já encontrados e corrigidos no projeto. Útil quando algo semelhante voltar a aparecer.

---

## 1. CMS: `Minified React error #418` (hidratação)

**Sintoma:** No build de produção ou no DevTools aparece o erro React #418; a página pode comportar-se de forma estranha.

**Causa:** O HTML gerado no **servidor (SSR)** não coincide com o **primeiro render no browser** (hidratação). Causa frequente em páginas `'use client'`: usar `new Date(iso).toLocaleString()` **sem locale nem timezone fixos**. O Node e o browser podem formatar a mesma data de forma diferente.

**Correção aplicada:** Centralizar datas em `apps/cms/src/lib/format-date.ts` (`formatDateTimePtBr`), com `locale` `pt-BR` e `timeZone: 'America/Sao_Paulo'`, e usar essa função em tabelas/listagens em vez de `toLocaleString()` nu.

**Outras causas possíveis:** Extensões do browser que alteram o DOM; conteúdo só no cliente sem `useEffect`. Para depurar, usar `pnpm dev` (mensagens completas) e testar em janela anónima.

---

## 2. CMS: `Failed to fetch` / “Não foi possível contactar a API…”

**Sintoma:** O browser não obtém resposta HTTP da API; mensagem genérica `Failed to fetch` ou o texto longo adicionado em `apps/cms/src/lib/api.ts` (função `fetchApi`).

**Causas típicas:**

| Situação | O que verificar |
|----------|------------------|
| API não está a correr | Na raiz: `pnpm dev` ou `pnpm --filter @easysignage/api dev`. Deve aparecer `API listening on 3001` (ou a porta em `PORT`). |
| Porta ocupada | Outro processo na mesma porta → a API não sobe (`EADDRINUSE`). Libertar a porta ou mudar `PORT` no `.env` da API e alinhar `NEXT_PUBLIC_API_URL` no CMS. |
| URL errada no CMS | `apps/cms/.env.local`: `NEXT_PUBLIC_API_URL` deve apontar para a API (ex.: `http://localhost:3001/api/v1`). Reiniciar o Next após alterar. |
| CORS | Em `apps/api/.env`, `CORS_ORIGINS` deve incluir a **origem exata** do browser. `http://localhost:3000` e `http://127.0.0.1:3000` são origens **diferentes**. Incluir ambas se necessário. Ver `.env.example` na raiz. |
| Conteúdo misto | Página servida em **HTTPS** a chamar API só em **HTTP** → o browser bloqueia; não é CORS “normal”. |

**Correção aplicada:** `fetchApi` envolve `fetch` e relança um `Error` com checklist em português para falhas de rede.

**Script de diagnóstico:** na raiz do repositório, `pnpm run check:env` (PowerShell) verifica Postgres (porta do `DATABASE_URL`), `GET /api/v1/health`, ficheiros `.env` e `pnpm` no PATH.

---

## 3. API: crash ao arrancar — `FST_ERR_PLUGIN_VERSION_MISMATCH` (`@fastify/multipart`)

**Sintoma:** Ao iniciar a API, erro do tipo:

`fastify-plugin: @fastify/multipart - expected '5.x' fastify version, '4.x' is installed`

A API **nunca** fica à escuta; o CMS mostra “Failed to fetch” ou erro de ligação.

**Causa:** **NestJS 10** com `@nestjs/platform-fastify` usa **Fastify 4**. A linha **@fastify/multipart v9+** exige **Fastify 5**. O plugin regista-se na instância Fastify criada pelo Nest (v4) e o processo termina.

**Correção aplicada:** Usar **`@fastify/multipart` ^8.x** (compatível com Fastify 4) e declarar **`fastify` ^4.28.x** em `apps/api/package.json` para alinhar com o adapter e para tipos em controllers que importam `fastify`. Ver comentário em `apps/api/src/main.ts`.

**Se no futuro migrarem para Nest + Fastify 5:** rever a linha major do multipart e o registo em `main.ts`.

---

## 4. API / Prisma: erros 500 ou “column does not exist”

**Sintoma:** Endpoints que leem modelos Prisma falham em runtime após mudanças ao `schema.prisma`.

**Causa:** Migrações não aplicadas na base apontada por `DATABASE_URL`, ou Prisma Client desatualizado.

**O que fazer:** Em `apps/api`: `pnpm exec prisma migrate deploy` (ou `migrate dev` em desenvolvimento) e `pnpm exec prisma generate` após puxar código novo.

---

## 5. CMS: `favicon.ico` 404

**Sintoma:** Pedido a `/favicon.ico` devolve 404 no DevTools.

**Correção aplicada:** Ficheiro `apps/cms/public/favicon.svg`, `metadata.icons` em `apps/cms/src/app/layout.tsx`, e rewrite em `apps/cms/next.config.ts` de `/favicon.ico` para `/favicon.svg`.

---

## 6. Windows: `EPERM` ao compilar a API (Prisma `query_engine`)

**Sintoma:** `nest build` ou apagar ficheiros em `dist/` falha com permissão negada no `.dll` do motor Prisma.

**Causa:** Outro processo Node (API antiga, IDE, antivírus) mantém o ficheiro aberto.

**O que fazer:** Terminar processos `node` que usem esse projeto ou fechar o terminal onde a API corre; voltar a compilar.

---

## 7. Grupos de dispositivos (`device_groups`)

**Migrar a base:** na pasta `apps/api`, após puxar código: `pnpm exec prisma migrate deploy` (ou `migrate dev` em desenvolvimento).

**Permissões JWT:** `groups.read` e `groups.write` (o role admin com `all: true` já cobre; o seed `viewer` inclui só `groups.read`).

**API:** `GET/POST /groups`, `GET/PATCH/DELETE /groups/:id`, `POST /groups/:id/members` com `{ "deviceIds": ["uuid", ...] }`, `DELETE /groups/:id/members/:deviceId`, `POST /groups/:id/test-content` e `POST /groups/:id/publish` (mesmo corpo que nos dispositivos). Respostas em lote incluem `applied`, `errors[]` por `deviceId` se algum falhar.

---

## 8. Fase 3 (incremento): `GET /device/state` e revisão de conteúdo

**Objetivo:** o player invalidar cache local (Cache API) quando o CMS altera conteúdo, playlist ou publicação, sem depender só do mesmo `assetId`.

**Resposta de `GET /api/v1/device/state` (JWT device):**

- `currentPublicationId`, `publicationVersion` — publicação ativa no `device_state`, quando existir.
- `contentRevision` — hash curto (SHA-256 truncado) de `lastSyncAt`, `currentPublicationId`, `updatedAt` da playlist ativa (se o item atual for playlist) e `currentItemJson`. Qualquer alteração relevante no servidor muda este valor.
- O **web player** compara com a revisão anterior; se mudar, chama `clearDeviceAssetCache()` e força novo pedido do manifest da playlist (`contentRevision` nas dependências do efeito).

**`GET /api/v1/device/playlists/:id/manifest`:**

- Inclui `manifestRevision` (hash da playlist + ordem dos itens) e, por item, `fileSize` (bytes em string) para uso futuro (progresso, integridade).

---

*Última atualização: alinhada com as correções descritas acima no repositório EasySignage.*
