-- Limpeza de importações preliminares da SS-08 (v1 travada e v2 com paginação incompleta)
-- para que a próxima importação real seja a única base preview vigente.
DELETE FROM public.mapa_bases WHERE ss = 'SS-08';