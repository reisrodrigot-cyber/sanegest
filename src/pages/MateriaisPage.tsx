import { AppLayout } from '@/components/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { useOrdensServico } from '@/hooks/useOrdensServico';
import { Loader2, Package, Plus, X, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
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

interface MaterialForm {
  descricao: string;
  quantidade: string;
  unidade: string;
  locked?: boolean;
}

interface MaterialDB {
  id: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  data_entrega: string;
}

const EMPTY_MATERIAL: MaterialForm = { descricao: '', quantidade: '', unidade: 'un' };

function getDefaultMateriais(os: OrdemServico): MaterialForm[] {
  if (os.dn != null) {
    const dnInt = Math.round(os.dn * 1000);
    return [{ descricao: `Tubo DN ${dnInt}`, quantidade: '', unidade: 'UND', locked: true }];
  }
  return [{ ...EMPTY_MATERIAL }];
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

const MateriaisPage = () => {
  const { user } = useAuth();
  const canDelete = user?.role === 'almoxarifado' || user?.role === 'sala_tecnica';
  const { ordens, loading } = useOrdensServico();
  const pendentes = ordens.filter(os => os.liberado);
  const [openId, setOpenId] = useState<string | null>(null);
  const [items, setItems] = useState<MaterialForm[]>([]);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [historico, setHistorico] = useState<Record<string, MaterialDB[]>>({});
  const [loadingHistorico, setLoadingHistorico] = useState(true);

  const fetchHistorico = useCallback(async () => {
    if (pendentes.length === 0) { setLoadingHistorico(false); return; }
    const ids = pendentes.map(os => os.id);
    const { data, error } = await supabase
      .from('materiais_entrega')
      .select('*')
      .in('os_id', ids)
      .order('created_at', { ascending: true });
    if (!error && data) {
      const grouped: Record<string, MaterialDB[]> = {};
      data.forEach((row: any) => {
        if (!grouped[row.os_id]) grouped[row.os_id] = [];
        grouped[row.os_id].push({
          id: row.id,
          descricao: row.descricao,
          quantidade: row.quantidade,
          unidade: row.unidade,
          data_entrega: row.data_entrega,
        });
      });
      setHistorico(grouped);
    }
    setLoadingHistorico(false);
  }, [pendentes.length]);

  useEffect(() => {
    if (!loading && pendentes.length > 0) fetchHistorico();
  }, [loading, pendentes.length]);

  const handleOpen = (osId: string) => {
    if (openId === osId) {
      setOpenId(null);
    } else {
      setOpenId(osId);
      const os = ordens.find(o => o.id === osId);
      const osHist = historico[osId] || [];
      const hasTubo = osHist.some(m => m.descricao.toLowerCase().startsWith('tubo dn'));
      const initial: MaterialForm[] = [];
      if (!hasTubo && os?.dn != null) {
        const dnInt = Math.round(os.dn * 1000);
        initial.push({ descricao: `Tubo DN ${dnInt}`, quantidade: '', unidade: 'UND', locked: true });
      }
      initial.push({ ...EMPTY_MATERIAL });
      setItems(initial);
    }
  };

  const toggleExpand = (osId: string) => {
    setExpandedId(prev => prev === osId ? null : osId);
  };

  const updateItem = (idx: number, field: keyof MaterialForm, value: string) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const addRow = () => setItems(prev => [...prev, { ...EMPTY_MATERIAL }]);

  const removeRow = (idx: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Confirmar exclusão desta entrega?')) return;
    const { error } = await supabase.from('materiais_entrega').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir: ' + error.message);
    } else {
      toast.success('Entrega excluída.');
      fetchHistorico();
    }
  };

  const handleSave = async () => {
    if (!openId) return;
    const valid = items.filter(m => m.descricao.trim() && Number(m.quantidade) > 0);
    if (valid.length === 0) {
      toast.error('Preencha descrição e quantidade (> 0) de pelo menos um item.');
      return;
    }
    setSaving(true);
    const rows = valid.map(m => ({
      os_id: openId,
      descricao: m.descricao.trim(),
      quantidade: Number(m.quantidade),
      unidade: m.unidade || 'un',
    }));
    const { error } = await supabase.from('materiais_entrega').insert(rows as any);
    if (error) {
      toast.error('Erro ao registrar: ' + error.message);
    } else {
      toast.success(`${rows.length} material(is) registrado(s)!`);
      setOpenId(null);
      setItems([]);
      fetchHistorico();
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
        {pendentes.map(os => {
          const osHistorico = historico[os.id] || [];
          return (
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

              {expandedId === os.id && (
                <div className="mt-3 pt-3 border-t border-border">
                  <h3 className="text-sm font-semibold text-foreground mb-2">Dados do Trecho</h3>
                  <OSDetail os={os} />
                </div>
              )}

              {/* Histórico de entregas */}
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Materiais Entregues</p>
                {loadingHistorico ? (
                  <Loader2 size={14} className="animate-spin text-muted-foreground" />
                ) : osHistorico.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum material registrado ainda.</p>
                ) : (
                  <div className="space-y-0">
                    <div className={`grid gap-2 pb-1 border-b border-border mb-1 ${canDelete ? 'grid-cols-[1fr_60px_60px_80px_32px]' : 'grid-cols-4'}`}>
                      <span className="text-xs font-semibold text-muted-foreground">Descrição</span>
                      <span className="text-xs font-semibold text-muted-foreground">Qtd</span>
                      <span className="text-xs font-semibold text-muted-foreground">Un.</span>
                      <span className="text-xs font-semibold text-muted-foreground">Data</span>
                      {canDelete && <span />}
                    </div>
                    {osHistorico.map(m => (
                      <div key={m.id} className={`grid gap-2 py-1 border-b border-border last:border-0 items-center ${canDelete ? 'grid-cols-[1fr_60px_60px_80px_32px]' : 'grid-cols-4'}`}>
                        <span className="text-xs text-foreground">{m.descricao}</span>
                        <span className="text-xs text-foreground">{m.quantidade}</span>
                        <span className="text-xs text-foreground">{m.unidade}</span>
                        <span className="text-xs text-foreground">{formatDate(m.data_entrega)}</span>
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(m.id)}
                            className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                            title="Excluir entrega"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

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
                  <p className="text-sm font-medium text-foreground">Nova Entrega:</p>
                  {items.map((m, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_100px_80px_32px] gap-2 items-end">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Descrição</label>
                        <input
                          value={m.descricao}
                          onChange={e => updateItem(idx, 'descricao', e.target.value)}
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
                          onChange={e => updateItem(idx, 'quantidade', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Un.</label>
                        {m.locked ? (
                          <input value={m.unidade} disabled className="w-full px-3 py-2 rounded-lg border border-input bg-muted text-foreground text-sm opacity-70" />
                        ) : (
                          <select
                            value={m.unidade}
                            onChange={e => updateItem(idx, 'unidade', e.target.value)}
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
                        className="p-2 text-muted-foreground hover:text-destructive disabled:opacity-30"
                        title="Remover"
                        disabled={items.length <= 1}
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
          );
        })}
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
