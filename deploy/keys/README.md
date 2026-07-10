# Chaves de licenciamento (fornecedor)

## Desenvolvimento

Gere um par de chaves Ed25519:

```bash
node -e "const {generateKeyPairSync}=require('crypto');const k=generateKeyPairSync('ed25519');console.log(k.publicKey.export({type:'spki',format:'pem'}));console.log('---');console.log(k.privateKey.export({type:'pkcs8',format:'pem'}));"
```

- **Pública:** embutida em `packages/license-core/src/keys.ts` (ou `LICENSE_PUBLIC_KEY` na API).
- **Privada:** grave em `deploy/keys/dev-private.pem` (ficheiro **gitignored**).

O gerador Electron (`apps/license-generator`) lê `deploy/keys/dev-private.pem` ou a variável `EASYSIGNAGE_LICENSE_PRIVATE_KEY`.

## Produção comercial

- Nunca commitar a chave privada de produção.
- Usar cofre seguro; apenas a equipa de licenciamento tem acesso ao gerador.
