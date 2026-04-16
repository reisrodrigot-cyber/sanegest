import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { Link } from 'react-router-dom';
import { ROLE_LABELS } from '@/types/sanegest';
import { useOrdensServico } from '@/hooks/useOrdensServico';
import { Loader2 } from 'lucide-react';
import { OSMap } from '@/components/OSMap';
import { Progress } from '@/components/ui/progress';

const OBRA_NOME = 'SES Japaratinga';

const DashboardPage = () => {
  const { user, effectiveRole } = useAuth();
  const { ordens, loading } = useOrdensServico();

  const totalPrevisto = ordens.reduce((sum, os) => sum + (os.comprimento_previsto ?? 0), 0);
  const totalExecutado = ordens.reduce((sum, os) => sum + (os.comprimento_real ?? 0), 0);
  const avanco = totalPrevisto > 0 ? Math.round((totalExecutado / totalPrevisto) * 100) : 0;

  const nsEmExecucao = ordens
    .filter(os => os.liberado && (os.status === 'AMARELO' || os.status === 'VERMELHO'))
    .sort((a, b) => {
      if (a.status === 'AMARELO' && b.status !== 'AMARELO') return -1;
      if (a.status !== 'AMARELO' && b.status === 'AMARELO') return 1;
      return 0;
    });

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

      {/* 1º Mapa das OS */}
      <OSMap />

      {ordens.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground mt-6">
          Nenhuma OS cadastrada. <Link to="/importar" className="text-secondary hover:underline">Importe o Planilhão</Link> para começar.
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6 mt-6">
          {/* 2º Avanço Físico */}
          <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-1">Avanço Físico</h2>
            <p className="text-sm text-muted-foreground mb-4">{avanco}% concluído</p>
            <Progress value={avanco} className="h-5 bg-muted" />
            <p className="text-sm text-muted-foreground mt-3">
              <span className="font-semibold text-foreground">{totalExecutado.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</span> metros executados de{' '}
              <span className="font-semibold text-foreground">{totalPrevisto.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</span> metros previstos
            </p>
          </div>

          {/* 3º NS em Execução */}
          <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">NS em Execução</h2>
              <Link to="/ordens" className="text-sm text-secondary hover:underline">Ver todas</Link>
            </div>
            <div className="space-y-3">
              {nsEmExecucao.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma NS em execução no momento.</p>
              ) : (
                nsEmExecucao.slice(0, 5).map(os => (
                  <Link
                    key={os.id}
                    to={`/ordens/${os.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
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
        </div>
      )}
    </AppLayout>
  );
};

export default DashboardPage;
