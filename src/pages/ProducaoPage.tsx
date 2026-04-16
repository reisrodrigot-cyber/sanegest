import { AppLayout } from '@/components/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrdensServico } from '@/hooks/useOrdensServico';
import { Loader2, Save, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { OrdemServico } from '@/types/sanegest';

const PAV_OPTIONS = [
  'Terreno Natural',
  'Asfalto',
  'Paralelo',
  'Terreno Natural e Asfalto',
  'Terreno Natural e Paralelo',
  'Asfalto e Paralelo',
  'Terreno Natural, Asfalto e Paralelo',
];

function fmt(val: unknown): string {
  if (val == null) return '—';
  const n = Number(val);
  if (isNaN(n)) return String(val);
  return n.toFixed(2).replace(/\.?0+$/, '') || '0';
}

interface RealFields {
  comprimento_real: string;
  prof_media_real: string;
  dn_real: string;
  largura_vala_real: string;
  prof_montante_real: string;
  prof_jusante_real: string;
  pav_real: string;
  largura_pav_real: string;
  pav_m2_real: string;
  ligacoes_real: string;
  areia_real: string;
  brita_real: string;
  prazo_real: string;
  bms_real: string;
  executor_real: string;
}

function initRealFields(os: OrdemServico): RealFields {
  return {
    comprimento_real: os.comprimento_real != null ? String(os.comprimento_real) : '',
    prof_media_real: os.prof_media_real != null ? String(os.prof_media_real) : '',
    dn_real: (os as any).dn_real != null ? String((os as any).dn_real) : '',
    largura_vala_real: (os as any).largura_vala_real != null ? String((os as any).largura_vala_real) : '',
    prof_montante_real: (os as any).prof_montante_real != null ? String((os as any).prof_montante_real) : '',
    prof_jusante_real: (os as any).prof_jusante_real != null ? String((os as any).prof_jusante_real) : '',
    pav_real: os.pav_real ?? '',
    largura_pav_real: os.largura_pav_real != null ? String(os.largura_pav_real) : '',
    pav_m2_real: os.pav_m2_real != null ? String(os.pav_m2_real) : '',
    ligacoes_real: os.ligacoes_real != null ? String(os.ligacoes_real) : '',
    areia_real: (os as any).areia_real ?? '',
    brita_real: (os as any).brita_real ?? '',
    prazo_real: (os as any).prazo_real != null ? String((os as any).prazo_real) : '',
    bms_real: (os as any).bms_real ?? '',
    executor_real: (os as any).executor_real ?? '',
  };
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

const SelectRow = ({ label, previsto, realValue, field, options, onChange }: {
  label: string;
  previsto: unknown;
  realValue: string;
  field: string;
  options: string[];
  onChange: (field: string, val: string) => void;
}) => (
  <div className="grid grid-cols-3 gap-2 py-2 border-b border-border last:border-0 items-center">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-medium text-foreground">{fmt(previsto)}</span>
    <select
      value={realValue}
      onChange={e => onChange(field, e.target.value)}
      className="px-2 py-1 rounded border border-input bg-background text-foreground text-sm w-full"
    >
      <option value="">— Selecione —</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

const ReadOnlyRow = ({ label, previsto, real }: { label: string; previsto: unknown; real?: unknown }) => (
  <div className="grid grid-cols-3 gap-2 py-2 border-b border-border last:border-0">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-medium text-foreground">{fmt(previsto)}</span>
    <span className="text-sm text-muted-foreground">{real != null ? fmt(real) : '—'}</span>
  </div>
);

const ProducaoPage = () => {
  const { user, effectiveRole } = useAuth();
  const { ordens, loading, refetch } = useOrdensServico();
  // Admin viewing as encarregado sees all liberadas; real encarregado sees only their own
  const minhasOS = ordens.filter(os => {
    if (!os.liberado) return false;
    if (user?.role === 'admin') return true; // Admin simulating sees all
    return os.liberado_para === user?.nome;
  });
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

  const handleSave = async (osId: string) => {
    if (!fields) return;
    setSaving(true);
    const toNum = (v: string) => v ? Number(v) : null;
    const toInt = (v: string) => v ? parseInt(v) : null;
    const update: any = {
      comprimento_real: toNum(fields.comprimento_real),
      prof_media_real: toNum(fields.prof_media_real),
      dn_real: toNum(fields.dn_real),
      largura_vala_real: toNum(fields.largura_vala_real),
      prof_montante_real: toNum(fields.prof_montante_real),
      prof_jusante_real: toNum(fields.prof_jusante_real),
      pav_real: fields.pav_real || null,
      largura_pav_real: toNum(fields.largura_pav_real),
      pav_m2_real: toNum(fields.pav_m2_real),
      ligacoes_real: toInt(fields.ligacoes_real),
      areia_real: fields.areia_real || null,
      brita_real: fields.brita_real || null,
      prazo_real: toInt(fields.prazo_real),
      bms_real: fields.bms_real || null,
      executor_real: fields.executor_real || null,
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
          {minhasOS.map(os => (
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
                    <DataRow label="DN (m)" previsto={os.dn} realValue={fields.dn_real} field="dn_real" onChange={updateField} />
                    <DataRow label="Largura Vala (m)" previsto={os.largura_vala} realValue={fields.largura_vala_real} field="largura_vala_real" onChange={updateField} />
                    <DataRow label="Prof. Montante (m)" previsto={os.prof_montante} realValue={fields.prof_montante_real} field="prof_montante_real" onChange={updateField} />
                    <DataRow label="Prof. Jusante (m)" previsto={os.prof_jusante} realValue={fields.prof_jusante_real} field="prof_jusante_real" onChange={updateField} />
                    <SelectRow label="Pavimento" previsto={os.pav_previsto} realValue={fields.pav_real} field="pav_real" options={PAV_OPTIONS} onChange={updateField} />
                    <DataRow label="Largura PAV (m)" previsto={os.largura_pav_prevista} realValue={fields.largura_pav_real} field="largura_pav_real" onChange={updateField} />
                    <DataRow label="PAV (m²)" previsto={os.pav_m2_previsto} realValue={fields.pav_m2_real} field="pav_m2_real" onChange={updateField} />
                    <DataRow label="Ligações" previsto={os.ligacoes_previstas} realValue={fields.ligacoes_real} field="ligacoes_real" onChange={updateField} />
                    <DataRow label="Areia" previsto={os.areia} realValue={fields.areia_real} field="areia_real" onChange={updateField} />
                    <DataRow label="Brita" previsto={os.brita} realValue={fields.brita_real} field="brita_real" onChange={updateField} />
                    <ReadOnlyRow label="Bomba Rebaixo" previsto={os.bomba_rebaixo ? 'SIM' : 'NÃO'} />
                    <DataRow label="Prazo (dias)" previsto={os.prazo_previsto} realValue={fields.prazo_real} field="prazo_real" onChange={updateField} />
                    <DataRow label="BMs" previsto={os.bms} realValue={fields.bms_real} field="bms_real" onChange={updateField} />
                    <DataRow label="Executor" previsto={os.executor} realValue={fields.executor_real} field="executor_real" onChange={updateField} />
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
          ))}
        </div>
      )}
    </AppLayout>
  );
};

export default ProducaoPage;
