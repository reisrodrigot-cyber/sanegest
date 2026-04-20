import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { OSStatus } from '@/types/sanegest';
import { Link } from 'react-router-dom';
import { Search, Plus, Loader2, FileSpreadsheet } from 'lucide-react';
import { useOrdensServico } from '@/hooks/useOrdensServico';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const OrdensPage = () => {
  const { ordens, loading } = useOrdensServico();
  const { user, effectiveRole } = useAuth();
  const role = effectiveRole || user?.role;
  const canImport = role === 'admin' || role === 'sala_tecnica';
  const [faseFilter, setFaseFilter] = useState<OSStatus | 'TODAS'>('TODAS');
  const [baciaFilter, setBaciaFilter] = useState('TODAS');
  const [search, setSearch] = useState('');

  const bacias = [...new Set(ordens.map(os => os.bacia).filter(Boolean))].sort();

  const matchSearch = (os: typeof ordens[0]) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return os.trecho.toLowerCase().includes(q) || os.bacia.toLowerCase().includes(q);
  };

  const matchBacia = (os: typeof ordens[0]) =>
    baciaFilter === 'TODAS' || os.bacia === baciaFilter;

  const naoLiberadas = ordens.filter(os => !os.liberado && matchSearch(os) && matchBacia(os));

  const liberadas = ordens.filter(os => {
    if (!os.liberado) return false;
    if (!matchSearch(os)) return false;
    if (!matchBacia(os)) return false;
    if (faseFilter !== 'TODAS' && os.status !== faseFilter) return false;
    return true;
  });

  const countByStatus = (status: OSStatus) =>
    ordens.filter(os => os.liberado && os.status === status).length;

  const OSTable = ({ data }: { data: typeof ordens }) => (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Trecho</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Bacia</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Comp. (m)</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">DN (m)</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Prof. Média (m)</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Executor</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map(os => (
              <tr key={os.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <Link to={`/ordens/${os.id}`} className="font-medium text-secondary hover:underline">{os.trecho}</Link>
                </td>
                <td className="px-4 py-3 text-foreground">{os.bacia}</td>
                <td className="px-4 py-3 text-foreground hidden md:table-cell">{os.comprimento_previsto}</td>
                <td className="px-4 py-3 text-foreground hidden md:table-cell">{os.dn}</td>
                <td className="px-4 py-3 text-foreground hidden md:table-cell">{os.prof_media_prevista != null ? Number(os.prof_media_prevista).toFixed(2) : '—'}</td>
                <td className="px-4 py-3 text-foreground hidden lg:table-cell">{os.executor || '—'}</td>
                <td className="px-4 py-3"><StatusBadge status={os.status} size="sm" /></td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  {ordens.length === 0
                    ? 'Nenhuma OS cadastrada. Importe o Planilhão para começar.'
                    : 'Nenhuma OS encontrada com os filtros aplicados.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ordens de Serviço</h1>
          <p className="text-sm text-muted-foreground">{ordens.length} OS cadastradas</p>
        </div>
        <div className="flex items-center gap-2">
          {canImport && (
            <Link
              to="/importar"
              className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-card text-foreground font-medium text-sm hover:bg-muted transition-colors"
              title="Importar Planilhão"
            >
              <FileSpreadsheet size={16} />
              <span className="hidden sm:inline">Importar Planilhão</span>
            </Link>
          )}
          <Link
            to="/ordens/nova"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
          >
            <Plus size={16} />
            Nova OS
          </Link>
        </div>
      </div>

      {/* Search + Bacia dropdown */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
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
        {bacias.length > 1 && (
          <Select value={baciaFilter} onValueChange={setBaciaFilter}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Filtrar por bacia" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAS">Todas as bacias</SelectItem>
              {bacias.map(b => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      ) : (
        <Tabs defaultValue="liberadas" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="liberadas">
              Liberadas ({ordens.filter(os => os.liberado).length})
            </TabsTrigger>
            <TabsTrigger value="nao-liberadas">
              Não Liberadas ({ordens.filter(os => !os.liberado).length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="liberadas">
            {/* Fase/status sub-filters */}
            <div className="flex flex-wrap gap-2 mb-4">
              {([
                { key: 'TODAS' as const, label: 'Todas as fases' },
                { key: 'CINZA' as const, label: `Cinza (${countByStatus('CINZA')})` },
                { key: 'VERMELHO' as const, label: `Vermelho (${countByStatus('VERMELHO')})` },
                { key: 'LARANJA' as const, label: `Laranja (${countByStatus('LARANJA')})` },
                { key: 'AMARELO' as const, label: `Amarelo (${countByStatus('AMARELO')})` },
                { key: 'VERDE' as const, label: `Verde (${countByStatus('VERDE')})` },
              ]).map(f => (
                <button
                  key={f.key}
                  onClick={() => setFaseFilter(f.key)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    faseFilter === f.key
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-muted-foreground border-border hover:border-foreground/20'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <OSTable data={liberadas} />
          </TabsContent>

          <TabsContent value="nao-liberadas">
            <OSTable data={naoLiberadas} />
          </TabsContent>
        </Tabs>
      )}
    </AppLayout>
  );
};

export default OrdensPage;
