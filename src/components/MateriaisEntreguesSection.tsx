import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Plus, Save, X, Package } from 'lucide-react';

interface MaterialEntrega {
  id: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  data_entrega: string;
}

interface Props {
  osId: string;
  canEdit: boolean;
}

export const MateriaisEntreguesSection = ({ osId, canEdit }: Props) => {
  const [materiais, setMateriais] = useState<MaterialEntrega[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newItem, setNewItem] = useState({ descricao: '', quantidade: '', unidade: 'un' });

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

  const handleSave = async () => {
    if (!newItem.descricao.trim()) {
      toast.error('Informe a descrição do material.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('materiais_entrega').insert({
      os_id: osId,
      descricao: newItem.descricao.trim(),
      quantidade: Number(newItem.quantidade) || 0,
      unidade: newItem.unidade || 'un',
    });
    if (error) {
      toast.error('Erro ao registrar: ' + error.message);
    } else {
      toast.success('Material registrado!');
      setNewItem({ descricao: '', quantidade: '', unidade: 'un' });
      setAdding(false);
      fetchMateriais();
    }
    setSaving(false);
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
            onClick={() => setAdding(true)}
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
              <div className="grid grid-cols-3 gap-2 pb-1 border-b border-border mb-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Descrição</span>
                <span className="text-xs font-semibold text-muted-foreground uppercase">Qtd</span>
                <span className="text-xs font-semibold text-muted-foreground uppercase">Unidade</span>
              </div>
              {materiais.map(m => (
                <div key={m.id} className="grid grid-cols-3 gap-2 py-1.5 border-b border-border last:border-0">
                  <span className="text-sm text-foreground">{m.descricao}</span>
                  <span className="text-sm text-foreground">{m.quantidade}</span>
                  <span className="text-sm text-foreground">{m.unidade}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {adding && (
        <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border space-y-2">
          <input
            value={newItem.descricao}
            onChange={e => setNewItem(p => ({ ...p, descricao: e.target.value }))}
            placeholder="Descrição (ex: Tubo DN 150)"
            className="px-2 py-1.5 rounded border border-input bg-background text-foreground text-sm w-full"
          />
          <div className="flex gap-2">
            <input
              value={newItem.quantidade}
              onChange={e => setNewItem(p => ({ ...p, quantidade: e.target.value }))}
              placeholder="Qtd"
              type="number"
              className="px-2 py-1.5 rounded border border-input bg-background text-foreground text-sm w-24"
            />
            <input
              value={newItem.unidade}
              onChange={e => setNewItem(p => ({ ...p, unidade: e.target.value }))}
              placeholder="Unidade"
              className="px-2 py-1.5 rounded border border-input bg-background text-foreground text-sm w-20"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Salvar
            </button>
            <button
              onClick={() => setAdding(false)}
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
