import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { Link } from 'react-router-dom';
import { ROLE_LABELS } from '@/types/sanegest';
import { useOrdensServico } from '@/hooks/useOrdensServico';
import { Loader2, AlertTriangle } from 'lucide-react';
import { MapaInterativo } from '@/components/mapa/MapaInterativo';
import { useMemo } from 'react';
import { AvancoFisicoDetail } from '@/components/dashboard/AvancoFisicoDetail';
import { ProducaoPorEncarregado } from '@/components/dashboard/ProducaoPorEncarregado';
import { ProducaoDiariaChart } from '@/components/dashboard/ProducaoDiariaChart';
import { ProducaoMensalChart } from '@/components/dashboard/ProducaoMensalChart';
import { MediaPorEncarregado } from '@/components/dashboard/MediaPorEncarregado';
import { ProdutividadeProfundidade } from '@/components/dashboard/ProdutividadeProfundidade';
import DashboardEncarregadoPage from './DashboardEncarregadoPage';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

const OBRA_NOME = 'SES Japaratinga';

const DashboardPage = () => {
  const { user, effectiveRole } = useAuth();
  const { ordens, loading } = useOrdensServico();

  const { data: divergencias = [] } = useQuery({
    queryKey: ['divergencias-abertas'],
    queryFn: async () => {
      const { data } = await supabase
        .from('materiais_entrega')
        .select('id, os_id')
        .eq('divergencia', true);
      return data ?? [];
    },
  });

  const totalPrevisto = ordens.reduce((sum, os) => sum + (os.comprimento_previsto ?? 0), 0);
  const totalExecutado = ordens.reduce((sum, os) => sum + (os.comprimento_real ?? 0), 0);
  const avanco = totalPrevisto > 0 ? Math.round((totalExecutado / totalPrevisto) * 100) : 0;

  const avancoPorBacia = useMemo(() => {
    const bacias = new Map<string, { previsto: number; executado: number }>();
    ordens.filter(os => os.liberado).forEach(os => {
      const b = os.bacia || 'Sem bacia';
      const cur = bacias.get(b) ?? { previsto: 0, executado: 0 };
      cur.previsto += os.comprimento_previsto ?? 0;
      cur.executado += os.comprimento_real ?? 0;
      bacias.set(b, cur);
    });
    return Array.from(bacias.entries())
      .map(([bacia, v]) => ({
        bacia,
        previsto: v.previsto,
        executado: v.executado,
        pct: v.previsto > 0 ? Math.round((v.executado / v.previsto) * 100) : 0,
      }))
      .sort((a, b) => b.pct - a.pct);
  }, [ordens]);

  const nsEmExecucao = ordens
    .filter(os => os.liberado && (os.status === 'VERMELHO' || os.status === 'LARANJA' || os.status === 'AMARELO'))
    .sort((a, b) => {
      const order = { AMARELO: 0, LARANJA: 1, VERMELHO: 2 };
      return (order[a.status as keyof typeof order] ?? 9) - (order[b.status as keyof typeof order] ?? 9);
    });

  const now = new Date();
  const seteDiasAtras = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const nsSemProducao = ordens.filter(os =>
    os.liberado && os.status === 'VERMELHO' && !os.comprimento_real && new Date(os.updated_at) < seteDiasAtras
  );
  const temAlertas = divergencias.length > 0 || nsSemProducao.length > 0;

  // Encarregado tem dashboard exclusivo (após todos os hooks)
  if (effectiveRole === 'encarregado') {
    return <DashboardEncarregadoPage />;
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-muted-foreground" size={32} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm">{OBRA_NOME} • {effectiveRole && ROLE_LABELS[effectiveRole]}</p>
      </div>

      <MapaInterativo />

      {ordens.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground mt-6">
          Nenhuma OS cadastrada. <Link to="/importar" className="text-secondary hover:underline">Importe o Planilhão</Link> para começar.
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mt-4 mb-4">
            Avanço Físico: <span className="font-semibold text-foreground">{totalExecutado.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}m</span> executados de{' '}
            <span className="font-semibold text-foreground">{totalPrevisto.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}m</span> previstos ({avanco}%)
          </p>

          <AvancoFisicoDetail ordens={ordens} />

          <ProducaoPorEncarregado ordens={ordens} />

          <ProducaoDiariaChart />
          <ProducaoMensalChart />

          <MediaPorEncarregado />

          <ProdutividadeProfundidade />

          {avancoPorBacia.length > 0 && (
            <div className="bg-card rounded-xl p-6 border border-border shadow-sm mb-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Avanço por Bacia</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Bacia</th>
                      <th className="pb-2 font-medium text-right">Previsto (m)</th>
                      <th className="pb-2 font-medium text-right">Executado (m)</th>
                      <th className="pb-2 font-medium text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {avancoPorBacia.map(b => (
                      <tr key={b.bacia} className="border-b border-border/50">
                        <td className="py-2 text-foreground font-medium">{b.bacia}</td>
                        <td className="py-2 text-right text-muted-foreground">{b.previsto.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                        <td className="py-2 text-right text-muted-foreground">{b.executado.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                        <td className="py-2 text-right font-semibold text-foreground">{b.pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-card rounded-xl p-6 border border-border shadow-sm mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">NS em Execução</h2>
              <Link to="/ordens" className="text-sm text-secondary hover:underline">Ver todas</Link>
            </div>
            <div className="space-y-3">
              {nsEmExecucao.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma NS em execução no momento.</p>
              ) : (
                nsEmExecucao.slice(0, 5).map(os => (
                  <Link key={os.id} to={`/ordens/${os.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="font-medium text-foreground">{os.trecho}</p>
                      <p className="text-xs text-muted-foreground">{os.bacia} • {os.comprimento_previsto}m</p>
                    </div>
                    <StatusBadge status={os.status} size="sm" />
                  </Link>
                ))
              )}
            </div>
          </div>

          {(temAlertas || divergencias.length > 0) && (
            <div className="rounded-xl border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-800 p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={18} className="text-yellow-600 dark:text-yellow-400" />
                <h2 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">Alertas</h2>
              </div>
              <ul className="space-y-2 text-sm">
                {divergencias.length > 0 && (
                  <li className="text-yellow-800 dark:text-yellow-200">
                    <span className="font-semibold">{divergencias.length}</span> divergência{divergencias.length > 1 ? 's' : ''} aberta{divergencias.length > 1 ? 's' : ''} aguardando resolução do Almoxarifado
                  </li>
                )}
                {nsSemProducao.length > 0 && (
                  <li className="text-yellow-800 dark:text-yellow-200">
                    <span className="font-semibold">{nsSemProducao.length}</span> NS liberada{nsSemProducao.length > 1 ? 's' : ''} há mais de 7 dias sem produção registrada
                    <div className="flex flex-wrap gap-2 mt-1">
                      {nsSemProducao.slice(0, 5).map(os => (
                        <Link key={os.id} to={`/ordens/${os.id}`} className="text-xs underline text-yellow-700 dark:text-yellow-300 hover:text-yellow-900">
                          {os.trecho}
                        </Link>
                      ))}
                    </div>
                  </li>
                )}
              </ul>
            </div>
          )}
        </>
      )}
    </AppLayout>
  );
};

export default DashboardPage;
