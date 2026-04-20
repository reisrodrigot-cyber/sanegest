-- Add material delivery confirmation fields to ordens_servico
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS material_entregue_em timestamp with time zone,
  ADD COLUMN IF NOT EXISTS material_entregue_por uuid;

-- Trigger function: when material is confirmed delivered, move VERMELHO -> LARANJA
CREATE OR REPLACE FUNCTION public.promote_os_on_material_entregue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only act when material_entregue_em transitions from NULL to a value
  IF NEW.material_entregue_em IS NOT NULL
     AND (OLD.material_entregue_em IS NULL OR OLD.material_entregue_em IS DISTINCT FROM NEW.material_entregue_em)
     AND NEW.status = 'VERMELHO' THEN
    NEW.status := 'LARANJA';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_promote_os_on_material_entregue ON public.ordens_servico;
CREATE TRIGGER trg_promote_os_on_material_entregue
BEFORE UPDATE ON public.ordens_servico
FOR EACH ROW
EXECUTE FUNCTION public.promote_os_on_material_entregue();