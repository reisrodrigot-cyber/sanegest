import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { OrdemServico, OSStatus, Estaca } from '@/types/sanegest';

// Map DB row to app type
function mapOS(row: any): OrdemServico {
  return {
    id: row.id,
    trecho: row.trecho,
    bacia: row.bacia ?? '',
    pv_montante: row.pv_montante ?? '',
    pv_jusante: row.pv_jusante ?? '',
    executor: row.executor ?? null,
    status: row.status as OSStatus,
    comprimento_previsto: row.comprimento_previsto != null ? Number(row.comprimento_previsto) : null,
    comprimento_real: row.comprimento_real != null ? Number(row.comprimento_real) : null,
    largura_vala: row.largura_vala != null ? Number(row.largura_vala) : null,
    prof_media_executada: row.prof_media_executada != null ? Number(row.prof_media_executada) : null,
    prof_media_prevista: row.prof_media_prevista != null ? Number(row.prof_media_prevista) : null,
    prof_media_real: row.prof_media_real != null ? Number(row.prof_media_real) : null,
    dn: row.dn != null ? Number(row.dn) : null,
    prof_montante: row.prof_montante != null ? Number(row.prof_montante) : null,
    prof_jusante: row.prof_jusante != null ? Number(row.prof_jusante) : null,
    pav_previsto: row.pav_previsto ?? null,
    pav_real: row.pav_real ?? null,
    largura_pav_prevista: row.largura_pav_prevista != null ? Number(row.largura_pav_prevista) : null,
    largura_pav_real: row.largura_pav_real != null ? Number(row.largura_pav_real) : null,
    pav_m2_previsto: row.pav_m2_previsto != null ? Number(row.pav_m2_previsto) : null,
    pav_m2_real: row.pav_m2_real != null ? Number(row.pav_m2_real) : null,
    areia: row.areia ?? null,
    areia_real: row.areia_real ?? null,
    brita: row.brita ?? null,
    brita_real: row.brita_real ?? null,
    ligacoes_previstas: row.ligacoes_previstas ?? null,
    ligacoes_real: row.ligacoes_real ?? null,
    bomba_rebaixo: row.bomba_rebaixo ?? false,
    prazo_previsto: row.prazo_previsto ?? null,
    prazo_arredondado: row.prazo_arredondado ?? null,
    prazo_real: row.prazo_real ?? null,
    bms: row.bms ?? null,
    bms_real: row.bms_real ?? null,
    dn_real: row.dn_real != null ? Number(row.dn_real) : null,
    largura_vala_real: row.largura_vala_real != null ? Number(row.largura_vala_real) : null,
    prof_montante_real: row.prof_montante_real != null ? Number(row.prof_montante_real) : null,
    prof_jusante_real: row.prof_jusante_real != null ? Number(row.prof_jusante_real) : null,
    executor_real: row.executor_real ?? null,
    liberado: row.liberado ?? false,
    liberado_para: row.liberado_para ?? null,
    as_built_lat: row.as_built_lat != null ? Number(row.as_built_lat) : null,
    as_built_lng: row.as_built_lng != null ? Number(row.as_built_lng) : null,
    real_validado: row.real_validado ?? false,
    real_validado_em: row.real_validado_em ?? null,
    real_validado_por: row.real_validado_por ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapEstaca(row: any): Estaca {
  return {
    id: row.id,
    os_id: row.os_id,
    nome: row.nome,
    coord_n: row.coord_n != null ? Number(row.coord_n) : null,
    coord_e: row.coord_e != null ? Number(row.coord_e) : null,
    ct: row.ct != null ? Number(row.ct) : null,
    cc: row.cc != null ? Number(row.cc) : null,
    declividade: row.declividade != null ? Number(row.declividade) : null,
    diametro: row.diametro != null ? Number(row.diametro) : null,
    g: row.g != null ? Number(row.g) : null,
    p: row.p != null ? Number(row.p) : null,
    cr: row.cr != null ? Number(row.cr) : null,
    r: row.r != null ? Number(row.r) : null,
    h: row.h != null ? Number(row.h) : null,
    pv_nome: row.pv_nome ?? null,
    pv_tipo: row.pv_tipo ?? null,
    pv_prof: row.pv_prof != null ? Number(row.pv_prof) : null,
  };
}

export function useOrdensServico() {
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrdens = async () => {
    setLoading(true);
    // Fetch all OS (handle >1000 rows with pagination)
    let allRows: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('ordens_servico')
        .select('*')
        .order('trecho', { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) {
        console.error('Error fetching OS:', error);
        break;
      }
      allRows = [...allRows, ...(data || [])];
      hasMore = (data?.length || 0) === pageSize;
      from += pageSize;
    }

    setOrdens(allRows.map(mapOS));
    setLoading(false);
  };

  useEffect(() => { fetchOrdens(); }, []);

  return { ordens, loading, refetch: fetchOrdens };
}

export function useOrdemServico(id: string | undefined) {
  const [os, setOs] = useState<OrdemServico | null>(null);
  const [estacas, setEstacas] = useState<Estaca[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) { setLoading(false); return; }

    const fetch = async () => {
      setLoading(true);
      const { data: osData, error: osError } = await supabase
        .from('ordens_servico')
        .select('*')
        .eq('id', id)
        .single();

      if (osError || !osData) {
        console.error('Error fetching OS:', osError);
        setLoading(false);
        return;
      }

      setOs(mapOS(osData));

      const { data: estacasData } = await supabase
        .from('estacas')
        .select('*')
        .eq('os_id', id)
        .order('nome', { ascending: true });

      setEstacas((estacasData || []).map(mapEstaca));
      setLoading(false);
    };

    fetch();
  }, [id]);

  return { os, estacas, loading };
}
