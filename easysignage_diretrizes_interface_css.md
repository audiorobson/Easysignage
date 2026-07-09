# EasySignage — Diretrizes Estéticas, CSS e Estratégia de Interface

## 1. Objetivo do Documento

Este documento define a estratégia estética da interface do EasySignage e estabelece diretrizes práticas para:

- identidade visual do produto digital
- linguagem de interface
- regras de layout
- princípios de usabilidade
- tokens visuais
- diretrizes CSS
- padrões de componentes
- comportamento visual de telas operacionais

O objetivo é garantir consistência entre CMS web, telas administrativas, monitoramento, fluxos operacionais e interfaces futuras do ecossistema EasySignage.

---

## 2. Estratégia Estética do Produto

## 2.1 Papel visual da interface

A interface do EasySignage não deve parecer um editor criativo, um app de mídia doméstica ou um dashboard genérico de marketing.

Ela deve transmitir:

- controle
- clareza operacional
- confiabilidade
- escala
- simplicidade de uso
- precisão

A estética precisa reforçar a percepção de que o produto é uma plataforma profissional de gestão de telas remotas.

---

## 2.2 Direção visual central

A direção estética recomendada é:

**SaaS operacional + monitoramento + infraestrutura visual leve**

Referências de linguagem:
- plataformas de observabilidade
- painéis de operação
- produtos B2B SaaS modernos
- interfaces com densidade moderada e alta clareza

A experiência deve combinar:
- limpeza visual
- legibilidade forte
- hierarquia objetiva
- sensação de produto técnico premium
- foco em estados e ações

---

## 2.3 Impressão que a interface deve causar

Ao abrir o sistema, o usuário deve sentir:

- “eu consigo controlar isso”
- “o sistema é organizado”
- “os dados importantes estão claros”
- “isso parece confiável”
- “isso foi feito para operar em ambiente real”

A UI deve reduzir ansiedade operacional.

---

## 3. Princípios de Interface

## 3.1 Clareza antes de expressão

A estética nunca pode competir com a função.
Toda decisão visual deve melhorar leitura, navegação ou confiança.

---

## 3.2 Operação antes de decoração

O valor do produto está em:
- gestão
- publicação
- monitoramento
- controle remoto
- confiabilidade

Logo, a interface deve priorizar:
- tabelas claras
- filtros eficientes
- status legíveis
- feedback rápido
- navegação previsível

---

## 3.3 Densidade controlada

A interface não deve ser exageradamente espaçada, nem comprimida demais.

Direção:
- dashboards com respiro visual
- listas e tabelas eficientes
- formulários objetivos
- boa densidade para uso profissional contínuo

---

## 3.4 Estados são parte da estética

No EasySignage, estados visuais são centrais.
A identidade da interface é construída também por:

- online
- offline
- sincronizando
- erro
- alerta
- publicação em andamento
- sucesso
- pendência

Esses estados devem ser imediatamente reconhecíveis.

---

## 3.5 Consistência radical

Espaçamento, cor, raio, borda, sombras, tipografia e comportamento devem se repetir de forma consistente.

Consistência gera:
- sensação de qualidade
- previsibilidade
- menor carga cognitiva
- maior confiança no sistema

---

## 4. Personalidade Visual da Interface

A interface do EasySignage deve ser:

- moderna
- sóbria
- técnica
- elegante
- estável
- objetiva

Ela não deve ser:
- lúdica
- chamativa demais
- “neon futurista”
- pesada visualmente
- genérica como template barato
- parecida com app consumer de streaming

---

## 5. Estratégia de Tema

## 5.1 Light theme como padrão administrativo

O tema claro deve ser o padrão do CMS administrativo, porque:
- favorece leitura em jornadas longas
- melhora clareza de formulários e tabelas
- transmite organização
- aproxima a experiência de ferramentas de gestão

---

## 5.2 Dark theme para operação e monitoramento

O tema escuro é recomendado para:
- painéis de monitoramento
- uso contínuo em NOC/operacional
- dashboards em ambientes escuros
- exibições permanentes

---

## 5.3 Recomendação prática

O sistema deve nascer com design preparado para ambos, mas o primeiro foco visual deve ser:

- **light theme robusto e completo**
- **dark theme compatível e consistente**

---

## 6. Paleta de Cores

## 6.1 Cor primária

Azul principal:
- `#2563EB`

Significado:
- confiança
- tecnologia
- clareza
- controle

Uso:
- botões primários
- links principais
- foco
- elementos interativos principais
- destaques de navegação ativa

---

## 6.2 Cor secundária

