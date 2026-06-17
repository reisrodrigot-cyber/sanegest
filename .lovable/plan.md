# Plano: Versionamento Base + Revisões por Trecho

## Objetivo
O mesmo botão de importação detecta automaticamente se a N.S./trecho é novidade (vira **Projeto Base**) ou já existe (cria **Rev.NN** e atualiza o dado vigente). O app continua usando apenas o vigente — nenhuma tela nova. A base histórica e revisões aparecem **apenas na exportação do Planilhão**.

## Chave de identificação
Continua a chave já usada hoje no importador: `Trecho + Bacia + PV Montante + PV Jusante` (case-insensitive). Se houver match → revisão; se não → base.

## Comportamento por importação

```text
para cada linha do .xlsx:
  chave = (trecho, bacia, pv_montante, pv_jusante)
  achou OS existente?
    NÃO → INSERT em ordens_servico (base) + INSERT em os_revisoes (versao=0, "Projeto Base")
    SIM → INSERT em os_revisoes (versao = max+1, "Rev.NN")
           + UPDATE em ordens_servico apenas dos campos PROJETADOS não-vazios
           (campo vazio = "sem alteração", nunca apaga vigente)
```

Campos REAIS, status, liberação, produção, materiais, topografia → **nunca tocados**.

## Marcação de remoção
Valores `SUPRIMIDO`, `RETIRADO`, `REMOVER`, `CANCELADO` em qualquer célula chave do trecho → cria revisão e marca `ordens_servico.status_vigencia = 'SUPRIMIDO'` (nova coluna). App pode filtrar/exibir badge depois — agora só preserva.

## Mudanças de banco
Migração única:

1. **Nova tabela `os_revisoes`**: guarda o snapshot completo dos 17 campos projetados a cada importação.
   - `id`, `os_id` (FK), `versao` (int, 0=base), `rotulo` ("Projeto Base" / "Rev.01"...), `imported_at`, `import_log_id` (FK opcional), todos os 17 campos projetados (mesmas colunas/tipos de `ordens_servico`), `created_at`.
   - Unique `(os_id, versao)`.
   - GRANTs + RLS: `authenticated` lê; insert via service_role (ou authenticated com role sala_tecnica/admin/gerencia).

2. **Nova coluna em `ordens_servico`**: `status_vigencia text default 'ATIVO'` (`ATIVO|SUPRIMIDO`).

3. **Backfill**: para cada OS já existente, criar uma linha `versao=0` em `os_revisoes` com os valores projetados atuais (rotulo "Projeto Base").

## Mudanças de código

### `src/pages/ImportarPage.tsx`
- Mantém o mesmo botão e o mesmo fluxo de análise prévia (NEW / UPDATE / UNCHANGED).
- No `handleConfirm`:
  - **NEW** → insert em `ordens_servico` (como hoje) + insert em `os_revisoes` (versao 0, "Projeto Base").
  - **UPDATE** → buscar `max(versao)` da OS, criar nova linha em `os_revisoes` (versao+1, "Rev.NN" zero-padded) com **snapshot completo dos novos valores projetados**; atualizar `ordens_servico` somente com campos não-vazios (vazio = sem alteração); se algum campo trouxer marcador de remoção → `status_vigencia='SUPRIMIDO'`.
- O texto explicativo do card "Como funciona" passa a mencionar: "Trechos novos viram Projeto Base; trechos existentes geram Rev.NN e atualizam o vigente. Base e revisões só aparecem na exportação do Planilhão."

### `src/lib/planilhaoExport.ts` + `supabase/functions/export-planilhao/index.ts`
- Carregar para cada OS todas as linhas de `os_revisoes` ordenadas por `versao`.
- Reestruturar layout: para cada um dos 17 campos projetados, gerar colunas `Campo - Projeto Base`, `Campo - Rev.01`, `Campo - Rev.02`, ... `Campo - Atual`. Número de colunas Rev cresce até o máximo de revisões existente na obra.
- Cabeçalho duplo: linha de grupo (nome do campo, mesclada) + linha de versão.
- Mantém metadado "Gerado em ...", autofilter, zoom 70%, bordas, paleta amarelo/azul/amarelo.
- Mesma estrutura para o download manual (`OrdensPage`) e para a edge function de backup.

## O que NÃO muda
- Nenhuma nova rota, tela, modal, ou botão.
- Dashboards, mapa, OS detail, encarregado: continuam lendo `ordens_servico` (vigente). Nada na UI muda.
- Status (VERMELHO/AMARELO/VERDE), liberação, produção, materiais, topografia, RLS dessas tabelas → intactos.
- Endpoint da edge function `/functions/v1/export-planilhao` e o token estático seguem iguais — só o XLSX gerado muda de layout.

## Ordem de execução
1. Migração: `os_revisoes` + `status_vigencia` + backfill versao 0.
2. Atualizar `ImportarPage.tsx` para gravar revisões.
3. Atualizar `planilhaoExport.ts` (manual) e `export-planilhao/index.ts` (cron) com o novo layout multi-versão.
4. Verificar build.

## Pontos abertos para o usuário confirmar
1. **Marcadores de remoção**: aceito a lista `SUPRIMIDO | RETIRADO | REMOVER | CANCELADO` em qualquer célula do trecho como sinal de supressão. OK?
2. **Layout do Planilhão exportado**: o modelo "colunas por versão" (Campo - Base, Campo - Rev.01, ..., Campo - Atual) é o desejado, em uma única aba `PLANILHÃO`. OK?
3. **Visibilidade do histórico no app**: confirmo que não devo expor nem badge "Rev.NN" nem painel de histórico em OS Detail nesta etapa — apenas preservar dados no banco. OK?
