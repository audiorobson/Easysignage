# Chaves de licenciamento (fornecedor)

## Chaves de desenvolvimento (dev)

```bash
pnpm license:gen-keys   # gera deploy/keys/dev-private.pem (gitignored)
```

- **Pública dev:** embutida em `packages/license-core/src/keys.ts` (só para dev).
- **Privada dev:** `deploy/keys/dev-private.pem` — usada pelo gerador Electron em desenvolvimento.

## Teste de produção (staging)

```bash
pnpm license:gen-staging-keys   # gera par staging (publica commitada)
pnpm license:gen-production-keys   # par comercial (privada → cofre)
pnpm license:test-serial -- --hwid ES-... --tier STD
```

- **Pública staging:** `deploy/keys/staging-public.pem` — copiada para `config/license-public.pem` no install.
- **Privada staging:** `deploy/keys/staging-private.pem` — gitignored; só no posto DEV.
- Ver `docs/teste-producao.md` para fluxo completo.

## Produção comercial

1. Gere um par Ed25519 **dedicado à produção**: `pnpm license:gen-production-keys` (ou `--out` fora do repo).
2. Instale a **pública** no mini PC: `config/license-public.pem` (ver `production-public.pem.example`).
3. Guarde a **privada** no cofre — ver **`docs/cofre-chave-licenca-producao.md`**.
4. No gerador: `EASYSIGNAGE_LICENSE_ENV=production` + variável ou **Carregar chave privada…** na UI.
5. **Nunca** commitar `production-private.pem`.
6. O gerador **rejeita** chaves dev/staging quando `EASYSIGNAGE_LICENSE_ENV=production`.

A API em produção lê `LICENSE_PUBLIC_KEY_FILE=/config/license-public.pem` e regista erro se ausente.
