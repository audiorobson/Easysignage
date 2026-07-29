# Cofre — chave privada de licenciamento (produção)

A chave privada Ed25519 de **produção comercial** assina os seriais entregues aos clientes.

## Gerar o par (uma vez)

```bash
pnpm license:gen-production-keys
pnpm license:gen-production-keys -- --out C:\Secure\EasySignage\keys
```

- **production-private.pem** → cofre (nunca no Git, ZIP cliente ou Docker).
- **production-public.pem** → `config/license-public.pem` no mini PC.

## Onde guardar a privada

| Método | Quando usar |
|--------|-------------|
| Gestor de passwords (1Password, Bitwarden) | Equipa pequena |
| Azure Key Vault / AWS Secrets Manager | Enterprise |
| USB offline encriptado | Backup DR |
| `EASYSIGNAGE_LICENSE_PRIVATE_KEY` | Posto comercial dedicado |

## Gerador Electron

```powershell
$env:EASYSIGNAGE_LICENSE_ENV = "production"
$env:EASYSIGNAGE_LICENSE_PRIVATE_KEY = Get-Content -Raw "C:\Secure\EasySignage\keys\production-private.pem"
pnpm --filter @easysignage/license-generator dev
```

Ou use **Carregar chave privada…** na UI do gerador.

A API no mini PC usa **só a chave pública** (`LICENSE_PUBLIC_KEY_FILE=/config/license-public.pem`).

Ver também: `deploy/keys/README.md`, `docs/teste-producao.md`.