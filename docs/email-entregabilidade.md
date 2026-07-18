# Entregabilidade dos e-mails de autenticação — SaneGest

Enquanto o remetente padrão `auth.lovable.cloud` estiver em uso, alguns e-mails
(recuperação de senha, confirmação de cadastro, etc.) podem ser classificados
como spam por provedores externos (Gmail, Outlook, corporativos).

Para melhorar a entregabilidade em produção:

1. Configurar um **domínio de envio próprio** (ex.: `notify.sanegest.com.br`).
2. Adicionar registros **SPF**, **DKIM** e **DMARC** na zona DNS do domínio.
3. Vincular o domínio ao provedor SMTP / Supabase Auth utilizado pelo projeto.
4. Personalizar os templates de e-mail de autenticação em português com
   assunto, título, botão e rodapé conforme definido no fluxo do produto.

Após a verificação DNS do domínio, os e-mails passam a ser enviados a partir
do remetente próprio (`SaneGest — Gestão de Obras <no-reply@seu-dominio>`),
o que reduz drasticamente a marcação como spam.

## Conteúdo esperado do e-mail de recuperação (PT-BR)

- **Assunto:** Redefinição de senha — SaneGest
- **Remetente exibido:** SaneGest — Gestão de Obras
- **Título:** Redefina sua senha
- **Corpo:** Olá! Recebemos uma solicitação para redefinir a senha da sua
  conta no SaneGest. Clique no botão abaixo para criar uma nova senha.
- **Botão:** Criar nova senha (mantém o link seguro gerado pelo Supabase e
  redireciona para `/redefinir-senha`).
- **Aviso de segurança:** Por segurança, este link é temporário e só pode ser
  utilizado uma vez.
- **Rodapé:** Se você não solicitou a redefinição de senha, ignore este
  e-mail. Sua senha atual continuará protegida.

> A senha atual do usuário **nunca** é enviada por e-mail.
