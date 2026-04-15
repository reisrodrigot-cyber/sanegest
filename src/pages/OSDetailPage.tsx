import { useParams, Link } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { ArrowLeft, Loader2, Send } from 'lucide-react';
import { useOrdemServico } from '@/hooks/useOrdensServico';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MOCK_USERS } from '@/data/mockData';

function fmt(val: unknown): string {
  if (val == null) return '—';
  const n = Number(val);
  if (isNaN(n)) return String(val);
  return n.toFixed(2).replace(/\.?0+$/, '') || '0';
}

const DataRow = ({ label, previsto, real }: { label: string; previsto: unknown; real?: unknown }) => (
  <div className="grid grid-cols-3 gap-2 py-2 border-b border-border last:border-0">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-medium text-foreground">{fmt(previsto)}</span>
    <span className={`text-sm font-medium ${real !== undefined && real !== null ? 'text-secondary' : 'text-muted-foreground'}`}>
      {fmt(real)}
    </span>
  </div>
);

const OSDetailPage = () => {
  const { id } = useParams();
  const { os, estacas, loading } = useOrdemServico(id);
  const { user } = useAuth();
  const [liberando, setLiberando] = useState(false);
  const [selectedEncarregado, setSelectedEncarregado] = useState('');

  const encarregados = MOCK_USERS.filter(u => u.role === 'encarregado');
  const isSalaTecnica = user?.role === 'sala_tecnica';

  const handleLiberar = async () => {
    if (!os || !selectedEncarregado) return;
    setLiberando(true);
    const { error } = await supabase
      .from('ordens_servico')
      .update({ liberado: true, liberado_para: selectedEncarregado } as any)
      .eq('id', os.id);
    if (error) {
      toast.error('Erro ao liberar OS: ' + error.message);
    } else {
      toast.success('OS liberada para o encarregado!');
      window.location.reload();
    }
    setLiberando(false);
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

  if (!os) {
    return (
      <AppLayout>
        <p className="text-muted-foreground">OS não encontrada.</p>
        <Link to="/ordens" className="text-secondary hover:underline">Voltar</Link>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <Link to="/ordens" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft size={16} /> Voltar
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">{os.trecho}</h1>
          <StatusBadge status={os.status} />
          {os.liberado && (
            <span className="text-xs px-2 py-1 rounded-full bg-status-green/20 text-status-green font-medium">
              Liberada para {os.liberado_para}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">{os.bacia} • PV {os.pv_montante} → {os.pv_jusante}</p>
      </div>

      {/* Liberação pela Sala Técnica */}
      {isSalaTecnica && !os.liberado && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-4 mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Send size={16} className="text-primary" />
            Liberar OS para Encarregado
          </h3>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Selecionar Encarregado</label>
              <select
                value={selectedEncarregado}
                onChange={e => setSelectedEncarregado(e.target.value)}
                className="px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm min-w-[200px]"
              >
                <option value="">— Selecione —</option>
                {encarregados.map(e => (
                  <option key={e.id} value={e.nome}>{e.nome}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleLiberar}
              disabled={!selectedEncarregado || liberando}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              {liberando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Liberar
            </button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border shadow-sm p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Dados do Trecho</h2>
          <div className="grid grid-cols-3 gap-2 pb-2 border-b-2 border-border mb-1">
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

        <div className="space-y-6">
          {os.executor && (
            <div className="bg-card rounded-xl border border-border shadow-sm p-6">
              <h2 className="text-lg font-semibold text-foreground mb-2">Executor</h2>
              <p className="text-foreground">{os.executor}</p>
            </div>
          )}

          {os.as_built_lat && (
            <div className="bg-card rounded-xl border border-border shadow-sm p-6">
              <h2 className="text-lg font-semibold text-foreground mb-2">Coordenadas As-Built</h2>
              <p className="text-sm text-foreground">Lat: {fmt(os.as_built_lat)}</p>
              <p className="text-sm text-foreground">Lng: {fmt(os.as_built_lng)}</p>
            </div>
          )}
        </div>
      </div>

      {estacas.length > 0 && (
        <div className="mt-6 bg-card rounded-xl border border-border shadow-sm p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Tabela de Estacas</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-border bg-muted/30">
                  {['Estaca', 'N', 'E', 'CT', 'CC', 'I', 'D', 'G', 'P', 'CR', 'R', 'H', 'PV', 'Tipo', 'Prof. PV'].map(h => (
                    <th key={h} className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {estacas.map(e => (
                  <tr key={e.id} className="border-b border-border hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{e.nome}</td>
                    <td className="px-3 py-2 text-foreground">{fmt(e.coord_n)}</td>
                    <td className="px-3 py-2 text-foreground">{fmt(e.coord_e)}</td>
                    <td className="px-3 py-2 text-foreground">{fmt(e.ct)}</td>
                    <td className="px-3 py-2 text-foreground">{fmt(e.cc)}</td>
                    <td className="px-3 py-2 text-foreground">{fmt(e.declividade)}</td>
                    <td className="px-3 py-2 text-foreground">{fmt(e.diametro)}</td>
                    <td className="px-3 py-2 text-foreground">{fmt(e.g)}</td>
                    <td className="px-3 py-2 text-foreground">{fmt(e.p)}</td>
                    <td className="px-3 py-2 text-foreground">{fmt(e.cr)}</td>
                    <td className="px-3 py-2 text-foreground">{fmt(e.r)}</td>
                    <td className="px-3 py-2 text-foreground">{fmt(e.h)}</td>
                    <td className="px-3 py-2 text-foreground">{e.pv_nome || '—'}</td>
                    <td className="px-3 py-2 text-foreground">{e.pv_tipo || '—'}</td>
                    <td className="px-3 py-2 text-foreground">{fmt(e.pv_prof)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default OSDetailPage;
