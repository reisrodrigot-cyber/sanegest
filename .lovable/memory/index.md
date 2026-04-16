# Project Memory

## Core
SaneGest — sistema de gestão de obras de saneamento. Paleta: azuis #0C447C/#185FA5, cinzas #888780/#D3D1C7. Inter font. PT-BR only.
5 roles: gerencia, sala_tecnica, almoxarifado, encarregado, topografo. Status OS: VERMELHO→AMARELO→VERDE.
Lovable Cloud enabled (Supabase). Real Supabase Auth + Google OAuth. Roles in user_roles table.
Permissões: sala_tecnica edita tudo; encarregado só REAL; almoxarifado só materiais; topografo só estacas; gerencia read-only.

## Memories
- [Domain concepts](mem://features/domain) — Planilhão, NS, OS, Estacas, status lifecycle
- [Roles & permissions](mem://features/roles) — 5 user roles with distinct access levels
- [Permissions rules](mem://features/permissions) — Edit/delete rules per role
