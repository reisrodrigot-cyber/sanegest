import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { Link } from 'react-router-dom';
import { ROLE_LABELS } from '@/types/sanegest';
import { useOrdensServico } from '@/hooks/useOrdensServico';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { OSMap } from '@/components/OSMap';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useMemo } from 'react';

const OBRA_NOME = 'SES Japaratinga';

function getWeekRange(weeksAgo: number) {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const thisMonday = new Date(now);
  thisMonday.setHours(0, 0, 0, 0);
  thisMonday.setDate(now.getDate() + mondayOffset);

  const start = new Date(thisMonday);
  start.setDate(start.getDate() - weeksAgo * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function formatDateShort(d: Date) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const DashboardPage = () => {
  const { user, effectiveRole } = useAuth();
  const { ordens, loading } = useOrdensServico();

  const totalPrevisto = ordens.reduce((sum, os) => sum + (os.comprimento_previsto ?? 0), 0);
  const totalExecutado = ordens.reduce((sum, os) => sum + (os.comprimento_real ?? 0), 0);
  const avanco = totalPrevisto > 0 ? Math.round((totalExecutado / totalPrevisto) * 100) : 0;

  const weeklyData = useMemo(() => {
    const osComReal = ordens.filter(os => os.comprimento_real != null && os.comprimento_real > 0);

    return [3, 2, 1, 0].map(weeksAgo => {
      const { start, end } = getWeekRange(weeksAgo);
      const metros = osComReal
        .filter(os => {
          const updated = new Date(os.updated_at);
          return updated >= start && updated <= end;
        })
        .reduce((sum, os) => sum + (os.comprimento_real ?? 0), 0);

      const label = weeksAgo === 0
        ? 'Sem atual'
        : `${formatDateShort(start)} - ${formatDateShort(end)}`;

      return { label, metros: Math.round(metros * 10) / 10, isCurrent: weeksAgo === 0 };
    });
  }, [ordens]);

  const semanaAtual = weeklyData[3]?.metros ?? 0;
  const semanaPassada = weeklyData[2]?.metros ?? 0;
  const diff = semanaAtual - semanaPassada;

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
        <>
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

            {/* Produção Semanal */}
            <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
              <h2 className="text-lg font-semibold text-foreground mb-1">Produção Semanal (m)</h2>
              <p className="text-sm text-muted-foreground mb-4">Últimas 4 semanas</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData}>
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit="m" />
                    <Tooltip
                      formatter={(value: number) => [`${value} m`, 'Produção']}
                    />
                    <Bar dataKey="metros" radius={[6, 6, 0, 0]}>
                      {weeklyData.map((entry, i) => (
                        <Cell key={i} fill={entry.isCurrent ? '#0C447C' : '#4A9FE0'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                <span>Esta semana: <span className="font-semibold text-foreground">{semanaAtual} m</span></span>
                <span>Semana passada: <span className="font-semibold text-foreground">{semanaPassada} m</span></span>
                {diff !== 0 && (
                  <span className={`flex items-center gap-1 font-medium ${diff > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {diff > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    {diff > 0 ? '+' : ''}{diff.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 3º NS em Execução */}
          <div className="bg-card rounded-xl p-6 border border-border shadow-sm mt-6">
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
        </>
      )}
    </AppLayout>
  );
};

export default DashboardPage;