Roxo:
- `#7C3AED`

Significado:
- inovação
- sistema digital
- sofisticação

Uso:
- destaques secundários
- gráficos
- identidade de marca
- gradientes pontuais
- estados de publicação ou distribuição, quando fizer sentido

---

## 6.3 Neutros

### Base clara
- `#FFFFFF` — fundo principal
- `#F8FAFC` — superfícies suaves
- `#F1F5F9` — painéis, divisórias leves
- `#E2E8F0` — bordas suaves
- `#CBD5E1` — bordas secundárias

### Texto
- `#0F172A` — texto principal
- `#334155` — texto secundário forte
- `#64748B` — texto secundário
- `#94A3B8` — texto auxiliar

### Base escura
- `#020617` — fundo profundo
- `#0F172A` — painéis dark
- `#111827` — superfícies escuras
- `#1E293B` — borda/superfície dark

---

## 6.4 Cores semânticas

### Sucesso
- Base: `#10B981`
- Fundo suave: `#ECFDF5`
- Texto forte: `#047857`

### Erro
- Base: `#EF4444`
- Fundo suave: `#FEF2F2`
- Texto forte: `#B91C1C`

### Alerta
- Base: `#F59E0B`
- Fundo suave: `#FFFBEB`
- Texto forte: `#B45309`

### Informação
- Base: `#0EA5E9`
- Fundo suave: `#F0F9FF`
- Texto forte: `#0369A1`

---

## 6.5 Regras de uso de cor

1. Azul é prioridade para ação principal.
2. Roxo deve ser usado como apoio, não como cor dominante da interface.
3. Vermelho nunca deve ser usado como destaque decorativo.
4. Verde deve ser reservado para sucesso, saúde e estado online.
5. Laranja/amarelo devem ser usados apenas para atenção, não como cor estrutural.

---

## 7. Gradientes

Gradientes devem ser sutis e estratégicos.

Gradiente principal recomendado:
- `linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)`

Usos permitidos:
- branding
- hero da landing page
- destaques de bloco institucional
- pequenos acentos de interface
- elementos de onboarding

Usos evitados:
- fundo principal do sistema
- tabelas
- cards operacionais
- textos longos
- dashboards com muita informação

---

## 8. Tipografia

## 8.1 Fonte principal

Recomendação:
- `Inter`, fallback para `system-ui`, `sans-serif`

Motivos:
- excelente legibilidade
- ótima performance
- aparência profissional
- adequada para produto SaaS
- boa leitura em dashboards e tabelas

---

## 8.2 Hierarquia tipográfica

### Display
- uso raro
- landing pages, onboarding, empty states especiais

### Heading 1
- páginas principais
- tamanho recomendado: `30px` a `36px`
- peso: `700`

### Heading 2
- seções importantes
- tamanho: `24px`
- peso: `600` ou `700`

### Heading 3
- blocos internos
- tamanho: `20px`
- peso: `600`

### Heading 4
- cards, módulos, seções pequenas
- tamanho: `16px` a `18px`
- peso: `600`

### Body
- tamanho padrão: `14px` a `16px`
- peso: `400` ou `500`

### Caption / helper
- tamanho: `12px` a `13px`
- peso: `400` ou `500`

---

## 8.3 Diretrizes tipográficas

- evitar uso excessivo de caixa alta
- evitar múltiplos pesos em um mesmo bloco
- priorizar contraste entre peso e tamanho
- números operacionais podem usar tabular figures quando possível
- títulos devem ser curtos e objetivos

---

## 9. Grid, Layout e Espaçamento

## 9.1 Sistema de espaçamento

Usar escala consistente baseada em múltiplos de 4.

Escala recomendada:
- 4
- 8
- 12
- 16
- 20
- 24
- 32
- 40
- 48
- 64

---

## 9.2 Princípio de respiro

- telas operacionais: espaçamento médio
- formulários: espaçamento compacto, porém legível
- dashboards: respiro entre blocos principais
- tabelas: compactas, sem parecer densas demais

---

## 9.3 Largura de conteúdo

### Páginas de gestão
- largura máxima ampla
- containers entre `1200px` e `1440px`

### Formulários e setup
- largura controlada
- `560px` a `800px`

### Dashboards
- largura fluida com grid responsivo

---

## 9.4 Grid recomendado

- 12 colunas para desktop
- 8 colunas para tablet
- 4 colunas para mobile

---

## 10. Bordas, Raios e Sombras

## 10.1 Border radius

Padrão:
- inputs e botões: `10px`
- cards: `14px`
- modais: `16px`
- badges: `999px`
- containers especiais: `20px`

