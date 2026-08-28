import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LiberacaoPav {
  os_id: string;
  liberado: boolean;
  liberado_para_user_id: string | null;
  liberado_em: string | null;
  revogado_em: string | null;
  motivo: string | null;
}

export interface ConclusaoPav {
  os_id: string;
  concluido: boolean;
  concluido_em: string | null;
}

/** Mapa os_id → liberação de pavimentação (para badges e ações na Sala Técnica). */
export function useLiberacoesPav() {
  return useQuery({
    queryKey: ['pav-liberacoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('os_liberacao_pavimentacao')
        .select('os_id, liberado, liberado_para_user_id, liberado_em, revogado_em, motivo');
      if (error) throw error;
      const map = new Map<string, LiberacaoPav>();
      (data ?? []).forEach((r) => map.set(r.os_id, r as LiberacaoPav));
      return map;
    },
  });
}

/** Mapa os_id → conclusão da pavimentação. */
export function useConclusoesPav() {
  return useQuery({
    queryKey: ['pav-conclusoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('os_pavimentacao_conclusao')
        .select('os_id, concluido, concluido_em');
      if (error) throw error;
      const map = new Map<string, ConclusaoPav>();
      (data ?? []).forEach((r) => map.set(r.os_id, r as ConclusaoPav));
      return map;
    },
  });
}

export function useInvalidatePav() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['pav-liberacoes'] });
    qc.invalidateQueries({ queryKey: ['pav-conclusoes'] });
    qc.invalidateQueries({ queryKey: ['pav-minhas-ns'] });
    qc.invalidateQueries({ queryKey: ['pav-registros'] });
    qc.invalidateQueries({ queryKey: ['pav-relatorio'] });
  };
}

export interface EncarregadoPavOption {
  user_id: string;
  nome: string;
}

/** Usuários com a role encarregado_pavimentacao. */
export function useEncarregadosPav() {
  return useQuery({
    queryKey: ['encarregados-pavimentacao'],
    queryFn: async (): Promise<EncarregadoPavOption[]> => {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'encarregado_pavimentacao');
      const ids = (roles ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, email, apelido')
        .in('user_id', ids);
      return (profiles ?? [])
        .map((p: any) => ({
          user_id: p.user_id,
          nome: p.apelido || p.display_name || p.email || 'Usuário',
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
    },
  });
}
