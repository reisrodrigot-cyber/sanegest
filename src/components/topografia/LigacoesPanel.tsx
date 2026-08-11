import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, MapPin, Save, Check, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface LigacaoRow {
  id: string;
  os_id: string;
  comprimento: number | null;
  referencia: string | null;
  latitude: number | null;
  longitude: number | null;
  encarregado_id: string;
  topografo_id: string | null;
  data_topografia: string | null;
  created_at: string;
}

interface Props {
  osId?: string; // if provided, scoped to a single OS; otherwise global pending list
}

interface OSInfo {
  id: string;
  trecho: string;
  bacia: string;
}

export const LigacoesPanel = ({ osId }: Props) => {
  const { user, actingUserId } = useAuth();
  const [ligacoes, setLigacoes] = useState<LigacaoRow[]>([]);
  const [osMap, setOsMap] = useState<Record<string, OSInfo>>({});
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('ligacoes')
      .select('*')
      .order('created_at', { ascending: false });
    if (osId) q = q.eq('os_id', osId);
    const { data } = await q;
    const rows = (data ?? []) as LigacaoRow[];
    setLigacoes(rows);

    // Resolve OS info
    if (!osId) {
      const ids = Array.from(new Set(rows.map((r) => r.os_id)));
      if (ids.length > 0) {
        const { data: osData } = await supabase
          .from('ordens_servico')
          .select('id, trecho, bacia')
          .in('id', ids);
        const map: Record<string, OSInfo> = {};
        (osData ?? []).forEach((o) => (map[o.id] = o as OSInfo));
        setOsMap(map);
      }
    }
    setLoading(false);
  }, [osId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const startEdit = (l: LigacaoRow) => {
    setEditingId(l.id);
    setEditLat(l.latitude?.toString() ?? '');
    setEditLng(l.longitude?.toString() ?? '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditLat('');
    setEditLng('');
  };

  const saveCoords = async (id: string) => {
    const lat = parseFloat(editLat);
    const lng = parseFloat(editLng);
    if (isNaN(lat) || isNaN(lng)) {
      toast.error('Latitude e longitude obrigatórias.');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('ligacoes')
      .update({
        latitude: lat,
        longitude: lng,
        topografo_id: actingUserId ?? user?.id ?? null,
        data_topografia: new Date().toISOString(),
      })
      .eq('id', id);
    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
      return;
    }
    toast.success('Coordenadas salvas!');
    cancelEdit();
    fetchData();
  };

  const pendentes = ligacoes.filter((l) => l.latitude == null);
  const completas = ligacoes.filter((l) => l.latitude != null);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="animate-spin text-muted-foreground" size={20} />
      </div>
    );
  }

  const renderLigacao = (l: LigacaoRow) => {
    const osInfo = osMap[l.os_id];
    return (
      <div key={l.id} className="bg-card rounded-lg border border-border p-3 text-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {!osId && osInfo && (
              <p className="font-medium text-foreground">
                {osInfo.trecho} <span className="text-muted-foreground font-normal">• {osInfo.bacia}</span>
              </p>
            )}
            <p className="text-foreground">
              <MapPin size={12} className="inline mr-1 text-muted-foreground" />
              {l.referencia || '(sem referência)'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Comp.: {l.comprimento != null ? `${l.comprimento}m` : '—'} • Cadastrada em{' '}
              {new Date(l.created_at).toLocaleDateString('pt-BR')}
            </p>
          </div>
          {editingId !== l.id && l.latitude != null && (
            <button
              onClick={() => startEdit(l)}
              className="text-muted-foreground hover:text-foreground p-1"
              title="Editar"
            >
              <Pencil size={14} />
            </button>
          )}
        </div>

        {editingId === l.id ? (
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Input value={editLat} onChange={(e) => setEditLat(e.target.value)} placeholder="Latitude" type="number" step="any" className="h-8 text-sm" />
              <Input value={editLng} onChange={(e) => setEditLng(e.target.value)} placeholder="Longitude" type="number" step="any" className="h-8 text-sm" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => saveCoords(l.id)} disabled={saving}>
                {saving ? <Loader2 size={12} className="animate-spin mr-1" /> : <Check size={12} className="mr-1" />}
                Salvar
              </Button>
              <Button size="sm" variant="ghost" onClick={cancelEdit}>
                <X size={12} className="mr-1" /> Cancelar
              </Button>
            </div>
          </div>
        ) : l.latitude != null ? (
          <p className="text-xs text-status-green mt-2">
            ✓ {l.latitude.toFixed(6)}, {l.longitude!.toFixed(6)}
          </p>
        ) : (
          <Button size="sm" variant="outline" className="mt-3" onClick={() => startEdit(l)}>
            <Save size={12} className="mr-1" /> Registrar coordenadas
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-2">
          Pendentes de coordenada ({pendentes.length})
        </h3>
        {pendentes.length === 0 ? (
          <p className="text-sm text-muted-foreground bg-card rounded-lg border border-border p-4">
            Nenhuma ligação pendente.
          </p>
        ) : (
          <div className="space-y-2">{pendentes.map(renderLigacao)}</div>
        )}
      </section>

      {completas.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-2">
            Já com coordenada ({completas.length})
          </h3>
          <div className="space-y-2">{completas.map(renderLigacao)}</div>
        </section>
      )}
    </div>
  );
};
