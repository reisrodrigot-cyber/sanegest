import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Plus, Save, X, Package, Trash2 } from 'lucide-react';

interface MaterialEntrega {
  id: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  data_entrega: string;
}

interface NewItem {
  descricao: string;
  quantidade: string;
  unidade: string;
  locked?: boolean; // if true, descricao/unidade not editable
}

interface Props {
  osId: string;
  canEdit: boolean;
  dnValue?: number | null;
}

export const MateriaisEntreguesSection = ({ osId, canEdit, dnValue }: Props) => {
  const [materiais, setMateriais] = useState<MaterialEntrega[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<NewItem[]>([]);

  const dnLabel = dnValue != null ? `Tubo DN ${Math.round(dnValue * 1000)}` : null;

  const getDefaultItems = (): NewItem[] => {
    if (dnLabel) {
      return [{ descricao: dnLabel, quantidade: '', unidade: 'UND', locked: true }];
    }
    return [{ descricao: '', quantidade: '', unidade: 'un' }];
  };

  const fetchMateriais = async () => {
    const { data, error } = await supabase
      .from('materiais_entrega')
      .select('*')
      .eq('os_id', osId)
      .order('created_at', { ascending: true });
    if (!error) setMateriais(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchMateriais(); }, [osId]);

  const startAdding = () => {
    setItems(getDefaultItems());
    setAdding(true);
  };

  const addExtraItem = () => {
    setItems(prev => [...prev, { descricao: '', quantidade: '', unidade: 'un' }]);
  };

  const updateItem = (idx: number, field: keyof NewItem, value: string) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
    if (items.length <= 1) setAdding(false);
  };

  const handleSave = async () => {
    const validItems = items.filter(i => i.descricao.trim());
    if (validItems.length === 0) {
      toast.error('Informe a descrição de pelo menos um material.');
      return;
    }
    setSaving(true);
    const rows = validItems.map(i => ({
      os_id: osId,
      descricao: i.descricao.trim(),
      quantidade: Number(i.quantidade) || 0,
      unidade: i.unidade || 'un',
    }));
    const { error } = await supabase.from('materiais_entrega').insert(rows);
    if (error) {
      toast.error('Erro ao registrar: ' + error.message);
    } else {
      toast.success('Materiais registrados!');
      setItems([]);
      setAdding(false);
      fetchMateriais();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('materiais_entrega').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir: ' + error.message);
    } else {
      toast.success('Material excluído.');
      fetchMateriais();
    }
  };

  const handleUpdateField = async (id: string, field: string, value: string) => {
    const update: any = {};
    if (field === 'quantidade') {
      update.quantidade = Number(value) || 0;
    } else {
      update[field] = value;
    }
    const { error } = await supabase.from('materiais_entrega').update(update).eq('id', id);
    if (error) {
      toast.error('Erro ao atualizar: ' + error.message);
    } else {
      fetchMateriais();
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Package size={18} className="text-muted-foreground" />
          Materiais Entregues
        </h2>
        {canEdit && !adding && (
          <button
            onClick={startAdding}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium"
          >
            <Plus size={12} /> Registrar Entrega
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 size={18} className="animate-spin text-muted-foreground" />
        </div>
      ) : materiais.length === 0 && !adding ? (
        <p className="text-sm text-muted-foreground">Nenhum material registrado.</p>
      ) : (
        <>
          {materiais.length > 0 && (
            <div className="space-y-0">
              <div className={`grid ${canEdit ? 'grid-cols-4' : 'grid-cols-3'} gap-2 pb-1 border-b border-border mb-1`}>
                <span className="text-xs font-semibold text-muted-foreground uppercase">Descrição</span>
                <span className="text-xs font-semibold text-muted-foreground uppercase">Qtd</span>
                <span className="text-xs font-semibold text-muted-foreground uppercase">Unidade</span>
                {canEdit && <span className="text-xs font-semibold text-muted-foreground uppercase text-right">Ações</span>}
              </div>
              {materiais.map(m => (
                <div key={m.id} className={`grid ${canEdit ? 'grid-cols-4' : 'grid-cols-3'} gap-2 py-1.5 border-b border-border last:border-0 items-center`}>
                  <span className="text-sm text-foreground">{m.descricao}</span>
                  {canEdit ? (
                    <input
                      defaultValue={m.quantidade}
                      onBlur={e => handleUpdateField(m.id, 'quantidade', e.target.value)}
                      className="px-2 py-1 rounded border border-input bg-background text-foreground text-sm w-20"
                      type="number"
                    />
                  ) : (
                    <span className="text-sm text-foreground">{m.quantidade}</span>
                  )}
                  {canEdit ? (
                    <input
                      defaultValue={m.unidade}
                      onBlur={e => handleUpdateField(m.id, 'unidade', e.target.value)}
                      className="px-2 py-1 rounded border border-input bg-background text-foreground text-sm w-20"
                    />
                  ) : (
                    <span className="text-sm text-foreground">{m.unidade}</span>
                  )}
                  {canEdit && (
                    <div className="flex justify-end">
                      <button onClick={() => handleDelete(m.id)} className="text-destructive hover:text-destructive/80 p-1" title="Excluir">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {adding && (
        <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="space-y-2 pb-2 border-b border-border last:border-0">
              <div className="flex gap-2 items-center">
                <input
                  value={item.descricao}
                  onChange={e => updateItem(idx, 'descricao', e.target.value)}
                  placeholder="Descrição (ex: Tubo DN 150)"
                  disabled={item.locked}
                  className="px-2 py-1.5 rounded border border-input bg-background text-foreground text-sm flex-1 disabled:opacity-70 disabled:bg-muted"
                />
                {!item.locked && items.length > 1 && (
                  <button onClick={() => removeItem(idx)} className="text-destructive p-1">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  value={item.quantidade}
                  onChange={e => updateItem(idx, 'quantidade', e.target.value)}
                  placeholder="Qtd"
                  type="number"
                  className="px-2 py-1.5 rounded border border-input bg-background text-foreground text-sm w-24"
                />
                <input
                  value={item.unidade}
                  onChange={e => updateItem(idx, 'unidade', e.target.value)}
                  placeholder="Unidade"
                  disabled={item.locked}
                  className="px-2 py-1.5 rounded border border-input bg-background text-foreground text-sm w-20 disabled:opacity-70 disabled:bg-muted"
                />
              </div>
            </div>
          ))}

          <button
            onClick={addExtraItem}
            className="inline-flex items-center gap-1 text-xs text-primary font-medium"
          >
            <Plus size={12} /> Adicionar material
          </button>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Salvar
            </button>
            <button
              onClick={() => { setAdding(false); setItems([]); }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-foreground text-xs"
            >
              <X size={12} /> Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
