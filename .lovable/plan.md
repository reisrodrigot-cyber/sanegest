
# Fase 2 — Editor Operacional de Trechos e PVs

Editor exclusivo para `sala_tecnica`. Sobrepõe uma camada operacional editável à base importada, **sem tocar na geometria original** nem no KMZ, importação SS-08, Mapa de Campo ou promoção de base.

## Princípio estrutural

Todo trecho operacional existe **sempre** entre dois PVs (`pv_inicial_id` → `pv_final_id`). Nenhum trecho pode ser salvo sem os dois nós. A geometria original permanece imutável em `mapa_trechos` / `mapa_pontos`. Alterações vivem em duas tabelas novas de "estado atual".

## Modelo de dados (novas tabelas — estado atual, sem versionamento)

### `mapa_pv_operacional`
- `id`, `base_id` (→ `mapa_bases`), `ponto_origem_id` (→ `mapa_pontos`, nullable — null = PV manual novo)
- `rotulo`, `tipo` (`original` | `movido` | `manual` | `suprimido`)
- `geom` (jsonb Point [lon,lat]), `lat`, `lon` (escalares para índice)
- `cota`, `profundidade`, `observacao` (opcionais)
- `motivo`, `updated_by`, `updated_at`, `created_at`
- Único: `(base_id, ponto_origem_id)` quando não-null.

### `mapa_trecho_operacional`
- `id`, `base_id`, `trecho_origem_id` (→ `mapa_trechos`, nullable — null = manual)
- `rotulo`, `tipo` (`original` | `derivado` | `manual` | `suprimido`)
- `pv_inicial_id` (→ `mapa_pv_operacional`, NOT NULL), `pv_final_id` (idem, NOT NULL)
- `geom` (jsonb LineString), `extensao_m` (numeric, recalculada), `dn`, `material`
- `motivo`, `updated_by`, `updated_at`, `created_at`
- Check: `pv_inicial_id <> pv_final_id`.

### Reuso de tabela existente
`mapa_trecho_os` já é N:N trecho↔N.S. Adicionar coluna opcional `trecho_operacional_id` (nullable) para vincular quando o trecho é operacional derivado/manual. Vínculos originais continuam por `trecho_id`.

### RLS
Todas as três operações (SELECT/INSERT/UPDATE/DELETE) em `mapa_pv_operacional`, `mapa_trecho_operacional` e nas colunas novas de `mapa_trecho_os` restritas via `has_role(auth.uid(),'sala_tecnica') OR has_role(auth.uid(),'admin')` — admin só para leitura de auditoria; **edição real apenas `sala_tecnica`** conforme requisito. GRANTs explícitos para `authenticated` + `service_role`.

## Rotas e navegação

- Nova rota `/mapa/editor` → `EditorOperacionalPage`.
- `ROUTE_ROLES['/mapa/editor'] = ['sala_tecnica']`.
- Item no `AppSidebar` visível **apenas** para `sala_tecnica` (não para admin no menu; admin acessa por URL só se for útil — por padrão bloqueado para respeitar "apenas sala_tecnica").
- `ProtectedRoute` já bloqueia por `effectiveRole`.

## Interface (`src/pages/EditorOperacionalPage.tsx` + componentes)

Layout: mapa Leaflet central + painel lateral direito de propriedades + toolbar superior.

Camadas simultâneas com toggles:
- Geometria original (referência, cinza claro tracejado fino).
- Trechos operacionais (linha sólida colorida por status).
- PVs originais (círculo pequeno).
- PVs operacionais novos/movidos (marcador distinto — losango).
- Suprimidos (tracejado vermelho, ocultos por padrão).
- Divergências/pendências (badge discreto).

Seleção obrigatória antes de qualquer edição.

## Ferramentas

Componentes em `src/components/mapa/editor/`:

1. **SelecionarTrecho** — painel mostra rótulo original, extensão original vs operacional, PVs, N.S. vinculadas, status agregado, tipo, ações.
2. **VincularNS** — modal com busca de N.S. da bacia; multi-select; motivo curto. Cor permanece derivada.
3. **DividirTrecho** — botão "Adicionar PV": ativa modo clique-na-linha; snap ao segmento mais próximo (projeção ortogonal via turf `nearestPointOnLine`); cria PV operacional novo + 2 trechos derivados; recalcula extensões (turf `length`); modal para rótulos e N.S. de cada segmento.
4. **MoverPV** — arraste com preview em metros (turf `distance`); lista trechos afetados; alerta reforçado se >10 m com campo de justificativa obrigatório; atualiza extremidades e recalcula extensões.
5. **SuprimirTrecho** — motivo obrigatório; marca `tipo='suprimido'`; PVs permanecem.
6. **SuprimirPV** — se sem trechos ativos: suprime. Se com trechos: modal com opções (cancelar / suprimir trechos / unir dois trechos quando exatamente 2 / reposicionar). Ao unir: escolher N.S. atual, confirmar comprimento.
7. **CriarTrechoManual** — selecionar PV1 → PV2 → desenhar polilinha entre eles (vértices intermediários livres); campos rótulo, DN, material, N.S.; marcado como `manual`.
8. **RestaurarOriginal** — botão no painel: remove overlay operacional daquele trecho (soft delete do `mapa_trecho_operacional` e PVs derivados órfãos); confirma antes.

## Bibliotecas

Adicionar `@turf/turf` (`nearestPointOnLine`, `length`, `distance`, `lineSlice`). `react-leaflet` + `leaflet` já usados.

## Hook de dados

`useEditorOperacional(baseId)`:
- Carrega trechos e PVs originais + operacionais.
- Faz merge: para cada trecho original com operacional derivado/suprimido, aplica overlay.
- Retorna geometria efetiva + status agregado (reusa lógica de `useMapaBasePreview`).
- Mutations com invalidation via React Query.

## Cores e popups

- Sempre via `statusAgregado` das N.S. ativas vinculadas (VERMELHO > LARANJA > AMARELO > VERDE > CINZA).
- `pv_final_assentado=true` → linha do popup: "PV final assentado — pronto para Topografia".
- Popup indica: Original | Derivado | Manual | Suprimido.

## Segurança

- Menu escondido para não-sala_tecnica.
- Rota bloqueada por `ProtectedRoute`.
- RLS restringe todas as operações a `sala_tecnica`.
- Sem endpoint público que permita bypass; todo acesso vai por PostgREST + RLS.

## Testes (via Playwright, base SS-08 Preview)

1. Login sala_tecnica → abre `/mapa/editor`.
2. Login encarregado → rota bloqueada, menu ausente.
3. Selecionar TR-8.37, adicionar PV no meio → 2 segmentos com extensões somando o original.
4. Vincular N.S. distintas aos 2 segmentos → cores independentes.
5. Mover PV <10m e >10m (alerta + justificativa).
6. Suprimir PV conectado → bloqueio + opções.
7. Unir 2 trechos.
8. Criar trecho manual entre 2 PVs (ex: Linha de Recalque).
9. Suprimir trecho e restaurar original.
10. Confirmar KMZ, Mapa de Campo, importação SS-08 sem regressão; nenhuma base promovida.

## Entregas ao final

- Código implementado (migração + páginas + componentes + hook).
- Relatório de testes reais (Playwright).
- Decisões técnicas (turf, N:N via coluna nullable, RLS estrita sala_tecnica).
- Limitações: sem versionamento/timeline; snap usa projeção ortogonal simples; polilinha manual limitada a cliques (sem edição de vértice após criar — v1).

## Fora de escopo (não implementar)

Promoção de base, edição por outros perfis, integração com novos projetos, automação de N.S., timeline/aprovação de edições.