Direção:
- cantos suaves
- aparência moderna
- evitar cantos muito duros ou exageradamente arredondados

---

## 10.2 Bordas

- usar bordas suaves e discretas
- prioridade para cinzas claros
- bordas devem organizar a interface, não desenhá-la em excesso

---

## 10.3 Sombras

Sombras devem ser leves e elegantes.

Objetivo:
- separar planos
- dar profundidade mínima
- indicar elevação

Evitar:
- sombras pesadas
- blur exagerado
- estética “cartão flutuante demais”

---

## 11. Ícones

## 11.1 Direção

- ícones lineares ou duotone leve
- traço limpo
- consistentes entre si
- sem excesso de detalhe

## 11.2 Critérios

- fácil leitura em 16px e 20px
- sem ambiguidade
- sempre alinhados semanticamente à ação

## 11.3 Categorias principais
- telas/devices
- grupos
- playlists
- campanhas
- agendamento
- monitoramento
- alertas
- configurações
- usuário
- sincronização
- upload

---

## 12. Navegação

## 12.1 Sidebar

A navegação principal deve ser lateral.
Isso reforça:
- produto operacional
- estrutura modular
- rápida alternância de contexto

### Conteúdo esperado
- Dashboard
- Devices
- Groups
- Assets
- Playlists
- Campaigns
- Scheduling
- Monitoring
- Alerts
- Settings

### Regras
- item ativo muito claro
- contraste adequado
- ícone + label
- possibilidade futura de sidebar colapsável

---

## 12.2 Topbar

Deve conter:
- busca global futura
- tenant/contexto
- notificações
- usuário
- ações contextuais quando necessário

---

## 13. Estratégia para Componentes

## 13.1 Botões

### Hierarquia
- Primário
- Secundário
- Terciário
- Ghost
- Danger

### Regras
- um único CTA principal por área
- evitar muitos botões primários na mesma tela
- botões críticos devem ter confirmação quando necessário

---

## 13.2 Inputs

Devem ser:
- simples
- legíveis
- com bom contraste
- estados muito claros

Estados obrigatórios:
- default
- hover
- focus
- filled
- disabled
- error
- success

---

## 13.3 Selects e filtros

São críticos para operação.
Devem ter:
- boa largura
- labels claros
- suporte a múltiplas seleções quando necessário
- chips/tags bem definidas

---

## 13.4 Tabelas

Tabelas são centrais no produto.

Diretrizes:
- linhas com altura confortável
- cabeçalhos claros
- possibilidade de ordenação
- filtros persistentes
- ações por linha
- seleção em lote futura
- status destacados com badge

Evitar:
- excesso de linhas visuais pesadas
- zebra exagerada
- texto comprimido

---

## 13.5 Cards

Cards devem ser usados para:
- resumo de métricas
- blocos modulares
- estados rápidos
- painéis secundários

Não usar cards para tudo.
Tabelas continuam sendo essenciais.

---

## 13.6 Modais

Usar modais para:
- confirmações
- ações rápidas
- formulários curtos
- detalhes complementares

Evitar modais para:
- fluxos longos
- edições complexas
- cadastros extensos

---

## 13.7 Drawers

Muito úteis para:
- edição lateral
- preview
- detalhes de device
- histórico rápido

---

## 14. Estados Visuais

## 14.1 Status de device

Estados recomendados:
- Online
- Offline
- Syncing
- Warning
- Error
- Updating
- Idle
- Unpaired

Cada um deve ter:
- badge
- ícone opcional
- cor específica
- possível tooltip com detalhe

---

## 14.2 Publicação

Estados recomendados:
- Draft
- Scheduled
- Publishing
- Active
- Paused
- Failed
- Archived

---

## 14.3 Comandos remotos

Estados:
- Pending
- Sent
- Delivered
- Executed
- Failed
- Timed out

Esses estados devem ficar claramente visíveis em listas e detalhes.

---

## 15. Telas Principais e Diretrizes

## 15.1 Dashboard

Objetivo:
dar visão geral imediata.

Deve priorizar:
- total de telas
- online/offline
- alertas críticos
- últimas publicações
- falhas recentes
- distribuição por grupos/sites

### Estética
- cards de resumo no topo
- blocos analíticos no centro
- listas operacionais no rodapé ou lateral
- leitura escaneável em segundos

---

## 15.2 Lista de Devices

Objetivo:
permitir gestão rápida e operacional.

Deve conter:
- nome
- status
- site
- grupo
- última conexão
- versão
- publication atual
- ações rápidas

