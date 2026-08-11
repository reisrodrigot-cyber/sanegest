import { AppLayout } from '@/components/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { useOrdensServico } from '@/hooks/useOrdensServico';
import { Loader2, CheckCircle2, ChevronDown, ChevronUp, PackageCheck } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { OSDetalhesTrecho } from '@/components/OSDetalhesTrecho';

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
  // Mostrar apenas NS pendentes de material (status VERMELHO)
  const pendentes = ordens.filter(os => os.liberado && os.status === 'VERMELHO');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const { actingUserId } = useAuth();
  const [savingId, setSavingId] = useState<string | null>(null);
  const toggleExpand = (osId: string) => {
    setExpandedId(prev => prev === osId ? null : osId);
  };

  const handleConfirmEntrega = async (osId: string) => {
    setSavingId(osId);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('ordens_servico')
      .update({
        material_entregue_em: new Date().toISOString(),
        material_entregue_por: actingUserId ?? userData.user?.id ?? null,
      } as any)
      .eq('id', osId);
    if (error) {
      toast.error('Erro ao registrar entrega: ' + error.message);
    } else {
      toast.success('Material registrado como entregue!');
      setConfirmingId(null);
      await refetch();
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
        {pendentes.map(os => {
          const dataEntrega = (os as any).material_entregue_em as string | null | undefined;
          const isStatusVermelho = os.status === 'VERMELHO';
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
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    Encarregado: <span className="font-medium text-foreground">{os.executor || os.liberado_para || '—'}</span>
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
                  <OSDetalhesTrecho os={os} />
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-border">
                {isStatusVermelho ? (
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
                  dataEntrega && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 text-foreground text-sm">
                      <PackageCheck size={14} className="text-status-orange" />
                      <span>Material entregue em <strong>{formatDate(dataEntrega)}</strong></span>
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })}
        {pendentes.length === 0 && (
          <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">
            Nenhuma NS pendente de entrega de material.
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default MateriaisPage;
