import { useParams, Link } from 'react-router-dom';
import { MOCK_OS } from '@/data/mockData';
import { AppLayout } from '@/components/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { ArrowLeft } from 'lucide-react';

const DataRow = ({ label, previsto, real }: { label: string; previsto: React.ReactNode; real?: React.ReactNode }) => (
  <div className="grid grid-cols-3 gap-2 py-2 border-b border-border last:border-0">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-medium text-foreground">{previsto ?? '—'}</span>
    <span className={`text-sm font-medium ${real !== undefined && real !== null ? 'text-secondary' : 'text-muted-foreground'}`}>
      {real ?? '—'}
    </span>
  </div>
);

const OSDetailPage = () => {
  const { id } = useParams();
  const os = MOCK_OS.find(o => o.id === id);

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
        </div>
        <p className="text-sm text-muted-foreground mt-1">{os.bacia} • PV {os.pv_montante} → {os.pv_jusante}</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Header data */}
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

        {/* Info cards */}
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
              <p className="text-sm text-foreground">Lat: {os.as_built_lat}</p>
              <p className="text-sm text-foreground">Lng: {os.as_built_lng}</p>
            </div>
          )}
        </div>
      </div>

      {/* Estacas table */}
      {os.estacas && os.estacas.length > 0 && (
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
                {os.estacas.map(e => (
                  <tr key={e.id} className="border-b border-border hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{e.nome}</td>
                    <td className="px-3 py-2 text-foreground">{e.coord_n?.toFixed(2)}</td>
                    <td className="px-3 py-2 text-foreground">{e.coord_e?.toFixed(2)}</td>
                    <td className="px-3 py-2 text-foreground">{e.ct}</td>
                    <td className="px-3 py-2 text-foreground">{e.cc}</td>
                    <td className="px-3 py-2 text-foreground">{e.declividade}</td>
                    <td className="px-3 py-2 text-foreground">{e.diametro}</td>
                    <td className="px-3 py-2 text-foreground">{e.g}</td>
                    <td className="px-3 py-2 text-foreground">{e.p}</td>
                    <td className="px-3 py-2 text-foreground">{e.cr}</td>
                    <td className="px-3 py-2 text-foreground">{e.r}</td>
                    <td className="px-3 py-2 text-foreground">{e.h}</td>
                    <td className="px-3 py-2 text-foreground">{e.pv_nome || '—'}</td>
                    <td className="px-3 py-2 text-foreground">{e.pv_tipo || '—'}</td>
                    <td className="px-3 py-2 text-foreground">{e.pv_prof || '—'}</td>
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
