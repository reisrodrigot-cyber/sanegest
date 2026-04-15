export type OSStatus = 'VERMELHO' | 'AMARELO' | 'VERDE';

export type UserRole = 'gerencia' | 'sala_tecnica' | 'almoxarifado' | 'encarregado' | 'topografo';

export const ROLE_LABELS: Record<UserRole, string> = {
  gerencia: 'Gerência / Diretoria',
  sala_tecnica: 'Sala Técnica',
  almoxarifado: 'Almoxarifado',
  encarregado: 'Encarregado',
  topografo: 'Topógrafo',
};

export interface Estaca {
  id: string;
  os_id: string;
  nome: string;
  coord_n: number | null;
  coord_e: number | null;
  ct: number | null;
  cc: number | null;
  declividade: number | null;
  diametro: number | null;
  g: number | null;
  p: number | null;
  cr: number | null;
  r: number | null;
  h: number | null;
  pv_nome: string | null;
  pv_tipo: 'PV' | 'TIL' | 'TL' | null;
  pv_prof: number | null;
}

export interface OrdemServico {
  id: string;
  trecho: string;
  bacia: string;
  pv_montante: string;
  pv_jusante: string;
  executor: string | null;
  status: OSStatus;
  
  // Dados previstos
  comprimento_previsto: number | null;
  comprimento_real: number | null;
  largura_vala: number | null;
  prof_media_executada: number | null;
  prof_media_prevista: number | null;
  prof_media_real: number | null;
  dn: number | null;
  prof_montante: number | null;
  prof_jusante: number | null;
  pav_previsto: string | null;
  pav_real: string | null;
  largura_pav_prevista: number | null;
  largura_pav_real: number | null;
  pav_m2_previsto: number | null;
  pav_m2_real: number | null;
  areia: string | null;
  brita: string | null;
  ligacoes_previstas: number | null;
  ligacoes_real: number | null;
  bomba_rebaixo: boolean;
  prazo_previsto: number | null;
  prazo_arredondado: number | null;
  bms: string | null;
  liberado: boolean;
  liberado_para: string | null;
  // As-built
  as_built_lat: number | null;
  as_built_lng: number | null;

  created_at: string;
  updated_at: string;
  
  estacas?: Estaca[];
}

export interface MaterialEntrega {
  id: string;
  os_id: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  data_entrega: string;
  divergencia: boolean;
  obs_divergencia: string | null;
}
