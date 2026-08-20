# Saneamento em Obra

Crie um aplicativo web chamado SaneGest — um sistema de gestão e controle de produção física para obras de saneamento no Brasil.

---

## IDENTIDADE VISUAL

- Nome: SaneGest

- Tom: sóbrio, corporativo, profissional

- Paleta principal: azuis escuros (#0C447C, #185FA5) com suporte em cinzas neutros (#888780, #D3D1C7) e branco para superfícies

- Tipografia: limpa e legível, adequada para uso em campo e escritório

- Layout responsivo: funciona bem em desktop e celular

- Idioma: Português (Brasil) em toda a interface

---

## TECNOLOGIA

- Frontend: React + Tailwind CSS

- Backend / Auth / Banco de dados: Supabase

- Autenticação: login por e-mail e senha com controle de perfis (roles)

---

## CONCEITOS FUNDAMENTAIS DO DOMÍNIO

Antes de construir o app, entenda estes conceitos centrais:

**Planilhão:** Planilha Excel de controle local da obra. Cada linha representa um trecho de rede (uma Nota de Serviço / OS). Contém dois grupos de dados:

- Dados de projeto (previstos): valores planejados para cada trecho — comprimento, DN, profundidades, pavimento, prazo, etc.

- Dados reais (executados): valores medidos em campo após execução — comprimento real, profundidade real, pavimento real, ligações reais, etc.

**Nota de Serviço (NS):** Documento técnico de campo emitido pelo contratante que define um trecho de rede a ser executado. Contém um cabeçalho com dados gerais do trecho e uma tabela de estaqueamento com dados de cada estaca (pontos ao longo do trecho). No SaneGest, cada linha do Planilhão equivale a uma NS, que equivale a uma OS no app.

**Tabela de Estacas:** Parte da NS que detalha ponto a ponto o trecho a ser executado. Cada estaca possui: nome, coordenadas N/E, cota do terreno (CT), cota do coletor (CC), declividade (I), diâmetro (D), altura da régua ao fundo da vala (G), profundidade da vala (P), cota da régua (CR), valor R, altura da régua ao greide (H), e — quando aplicável — nome e tipo do Poço de Visita (PV/TIL/TL).

**OS (Ordem de Serviço):** Unidade de controle no app. 1 NS = 1 OS. Cada OS possui dados de cabeçalho (vindos do Planilhão) e uma tabela de estacas (preenchida manualmente pela Sala Técnica). Cada OS passa por um ciclo de vida com 3 status: Vermelho → Amarelo → Verde.

---

## PERFIS DE USUÁRIO (ROLES)

5 perfis com permissões distintas:

1. Gerência/Diretoria — somente leitura em todos os módulos

2. Sala Técnica — acesso total: importa Planilhão, cria/edita OS manualmente, gerencia tabela de estacas, valida produção, altera status

3. Almoxarifado — registra entrega de materiais nas OS

4. Encarregado — preenche produção diária nas OS atribuídas a ele

5. Topógrafo — registra coordenadas as-built nas OS validadas

---

## FLUXO PRINCIPAL DO APP (CICLO DE VIDA DA OS)

ETAPA 1 — IMPORTAÇÃO DO PLANILHÃO

O Planilhão é a fonte principal de criação de OS em lote. Importá-lo cria automaticamente todas as OS da obra de uma vez.

Padrão do Planilhão aceito:

- Arquivo .xlsx com aba chamada "PLANILHÃO"

- Cabeçalho na linha 18

- Dados a partir da linha 22

- Linha válida: qualquer linha com valor preenchido na coluna B (Trecho) iniciando com "TR-"

Mapeamento de colunas:

  Coluna B  — Trecho (código da OS, ex: TR-1.1)

  Coluna C  — Bacia

  Coluna D  — PV de Montante

  Coluna E  — PV de Jusante

  Coluna F  — Comprimento previsto (m)

  Coluna G  — Comprimento REAL (m)

  Coluna H  — Largura de Vala (m)

  Coluna I  — Prof. Média EXECUTADA (m)

  Coluna J  — Prof. Média prevista (m)

  Coluna K  — Prof. Média REAL (m)

  Coluna L  — DN (m)

  Coluna M  — Prof. Montante (m)

  Coluna N  — Prof. Jusante (m)

  Coluna O  — PAV (tipo de pavimento previsto)

  Coluna P  — PAV REAL

  Coluna Q  — Largura PAV prevista (m)

  Coluna R  — Largura PAV REAL (m)

  Coluna S  — PAV m² previsto

  Coluna T  — PAV REAL (m²)

  Coluna U  — Areia

  Coluna V  — Brita

  Coluna W  — Previsão de ligações por trecho

  Coluna X  — Ligações REAL por trecho

  Coluna Y  — Bomba de Rebaixo (SIM/NÃO)

  Coluna Z  — Prazo previsto (dias)

  Coluna AA — Prazo arredondado (dias)

  Coluna AB — BMs

Comportamento na importação:

- Cada linha válida gera uma OS no app com status inicial VERMELHO

- Todos os campos são importados e armazenados no banco

- OS já existentes com o mesmo código de Trecho são atualizadas, não duplicadas

- Os campos "REAL" ficam vazios até serem preenchidos em campo pelo Encarregado

- A tabela de estacas de cada OS começa vazia — é preenchida manualmente pela Sala Técnica após a importação

Tela de instruções antes do upload:

- Título: "Como importar o Planilhão"

- Aviso: o arquivo deve ter aba "PLANILHÃO", cabeçalho na linha 18 e dados a partir da linha 22

- Botão "Selecionar arquivo" e botão "Baixar modelo"

- Após upload: exibir prévia com número de OS identificadas e lista dos trechos encontrados

- Botão "Confirmar importação"

---

ETAPA 2 — GESTÃO DE OS (CRIAR / EDITAR / VISUALIZAR)

Além da importação em lote, a Sala Técnica pode:

- Criar uma OS manualmente

- Editar qualquer OS existente (importada ou criada manualmente)

- Visualizar o detalhe completo de qualquer OS

- Gerenciar a tabela de estacas de cada OS (adicionar, editar e remover estacas)

Cada OS contém dois níveis de dados:

NÍVEL 1 — Cabeçalho da OS (dados do Planilhão):

  Identificação: código da OS (Trecho), bacia, PV montante, PV jusante, executor

  Dados de projeto (previstos):

  - Comprimento (m), Largura de Vala, Prof. Média, DN

  - Prof. Montante e Prof. Jusante

  - Tipo de Pavimento, Largura PAV, PAV m²

  - Areia, Brita, Previsão de ligações, Bomba de Rebaixo, Prazo, BMs

  Dados reais (executados — preenchidos pelo Encarregado):

  - Comprimento REAL, Prof. Média REAL

  - PAV REAL, Largura PAV REAL, PAV REAL m²

  - Ligações REAL

  Status atual: VERMELHO / AMARELO / VERDE

  Histórico de alterações

NÍVEL 2 — Tabela de Estacas (dados da NS, preenchida manualmente):

  Cada estaca contém:

  - Nome da estaca (ex: 0+7,194)

  - Coordenada N (m)

  - Coordenada E (m)

  - CT — Cota do Terreno (m)

  - CC — Cota do Coletor (m)

  - I — Declividade (m/m)

  - D — Diâmetro (m)

  - G — Altura da régua ao fundo da vala (m)

  - P — Profundidade da vala (m)

  - CR — Cota da régua (m)

  - R (m)

  - H — Altura da régua ao greide da rua (m)

  - Nome do PV (ex: PV-01) — opcional

  - Tipo do PV (PV / TIL / TL) — opcional

  - Prof. do PV (m) — opcional

  A tabela de estacas é editável apenas pela Sala Técnica.

  Futuramente será preenchida por importação automática da NS em Excel.

Ao ser criada ou importada, a OS recebe status inicial: VERMELHO

---

ETAPA 3 — EXECUÇÃO EM CAMPO

3a. Almoxarifado:

- Visualiza as OS com status VERMELHO

- Registra os materiais entregues para cada OS

- Visualiza divergências sinalizadas pelo Encarregado e pode ajustar

3b. Encarregado:

- Visualiza apenas as OS atribuídas a ele

- Preenche os dados reais: Comprimento REAL, Prof. Média REAL, PAV REAL, Largura PAV REAL, PAV REAL m², Ligações REAL

- Pode sinalizar divergência de quantidade de material

---

ETAPA 4 — VALIDAÇÃO PELA SALA TÉCNICA

- Sala Técnica revisa os dados reais preenchidos pelo Encarregado

- Pode aprovar ou solicitar correção

- Após validação: status muda para AMARELO

---

ETAPA 5 — REGISTRO TOPOGRÁFICO (AS-BUILT)

- Topógrafo visualiza OS com status AMARELO

- Registra as coordenadas reais medidas em campo (as-built)

- Campos: latitude e longitude (ou coordenadas N/E no sistema UTM)

- Após salvar: status muda para VERDE automaticamente

---

## SISTEMA DE STATUS POR COR

Central na experiência do app — destacado em todas as listagens:

- VERMELHO: OS liberada, aguardando execução em campo

- AMARELO: produção validada pela Sala Técnica, aguardando topografia

- VERDE: OS concluída com registro topográfico as-built

---

## TELAS NECESSÁRIAS

**Login**

- Campos: e-mail e senha

- Redireciona para o dashboard do perfil após autenticação

**Dashboard (por perfil)**

- Cards de métricas: total de OS, OS por status, % de avanço físico geral

- Lista recente de OS com filtros por status, bacia e executor

- Gráfico simples de avanço (barras ou pizza por status)

**Módulo: Importação do Planilhão**

- Tela de instruções com botão de download do modelo

- Upload do arquivo .xlsx

- Prévia: número de OS identificadas e lista de trechos

- Confirmação e gravação no Supabase

**Módulo: Ordens de Serviço**

- Listagem com filtros por status, bacia, executor e período

- Criação manual de OS

- Tela de edição do cabeçalho da OS

- Tela de detalhe da OS com:

    - Cabeçalho completo (dados previstos e reais, visualmente distintos)

    - Tabela de estacas editável (adicionar / editar / remover estacas)

    - Histórico de alterações

**Módulo: Registro de Produção (Encarregado)**

- Lista das OS atribuídas, filtradas por status VERMELHO

- Formulário para preenchimento dos dados reais

- Botão para sinalizar divergência de material

**Módulo: Entrega de Materiais (Almoxarifado)**

- Lista de OS pendentes de entrega

- Formulário de registro de entrega por OS

- Visualização e resposta a divergências

**Módulo: Topografia**

- Lista de OS com status AMARELO

- Formulário de registro de coordenadas as-built

- Após salvar: status muda para VERDE automaticamente

**Módulo: Relatórios (Gerência/Diretoria)**

- Avanço físico consolidado da obra

- Comparativo: valores previstos vs. reais por trecho e bacia

- Filtros por período, bacia e status

---

## DADOS DE EXEMPLO (MOCK DATA)

Popular o banco com dados fictícios para demonstração:

- 1 obra: "SES Japaratinga TESTE"

- 10 OS (trechos TR-1.1 a TR-1.10, bacia SEDE SS-01, DN 0.15m)

- OS distribuídas: 4 vermelhas, 4 amarelas, 2 verdes

- Dados de projeto preenchidos (comprimentos entre 30m e 80m, profundidades entre 1,1m e 1,5m, pavimento "Solo Natural")

- Nas OS amarelas e verdes: dados reais preenchidos pelo encarregado

- Pelo menos 2 OS com tabela de estacas preenchida (mínimo 5 estacas cada, incluindo PV-01 e PV-02)

- 5 usuários, um por perfil

- Coordenadas as-built nas 2 OS verdes

---

## OBSERVAÇÕES FINAIS

- Toda a interface em Português (Brasil)

- App funcional de ponta a ponta com Supabase (auth + database)

- Priorizar clareza e facilidade de uso — operadores de campo têm pouca familiaridade com tecnologia

- O sistema de status por cores (vermelho / amarelo / verde) é o elemento visual mais importante — destacado em toda listagem de OS

- Campos previstos e reais devem ser visualmente distintos na tela de detalhe da OS

- A tabela de estacas é um sub-módulo dentro da tela de detalhe da OS — não uma tela separada

- A tabela de estacas será futuramente preenchida por importação automática da NS em Excel — o design deve prever essa evolução

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://sanegest.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/37f327a1-4428-4f0b-8749-e41fd3ed8378).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
