# Fase 1 — Novo módulo de mapa geográfico (Preview SS-08)

Escopo desta autorização: importar base real SS-08 (shapefile ZIP), vincular trechos às N.S. e renderizar como camada Preview no Leaflet, sem tocar no KMZ atual nem em produção.

## 1. Backend (Lovable Cloud)

### Storage
- Bucket privado `mapa-base` — originais (ZIP/SHP/GPKG), imutáveis, path `ss-08/<versao>/<hash>.zip`.

### Tabelas novas (todas com RLS, GRANTs, updated_at)

- `mapa_bases` — versionamento da importação
  - `ss` (ex.: `SS-08`), `versao`, `status` (`processando|preview|falha|ativa|arquivada`), `arquivo_path`, `arquivo_hash`, `arquivo_bytes`, `feicoes_rede`, `feicoes_pv`, `bbox` jsonb, `relatorio_validacao` jsonb, `motivo_falha`, `importado_por`, `promovido_em/por`.
- `mapa_camadas_geo` — camadas lógicas da base (`REDE`, `PV`).
  - `base_id`, `tipo` (`LINESTRING|POINT`), `nome_camada`, `campos_originais` jsonb.
- `mapa_trechos` — linhas da REDE
  - `base_id`, `rotulo_original` (imutável, ex.: `TR-8.40`), `rotulo_chave` (normalizado apenas p/ sugestão), `no_inicial`, `no_final`, `dn`, `material`, `l_escala`, `inv_inic`, `inv_fim`, `declividade`, `geometry` jsonb (GeoJSON LineString em 4326), `min_lon/lat`, `max_lon/lat`, `atributos_extra` jsonb.
- `mapa_pontos` — PV/TL/TQ
  - `base_id`, `rotulo_original`, `tipo_no` (`PV|TL|TQ|OUTRO`), `cota_marg`, `cota_inv`, `prof`, `geometry` jsonb (Point), `lon`, `lat`, `atributos_extra` jsonb.
- `mapa_trecho_os` — N:N trecho ↔ N.S.
  - `trecho_id`, `os_id`, `origem` (`AUTO|MANUAL`), `fracao` (default 1.0), `ativo` bool, `motivo`, `criado_por`, `desativado_por/em`.
- `mapa_vinculos_auditoria` — histórico de toda mudança de vínculo (INSERT/UPDATE/DELETE lógico) com snapshot antes/depois.
- `mapa_divergencias` — fila de revisão
  - `base_id`, `tipo` (`COLISAO|SEM_NS|SEM_LINHA|AMBIGUO|SEM_GEOMETRIA|OUTRO`), `rotulo`, `detalhes` jsonb, `status` (`aberta|resolvida|ignorada`), `resolvido_por/em`, `resolucao`.

### Índices
B-Tree em `base_id`, `rotulo_chave`, `min_lon/lat`, `max_lon/lat`, `mapa_trecho_os(trecho_id, ativo)`, `(os_id, ativo)`.

### RLS
- Sala Técnica/Admin/Gerência: leitura completa; escrita apenas Sala Técnica e Admin.
- Bases com `status != 'ativa'` só visíveis para Sala Técnica/Admin.
- Encarregado/Topógrafo/Almoxarifado: leitura apenas de bases `ativa` (nesta fase, nenhuma — camada preview fica invisível para eles).

## 2. Parsing (frontend + Web Worker)

- Lib: `shpjs` (roda no browser, aceita ZIP, decodifica DBF UTF-8 via `.cpg`).
- `proj4` para reprojetar EPSG:31985 → EPSG:4326.
- Web Worker (`src/workers/shpImport.worker.ts`) faz: unzip → identifica conjuntos completos (`.shp/.shx/.dbf/.prj/.cpg`) → parse → reprojeção → normalização → devolve payload JSON com features e bbox.
- Validação: exigir camada LINESTRING (`SS-08-REDE`) e POINT (`SS-08-PV`). GeoJSON `[lon, lat]`. Preservar acentos (`RÓTULO`).
- Upload do ZIP original vai para Storage antes do parse; hash SHA-256 calculado no browser.

## 3. Fluxo de importação

