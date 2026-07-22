UPDATE public.ordens_servico
SET liberado = true,
    liberado_para = 'Encarregado 1',
    executor = 'Encarregado 1',
    status = 'VERMELHO'
WHERE id IN (
  SELECT id FROM public.ordens_servico
  WHERE status = 'CINZA'
  ORDER BY trecho
  LIMIT 5
);
