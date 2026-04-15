import { MOCK_OS, OBRA_NOME } from '@/data/mockData';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { Link } from 'react-router-dom';
import { ROLE_LABELS } from '@/types/sanegest';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const DashboardPage = () => {
  const { user } = useAuth();
  const vermelhas = MOCK_OS.filter(os => os.status === 'VERMELHO').length;
  const amarelas = MOCK_OS.filter(os => os.status === 'AMARELO').length;
  const verdes = MOCK_OS.filter(os => os.status === 'VERDE').length;
  const total = MOCK_OS.length;
  const avanco = total > 0 ? Math.round((verdes / total) * 100) : 0;

  const chartData = [
    { name: 'Vermelho', value: vermelhas, color: 'hsl(0, 72%, 51%)' },
    { name: 'Amarelo', value: amarelas, color: 'hsl(45, 93%, 47%)' },
    { name: 'Verde', value: verdes, color: 'hsl(142, 71%, 35%)' },
  ];

  const recentOS = MOCK_OS.slice(0, 5);

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm">{OBRA_NOME} • {user && ROLE_LABELS[user.role]}</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
          <p className="text-sm text-muted-foreground">Total de OS</p>
          <p className="text-3xl font-bold text-foreground mt-1">{total}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
          <p className="text-sm text-muted-foreground">Vermelhas</p>
          <p className="text-3xl font-bold text-status-red mt-1">{vermelhas}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
          <p className="text-sm text-muted-foreground">Amarelas</p>
          <p className="text-3xl font-bold text-status-yellow mt-1">{amarelas}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
          <p className="text-sm text-muted-foreground">Verdes</p>
          <p className="text-3xl font-bold text-status-green mt-1">{verdes}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Chart */}
        <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-1">Avanço Físico</h2>
          <p className="text-sm text-muted-foreground mb-4">{avanco}% concluído</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent OS */}
        <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">OS Recentes</h2>
            <Link to="/ordens" className="text-sm text-secondary hover:underline">Ver todas</Link>
          </div>
          <div className="space-y-3">
            {recentOS.map(os => (
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
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default DashboardPage;
