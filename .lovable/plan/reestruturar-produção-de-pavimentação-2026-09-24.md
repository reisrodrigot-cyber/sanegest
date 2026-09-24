# Reestruturar Produção de Pavimentação

## Objetivo
Transformar somente a aba “Produção de Pavimentação” em um painel operacional baseado na produção real, removendo comparações com área prevista e preservando dados, permissões, auditoria e os demais módulos.

## Implementação
- Substituir os indicadores atuais por: Produção ontem, Área executada no período, Produção diária média e Trechos finalizados.
- Aplicar um único filtro de período, iniciado nos últimos 30 dias, a todos os indicadores, gráficos e à tabela da aba.
- Criar gráficos consistentes com a aba de Rede e Ligações:
  - produção diária em m², incluindo dias sem lançamento com valor zero;
  - produção mensal em m², limitada aos últimos quatro meses e ao período selecionado;
  - produção por tipo de pavimento, com Asfalto e Paralelepípedo.
- Melhorar a tabela por encarregado com área, dias produtivos, trechos, média diária e última produção.
- Usar `responsavel_user_id` como identidade operacional, preservando corretamente lançamentos cujo autor foi a Sala Técnica.
- Contar finalizações pela marcação existente de conclusão e pela data efetiva da finalização, sem inferir pela metragem.
- Manter o layout compacto, responsivo e alinhado ao padrão visual atual do Dashboard.

## Fontes e regras técnicas
- Fonte principal: `relatorio_pavimentacao_diaria`, uma linha por lançamento ativo, para área, data, N.S. e responsável operacional.
- Fonte de conclusão: `os_pavimentacao_conclusao`, usando `concluido` e `concluido_em` para o período.
- Fonte do tipo: `ordens_servico`, usando o pavimento executado padronizado quando presente e o previsto como fallback, sem alterar os valores salvos.
- Evitar duplicidade agrupando diretamente os IDs únicos dos lançamentos da view e contando N.S. distintas somente onde o indicador exigir.

## Validação
- Conferir consistência da mesma soma de área entre indicador, gráfico diário, gráfico mensal, tipos e tabela no mesmo período.
- Validar filtros, período sem produção, dias zerados, Asfalto, Paralelepípedo e finalizações.
- Validar especificamente lançamentos feitos pela Sala Técnica com responsável operacional distinto.
- Conferir apresentação em desktop e celular, além da compilação sem erros.
- Ao final, informar as tabelas/views usadas e os resultados objetivos dos testes.
