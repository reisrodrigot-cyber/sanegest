
CREATE POLICY "mapa-base read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'mapa-base' AND public.pode_gerenciar_mapa_base(auth.uid()));
CREATE POLICY "mapa-base insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mapa-base' AND public.pode_gerenciar_mapa_base(auth.uid()));
CREATE POLICY "mapa-base update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'mapa-base' AND public.pode_gerenciar_mapa_base(auth.uid()));
CREATE POLICY "mapa-base delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'mapa-base' AND public.pode_gerenciar_mapa_base(auth.uid()));
