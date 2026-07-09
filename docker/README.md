# Imagens Docker (API + CMS)

## Pré-requisitos

- Docker Engine + Docker Compose v2
- Na raiz do repositório

## Arranque

```bash
docker compose up --build
```

Ou: `pnpm docker:compose` (equivalente).

- **CMS:** http://localhost:3000  
- **API:** http://localhost:3001/api/v1  
- **Health:** http://localhost:3001/api/v1/health  
- **Postgres:** porta `5432` (utilizador/senha/BD alinhados ao `docker-compose.yml`)

## Variáveis

- Defina `JWT_SECRET` no ambiente ou num ficheiro `.env` na raiz (Compose faz `${JWT_SECRET:-...}`).
- O CMS é construído com `NEXT_PUBLIC_API_URL` (argumento de build no compose). Para outro domínio público, altere o `args` do serviço `cms` em `docker-compose.yml` e volte a construir.

## Builds isolados

```bash
docker build -f docker/api.Dockerfile -t easysignage-api .
docker build -f docker/cms.Dockerfile -t easysignage-cms .
```

## Notas

- O arranque da API executa `prisma migrate deploy` antes de `node dist/main.js`.
- O build Next com `output: standalone` está activo só quando `DOCKER_BUILD=1` (evita falhas de symlink no `next build` do Windows).
