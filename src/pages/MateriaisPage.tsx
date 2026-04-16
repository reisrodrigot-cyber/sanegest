import { AppLayout } from '@/components/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { useOrdensServico } from '@/hooks/useOrdensServico';
import { Loader2, CheckCircle2, ChevronDown, ChevronUp, PackageCheck } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { OrdemServico } from '@/types/sanegest';

function fmt(val: unknown): string {
  if (val == null) return '—';
  const n = Number(val);
  if (isNaN(n)) return String(val);
  return n.toFixed(2).replace(/\.?0+$/, '') || '0';
}

const DataRow = ({ label, previsto, real }: { label: string; previsto: unknown; real?: unknown }) => (
  <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-border last:border-0">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-xs font-medium text-foreground">{fmt(previsto)}</span>
    <span className={`text-xs font-medium ${real !== undefined && real !== null ? 'text-secondary' : 'text-muted-foreground'}`}>
      {fmt(real)}
    </span>
  </div>
);

const OSDetail = ({ os }: { os: OrdemServico }) => (
  <div className="mb-4">
    <div className="grid grid-cols-3 gap-2 pb-1.5 border-b-2 border-border mb-1">
      <span className="text-xs font-semibold text-muted-foreground uppercase">Campo</span>
      <span className="text-xs font-semibold text-foreground uppercase">Previsto</span>
      <span className="text-xs font-semibold text-secondary uppercase">Real</span>
    </div>
    <DataRow label="Comprimento (m)" previsto={os.comprimento_previsto} real={os.comprimento_real} />
    <DataRow label="Prof. Média (m)" previsto={os.prof_media_prevista} real={os.prof_media_real} />
    <DataRow label="DN (m)" previsto={os.dn} />
    <DataRow label="Largura Vala (m)" previsto={os.largura_vala} />
    <DataRow label="Prof. Montante (m)" previsto={os.prof_montante} />
    <DataRow label="Prof. Jusante (m)" previsto={os.prof_jusante} />
    <DataRow label="Pavimento" previsto={os.pav_previsto} real={os.pav_real} />
    <DataRow label="Largura PAV (m)" previsto={os.largura_pav_prevista} real={os.largura_pav_real} />
    <DataRow label="PAV (m²)" previsto={os.pav_m2_previsto} real={os.pav_m2_real} />
    <DataRow label="Ligações" previsto={os.ligacoes_previstas} real={os.ligacoes_real} />
    <DataRow label="Areia" previsto={os.areia} />
    <DataRow label="Brita" previsto={os.brita} />
    <DataRow label="Bomba Rebaixo" previsto={os.bomba_rebaixo ? 'SIM' : 'NÃO'} />
    <DataRow label="Prazo (dias)" previsto={os.prazo_previsto} />
    <DataRow label="BMs" previsto={os.bms} />
  </div>
);

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

const MateriaisPage = () => {
  const { ordens, loading, refetch } = useOrdensServico();
  // Mostrar todas as OS liberadas (independente do status)
  const liberadas = ordens.filter(os => os.liberado);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  // Mapa: os_id -> data ISO da entrega (transição VERMELHO -> LARANJA)
  const [entregas, setEntregas] = useState<Record<string, string>>({});
  const [loadingEntregas, setLoadingEntregas] = useState(true);

  const fetchEntregas = useCallback(async () => {
    if (liberadas.length === 0) { setLoadingEntregas(false); return; }
    const ids = liberadas.map(os => os.id);
    // Buscar a transição mais recente para LARANJA por OS
    const { data, error } = await supabase
      .from('os_status_historico')
      .select('os_id, status_novo, created_at')
      .in('os_id', ids)
      .eq('status_novo', 'LARANJA')
      .order('created_at', { ascending: false });
    if (!error && data) {
      const map: Record<string, string> = {};
      data.forEach((row: any) => {
        // mantém a mais recente (primeiro item por estar ordenado desc)
        if (!map[row.os_id]) map[row.os_id] = row.created_at;
      });
      setEntregas(map);
    }
    setLoadingEntregas(false);
  }, [liberadas.length]);

  useEffect(() => {
    if (!loading && liberadas.length > 0) fetchEntregas();
    else if (!loading) setLoadingEntregas(false);
  }, [loading, liberadas.length]);

  const toggleExpand = (osId: string) => {
    setExpandedId(prev => prev === osId ? null : osId);
  };

  const handleConfirmEntrega = async (osId: string) => {
    setSavingId(osId);
    const { error } = await supabase
      .from('ordens_servico')
      .update({ status: 'LARANJA' })
      .eq('id', osId);
    if (error) {
      toast.error('Erro ao registrar entrega: ' + error.message);
    } else {
      toast.success('Material registrado como entregue!');
      setConfirmingId(null);
      await refetch();
      await fetchEntregas();
    }
    setSavingId(null);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-foreground mb-1">Entrega de Materiais</h1>
      <p className="text-sm text-muted-foreground mb-6">Confirme a entrega de material para cada NS liberada</p>

      <div className="space-y-3">
        {liberadas.map(os => {
          const dataEntrega = entregas[os.id];
          const isVermelho = os.status === 'VERMELHO';
          const isConfirming = confirmingId === os.id;
          const isSaving = savingId === os.id;

          return (
            <div key={os.id} className="bg-card rounded-xl border border-border shadow-sm p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{os.trecho}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {os.bacia} • PV {os.pv_montante} → {os.pv_jusante}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={os.status} size="sm" />
                  <button
                    onClick={() => toggleExpand(os.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    title="Ver dados do trecho"
                  >
                    {expandedId === os.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {expandedId === os.id && (
                <div className="mt-3 pt-3 border-t border-border">
                  <h3 className="text-sm font-semibold text-foreground mb-2">Dados do Trecho</h3>
                  <OSDetail os={os} />
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-border">
                {isVermelho ? (
                  isConfirming ? (
                    <div className="space-y-2">
                      <p className="text-sm text-foreground">
                        Confirmar entrega de material para <strong>{os.trecho}</strong>?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleConfirmEntrega(os.id)}
                          disabled={isSaving}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
                        >
                          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                          Sim, confirmar
                        </button>
                        <button
                          onClick={() => setConfirmingId(null)}
                          disabled={isSaving}
                          className="px-3 py-1.5 rounded-lg border border-border text-foreground text-sm disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmingId(os.id)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
                    >
                      <CheckCircle2 size={14} />
                      Material Entregue
                    </button>
                  )
                ) : (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 text-foreground text-sm">
                    <PackageCheck size={14} className="text-status-orange" />
                    {loadingEntregas ? (
                      <Loader2 size={12} className="animate-spin text-muted-foreground" />
                    ) : dataEntrega ? (
                      <span>Material entregue em <strong>{formatDate(dataEntrega)}</strong></span>
                    ) : (
                      <span className="text-muted-foreground">Material já entregue</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {liberadas.length === 0 && (
          <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">
            Nenhuma NS liberada para entrega de materiais.
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default MateriaisPage;
