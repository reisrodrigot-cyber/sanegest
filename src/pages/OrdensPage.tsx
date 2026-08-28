import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { OSStatus } from '@/types/sanegest';
import { statusLabel, vinculoDisplayStatus, toDisplayStatus, type OSDisplayStatus } from '@/lib/osStatus';

import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PlanilhaoConsulta } from '@/components/ordens/PlanilhaoConsulta';
import { Search, Plus, Loader2, FileSpreadsheet, Download, MapPin, Map as MapIcon, UserPlus, UserMinus, X } from 'lucide-react';
import { downloadPlanilhao } from '@/lib/planilhaoExport';
import { useOrdensServico } from '@/hooks/useOrdensServico';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { LiberarLoteModal } from '@/components/LiberarLoteModal';
import { DesatribuirModal } from '@/components/DesatribuirModal';
import { LiberarPavimentacaoModal } from '@/components/pavimentacao/LiberarPavimentacaoModal';
import { useLiberacoesPav, useConclusoesPav } from '@/hooks/usePavimentacao';
import { permissions } from '@/lib/permissions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ColumnFilterMenu } from '@/components/tabela/ColumnFilterMenu';
import { isFilterActive, passesFilter, type CellValue, type ColFilterType, type ColumnFilterValue } from '@/lib/columnFilter';

