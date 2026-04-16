
-- Assign admin role to reisrodrigot@gmail.com
INSERT INTO public.user_roles (user_id, role)
VALUES ('df6d771e-60b7-462b-bf96-51e9bc724a5b', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Allow admins to insert roles
CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update roles
CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete roles
CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
