---
name: Permission rules per role
description: Edit/delete permissions - each role only edits what they filled
type: feature
---
## Regras de permissões

- **Sala Técnica**: Edita/exclui qualquer campo da OS. Único que exclui OS inteira.
- **Encarregado**: Edita/exclui apenas campos REAL que ele preencheu.
- **Almoxarifado**: Edita/exclui apenas registros de entrega que ele cadastrou.
- **Topógrafo**: Edita/exclui apenas estacas que ele registrou.
- **Gerência/Diretoria**: Somente leitura — não edita nem exclui nada.

## Implementation
- `src/lib/permissions.ts` — utility with permission checks
- UI-level guards hide/disable buttons based on role
- Auth via Supabase Auth (email/password + Google OAuth)
- Roles stored in `user_roles` table, fetched on login
- Users without role see "Aguardando Aprovação" page
