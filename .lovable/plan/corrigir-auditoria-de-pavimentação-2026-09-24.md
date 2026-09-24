# Corrigir auditoria de pavimentação

## Implementação
- Corrigir o gatilho de inclusão retroativa de pavimentação para usar a ação válida `lancamento_retroativo`, mantendo nos snapshots a identificação de que o evento pertence à pavimentação.
- Criar auditoria automática para alterações em `registros_pavimentacao`: usar `edicao` em mudanças operacionais e `exclusao` quando ocorrer a exclusão lógica.
- Preservar a constraint existente, os lançamentos atuais, as permissões e todos os demais módulos.
- Aplicar a alteração por migration, sem atualizar ou apagar registros existentes.

## Validação
- Confirmar no banco os valores aceitos pela constraint e a definição final dos gatilhos.
- Executar um teste transacional isolado de criar, editar e excluir logicamente um lançamento de pavimentação, validando as três entradas de auditoria e revertendo todos os dados do teste ao final.
- Confirmar que a aplicação continua compilando sem erros.

## Detalhes técnicos
- Ações válidas atuais: `edicao`, `exclusao`, `lancamento_retroativo`.
- Valor inválido atual: `pavimentacao_lancamento_retroativo`.
- O tipo do lançamento continuará explícito dentro de `valor_anterior` e `valor_novo`, sem ampliar a lista de ações permitidas.
