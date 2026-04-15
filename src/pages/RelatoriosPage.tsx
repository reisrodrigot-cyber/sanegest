import { AppLayout } from '@/components/AppLayout';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { useOrdensServico } from '@/hooks/useOrdensServico';
import { Loader2 } from 'lucide-react';

const OBRA_NOME = 'SES Japaratinga';

const RelatoriosPage = () => {
  const { ordens, loading } = useOrdensServico();

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      </AppLayout>
    );
  }

  const vermelhas = ordens.filter(os => os.status === 'VERMELHO').length;
  const amarelas = ordens.filter(os => os.status === 'AMARELO').length;
  const verdes = ordens.filter(os => os.status === 'VERDE').length;
  const total = ordens.length;

  const pieData = [
    { name: 'Vermelho', value: vermelhas, color: 'hsl(0, 72%, 51%)' },
    { name: 'Amarelo', value: amarelas, color: 'hsl(45, 93%, 47%)' },
    { name: 'Verde', value: verdes, color: 'hsl(142, 71%, 35%)' },
  ];

  const compData = ordens.filter(os => os.comprimento_real).map(os => ({
    name: os.trecho,
    previsto: os.comprimento_previsto,
    real: os.comprimento_real,
  }));

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-foreground mb-1">Relatórios</h1>
      <p className="text-sm text-muted-foreground mb-6">{OBRA_NOME} • Avanço físico consolidado</p>

      {total === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">
          Nenhuma OS cadastrada. Importe o Planilhão para gerar relatórios.
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-card rounded-xl border border-border shadow-sm p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Distribuição por Status</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-2">
              {pieData.map(d => (
                <div key={d.name} className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                  {d.name}: {d.value}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-sm p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Previsto vs Real — Comprimento</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={compData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="previsto" fill="hsl(212, 80%, 27%)" radius={[4, 4, 0, 0]} name="Previsto" />
                  <Bar dataKey="real" fill="hsl(213, 60%, 50%)" radius={[4, 4, 0, 0]} name="Real" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-2 bg-card rounded-xl border border-border shadow-sm p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Resumo</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div><p className="text-sm text-muted-foreground">Total OS</p><p className="text-2xl font-bold text-foreground">{total}</p></div>
              <div><p className="text-sm text-muted-foreground">Concluídas</p><p className="text-2xl font-bold text-status-green">{verdes}</p></div>
              <div><p className="text-sm text-muted-foreground">Avanço</p><p className="text-2xl font-bold text-foreground">{total > 0 ? Math.round((verdes / total) * 100) : 0}%</p></div>
              <div><p className="text-sm text-muted-foreground">Comp. Total Previsto</p><p className="text-2xl font-bold text-foreground">{ordens.reduce((s, o) => s + (o.comprimento_previsto || 0), 0).toFixed(1)}m</p></div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default RelatoriosPage;