### Estética
- layout tabelado
- filtros fixos ou muito acessíveis
- status muito visíveis
- ações discretas, porém fáceis

---

## 15.3 Detalhe do Device

Objetivo:
centralizar tudo sobre um player.

Seções sugeridas:
- cabeçalho com status
- informações do dispositivo
- publicação atual
- última sincronização
- métricas
- comandos
- logs
- screenshot
- histórico

---

## 15.4 Biblioteca de Assets

Objetivo:
gerenciar conteúdo sem parecer um editor criativo.

Direção:
- grid opcional para preview
- lista detalhada para operação
- filtros por tipo
- status de processamento
- metadados claros

---

## 15.5 Playlists

Objetivo:
montar sequência operacional de conteúdo.

Direção:
- estrutura limpa
- drag-and-drop claro
- preview simples
- duração por item muito visível
- hierarquia linear

---

## 15.6 Agendamento

Objetivo:
permitir organização temporal sem confusão.

Direção:
- visão de calendário ou timeline
- conflitos visualmente claros
- prioridade explícita
- filtros por grupo, campanha, site

---

## 15.7 Monitoramento

Objetivo:
operar a rede de telas.

Direção:
- dark theme funciona muito bem
- alertas devem ser visíveis sem poluir
- logs e estados devem ter hierarquia
- indicadores de saúde em destaque

---

## 15.8 Alertas

Objetivo:
agir rápido.

Direção:
- severidade evidente
- lista ordenável por criticidade
- ações claras: reconhecer, investigar, reenviar comando, abrir device

---

## 16. Responsividade

## 16.1 Estratégia realista

O CMS é prioritariamente desktop-first.
Tablet é secundário.
Mobile deve existir para consulta e ações rápidas, não para operação completa.

---

## 16.2 Regras

### Desktop
- experiência completa

### Tablet
- reduzir densidade
- empilhar painéis
- sidebar adaptável

### Mobile
- consulta de status
- alertas
- ações rápidas
- detalhes resumidos

---

## 17. Motion e Microinterações

## 17.1 Princípios

Animações devem:
- confirmar
- orientar
- suavizar
- nunca distrair

---

## 17.2 Usos recomendados

- hover discreto
- fade pequeno de modais
- transição de tabs
- skeleton loading
- feedback de salvamento
- badge/estado mudando de forma suave

---

## 17.3 Evitar

- animação longa
- bounce exagerado
- microinterações “divertidas” demais
- excesso de motion em dashboard

---

## 18. Empty States, Loading e Erros

## 18.1 Empty states

Devem ser úteis e acionáveis.
Cada empty state deve responder:
- o que está vazio
- por que isso importa
- qual ação tomar agora

---

## 18.2 Loading

Usar:
- skeleton para listas e cards
- spinner apenas para ações pontuais
- labels claras como “Publicando...” ou “Sincronizando...”

---

## 18.3 Erros

Erros devem ser:
- claros
- humanos
- orientados à ação
- não técnicos demais na camada visual principal

---

## 19. Acessibilidade

Diretrizes mínimas:
- contraste adequado
- foco visível em todos os interativos
- navegação por teclado nas telas principais
- labels corretas
- não depender só de cor para status
- tamanho de clique confortável
- mensagens de erro ligadas ao campo

---

## 20. Design Tokens CSS

Abaixo, um ponto de partida de tokens globais.

```css
:root {
  --font-sans: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;

  --color-primary-500: #2563EB;
  --color-primary-700: #1D4ED8;
  --color-secondary-500: #7C3AED;
  --color-secondary-700: #6D28D9;

  --color-bg: #FFFFFF;
  --color-bg-soft: #F8FAFC;
  --color-surface: #FFFFFF;
  --color-surface-muted: #F1F5F9;
  --color-border: #E2E8F0;
  --color-border-strong: #CBD5E1;

  --color-text: #0F172A;
  --color-text-soft: #334155;
  --color-text-muted: #64748B;
  --color-text-faint: #94A3B8;

  --color-success: #10B981;
  --color-success-bg: #ECFDF5;
  --color-success-text: #047857;

  --color-danger: #EF4444;
  --color-danger-bg: #FEF2F2;
  --color-danger-text: #B91C1C;

  --color-warning: #F59E0B;
  --color-warning-bg: #FFFBEB;
  --color-warning-text: #B45309;

  --color-info: #0EA5E9;
  --color-info-bg: #F0F9FF;
  --color-info-text: #0369A1;

  --radius-sm: 10px;
  --radius-md: 14px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-pill: 999px;

  --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.05);
  --shadow-md: 0 8px 24px rgba(15, 23, 42, 0.06);
  --shadow-lg: 0 16px 40px rgba(15, 23, 42, 0.08);

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  --text-xs: 12px;
  --text-sm: 14px;
  --text-md: 16px;
  --text-lg: 18px;
  --text-xl: 20px;
  --text-2xl: 24px;
  --text-3xl: 30px;

  --line-tight: 1.2;
  --line-normal: 1.5;
  --line-relaxed: 1.65;

  --transition-fast: 120ms ease;
  --transition-base: 180ms ease;
  --transition-slow: 260ms ease;

  --gradient-brand: linear-gradient(135deg, #2563EB 0%, #7C3AED 100%);
}
```

