import { AppLayout } from '@/components/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrdensServico } from '@/hooks/useOrdensServico';
import { Loader2, Save, MapPin, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { OrdemServico } from '@/types/sanegest';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface RegistroDia {
  id: string;
  data_registro: string;
  comprimento_dia: number;
  ligacoes_dia: number;
}

interface LigacaoRow {
  id: string;
  comprimento: number | null;
  referencia: string | null;
  latitude: number | null;
  longitude: number | null;
  data_topografia: string | null;
  registro_producao_id: string | null;
  created_at: string;
}

interface LigacaoNova {
  comprimento: string;
  referencia: string;
}

const fmt = (v: unknown) => {
  if (v == null) return '—';
  const n = Number(v);
  if (isNaN(n)) return String(v);
  return n.toFixed(2).replace(/\.?0+$/, '') || '0';
};

const ReadField = ({ label, value }: { label: string; value: unknown }) => (
  <div className="flex justify-between py-1.5 border-b border-border last:border-0 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-foreground font-medium">{fmt(value)}</span>
  </div>
);

const OSPanel = ({ os }: { os: OrdemServico }) => {
  const { user } = useAuth();
  const [registros, setRegistros] = useState<RegistroDia[]>([]);
  const [ligacoesAll, setLigacoesAll] = useState<LigacaoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [comprimento, setComprimento] = useState('');
  const [numLigacoes, setNumLigacoes] = useState('');
  const [ligacoes, setLigacoes] = useState<LigacaoNova[]>([]);
  const [saving, setSaving] = useState(false);
  const [popupRegistroId, setPopupRegistroId] = useState<string | null>(null);
  const [popupAcumOpen, setPopupAcumOpen] = useState(false);

  const fetchRegistros = useCallback(async () => {
    const [regRes, ligRes] = await Promise.all([
      supabase
        .from('registros_producao')
        .select('id, data_registro, comprimento_dia, ligacoes_dia')
        .eq('os_id', os.id)
        .eq('user_id', user?.id ?? '')
        .order('data_registro', { ascending: false }),
      supabase
        .from('ligacoes')
        .select('id, comprimento, referencia, latitude, longitude, data_topografia, registro_producao_id, created_at')
        .eq('os_id', os.id)
        .eq('encarregado_id', user?.id ?? '')
        .order('created_at', { ascending: true }),
    ]);
    setRegistros((regRes.data ?? []) as RegistroDia[]);
    setLigacoesAll((ligRes.data ?? []) as LigacaoRow[]);
    setLoading(false);
  }, [os.id, user?.id]);

  useEffect(() => {
    fetchRegistros();
  }, [fetchRegistros]);

  // Update ligacoes array when count changes
  useEffect(() => {
    const n = parseInt(numLigacoes) || 0;
    setLigacoes((prev) => {
      const next = [...prev];
      while (next.length < n) next.push({ comprimento: '', referencia: '' });
      while (next.length > n) next.pop();
      return next;
    });
  }, [numLigacoes]);

  const updateLigacao = (idx: number, field: keyof LigacaoNova, val: string) => {
    setLigacoes((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: val } : l)));
  };

  const acumComprimento = registros.reduce((s, r) => s + Number(r.comprimento_dia || 0), 0);
  const acumLigacoes = registros.reduce((s, r) => s + (r.ligacoes_dia || 0), 0);

  const handleSave = async () => {
    const compNum = parseFloat(comprimento) || 0;
    const ligNum = parseInt(numLigacoes) || 0;
    if (compNum <= 0 && ligNum <= 0) {
      toast.error('Informe comprimento ou ligações.');
      return;
    }
    if (!user) return;
    setSaving(true);

    const { data: reg, error: regErr } = await supabase
      .from('registros_producao')
      .insert({
        os_id: os.id,
        user_id: user.id,
        comprimento_dia: compNum,
        ligacoes_dia: ligNum,
      })
      .select('id')
      .single();

    if (regErr || !reg) {
      toast.error('Erro ao salvar registro: ' + (regErr?.message ?? ''));
      setSaving(false);
      return;
    }

    if (ligNum > 0) {
      const ligRows = ligacoes.map((l) => ({
        os_id: os.id,
        registro_producao_id: reg.id,
        encarregado_id: user.id,
        comprimento: l.comprimento ? Number(l.comprimento) : null,
        referencia: l.referencia.trim() || null,
      }));
      const { error: ligErr } = await supabase.from('ligacoes').insert(ligRows);
      if (ligErr) {
        toast.error('Registro salvo, mas erro nas ligações: ' + ligErr.message);
      }
    }

    // Atualiza acumulado na OS
    const novoAcumComp = acumComprimento + compNum;
    const novoAcumLig = acumLigacoes + ligNum;
    await supabase
      .from('ordens_servico')
      .update({ comprimento_real: novoAcumComp, ligacoes_real: novoAcumLig })
      .eq('id', os.id);

    toast.success('Produção do dia registrada!');
    setComprimento('');
    setNumLigacoes('');
    setLigacoes([]);
    fetchRegistros();
    setSaving(false);
  };

  return (
    <div className="mt-4 pt-4 border-t border-border space-y-5">
      {/* Dados da OS (read-only) */}
      <div className="bg-muted/30 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-foreground mb-2">Dados da OS</h3>
        <div className="grid md:grid-cols-2 gap-x-6">
          <ReadField label="Comprimento (m)" value={os.comprimento_previsto} />
          <ReadField label="DN (m)" value={os.dn} />
          <ReadField label="Prof. Média (m)" value={os.prof_media_prevista} />
          <ReadField label="Prof. Montante (m)" value={os.prof_montante} />
          <ReadField label="Prof. Jusante (m)" value={os.prof_jusante} />
          <ReadField label="Largura Vala (m)" value={os.largura_vala} />
          <ReadField label="Pavimento" value={os.pav_previsto} />
          <ReadField label="Ligações previstas" value={os.ligacoes_previstas} />
        </div>
      </div>

      {/* Acumulado */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Comprimento acumulado</p>
          <p className="text-xl font-bold text-foreground">
            {acumComprimento.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Ligações acumuladas</p>
          <p className="text-xl font-bold text-foreground">{acumLigacoes}</p>
        </div>
      </div>

      {/* Novo registro do dia */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Registro de hoje</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Comprimento do dia (m)</label>
            <Input
              type="number"
              step="any"
              value={comprimento}
              onChange={(e) => setComprimento(e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Ligações do dia</label>
            <Input
              type="number"
              min="0"
              value={numLigacoes}
              onChange={(e) => setNumLigacoes(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        {ligacoes.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Detalhes das ligações</p>
            {ligacoes.map((l, idx) => (
              <div key={idx} className="grid md:grid-cols-3 gap-2 items-center">
                <Input
                  type="number"
                  step="any"
                  placeholder="Comprimento (m)"
                  value={l.comprimento}
                  onChange={(e) => updateLigacao(idx, 'comprimento', e.target.value)}
                />
                <Input
                  placeholder="Referência (ex: Casa nº 47)"
                  value={l.referencia}
                  onChange={(e) => updateLigacao(idx, 'referencia', e.target.value)}
                />
                <div className="text-xs text-muted-foreground italic flex items-center gap-1">
                  <MapPin size={12} /> Coord. preenchida pelo Topógrafo
                </div>
              </div>
            ))}
          </div>
        )}

        <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
          {saving ? <Loader2 className="animate-spin mr-2" size={14} /> : <Save size={14} className="mr-2" />}
          Salvar registro do dia
        </Button>
      </div>

      {/* Histórico do encarregado */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">Meus registros ({registros.length})</h3>
        {loading ? (
          <Loader2 className="animate-spin text-muted-foreground" size={16} />
        ) : registros.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-1 font-medium">Data</th>
                <th className="py-1 font-medium text-right">Comp. (m)</th>
                <th className="py-1 font-medium text-right">Ligações</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="py-1 text-foreground">
                    {new Date(r.data_registro + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </td>
                  <td className="py-1 text-right text-foreground">{Number(r.comprimento_dia).toFixed(2)}</td>
                  <td className="py-1 text-right text-foreground">{r.ligacoes_dia}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const ProducaoPage = () => {
  const { user } = useAuth();
  const { ordens, loading } = useOrdensServico();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const minhasOS = ordens.filter((os) => {
    if (!os.liberado) return false;
    if (user?.role === 'admin') return true;
    return os.liberado_para === user?.nome;
  });

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
      <p className="text-sm text-muted-foreground mb-6">
        Registre a produção do dia em cada NS atribuída a você
      </p>

      {minhasOS.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">
          Nenhuma OS liberada para você no momento.
        </div>
      ) : (
        <div className="space-y-3">
          {minhasOS.map((os) => (
            <div key={os.id} className="bg-card rounded-xl border border-border shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{os.trecho}</p>
                  <p className="text-xs text-muted-foreground">
                    {os.bacia} • PV {os.pv_montante} → {os.pv_jusante} • {fmt(os.comprimento_previsto)}m previsto
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={os.status} size="sm" />
                  <button
                    onClick={() => setExpandedId(expandedId === os.id ? null : os.id)}
                    className="text-sm text-secondary hover:underline"
                  >
                    {expandedId === os.id ? 'Fechar' : 'Registrar Dia'}
                  </button>
                </div>
              </div>
              {expandedId === os.id && <OSPanel os={os} />}
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
};

export default ProducaoPage;
