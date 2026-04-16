import { AppLayout } from '@/components/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { useOrdensServico } from '@/hooks/useOrdensServico';
import { Loader2, Package, Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
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

interface MaterialForm {
  descricao: string;
  quantidade: string;
  unidade: string;
  locked?: boolean;
}

const EMPTY_MATERIAL: MaterialForm = { descricao: '', quantidade: '', unidade: 'un' };

function getDefaultMateriais(os: OrdemServico): MaterialForm[] {
  if (os.dn != null) {
    const dnInt = Math.round(os.dn * 1000);
    return [{ descricao: `Tubo DN ${dnInt}`, quantidade: '', unidade: 'UND', locked: true }];
  }
  return [{ ...EMPTY_MATERIAL }];
}

const MateriaisPage = () => {
  const { ordens, loading } = useOrdensServico();
  const pendentes = ordens.filter(os => os.liberado);
  const [openId, setOpenId] = useState<string | null>(null);
  const [materiais, setMateriais] = useState<MaterialForm[]>([{ ...EMPTY_MATERIAL }]);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleOpen = (osId: string) => {
    if (openId === osId) {
      setOpenId(null);
    } else {
      setOpenId(osId);
      const os = ordens.find(o => o.id === osId);
      setMateriais(os ? getDefaultMateriais(os) : [{ ...EMPTY_MATERIAL }]);
    }
  };

  const toggleExpand = (osId: string) => {
    setExpandedId(prev => prev === osId ? null : osId);
  };

  const addRow = () => setMateriais(prev => [...prev, { ...EMPTY_MATERIAL }]);

  const removeRow = (idx: number) => {
    if (materiais.length <= 1) return;
    setMateriais(prev => prev.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, field: keyof MaterialForm, value: string) => {
    setMateriais(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  };

  const handleSave = async () => {
    if (!openId) return;
    const valid = materiais.filter(m => m.descricao.trim());
    if (valid.length === 0) {
      toast.error('Preencha ao menos um material');
      return;
    }
    setSaving(true);
    const rows = valid.map(m => ({
      os_id: openId,
      descricao: m.descricao.trim(),
      quantidade: Number(m.quantidade) || 0,
      unidade: m.unidade || 'un',
    }));
    const { error } = await supabase.from('materiais_entrega').insert(rows as any);
    if (error) {
      toast.error('Erro ao registrar: ' + error.message);
    } else {
      toast.success(`${rows.length} material(is) registrado(s)!`);
      setOpenId(null);
      setMateriais([{ ...EMPTY_MATERIAL }]);
    }
    setSaving(false);
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
      <p className="text-sm text-muted-foreground mb-6">Registre os materiais entregues para cada OS</p>

      <div className="space-y-3">
        {pendentes.map(os => (
          <div key={os.id} className="bg-card rounded-xl border border-border shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">{os.trecho}</p>
                <p className="text-xs text-muted-foreground">
                  {os.bacia} • PV {os.pv_montante} → {os.pv_jusante}
                </p>
              </div>
              <div className="flex items-center gap-2">
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

            {/* Dados do trecho expandidos */}
            {expandedId === os.id && (
              <div className="mt-3 pt-3 border-t border-border">
                <h3 className="text-sm font-semibold text-foreground mb-2">Dados do Trecho</h3>
                <OSDetail os={os} />
              </div>
            )}

            <div className="mt-3">
              <button
                onClick={() => handleOpen(os.id)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
              >
                <Package size={14} />
                {openId === os.id ? 'Fechar' : 'Registrar Entrega'}
              </button>
            </div>

            {openId === os.id && (
              <div className="mt-4 pt-4 border-t border-border space-y-3">
                <p className="text-sm font-medium text-foreground">Materiais Entregues:</p>
                {materiais.map((m, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_100px_80px_32px] gap-2 items-end">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Descrição</label>
                      <input
                        value={m.descricao}
                        onChange={e => updateRow(idx, 'descricao', e.target.value)}
                        placeholder="Ex: Areia média, Tubo 150mm..."
                        disabled={m.locked}
                        className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm disabled:opacity-70 disabled:bg-muted"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Qtd</label>
                      <input
                        type="number"
                        value={m.quantidade}
                        onChange={e => updateRow(idx, 'quantidade', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Un.</label>
                      {m.locked ? (
                        <input
                          value={m.unidade}
                          disabled
                          className="w-full px-3 py-2 rounded-lg border border-input bg-muted text-foreground text-sm opacity-70"
                        />
                      ) : (
                        <select
                          value={m.unidade}
                          onChange={e => updateRow(idx, 'unidade', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm"
                        >
                          <option value="un">un</option>
                          <option value="m">m</option>
                          <option value="m²">m²</option>
                          <option value="m³">m³</option>
                          <option value="kg">kg</option>
                          <option value="t">t</option>
                        </select>
                      )}
                    </div>
                    <button
                      onClick={() => removeRow(idx)}
                      className="p-2 text-muted-foreground hover:text-destructive"
                      title="Remover"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addRow}
                  className="inline-flex items-center gap-1 text-sm text-secondary hover:underline"
                >
                  <Plus size={14} /> Adicionar material
                </button>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
                  >
                    {saving && <Loader2 size={14} className="animate-spin" />}
                    Salvar Entrega
                  </button>
                  <button
                    onClick={() => setOpenId(null)}
                    className="px-4 py-2 rounded-lg border border-border text-foreground text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {pendentes.length === 0 && (
          <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">
            Nenhuma OS pendente de entrega de materiais.
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default MateriaisPage;