---

## 21. Tokens do Tema Escuro

```css
[data-theme="dark"] {
  --color-bg: #020617;
  --color-bg-soft: #0F172A;
  --color-surface: #111827;
  --color-surface-muted: #1E293B;
  --color-border: #334155;
  --color-border-strong: #475569;

  --color-text: #F8FAFC;
  --color-text-soft: #E2E8F0;
  --color-text-muted: #CBD5E1;
  --color-text-faint: #94A3B8;

  --shadow-sm: 0 1px 2px rgba(2, 6, 23, 0.35);
  --shadow-md: 0 8px 24px rgba(2, 6, 23, 0.4);
  --shadow-lg: 0 16px 40px rgba(2, 6, 23, 0.5);
}
```

---

## 22. Base CSS Recomendada

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  font-family: var(--font-sans);
  color: var(--color-text);
  background: var(--color-bg);
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
}

body {
  margin: 0;
  background: var(--color-bg);
  color: var(--color-text);
  font-size: var(--text-sm);
  line-height: var(--line-normal);
}

a {
  color: var(--color-primary-500);
  text-decoration: none;
  transition: color var(--transition-fast);
}

a:hover {
  color: var(--color-primary-700);
}

button,
input,
select,
textarea {
  font: inherit;
}

button {
  cursor: pointer;
}

:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}
```

---

## 23. Exemplo de Componentes Base em CSS

## 23.1 Botão primário

```css
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  height: 40px;
  padding: 0 var(--space-4);
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--color-primary-500);
  color: #fff;
  font-weight: 600;
  box-shadow: var(--shadow-sm);
  transition:
    background var(--transition-fast),
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}

.btn-primary:hover {
  background: var(--color-primary-700);
  box-shadow: var(--shadow-md);
}

.btn-primary:active {
  transform: translateY(1px);
}
```

---

## 23.2 Card

```css
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}
```

---

## 23.3 Input

```css
.input {
  width: 100%;
  height: 42px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.input:hover {
  border-color: var(--color-border-strong);
}

.input:focus {
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
  outline: none;
}
```

---

## 23.4 Badge de status

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 24px;
  padding: 0 10px;
  border-radius: var(--radius-pill);
  font-size: var(--text-xs);
  font-weight: 600;
}

.badge--success {
  background: var(--color-success-bg);
  color: var(--color-success-text);
}

.badge--danger {
  background: var(--color-danger-bg);
  color: var(--color-danger-text);
}

.badge--warning {
  background: var(--color-warning-bg);
  color: var(--color-warning-text);
}

.badge--info {
  background: var(--color-info-bg);
  color: var(--color-info-text);
}
```

---

## 24. Linguagem de Conteúdo na UI

A interface deve usar linguagem:
- clara
- curta
- operacional
- humana
- sem excesso de jargão

Exemplos:
- “Publicar agora”
- “Sincronização concluída”
- “Player offline há 12 min”
- “Falha ao atualizar conteúdo”
- “Última publicação ativa”

Evitar:
- frases vagas
- linguagem excessivamente técnica
- labels longos demais

---

## 25. Diretriz Final de Consistência

Toda tela do EasySignage deve responder a estas perguntas:

1. O que é mais importante nesta tela?
2. O estado atual está visível?
3. A próxima ação está clara?
4. O layout ajuda a operar ou só “parece bonito”?
5. A identidade visual reforça controle, confiança e simplicidade?

Se a resposta não for clara, a interface ainda não está pronta.

---

## 26. Resumo Executivo

A estética do EasySignage deve ser a de um produto SaaS operacional premium:
- moderno
- limpo
- técnico
- confiável
- orientado a estados e ações

A interface deve equilibrar:
- marca forte
- operação clara
- consistência visual
- eficiência diária

O objetivo não é impressionar com excesso visual.
O objetivo é transmitir domínio, clareza e confiança em um sistema que controla redes de telas remotas.