1. Upload → cria `mapa_bases` com `status=processando`, guarda arquivo + hash.
2. Worker faz parse; UI mostra progresso.
3. Insert em chunks: `mapa_camadas_geo`, `mapa_trechos`, `mapa_pontos`.
4. Executa reconciliação de vínculos (ver 4). Popula `mapa_trecho_os` (só matches únicos) e `mapa_divergencias`.
5. Só então `status = preview`. Em qualquer erro: `status = falha`, motivo gravado, dados parciais removidos (delete cascata por `base_id`).

## 4. Vínculo automático

- Chave normalizada: uppercase + trim + colapso de espaços; **não remover dígitos**. `TR-8.40 ≠ TR-8.4`.
- Match único (1 trecho ↔ 1 N.S. da SS-08 ativa) → vínculo `AUTO`.
- Colisão / múltiplos / ausência / grafia ambígua → `mapa_divergencias` (sem vínculo).
- Casos conhecidos pré-carregados como pendência: `TR-8.4 × TR-8.40`, `TR-8.42` sem N.S., `TR-8.18 1-A` sem geometria, Linha de Recalque, `TQ-8.19/20/23/40/41`.

## 5. Renderização no mapa

- `MapaInterativo.tsx` recebe nova camada `Base geográfica — SS-08 (Preview)` com toggle próprio, ao lado das camadas KMZ (KMZ intocado).
- Fetch: trechos e pontos da base preview mais recente da SS-08 (via hook `useMapaBasePreview`).
- Cor do trecho calculada **client-side** a partir das N.S. ativas vinculadas:
  - Precedência `VERMELHO > LARANJA > AMARELO > VERDE > CINZA`.
  - Sem N.S. → CINZA. `pv_final_assentado` não força VERDE (mensagem só no popup).
- Popup do trecho: rótulo original, SS, extensão, DN, material, nós, N.S. vinculadas com status individual, status agregado, origem AUTO/MANUAL, alerta de divergência, aviso "PV final assentado — pronto para Topografia" quando aplicável.
- Pontos PV/TL/TQ como marcadores discretos com popup de rótulo + cotas.

## 6. Tela de administração (Sala Técnica)

Rota `/mapa/bases` (guard por role):
- Upload de ZIP + campo SS (fixo `SS-08` nesta fase).
- Lista de bases com status, contagens, hash, data, ações (ver relatório, ver divergências, arquivar). **Sem botão de promover para `ativa`** nesta fase.
- Sub-tela de divergências: lista, filtros, ação de vínculo manual (com confirmação) que grava em `mapa_trecho_os` origem `MANUAL` + auditoria.

## 7. Permissões
- Rota admin + escrita: `admin`, `sala_tecnica`.
- Camada Preview visível: `admin`, `sala_tecnica`, `gerencia` (read-only).
- Demais roles: não veem toggle, não recebem dados.

## 8. Testes (script `scripts/mapa-fase1-smoke.ts` + Playwright)

- Importa `22.07_shapes.zip` real; espera 42 LINESTRING + 42 POINT.
- Confere bbox dentro de SS-08.
- Reconciliação: reporta matches / pendências / divergências conhecidas.
- Toggle liga/desliga camada sem afetar KMZ.
- Simulação de falha (ZIP corrompido) → base fica `falha`, nada renderiza.
- Mudança de status de uma N.S. altera cor do trecho.
- Playwright: login como sala_tecnica vê a camada; login como encarregado não vê.

## 9. Entregáveis
- Migrações + código + tela admin + camada preview.
- Relatório de execução dos testes (contagens, matches, pendências).
- Lista de itens para validação da Sala Técnica (colisão TR-8.4/8.40, TR-8.42, etc.).
- Nenhuma base promovida para `ativa`.

## Detalhes técnicos

- Deps novas: `shpjs`, `proj4`, `@types/proj4`. `jszip` já vem via `shpjs`.
- Nenhuma alteração em: `ordens_servico`, produção, topografia, dashboard, KMZ, tabelas `mapa_camadas` / `kmz_layer_groups` / `estacas` / `ligacoes`.
- Ordem de execução: (1) migração SQL + storage, (2) worker + parser, (3) tela admin + fluxo import, (4) camada preview no mapa, (5) testes.

Confirma para eu começar pela migração?
