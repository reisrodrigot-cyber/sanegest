INSERT INTO public.user_roles (user_id, role) VALUES
('e1ac42b2-0803-4808-9801-b5b2e42a45bb', 'encarregado'),
('86554de5-d7ae-4075-93d4-438640ba657a', 'encarregado'),
('1fa40579-90ac-405d-bc7a-22a0561db538', 'encarregado')
ON CONFLICT (user_id, role) DO NOTHING;
