# EasySignage — Guia de Atualização do Design (Enterprise)

Pacote de handoff para elevar o CMS a nível *enterprise* e **corrigir as inconsistências** identificadas na avaliação. Todos os ficheiros abaixo estão em `entrega-design/` espelhando a estrutura real do repositório — basta copiá-los para os caminhos correspondentes.

> Protótipo navegável de referência: **`EasySignage Enterprise.dc.html`** (abre no browser). Mostra as 4 telas finais — use-o como fonte visual da verdade ao revisar.

---

## 1. O que vem no pacote

| Ficheiro | Destino no repo | O que faz |
|---|---|---|
| `apps/cms/src/app/globals.css` | **substitui** | Tokens refinados + sidebar escura + classes de dashboard, KPI, gráficos e badges |
| `apps/cms/src/components/app-shell.tsx` | **substitui** | Shell com ícones Lucide (outline), seções e topbar com estado de rede |
| `apps/cms/src/app/(app)/dashboard/page.tsx` | **substitui** | Dashboard operacional visual (a tela que faltava) |
| `apps/cms/src/app/(app)/devices/page.tsx` | **substitui** | Lista de dispositivos corrigida (badges + rótulos humanos) |
| `apps/cms/src/lib/device-labels.ts` | **novo** | Mapas enum → texto humano (§24) |
| `apps/cms/src/components/ui/StatusPill.tsx` | **novo** | Badges de estado e conexão com dot |

---

## 2. Pré-requisitos

**2.1 Instalar a biblioteca de ícones outline (substitui o Font Awesome):**

```bash
pnpm --filter @easysignage/cms add lucide-react
```

**2.2 Remover o Font Awesome** (peso morto após a migração):

```bash
pnpm --filter @easysignage/cms remove @fortawesome/fontawesome-free
```

O `@import` do Font Awesome já **não existe** no novo `globals.css`. Ao copiar os ficheiros, todos os `<i className="fa-solid …">` são substituídos por componentes Lucide.

---

## 3. Passos de aplicação

1. Faça backup / branch: `git checkout -b feat/design-enterprise`.
2. Copie os 6 ficheiros de `entrega-design/apps/cms/**` para `apps/cms/**` (mesmos caminhos).
3. Rode `pnpm --filter @easysignage/cms dev` e valide `/dashboard` e `/devices`.
4. Aplique o mesmo padrão às telas restantes usando o mapeamento da seção 4 e os componentes `StatusPill` / `ConnectionPill` / `device-labels`.

> As demais páginas (`sites`, `playlists`, `scheduling`, `groups`, detalhes) continuam a funcionar — herdam automaticamente os novos tokens e classes de `globals.css`. Migre os ícones e badges delas gradualmente.

---

## 4. Mapeamento de ícones (Font Awesome → Lucide)

Troque cada `<i className="fa-solid fa-…" />` pelo componente correspondente `import { X } from 'lucide-react'` e use `<X strokeWidth={1.9} />`.

| Font Awesome (antigo) | Lucide (novo) |
|---|---|
| `fa-gauge-high` | `LayoutDashboard` |
| `fa-network-wired` | `MonitorPlay` |
| `fa-location-dot` | `MapPin` |
| `fa-folder-open` | `FolderOpen` |
| `fa-list` | `ListVideo` |
| `fa-users` | `Users` |
| `fa-calendar-days` | `CalendarDays` |
| `fa-chart-line` | `Activity` |
| `fa-bullhorn` | `Megaphone` |
| `fa-triangle-exclamation` | `TriangleAlert` |
| `fa-gear` | `Settings` |
| `fa-magnifying-glass` | `Search` |
| `fa-bell` | `Bell` |
| `fa-circle-question` | `CircleHelp` |
| `fa-plus` | `Plus` |
| `fa-pen` / editar | `Pencil` |
| `fa-trash` / eliminar | `Trash2` |

Padrão de uso: tamanho `18–20px`, `strokeWidth={1.9}`. Nunca misturar ícones sólidos e outline.

---

## 5. Inconsistências corrigidas (checklist)

- [x] **Ícones sólidos → outline consistente** (diretrizes §11). Font Awesome removido; Lucide em todo o CMS.
- [x] **Dashboard vazio → dashboard visual real** (§15.1): KPIs, disponibilidade, donut de estados, alertas, publicações, distribuição por site.
- [x] **Jargão cru → rótulos humanos** (§24): `electron` → "Player Desktop", `android_browser` → "Android TV", `provisioned` → "Provisionado" (via `device-labels.ts`).
- [x] **Estado como texto → badge semântico** (§15.2) e conexão com dot + label (não depende só de cor — §19).
- [x] **Gradiente em CTA operacional → azul sólido** (§7). Gradiente reservado a branding/onboarding (`.btn--brand`).
- [x] **Deriva de paleta corrigida** (§3.5): fundo neutralizado (sem tom azulado), roxo secundário volta a `#7C3AED`.
- [x] **Sidebar operacional escura** reforçando percepção de plataforma de rede 24/7.
- [ ] **`window.confirm` → modal de confirmação** (§13.6): marcado com `TODO` em `devices/page.tsx`. Criar `<ConfirmDialog>` reutilizável.
- [ ] **Idioma:** padronizar pt-BR **ou** pt-PT em toda a UI (hoje há mistura: "Monitorização"/"ficheiro" vs "Carregando"/"Senha").

---

## 6. Ligar o Dashboard à API real

O `dashboard/page.tsx` usa um bloco `DEMO` como placeholder. A UI já está pronta para dados reais — substitua por:

```ts
const overview = await api('/monitoring/overview'); // KPIs + donut (estado dos players)
const alerts   = await api('/monitoring/alerts');   // lista de alertas ativos
const pubs     = await api('/publications?recent'); // publicações recentes
```

Mantenha o formato: cada KPI = `{ value, label, tone, trend, dir }`; cada alerta/publicação = `{ title/name, meta, tone, label }`.

---

## 7. Higiene do repositório (recomendado)

Fora do escopo de UI, mas afeta a percepção de "produto premium":

- Remover o pôster solto na raiz: `6d4043f1-…​.png` (2,3 MB) e a pasta `fontes/` com PNGs pesados.
- Preencher ou remover `Diretrizes.MD` (0 bytes).
- Considerar mover exports do Stitch (`docs/stitch-exports/`) para fora do bundle de produção.

---

## 8. Tokens de referência (resumo)

```
Primário     #2563EB   Secundário  #7C3AED (acento, uso pontual)
Sucesso      #10B981   Erro        #EF4444
Atenção      #F59E0B   Info        #0EA5E9
Ink (texto)  #0B1220   Sidebar     #0B1220
Fundo        #EEF2F8   Superfície  #FFFFFF   Borda  #E7ECF3
Raios        sm 10 · md 12 · lg 16 · xl 18 · pill 999
Tipografia   Inter — H1 30/800 · H3 16/700 · Body 14/500 · Caption 12/600
```

Consistência radical: mesma paleta, raios, sombras e tipografia em CMS claro e NOC escuro.
