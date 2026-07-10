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
pnpm license:test-serial -- --hwid ES-... --tier STD
```

- **Pública staging:** `deploy/keys/staging-public.pem` — copiada para `config/license-public.pem` no install.
- **Privada staging:** `deploy/keys/staging-private.pem` — gitignored; só no posto DEV.
- Ver `docs/teste-producao.md` para fluxo completo.

## Produção comercial

1. Gere um par Ed25519 **dedicado à produção** (fora do repositório).
2. Instale a **pública** no mini PC: `config/license-public.pem` (ver `production-public.pem.example`).
3. Guarde a **privada** apenas no posto do fornecedor:
   - variável `EASYSIGNAGE_LICENSE_PRIVATE_KEY`, ou
   - ficheiro seguro referenciado pelo gerador Electron.
4. **Nunca** commitar `*.pem` de produção.
5. O gerador **rejeita** `dev-private.pem` quando `NODE_ENV=production`.

A API em produção lê `LICENSE_PUBLIC_KEY_FILE=/config/license-public.pem` e regista erro se ausente.
