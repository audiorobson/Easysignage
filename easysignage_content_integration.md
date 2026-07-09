# EasySignage — Content Integration Layer (APIs, RSS, Dados Dinâmicos)

## 1. Objetivo

Este documento define a estratégia, arquitetura e integrações para incorporar conteúdo dinâmico ao EasySignage, incluindo:

- feeds RSS
- APIs de notícias
- clima
- economia
- dados públicos
- conteúdo corporativo

O objetivo é transformar o EasySignage em uma plataforma de **conteúdo vivo e contextual**, além de mídia estática.

---

## 2. Estratégia Central

### Problema
A maioria das soluções de signage:
- exibe conteúdo estático
- depende de atualização manual
- não reage ao contexto

### Solução EasySignage

Criar uma camada chamada:

## Content Integration Layer

```
APIs externas → Normalização → Cache → Widgets → Player
```

---

## 3. Conceito-chave: Widgets de Conteúdo

Todo conteúdo externo deve virar um componente reutilizável.

### Tipos de widgets

- News Widget
- Weather Widget
- Market Widget
- RSS Custom Widget
- Corporate Feed Widget

---

## 4. APIs Recomendadas (Brasil)

## 4.1 Notícias

### G1
- RSS: https://g1.globo.com/rss/g1/
- uso: geral, economia, tecnologia

### UOL
- RSS por categorias

### Agência Brasil
- conteúdo institucional

---

## 4.2 Clima

### OpenWeather
- temperatura
- previsão
- gratuito com limite

### INMET
- dados oficiais do Brasil

---

## 4.3 Economia

### Banco Central (SGS)
- Selic
- inflação
- câmbio

---

## 4.4 Criptomoedas

### CoinGecko
- preços
- variações

---

## 4.5 Dados públicos

### dados.gov.br
- datasets abertos

---

## 5. Arquitetura Técnica

## 5.1 Serviço dedicado

Criar serviço:

`content-service`

Responsável por:
- consumir APIs externas
- normalizar dados
- cachear
- expor API interna

---

## 5.2 Fluxo de dados

```
RSS/API externa
   ↓
Parser
   ↓
Normalizador
   ↓
Cache (Redis/DB)
   ↓
API interna
   ↓
Player / Widget
```

---

## 6. Normalização de Dados

### Exemplo RSS → JSON

Entrada:
```
<item>
  <title>Notícia</title>
</item>
```

Saída:
```
{
  "title": "Notícia",
  "source": "G1"
}
```

---

## 7. Cache (obrigatório)

- Redis recomendado
- TTL configurável
- evitar rate limit

---

## 8. Módulos Node.js

### RSS
- rss-parser

### HTTP
- axios

### Cache
- ioredis

---

## 9. Endpoints Internos

### GET /content/news
### GET /content/weather
### GET /content/market
### GET /content/rss
### GET /content/custom

---

## 10. Content Packs (diferencial)

### Varejo
- clima
- promoções
- notícias leves

### Corporativo
- notícias
- indicadores
- comunicados

### Financeiro
- dólar
- bolsa
- cripto

---

## 11. Roadmap

### Fase 1
- RSS genérico
- G1 / UOL
- Weather

### Fase 2
- Banco Central
- CoinGecko

### Fase 3
- APIs do cliente

### Fase 4
- conteúdo dinâmico por contexto

---

## 12. Boas práticas

- respeitar rate limits
- evitar scraping ilegal
- fallback offline
- normalização obrigatória

---

## 13. Conclusão

Content Integration transforma o EasySignage em:

- plataforma viva
- contextual
- automatizada
- escalável

Não é apenas exibição de mídia, mas distribuição inteligente de informação.
