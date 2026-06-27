import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { OSStatus } from '@/types/sanegest';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, Loader2, FileSpreadsheet, AlertTriangle, Download, MapPin, UserPlus, X } from 'lucide-react';
import { downloadPlanilhao } from '@/lib/planilhaoExport';
import { useOrdensServico } from '@/hooks/useOrdensServico';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { LiberarLoteModal } from '@/components/LiberarLoteModal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Natural sort comparator: "1.2" < "1.10"
function naturalCompare(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

const OrdensPage = () => {
  const { ordens, loading, refetch } = useOrdensServico();
  const { user, effectiveRole } = useAuth();
  const navigate = useNavigate();
  const role = effectiveRole || user?.role;
  const canImport = role === 'admin' || role === 'sala_tecnica';
  const canLiberar = role === 'admin' || role === 'sala_tecnica' || role === 'gerencia';
  const [faseFilter, setFaseFilter] = useState<OSStatus | 'TODAS'>('TODAS');
  const [baciaFilter, setBaciaFilter] = useState('TODAS');
  const [responsavelFilter, setResponsavelFilter] = useState('TODOS');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showLiberarModal, setShowLiberarModal] = useState(false);

  // Aggregated produção (sum comprimento_dia) per OS
  const [producaoByOs, setProducaoByOs] = useState<Record<string, number>>({});
  // Latest status change date per OS
  const [statusSinceByOs, setStatusSinceByOs] = useState<Record<string, string>>({});
  // OS ids that have ≥2 as-built points (PV montante + jusante coords filled)
  const [locatableOsIds, setLocatableOsIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: regs }, { data: hist }, { data: ab }] = await Promise.all([
        supabase.from('registros_producao').select('os_id, comprimento_dia').eq('excluido', false).eq('excluido', false),
        supabase
          .from('os_status_historico')
          .select('os_id, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('topografia_asbuilt')
          .select('os_id')
          .not('latitude', 'is', null)
          .not('longitude', 'is', null),
      ]);
      if (cancelled) return;

      const counts = new Map<string, number>();
      (ab || []).forEach((r: any) => counts.set(r.os_id, (counts.get(r.os_id) || 0) + 1));
      const locatable = new Set<string>();
      counts.forEach((n, id) => { if (n >= 2) locatable.add(id); });
      setLocatableOsIds(locatable);

      const acc: Record<string, number> = {};
      (regs || []).forEach((r: any) => {
        acc[r.os_id] = (acc[r.os_id] || 0) + Number(r.comprimento_dia || 0);
      });
      setProducaoByOs(acc);

      const since: Record<string, string> = {};
      (hist || []).forEach((h: any) => {
        if (!since[h.os_id]) since[h.os_id] = h.created_at;
      });
      setStatusSinceByOs(since);
    })();
    return () => { cancelled = true; };
  }, [ordens.length]);

  const bacias = [...new Set(ordens.map(os => os.bacia).filter(Boolean))].sort();
  const responsaveis = [...new Set(ordens.map(os => os.liberado_para).filter(Boolean) as string[])].sort();

  const matchSearch = (os: typeof ordens[0]) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return os.trecho.toLowerCase().includes(q) || os.bacia.toLowerCase().includes(q);
  };

  const matchBacia = (os: typeof ordens[0]) =>
    baciaFilter === 'TODAS' || os.bacia === baciaFilter;

  const matchResponsavel = (os: typeof ordens[0]) =>
    responsavelFilter === 'TODOS' || os.liberado_para === responsavelFilter;

  const naoLiberadas = useMemo(
    () => ordens
      .filter(os => !os.liberado && matchSearch(os) && matchBacia(os) && matchResponsavel(os))
      .sort((a, b) => naturalCompare(a.trecho, b.trecho)),
    [ordens, search, baciaFilter, responsavelFilter]
  );

  const liberadas = useMemo(
    () => ordens
      .filter(os => {
        if (!os.liberado) return false;
        if (!matchSearch(os)) return false;
        if (!matchBacia(os)) return false;
        if (!matchResponsavel(os)) return false;
        if (faseFilter !== 'TODAS' && os.status !== faseFilter) return false;
        return true;
      })
      .sort((a, b) => naturalCompare(a.trecho, b.trecho)),
    [ordens, search, baciaFilter, responsavelFilter, faseFilter]
  );

  const countByStatus = (status: OSStatus) =>
    ordens.filter(os => os.liberado && os.status === status).length;

  const daysSince = (iso?: string) => {
    if (!iso) return 0;
    return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  };

  const handleExport = async () => {
    try {
      await downloadPlanilhao(ordens);
      await supabase.from('export_logs').insert({
        actor: user?.email || user?.id || 'unknown',
        user_id: user?.id ?? null,
        source: 'manual',
        registros_count: ordens.length,
        status: 'success',
        filename: `sanegest_japaratinga_planilhao_${new Date().toISOString().slice(0,10)}.xlsx`,
      });
    } catch (e: any) {
      await supabase.from('export_logs').insert({
        actor: user?.email || user?.id || 'unknown',
        user_id: user?.id ?? null,
        source: 'manual',
        registros_count: ordens.length,
        status: 'error',
        error: String(e?.message || e),
      });
      throw e;
    }
  };


  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = (data: typeof ordens, checked: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (checked) data.forEach(o => next.add(o.id));
      else data.forEach(o => next.delete(o.id));
      return next;
    });
  };

  const selectedOS = useMemo(() => ordens.filter(o => selected.has(o.id)), [ordens, selected]);

  const OSTable = ({ data }: { data: typeof ordens }) => {
    const allSelected = data.length > 0 && data.every(o => selected.has(o.id));
    const someSelected = data.some(o => selected.has(o.id)) && !allSelected;
    return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {canLiberar && (
                <th className="px-3 py-3 w-10">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={(c) => toggleAll(data, c === true)}
                    aria-label="Selecionar todas"
                  />
                </th>
              )}
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Trecho</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Bacia</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Comp. (m)</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Prof. Média (m)</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Executado (m)</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell w-[160px]">%</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Responsável</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="px-2 py-3 w-[44px]"></th>
            </tr>
          </thead>
          <tbody>
            {data.map(os => {
              const executado = producaoByOs[os.id] || 0;
              const total = Number(os.comprimento_previsto || 0);
              const pct = total > 0 ? Math.min(100, (executado / total) * 100) : 0;
              const since = statusSinceByOs[os.id] || os.updated_at;
              const dias = daysSince(since);
              const parado = dias >= 5;
              const isSel = selected.has(os.id);
              return (
                <tr key={os.id} className={`border-b border-border last:border-0 hover:bg-muted/20 transition-colors ${isSel ? 'bg-primary/5' : ''}`}>
                  {canLiberar && (
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={isSel} onCheckedChange={() => toggleOne(os.id)} aria-label={`Selecionar ${os.trecho}`} />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <Link to={`/ordens/${os.id}`} className="font-medium text-primary hover:underline">{os.trecho}</Link>
                  </td>
                  <td className="px-4 py-3 text-foreground">{os.bacia}</td>
                  <td className="px-4 py-3 text-foreground hidden md:table-cell">{os.comprimento_previsto ?? '—'}</td>
                  <td className="px-4 py-3 text-foreground hidden md:table-cell">{os.prof_media_prevista != null ? Number(os.prof_media_prevista).toFixed(2) : '—'}</td>
                  <td className="px-4 py-3 text-foreground hidden md:table-cell">{executado.toFixed(2).replace('.', ',')}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground tabular-nums w-10">{pct.toFixed(0)}%</span>
                      <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden min-w-[60px]">
                        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground hidden lg:table-cell">{os.liberado_para || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={os.status} size="sm" />
                      {parado && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center text-amber-500" aria-label={`Parado há ${dias} dias`}>
                                <AlertTriangle size={14} />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent><span>⚠️ Parado há {dias} dias</span></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    {locatableOsIds.has(os.id) && (
                      <button
                        onClick={() => navigate('/dashboard', { state: { focusOsId: os.id } })}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium hover:bg-primary/10 transition-colors"
                        style={{ color: '#4dd9ac' }}
                        title="Localizar no mapa"
                      >
                        <MapPin size={14} /> <span className="hidden lg:inline">Localizar</span>
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {data.length === 0 && (
              <tr>
                <td colSpan={canLiberar ? 10 : 9} className="px-4 py-8 text-center text-muted-foreground">
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
  };

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ordens de Serviço</h1>
          <p className="text-sm text-muted-foreground">{ordens.length} OS cadastradas</p>
        </div>
        <div className="flex items-center gap-2">
          {canImport && (
            <>
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-card text-foreground font-medium text-sm hover:bg-muted transition-colors"
                title="Exportar Planilhão"
              >
                <Download size={16} />
                <span className="hidden sm:inline">Exportar Planilhão</span>
              </button>
              <Link
                to="/importar"
                className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-card text-foreground font-medium text-sm hover:bg-muted transition-colors"
                title="Importar Planilhão"
              >
                <FileSpreadsheet size={16} />
                <span className="hidden sm:inline">Importar Planilhão</span>
              </Link>
            </>
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

      {/* Search + Bacia + Responsável */}
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
            <SelectTrigger className="w-full sm:w-[200px]">
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
        <Select value={responsavelFilter} onValueChange={setResponsavelFilter}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Filtrar por responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos os responsáveis</SelectItem>
            {responsaveis.map(r => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      {canLiberar && selected.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-card border border-border shadow-lg rounded-full px-4 py-2.5 flex items-center gap-3">
          <span className="text-sm font-medium">{selected.size} OS selecionada{selected.size > 1 ? 's' : ''}</span>
          <button
            onClick={() => setShowLiberarModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
          >
            <UserPlus size={14} /> Liberar para encarregado
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="inline-flex items-center justify-center w-7 h-7 rounded-full hover:bg-muted text-muted-foreground"
            aria-label="Limpar seleção"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <LiberarLoteModal
        open={showLiberarModal}
        onClose={() => setShowLiberarModal(false)}
        selectedOS={selectedOS}
        onDone={() => { setSelected(new Set()); refetch(); }}
      />
    </AppLayout>
  );
};

export default OrdensPage;
