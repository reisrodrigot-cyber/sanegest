# Plano — registros_producao como fonte única de verdade

## 1. Campos existentes em `registros_producao`
- `id, os_id, user_id`
- `data_registro` (date)
- `comprimento_dia` (numeric), `ligacoes_dia` (int) — valores informados pelo encarregado
- `observacao`, `tipo_pavimento`
- `created_at, updated_at`
- `excluido` (bool), `excluido_em`, `excluido_por`, `motivo_exclusao`

Já existe auditoria em `registros_producao_auditoria` e função `recompute_os_real_from_registros()` + trigger `tg_registros_producao_sync_os` que recalcula `ordens_servico.comprimento_real / ligacoes_real` quando `real_validado` ≠ true.

## 2. Campos novos necessários em `registros_producao`
- `comprimento_ajustado` numeric NULL — ajuste técnico do comprimento
- `ligacoes_ajustadas` int NULL — ajuste técnico das ligações
- `ajustado_por` uuid NULL, `ajustado_em` timestamptz NULL, `motivo_ajuste` text NULL
- `status` text NOT NULL DEFAULT `'ativo'` CHECK in (`'ativo'`,`'cancelado'`) — cancelamento lógico distinto de `excluido` (mantemos `excluido` por compatibilidade; UI nova usa `status`)
- `cancelado_por`, `cancelado_em`, `motivo_cancelamento`

A produção contabilizada do registro passa a ser:
```
comprimento_contabilizado = COALESCE(comprimento_ajustado, comprimento_dia)
ligacoes_contabilizadas   = COALESCE(ligacoes_ajustadas,   ligacoes_dia)
```
considerando apenas `excluido IS NOT TRUE AND status <> 'cancelado'`.

## 3. Seção "Registros de Produção" na N.S. aberta
Em `OSDetailPage`, abaixo de "Dados do Trecho" (`OSDetalhesTrecho`), nova seção com tabela enxuta:

| Data | Encarregado | Comp. informado | Comp. final | Ligações | Status | Ações |
|---|---|---|---|---|---|---|

- "Comp. final" = valor ajustado se houver (com badge "ajustado"), senão o informado.
- Linha cancelada/excluída fica esmaecida, com motivo em tooltip.
- Ações (apenas sala_tecnica/gerencia): **Ajustar**, **Cancelar**, **Restaurar**.
- Rodapé: totais ativos (deve bater com "Executado" do cabeçalho).

Encarregado continua usando "Meus registros enviados" para editar/excluir os próprios — sem mudança de layout.

## 4. Componentes/telas impactadas
- `src/pages/OSDetailPage.tsx` — inclui a nova seção.
- novo `src/components/os/RegistrosProducaoOS.tsx` — tabela + modais Ajustar/Cancelar/Restaurar.
- `src/components/OSDetalhesTrecho.tsx` — "Executado" passa a vir do somatório contabilizado (via `comprimento_real` recalculado, que continua sendo cache).
- `src/components/encarregado/MeusRegistrosEnviados.tsx` — remover bloqueio por `real_validado`; passar a respeitar `status='cancelado'` (registro cancelado pela sala técnica não é editável pelo encarregado, só restaurável pela técnica).
- `src/lib/realEfetivo.ts` / `planilhaoExport.ts` / dashboards — passam a ler do cache `comprimento_real` (já sincronizado), sem ler `real_validado`.
- Remover UI/uso de "validar REAL" onde aparecer.

## 5. Banco — funções, triggers, views
- Alterar `recompute_os_real_from_registros(_os_id)`:
  - remover o `IF v_validado IS TRUE THEN RETURN`;
  - somar `COALESCE(comprimento_ajustado, comprimento_dia)` e `COALESCE(ligacoes_ajustadas, ligacoes_dia)`;
  - filtrar `excluido IS NOT TRUE AND status <> 'cancelado'`.
- Trigger `tg_registros_producao_sync_os` permanece (já cobre INSERT/UPDATE/DELETE).
- Auditoria: ampliar `registros_producao_auditoria.acao` para aceitar `'ajuste'`, `'cancelamento'`, `'restauracao'` (texto livre — sem mudança de schema se já for text).
- RLS em `registros_producao`: nova policy de UPDATE para `sala_tecnica`/`gerencia` (ajuste/cancelar/restaurar). Encarregado mantém policy atual.
- `ordens_servico.real_validado` e `_real`: manter colunas como **cache**; não remover. `real_validado` deixa de ser usado pela aplicação (poderá ser depreciado depois).

## 6. Migração de dados
- Backfill: para cada OS, popular `comprimento_real`/`ligacoes_real` via `recompute_os_real_from_registros` com a nova lógica.
- Onde `real_validado=true` e o somatório dos registros ≠ valor validado: criar um registro de auditoria informativo e **não** alterar dados históricos automaticamente; sala técnica pode ajustar via UI nova.
- Nenhuma linha de `registros_producao` ou `registros_producao_auditoria` é apagada.

## 7. Riscos
- OS com `real_validado=true` cujo somatório atual diverge do valor validado: o "Executado" pode mudar após o deploy. Mitigar com relatório prévio das divergências e comunicar a sala técnica.
- Dashboards/Planilhão dependem hoje de `comprimento_real`; como continuamos populando esse cache, o impacto é nulo se o backfill rodar.
- Encarregado pode editar registros antigos que antes estavam congelados pela validação — comportamento desejado, mas precisa estar claro no texto da UI.

## 8. Implementação em etapas seguras
1. **Migração 1 (schema):** adicionar colunas de ajuste e `status` em `registros_producao`; ampliar policies para sala técnica; atualizar `recompute_os_real_from_registros` com a nova fórmula e filtros; backfill.
2. **Backend de leitura:** ajustar `realEfetivo`, exports e dashboards para ignorar `real_validado` (passam a confiar apenas no cache recomputado).
3. **UI sala técnica:** nova seção "Registros de Produção" em `OSDetailPage` com Ajustar / Cancelar / Restaurar e auditoria.
4. **UI encarregado:** remover bloqueio por `real_validado` em `MeusRegistrosEnviados`; tratar `status='cancelado'` como bloqueado para o encarregado.
5. **Limpeza:** esconder textos/badges de "validação técnica" remanescentes; manter colunas `real_validado/_real` no banco como cache até confirmar estabilidade.

Confirma este plano para eu executar a partir da Etapa 1?
