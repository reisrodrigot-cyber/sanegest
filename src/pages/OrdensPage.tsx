import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { OSStatus } from '@/types/sanegest';
import { Link } from 'react-router-dom';
import { Search, Plus, Loader2 } from 'lucide-react';
import { useOrdensServico } from '@/hooks/useOrdensServico';

const OrdensPage = () => {
  const { ordens, loading } = useOrdensServico();
  const [statusFilter, setStatusFilter] = useState<OSStatus | 'TODOS'>('TODOS');
  const [baciaFilter, setBaciaFilter] = useState('TODAS');
  const [search, setSearch] = useState('');

  const bacias = [...new Set(ordens.map(os => os.bacia).filter(Boolean))].sort();

  const filtered = ordens.filter(os => {
    if (statusFilter !== 'TODOS' && os.status !== statusFilter) return false;
    if (baciaFilter !== 'TODAS' && os.bacia !== baciaFilter) return false;
    if (search && !os.trecho.toLowerCase().includes(search.toLowerCase()) && !os.bacia.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ordens de Serviço</h1>
          <p className="text-sm text-muted-foreground">{ordens.length} OS cadastradas</p>
        </div>
        <Link
          to="/ordens/nova"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          Nova OS
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por trecho ou bacia..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(['TODOS', 'VERMELHO', 'AMARELO', 'VERDE'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                statusFilter === s
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:border-foreground/20'
              }`}
            >
              {s === 'TODOS' ? 'Todos' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>
      {/* Bacia filter */}
      {bacias.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setBaciaFilter('TODAS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              baciaFilter === 'TODAS'
                ? 'bg-secondary text-secondary-foreground border-secondary'
                : 'bg-card text-muted-foreground border-border hover:border-foreground/20'
            }`}
          >
            Todas as bacias
          </button>
          {bacias.map(b => (
            <button
              key={b}
              onClick={() => setBaciaFilter(b)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                baciaFilter === b
                  ? 'bg-secondary text-secondary-foreground border-secondary'
                  : 'bg-card text-muted-foreground border-border hover:border-foreground/20'
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-muted-foreground" size={24} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Trecho</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Bacia</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Comp. (m)</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">DN (m)</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Executor</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(os => (
                  <tr key={os.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <Link to={`/ordens/${os.id}`} className="font-medium text-secondary hover:underline">{os.trecho}</Link>
                    </td>
                    <td className="px-4 py-3 text-foreground">{os.bacia}</td>
                    <td className="px-4 py-3 text-foreground hidden md:table-cell">{os.comprimento_previsto}</td>
                    <td className="px-4 py-3 text-foreground hidden md:table-cell">{os.dn}</td>
                    <td className="px-4 py-3 text-foreground hidden lg:table-cell">{os.executor || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={os.status} size="sm" /></td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      {ordens.length === 0
                        ? 'Nenhuma OS cadastrada. Importe o Planilhão para começar.'
                        : 'Nenhuma OS encontrada com os filtros aplicados.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default OrdensPage;
