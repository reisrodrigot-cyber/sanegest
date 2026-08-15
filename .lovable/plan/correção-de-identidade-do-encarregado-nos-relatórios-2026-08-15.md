# Correção de identidade do encarregado nos relatórios

## Objetivo
Usar o ID estável do autor da produção como chave em todos os agrupamentos. Login, apelido e nome serão apenas rótulos de apresentação, impedindo tanto a duplicidade de Carlito quanto a união indevida de pessoas homônimas.

## Implementação

1. **Corrigir a fonte canônica do relatório diário**
   - Atualizar `relatorio_producao_diaria` para preservar `registros_producao.user_id` como `responsavel_user_id` e agregar por O.S. + data + usuário responsável.
   - Resolver `responsavel_nome` por `profiles.user_id`, com prioridade para `apelido`, depois `display_name` e e-mail.
   - Manter intactas as regras atuais de soma de rede, quantidade de ligações, comprimentos individuais e PV final.
   - Não alterar registros, perfis, contas, permissões, RLS ou histórico.

2. **Centralizar a resolução de identidade no frontend**
   - Evoluir o utilitário de encarregados para produzir uma identidade `{ id, nome }`, usando sempre o ID como chave e o perfil como rótulo.
   - Manter fallback controlado para fontes legadas sem ID, sem usar nome exibido para fundir contas diferentes.
   - Remover agrupamentos baseados diretamente em `responsavel_nome`, `encarregado`, login ou apelido.

3. **Aplicar a chave canônica em todos os consumidores**
   - Dashboard: produção e produtividade por encarregado, médias, cards e detalhamentos.
   - Relatório diário e Planilhão: consultas, consolidação, totais e nomes exibidos.
   - Exportações Excel/PDF e funções de consulta do relatório: consumir a mesma identidade canônica.
   - Preservar somas integrais de rede, ligações em unidades e metragem de ligações, sem descartar, sobrescrever ou duplicar lançamentos.

4. **Cobertura contra regressão**
   - Adicionar testes com duas grafias da mesma conta apontando para o mesmo ID: uma única linha “Carlito”, com totais somados.
   - Adicionar teste com duas contas distintas que tenham o mesmo nome exibido: identidades permanecem separadas.
   - Verificar que os totais gerais antes e depois da resolução de identidade são idênticos.

5. **Validação específica de 14/08/2026**
   - Consultar a fonte diária após a migração e confirmar que os quatro lançamentos do usuário de Carlito aparecem sob um único `responsavel_user_id` e rótulo “Carlito”.
   - Confirmar uma única seção/linha de Carlito no relatório, acumulando **16,00 m de rede, 4 ligações e 15,76 m de ligações**, sem alteração nos totais gerais do dia.
   - Validar a tela no preview e executar os testes relacionados.

## Detalhes técnicos
- A granularidade canônica será `responsavel_user_id`; o nome nunca será chave de agrupamento.
- Quando a mesma O.S. tiver lançamentos de usuários diferentes no mesmo dia, a fonte retornará uma linha por usuário, preservando autoria e quantitativos.
- Consumidores que consolidam por O.S. continuarão consolidando os quantitativos normalmente, mas manterão identidades distintas para exibição.
