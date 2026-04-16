import { AppLayout } from '@/components/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrdensServico } from '@/hooks/useOrdensServico';
import { Loader2, Save, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { OrdemServico } from '@/types/sanegest';

function fmt(val: unknown): string {
  if (val == null) return '—';
  const n = Number(val);
  if (isNaN(n)) return String(val);
  return n.toFixed(2).replace(/\.?0+$/, '') || '0';
}

function parsePavTypes(pav: string | null | undefined): string[] {
  if (!pav) return [];
  return pav.split('/').map(s => s.trim()).filter(Boolean);
}

interface RealFields {
  comprimento_real: string;
  prof_media_real: string;
  pav_real: string;
  largura_pav_real: string;
  pav_m2_real: string;
  ligacoes_real: string;
  [key: string]: string; // for dynamic pav extension fields
}

function initRealFields(os: OrdemServico): RealFields {
  const fields: RealFields = {
    comprimento_real: os.comprimento_real != null ? String(os.comprimento_real) : '',
    prof_media_real: os.prof_media_real != null ? String(os.prof_media_real) : '',
    pav_real: os.pav_real ?? '',
    largura_pav_real: os.largura_pav_real != null ? String(os.largura_pav_real) : '',
    pav_m2_real: os.pav_m2_real != null ? String(os.pav_m2_real) : '',
    ligacoes_real: os.ligacoes_real != null ? String(os.ligacoes_real) : '',
  };
  const pavTypes = parsePavTypes(os.pav_previsto);
  const extReal = (os as any).pav_extensoes_real || {};
  pavTypes.forEach(t => {
    fields[`pav_ext_real_${t}`] = extReal[t] != null ? String(extReal[t]) : '';
  });
  return fields;
}

const DataRow = ({ label, previsto, realValue, field, onChange }: {
  label: string;
  previsto: unknown;
  realValue: string;
  field: string;
  onChange: (field: string, val: string) => void;
}) => (
  <div className="grid grid-cols-3 gap-2 py-2 border-b border-border last:border-0 items-center">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-medium text-foreground">{fmt(previsto)}</span>
    <input
      value={realValue}
      onChange={e => onChange(field, e.target.value)}
      className="px-2 py-1 rounded border border-input bg-background text-foreground text-sm w-full"
      placeholder="—"
    />
  </div>
);

const ReadOnlyRow = ({ label, previsto }: { label: string; previsto: unknown }) => (
  <div className="grid grid-cols-3 gap-2 py-2 border-b border-border last:border-0">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-medium text-foreground">{fmt(previsto)}</span>
    <span className="text-sm text-muted-foreground">—</span>
  </div>
);

const ProducaoPage = () => {
  const { user } = useAuth();
  const { ordens, loading, refetch } = useOrdensServico();
  const minhasOS = ordens.filter(os =>
    os.liberado && os.liberado_para === user?.nome
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fields, setFields] = useState<RealFields | null>(null);
  const [saving, setSaving] = useState(false);

  const handleExpand = (os: OrdemServico) => {
    if (expandedId === os.id) {
      setExpandedId(null);
      setFields(null);
    } else {
      setExpandedId(os.id);
      setFields(initRealFields(os));
    }
  };

  const updateField = (field: string, val: string) => {
    setFields(prev => prev ? { ...prev, [field]: val } : prev);
  };

  const buildPavExtensoesFromFields = (f: RealFields) => {
    const ext: Record<string, number | null> = {};
    Object.entries(f).forEach(([k, v]) => {
      if (k.startsWith('pav_ext_real_')) {
        const type = k.replace('pav_ext_real_', '');
        ext[type] = v ? Number(v) : null;
      }
    });
    return Object.keys(ext).length > 0 ? ext : {};
  };

  const handleSave = async (osId: string) => {
    if (!fields) return;
    setSaving(true);
    const update: any = {
      comprimento_real: fields.comprimento_real ? Number(fields.comprimento_real) : null,
      prof_media_real: fields.prof_media_real ? Number(fields.prof_media_real) : null,
      pav_real: fields.pav_real || null,
      largura_pav_real: fields.largura_pav_real ? Number(fields.largura_pav_real) : null,
      pav_m2_real: fields.pav_m2_real ? Number(fields.pav_m2_real) : null,
      ligacoes_real: fields.ligacoes_real ? Number(fields.ligacoes_real) : null,
      pav_extensoes_real: buildPavExtensoesFromFields(fields),
    };
    const { error } = await supabase.from('ordens_servico').update(update).eq('id', osId);
    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
    } else {
      toast.success('Dados reais salvos com sucesso!');
      refetch();
    }
    setSaving(false);
  };

  const handleDivergencia = async (osId: string) => {
    toast.info('Divergência sinalizada para a Sala Técnica.');
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
      <h1 className="text-2xl font-bold text-foreground mb-1">Registro de Produção</h1>
      <p className="text-sm text-muted-foreground mb-6">Preencha os dados reais das OS atribuídas a você</p>

      {minhasOS.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">
          Nenhuma OS liberada para você no momento. A Sala Técnica precisa liberar as OS antes.
        </div>
      ) : (
        <div className="space-y-3">
          {minhasOS.map(os => {
            const pavTypesPrev = parsePavTypes(os.pav_previsto);
            const extPrev = (os as any).pav_extensoes_previsto || {};
            return (
              <div key={os.id} className="bg-card rounded-xl border border-border shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-foreground">{os.trecho}</p>
                    <p className="text-xs text-muted-foreground">
                      {os.bacia} • PV {os.pv_montante} → {os.pv_jusante} • {fmt(os.comprimento_previsto)}m previsto
                    </p>
                  </div>
                  <StatusBadge status={os.status} size="sm" />
                </div>
                <button
                  onClick={() => handleExpand(os)}
                  className="text-sm text-secondary hover:underline"
                >
                  {expandedId === os.id ? 'Fechar' : 'Registrar Produção'}
                </button>

                {expandedId === os.id && fields && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="bg-muted/30 rounded-lg p-4 mb-4">
                      <h3 className="text-sm font-semibold text-foreground mb-3">Dados do Trecho</h3>
                      <div className="grid grid-cols-3 gap-2 pb-2 border-b-2 border-border mb-1">
                        <span className="text-xs font-semibold text-muted-foreground uppercase">Campo</span>
                        <span className="text-xs font-semibold text-foreground uppercase">Previsto</span>
                        <span className="text-xs font-semibold text-secondary uppercase">Real (editável)</span>
                      </div>
                      <DataRow label="Comprimento (m)" previsto={os.comprimento_previsto} realValue={fields.comprimento_real} field="comprimento_real" onChange={updateField} />
                      <DataRow label="Prof. Média (m)" previsto={os.prof_media_prevista} realValue={fields.prof_media_real} field="prof_media_real" onChange={updateField} />
                      <ReadOnlyRow label="DN (m)" previsto={os.dn} />
                      <ReadOnlyRow label="Largura Vala (m)" previsto={os.largura_vala} />
                      <ReadOnlyRow label="Prof. Montante (m)" previsto={os.prof_montante} />
                      <ReadOnlyRow label="Prof. Jusante (m)" previsto={os.prof_jusante} />
                      <DataRow label="Pavimento" previsto={os.pav_previsto} realValue={fields.pav_real} field="pav_real" onChange={updateField} />
                      {/* Per-type pav extensions */}
                      {pavTypesPrev.map(t => (
                        <DataRow
                          key={`pav_ext_${t}`}
                          label={`  ↳ ${t} (m)`}
                          previsto={extPrev[t]}
                          realValue={fields[`pav_ext_real_${t}`] || ''}
                          field={`pav_ext_real_${t}`}
                          onChange={updateField}
                        />
                      ))}
                      <DataRow label="Largura PAV (m)" previsto={os.largura_pav_prevista} realValue={fields.largura_pav_real} field="largura_pav_real" onChange={updateField} />
                      <DataRow label="PAV (m²)" previsto={os.pav_m2_previsto} realValue={fields.pav_m2_real} field="pav_m2_real" onChange={updateField} />
                      <DataRow label="Ligações" previsto={os.ligacoes_previstas} realValue={fields.ligacoes_real} field="ligacoes_real" onChange={updateField} />
                      <ReadOnlyRow label="Areia" previsto={os.areia} />
                      <ReadOnlyRow label="Brita" previsto={os.brita} />
                      <ReadOnlyRow label="Bomba Rebaixo" previsto={os.bomba_rebaixo ? 'SIM' : 'NÃO'} />
                      <ReadOnlyRow label="Prazo (dias)" previsto={os.prazo_previsto} />
                      <ReadOnlyRow label="BMs" previsto={os.bms} />
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => handleSave(os.id)}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
                      >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Salvar
                      </button>
                      <button
                        onClick={() => handleDivergencia(os.id)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-destructive text-destructive text-sm font-medium"
                      >
                        <AlertTriangle size={14} />
                        Sinalizar Divergência
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
};

export default ProducaoPage;