// Natural sort comparator: "1.2" < "1.10"
function naturalCompare(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

const OrdensPage = () => {
  const { ordens, loading, refetch } = useOrdensServico();
  const { user, effectiveRole, actingUserId, actingUserName } = useAuth();
  const navigate = useNavigate();
  const role = effectiveRole || user?.role;
  const canImport = role === 'admin' || role === 'sala_tecnica';
  const canLiberar = role === 'admin' || role === 'sala_tecnica' || role === 'gerencia';
  const canDelete = role === 'admin' || role === 'sala_tecnica';
  const canPlanilhao = role === 'admin' || role === 'sala_tecnica';
  const location = useLocation();
  const planilhaoView = location.pathname.startsWith('/ordens/planilhao');
  const [colFilters, setColFiltros] = useState<Record<string, ColumnFilterValue>>({});
  const [colSort, setColSort] = useState<{ id: string; dir: 'asc' | 'desc' } | null>(null);
  const [baciaFilter, setBaciaFilter] = useState('TODAS');
  const [responsavelFilter, setResponsavelFilter] = useState('TODOS');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showLiberarModal, setShowLiberarModal] = useState(false);
  const [desatribuirOS, setDesatribuirOS] = useState<typeof ordens>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<'liberadas' | 'nao-liberadas' | 'executadas'>('liberadas');
  const [pavModal, setPavModal] = useState<{ modo: 'liberar' | 'revogar'; alvo: typeof ordens } | null>(null);
  const { data: pavLiberacoes } = useLiberacoesPav();
  const { data: pavConclusoes } = useConclusoesPav();
  const canPav = permissions.canLiberarPavimentacao(role);

  const PavBadge = ({ osId }: { osId: string }) => {
    const lib = pavLiberacoes?.get(osId);
    const conc = pavConclusoes?.get(osId);
    if (conc?.concluido) {
      return <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/15 text-emerald-700">Pav. finalizada</span>;
    }
    if (lib?.liberado) {
      return <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-sky-500/15 text-sky-700">Pav. liberada</span>;
    }
    return null;
  };

  // Aggregated produção (sum comprimento_dia) per OS
  const [producaoByOs, setProducaoByOs] = useState<Record<string, number>>({});
  // OS ids marcadas como executadas (pv final assentado)
  const [executadasOsIds, setExecutadasOsIds] = useState<Set<string>>(new Set());
  // Latest status change date per OS
  const [statusSinceByOs, setStatusSinceByOs] = useState<Record<string, string>>({});
  // OS ids that have ≥2 as-built points (PV montante + jusante coords filled)
  const [locatableOsIds, setLocatableOsIds] = useState<Set<string>>(new Set());
  // OS ids com ao menos um vínculo ativo no mapa (mapa_trecho_os.ativo = true)
  const [mapeadasOsIds, setMapeadasOsIds] = useState<Set<string>>(new Set());


  useEffect(() => {
    let cancelled = false;
    const fetchAllPaged = async (
      q: (from: number, to: number) => any,
    ): Promise<any[]> => {
      const page = 1000;
      let from = 0;
      let out: any[] = [];
      for (;;) {
        const { data, error } = await q(from, from + page - 1);
        if (error) break;
        out = out.concat(data || []);
        if (!data || data.length < page) break;
        from += page;
      }
      return out;
    };
    (async () => {
      const [{ data: regs }, { data: hist }, { data: ab }, vinculos] = await Promise.all([
        supabase.from('registros_producao').select('os_id, comprimento_dia, comprimento_ajustado, status, pv_final_assentado').eq('excluido', false).eq('status', 'ativo'),
        supabase
          .from('os_status_historico')
          .select('os_id, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('topografia_asbuilt')
          .select('os_id')
          .not('latitude', 'is', null)
          .not('longitude', 'is', null),
        fetchAllPaged((from, to) =>
          supabase.from('mapa_trecho_os').select('os_id').eq('ativo', true).range(from, to)
        ),
      ]);
      if (cancelled) return;

      setMapeadasOsIds(new Set((vinculos || []).map((v: any) => v.os_id as string)));

      const counts = new Map<string, number>();
      (ab || []).forEach((r: any) => counts.set(r.os_id, (counts.get(r.os_id) || 0) + 1));
      const locatable = new Set<string>();
      counts.forEach((n, id) => { if (n >= 2) locatable.add(id); });
      setLocatableOsIds(locatable);

      const acc: Record<string, number> = {};
      const exec = new Set<string>();
      (regs || []).forEach((r: any) => {
        acc[r.os_id] = (acc[r.os_id] || 0) + Number(r.comprimento_dia || 0);
        if (r.pv_final_assentado) exec.add(r.os_id);
      });
      setProducaoByOs(acc);
      setExecutadasOsIds(exec);

      const since: Record<string, string> = {};
      (hist || []).forEach((h: any) => {
        if (!since[h.os_id]) since[h.os_id] = h.created_at;
      });
      setStatusSinceByOs(since);
    })();
    return () => { cancelled = true; };
  }, [ordens.length]);

  /** Status efetivo: PV final assentado vence o enum técnico legado. */
  const statusEfetivo = (os: { id: string; status: OSStatus }): OSDisplayStatus =>
    vinculoDisplayStatus({ status: os.status, pv_final_assentado: executadasOsIds.has(os.id) });


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
        if (executadasOsIds.has(os.id)) return false;
        if (!matchSearch(os)) return false;
        if (!matchBacia(os)) return false;
        if (!matchResponsavel(os)) return false;
        return true;
      })
      .sort((a, b) => naturalCompare(a.trecho, b.trecho)),
    [ordens, search, baciaFilter, responsavelFilter, executadasOsIds]
  );

  const executadas = useMemo(
    () => ordens
      .filter(os => {
        if (!executadasOsIds.has(os.id)) return false;
        if (!matchSearch(os)) return false;
        if (!matchBacia(os)) return false;
        if (!matchResponsavel(os)) return false;
        return true;
      })
      .sort((a, b) => naturalCompare(a.trecho, b.trecho)),
    [ordens, search, baciaFilter, responsavelFilter, executadasOsIds]
  );

  const liberadasBaseCount = ordens.filter(os => os.liberado && !executadasOsIds.has(os.id)).length;
  const executadasBaseCount = ordens.filter(os => executadasOsIds.has(os.id)).length;


  const handleExport = async () => {
    try {
      await downloadPlanilhao(ordens);
      await supabase.from('export_logs').insert({
        actor: actingUserName || user?.email || user?.id || 'unknown',
        user_id: actingUserId ?? user?.id ?? null,
        source: 'manual',
        registros_count: ordens.length,
        status: 'success',
        filename: `sanegest_japaratinga_planilhao_${new Date().toISOString().slice(0,10)}.xlsx`,
      });
    } catch (e: any) {
      await supabase.from('export_logs').insert({
        actor: actingUserName || user?.email || user?.id || 'unknown',
        user_id: actingUserId ?? user?.id ?? null,
        source: 'manual',
        registros_count: ordens.length,
        status: 'error',
        error: String(e?.message || e),
      });
      throw e;
    }
  };

  const handleDeleteSelecionadas = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setDeleting(true);
    try {
      const { error, data } = await supabase
        .from('ordens_servico')
        .delete()
        .in('id', ids)
        .select('id');
      if (error) throw error;
      const excluidas = (data || []).length;
      const naoExcluidas = ids.length - excluidas;
      if (naoExcluidas > 0) {
        const faltantes = ids.filter(id => !(data || []).some((d: any) => d.id === id));
        const trechos = ordens.filter(o => faltantes.includes(o.id)).map(o => o.trecho).join(', ');
        toast({
          title: `${excluidas} N.S. excluídas, ${naoExcluidas} não puderam ser excluídas`,
          description: trechos ? `Não excluídas: ${trechos}` : undefined,
          variant: 'destructive',
        });
      } else {
        toast({ title: `${excluidas} N.S. excluídas com sucesso` });
      }
      setSelected(new Set());
      setShowDeleteConfirm(false);
      refetch();
    } catch (e: any) {
      toast({ title: 'Erro ao excluir N.S.', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setDeleting(false);
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

  /** Metadados das colunas filtráveis (padrão Excel). */
  const OS_COLS: { id: string; label: string; type: ColFilterType; className: string; align?: string }[] = [
    { id: 'trecho', label: 'Trecho', type: 'text', className: 'text-left px-2 sm:px-4 py-3 font-medium text-muted-foreground whitespace-nowrap' },
    { id: 'bacia', label: 'Bacia', type: 'text', className: 'text-left px-2 sm:px-4 py-3 font-medium text-muted-foreground whitespace-nowrap' },
    { id: 'comprimento', label: 'Comp. (m)', type: 'number', className: 'text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell' },
    { id: 'prof', label: 'Prof. Média (m)', type: 'number', className: 'text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell' },
    { id: 'executado', label: 'Executado (m)', type: 'number', className: 'text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell' },
    { id: 'pct', label: '%', type: 'number', className: 'text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell w-[160px]' },
    { id: 'responsavel', label: 'Responsável', type: 'text', className: 'text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell' },
    { id: 'status', label: 'Status', type: 'text', className: 'text-right sm:text-left px-2 sm:px-4 py-3 font-medium text-muted-foreground whitespace-nowrap' },
  ];

  /** Valor comparável de cada coluna para uma O.S. */
  const osCellValue = (os: typeof ordens[0], colId: string): CellValue => {
    const executado = producaoByOs[os.id] || 0;
    const total = Number(os.comprimento_previsto || 0);
    const pct = total > 0 ? Math.min(100, (executado / total) * 100) : 0;
    switch (colId) {
      case 'trecho': return { text: os.trecho || '—' };
      case 'bacia': return { text: os.bacia || '—' };
      case 'comprimento': return { text: os.comprimento_previsto != null ? String(os.comprimento_previsto) : '—', num: os.comprimento_previsto != null ? Number(os.comprimento_previsto) : null };
      case 'prof': return { text: os.prof_media_prevista != null ? Number(os.prof_media_prevista).toFixed(2) : '—', num: os.prof_media_prevista != null ? Number(os.prof_media_prevista) : null };
      case 'executado': return { text: executado.toFixed(2), num: executado };
      case 'pct': return { text: `${pct.toFixed(0)}%`, num: pct };
      case 'responsavel': return { text: os.liberado_para || '—' };
      case 'status': return { text: statusLabel(statusEfetivo(os)) };
      default: return { text: '' };
    }
  };

  const aplicarColunas = (data: typeof ordens) => {
    const ativos = OS_COLS.filter(c => isFilterActive(colFilters[c.id]));
    let out = ativos.length
      ? data.filter(os => ativos.every(c => passesFilter(colFilters[c.id], c.type, osCellValue(os, c.id))))
      : data;
    if (colSort) {
      const col = OS_COLS.find(c => c.id === colSort.id);
      if (col) {
        const mult = colSort.dir === 'asc' ? 1 : -1;
        out = [...out].sort((a, b) => {
          const va = osCellValue(a, col.id);
          const vb = osCellValue(b, col.id);
          if (col.type === 'number') {
            const na = va.num ?? Number.NEGATIVE_INFINITY;
            const nb = vb.num ?? Number.NEGATIVE_INFINITY;
            return (na - nb) * mult;
          }
          return naturalCompare(va.text, vb.text) * mult;
        });
      }
    }
    return out;
  };

  const OSTable = ({ data: base }: { data: typeof ordens }) => {
    const data = aplicarColunas(base);
    const allSelected = data.length > 0 && data.every(o => selected.has(o.id));
    const someSelected = data.some(o => selected.has(o.id)) && !allSelected;
    const valoresCol = (colId: string) =>
      [...new Set(base.map(os => osCellValue(os, colId).text))].sort(naturalCompare);
    return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] sm:text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary">
              {canLiberar && (
                <th className="px-2 sm:px-3 py-3 w-8 sm:w-10">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={(c) => toggleAll(data, c === true)}
                    aria-label="Selecionar todas"
                  />
                </th>
              )}
              {OS_COLS.map(c => (
                <th key={c.id} className={c.className}>
                  <div className={`flex items-center gap-1 ${c.id === 'status' ? 'justify-end sm:justify-start' : ''}`}>
                    <span className="truncate">{c.label}</span>
                    <ColumnFilterMenu
                      label={c.label}
                      type={c.type}
                      values={valoresCol(c.id)}
                      filter={colFilters[c.id]}
                      onChange={f => setColFiltros(prev => ({ ...prev, [c.id]: f }))}
                      sortDir={colSort?.id === c.id ? colSort.dir : null}
                      onSort={dir => setColSort(dir ? { id: c.id, dir } : null)}
                    />
                  </div>
                </th>
              ))}
              <th className="px-1 sm:px-2 py-3 w-auto sm:w-[180px]"></th>
            </tr>
          </thead>
          <tbody>
            {data.map(os => {
              const executado = producaoByOs[os.id] || 0;
              const total = Number(os.comprimento_previsto || 0);
              const pct = total > 0 ? Math.min(100, (executado / total) * 100) : 0;
              const isSel = selected.has(os.id);
              return (
                <tr key={os.id} className={`border-b border-border last:border-0 hover:bg-muted/20 transition-colors ${isSel ? 'bg-primary/5' : ''}`}>
                  {canLiberar && (
                    <td className="px-2 sm:px-3 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={isSel} onCheckedChange={() => toggleOne(os.id)} aria-label={`Selecionar ${os.trecho}`} />
                    </td>
                  )}
                  <td className="px-2 sm:px-4 py-3 align-middle">
                    <Link to={`/ordens/${os.id}`} className="font-medium text-primary hover:underline break-words">{os.trecho}</Link>
                  </td>
                  <td className="px-2 sm:px-4 py-3 align-middle text-foreground whitespace-nowrap">{os.bacia}</td>
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
                  <td className="px-2 py-3 sm:px-4 whitespace-nowrap text-right sm:text-left">
                    <div className="flex items-center gap-2 justify-end sm:justify-start flex-wrap">
                      <StatusBadge status={statusEfetivo(os)} size="sm" shortLabel />
                      <PavBadge osId={os.id} />
                    </div>
                  </td>
                  <td className="px-1 sm:px-2 py-3 align-middle">
                    <div className="flex items-center gap-0.5 sm:gap-1 justify-end">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <button
                                onClick={(e) => { e.stopPropagation(); if (mapeadasOsIds.has(os.id)) navigate(`/mapa?os=${os.id}`); }}
                                disabled={!mapeadasOsIds.has(os.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                aria-label="Ver no mapa"
                              >
                                <MapIcon size={14} /> <span className="hidden lg:inline">Ver no mapa</span>
                              </button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <span>{mapeadasOsIds.has(os.id) ? 'Ver no mapa' : 'Trecho ainda não vinculado ao mapa'}</span>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      {locatableOsIds.has(os.id) && (
                        <button
                          onClick={() => navigate('/dashboard', { state: { focusOsId: os.id } })}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-[hsl(var(--heca-blue-bright))] hover:bg-primary/10 transition-colors"
                          title="Localizar As Built"
                        >
                          <MapPin size={14} /> <span className="hidden lg:inline">As Built</span>
                        </button>
                      )}

                      {canLiberar && os.liberado && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDesatribuirOS([os]); }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                          title="Desatribuir N.S."
                        >
                          <UserMinus size={14} /> <span className="hidden lg:inline">Desatribuir</span>
                        </button>
                      )}
                    </div>
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

  const topTabs = (
    <div className="mb-4 border-b border-border">
      <div className="inline-flex items-stretch gap-2 rounded-t-lg">
        <button
          onClick={() => navigate('/ordens')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg border border-b-2 transition-colors ${
            !planilhaoView
              ? 'bg-card border-border border-b-primary text-primary shadow-sm'
              : 'border-transparent border-b-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          Ordens de Serviço
        </button>
        {canPlanilhao && (
          <>
            <span className="self-center w-px h-5 bg-border" aria-hidden />
            <button
              onClick={() => navigate('/ordens/planilhao')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg border border-b-2 transition-colors ${
                planilhaoView
                  ? 'bg-card border-border border-b-primary text-primary shadow-sm'
                  : 'border-transparent border-b-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              Planilhão
            </button>
          </>
        )}
      </div>
    </div>
  );

  if (planilhaoView) {
    return (
      <AppLayout>
        {topTabs}
        {canPlanilhao ? (
          <PlanilhaoConsulta />
        ) : (
          <p className="text-sm text-muted-foreground">Você não tem permissão para acessar o Planilhão.</p>
        )}
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {topTabs}
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
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as any); setColFiltros({}); setColSort(null); }} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="liberadas">
              Liberadas ({liberadasBaseCount})
            </TabsTrigger>
            <TabsTrigger value="nao-liberadas">
              Não Liberadas ({ordens.filter(os => !os.liberado).length})
            </TabsTrigger>
            <TabsTrigger value="executadas">
              Executadas ({executadasBaseCount})
            </TabsTrigger>
          </TabsList>


          <TabsContent value="liberadas">
            <OSTable data={liberadas} />
          </TabsContent>

          <TabsContent value="nao-liberadas">
            <OSTable data={naoLiberadas} />
          </TabsContent>

          <TabsContent value="executadas">
            <OSTable data={executadas} />
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
          {selectedOS.some(o => o.liberado) && (
            <button
              onClick={() => setDesatribuirOS(selectedOS.filter(o => o.liberado))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-destructive/40 text-destructive text-sm font-medium hover:bg-destructive/10"
              title="Desatribuir N.S. selecionadas"
            >
              <UserMinus size={14} /> Desatribuir
            </button>
          )}
          {canPav && (
            <>
              <button
                onClick={() => setPavModal({ modo: 'liberar', alvo: selectedOS })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/40 text-primary text-sm font-medium hover:bg-primary/10"
                title="Liberar Pavimentação"
              >
                <Layers size={14} /> Liberar Pavimentação
              </button>
              <button
                onClick={() => setPavModal({ modo: 'revogar', alvo: selectedOS })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-muted-foreground text-sm font-medium hover:bg-muted"
                title="Retirar liberação de Pavimentação"
              >
                <Layers size={14} /> Retirar Pav.
              </button>
            </>
          )}
          {canDelete && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90"
              title="Excluir N.S. selecionadas"
            >
              <Trash2 size={14} /> Excluir {selected.size} N.S. selecionada{selected.size > 1 ? 's' : ''}
            </button>
          )}
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

      <DesatribuirModal
        open={desatribuirOS.length > 0}
        onClose={() => setDesatribuirOS([])}
        selectedOS={desatribuirOS}
        onDone={() => { setSelected(new Set()); refetch(); }}
      />

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir definitivamente {selected.size} N.S. selecionada{selected.size > 1 ? 's' : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeleteSelecionadas(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Excluindo...' : 'Excluir selecionadas'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default OrdensPage;
