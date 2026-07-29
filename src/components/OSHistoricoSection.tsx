import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChevronDown, ChevronRight, History, Loader2 } from 'lucide-react';
import { statusLabel } from '@/lib/osStatus';

interface Props {
  osId: string;
}

interface UserMap {
  [userId: string]: string;
}

interface ProducaoRow {
  id: string;
  data_registro: string;
  comprimento_dia: number;
  ligacoes_dia: number;
  user_id: string;
  created_at: string;
}

interface MaterialRow {
  id: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  data_entrega: string;
  registrado_por: string | null;
  created_at: string;
}

interface AsBuiltRow {
  id: string;
  nome_estaca: string | null;
  latitude: number | null;
  longitude: number | null;
  registrado_por: string | null;
  created_at: string;
}

interface StatusRow {
  id: string;
  status_anterior: string | null;
  status_novo: string;
  user_id: string | null;
  created_at: string;
}

const fmtDateTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return iso;
  }
};

const fmtDate = (d: string) => {
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
  } catch {
    return d;
  }
};

export const OSHistoricoSection = ({ osId }: Props) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [producao, setProducao] = useState<ProducaoRow[]>([]);
  const [materiais, setMateriais] = useState<MaterialRow[]>([]);
  const [estacas, setEstacas] = useState<AsBuiltRow[]>([]);
  const [statusHist, setStatusHist] = useState<StatusRow[]>([]);
  const [users, setUsers] = useState<UserMap>({});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [p, m, e, s] = await Promise.all([
        supabase
          .from('registros_producao')
          .select('id, data_registro, comprimento_dia, ligacoes_dia, user_id, created_at')
          .eq('excluido', false)
          .eq('os_id', osId)
          .order('data_registro', { ascending: false }),
        supabase
          .from('materiais_entrega')
          .select('id, descricao, quantidade, unidade, data_entrega, registrado_por, created_at')
          .eq('os_id', osId)
          .order('created_at', { ascending: false }),
        supabase
          .from('topografia_asbuilt')
          .select('id, nome_estaca, latitude, longitude, registrado_por, created_at')
          .eq('os_id', osId)
          .order('created_at', { ascending: false }),
        supabase
          .from('os_status_historico')
          .select('id, status_anterior, status_novo, user_id, created_at')
          .eq('os_id', osId)
          .order('created_at', { ascending: false }),
      ]);

      if (cancelled) return;

      const pData = p.data ?? [];
      const mData = m.data ?? [];
      const eData = e.data ?? [];
      const sData = s.data ?? [];

      // Resolve user names
      const ids = new Set<string>();
      pData.forEach((r) => r.user_id && ids.add(r.user_id));
      mData.forEach((r) => r.registrado_por && ids.add(r.registrado_por));
      eData.forEach((r) => r.registrado_por && ids.add(r.registrado_por));
      sData.forEach((r) => r.user_id && ids.add(r.user_id));

      let map: UserMap = {};
      if (ids.size > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, display_name, email, apelido')
          .in('user_id', Array.from(ids));
        (profs ?? []).forEach((pr) => {
          map[pr.user_id] = pr.apelido || pr.display_name || pr.email || pr.user_id.slice(0, 8);
        });
      }

      if (cancelled) return;
      setProducao(pData);
      setMateriais(mData);
      setEstacas(eData);
      setStatusHist(sData);
      setUsers(map);
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open, osId]);

  const userName = (id: string | null) => (id && users[id]) || '—';

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
      >
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <History size={18} className="text-muted-foreground" />
          Histórico
        </h2>
        {open ? (
          <ChevronDown size={18} className="text-muted-foreground" />
        ) : (
          <ChevronRight size={18} className="text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-6">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="animate-spin text-muted-foreground" size={20} />
            </div>
          ) : (
            <>
              {/* Status */}
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  Alterações de status ({statusHist.length})
                </h3>
                {statusHist.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum registro.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {statusHist.map((r) => (
                      <li key={r.id} className="text-muted-foreground">
                        <span className="text-foreground font-medium">
                          {r.status_anterior ? statusLabel(r.status_anterior) : '—'} → {statusLabel(r.status_novo)}
                        </span>{' '}
                        por {userName(r.user_id)} em {fmtDateTime(r.created_at)}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Produção */}
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  Registros de produção ({producao.length})
                </h3>
                {producao.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum registro.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-muted-foreground">
                          <th className="py-1 pr-3 font-medium">Data</th>
                          <th className="py-1 pr-3 font-medium">Encarregado</th>
                          <th className="py-1 pr-3 font-medium text-right">Rede (m)</th>
                          <th className="py-1 pr-3 font-medium text-right">Ligações (qtd)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {producao.map((r) => (
                          <tr key={r.id} className="border-b border-border/50">
                            <td className="py-1 pr-3 text-foreground">{fmtDate(r.data_registro)}</td>
                            <td className="py-1 pr-3 text-foreground">{userName(r.user_id)}</td>
                            <td className="py-1 pr-3 text-foreground text-right">{Number(r.comprimento_dia).toFixed(2)}</td>
                            <td className="py-1 pr-3 text-foreground text-right">{r.ligacoes_dia}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Materiais */}
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  Materiais entregues ({materiais.length})
                </h3>
                {materiais.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum registro.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {materiais.map((m) => (
                      <li key={m.id} className="text-muted-foreground">
                        <span className="text-foreground">{m.descricao}</span> — {m.quantidade} {m.unidade}, em{' '}
                        {fmtDate(m.data_entrega)} por {userName(m.registrado_por)}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Coordenadas */}
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  Coordenadas registradas ({estacas.length})
                </h3>
                {estacas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum registro.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {estacas.map((e) => (
                      <li key={e.id} className="text-muted-foreground">
                        <span className="text-foreground font-medium">{e.nome_estaca || '(sem nome)'}</span> —{' '}
                        {e.latitude?.toFixed(6) ?? '—'}, {e.longitude?.toFixed(6) ?? '—'}, por{' '}
                        {userName(e.registrado_por)} em {fmtDateTime(e.created_at)}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
};
