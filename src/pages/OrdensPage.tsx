import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { OSStatus } from '@/types/sanegest';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, Loader2, FileSpreadsheet, AlertTriangle, Download, MapPin } from 'lucide-react';
import ExcelJS from 'exceljs';
import { useOrdensServico } from '@/hooks/useOrdensServico';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  const { ordens, loading } = useOrdensServico();
  const { user, effectiveRole } = useAuth();
  const role = effectiveRole || user?.role;
  const canImport = role === 'admin' || role === 'sala_tecnica';
  const [faseFilter, setFaseFilter] = useState<OSStatus | 'TODAS'>('TODAS');
  const [baciaFilter, setBaciaFilter] = useState('TODAS');
  const [responsavelFilter, setResponsavelFilter] = useState('TODOS');
  const [search, setSearch] = useState('');

  // Aggregated produção (sum comprimento_dia) per OS
  const [producaoByOs, setProducaoByOs] = useState<Record<string, number>>({});
  // Latest status change date per OS
  const [statusSinceByOs, setStatusSinceByOs] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: regs }, { data: hist }] = await Promise.all([
        supabase.from('registros_producao').select('os_id, comprimento_dia'),
        supabase
          .from('os_status_historico')
          .select('os_id, created_at')
          .order('created_at', { ascending: false }),
      ]);
      if (cancelled) return;

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
    const headers = [
      'Trecho','BACIA','PV de Montante','PV de Jusante',
      'Comprimento (m)','Comprimento REAL (m)','Largura de Vala',
      'Prof. Média EXECUTADA  (m)','Prof. Média  (m)','Prof. Média REAL  (m)',
      'DN (m)','Prof. Mont.  (m)','Prof. Jus.  (m)',
      'PAV','PAV REAL','LARG. PAV.','LARG. PAV REAL','PAV. M2','PAV. REAL(M2)',
      'AREIA','BRITA','Previsão de ligação por TR',' ligação por TR REAL',
      'Bomba de Rebaixo','PRAZO               (dias)','PRAZO               (dias arrend)',"BM'S",
    ];
    const subHeaders = [
      'trecho','bacia','pv_montante','pv_jusante',
      'comprimento_previsto','comprimento_real','largura_vala',
      'prof_media_executada','prof_media_prevista','prof_media_real',
      'dn','prof_montante','prof_jusante',
      'pav_previsto','pav_real','largura_pav_prevista','largura_pav_real',
      'pav_m2_previsto','pav_m2_real','areia','brita',
      'ligacoes_previstas','ligacoes_real','bomba_rebaixo',
      'prazo_previsto','prazo_arredondado','bms',
    ];
    // Color per column index (0=B ... 26=AB)
    const YELLOW = 'FFFFFF00', LBLUE = 'FF99CCFF', LYELLOW = 'FFFFFFCC';
    const colorByIdx: (string | null)[] = [
      YELLOW,YELLOW,YELLOW,YELLOW,YELLOW,null,YELLOW,    // B-H
      LBLUE,LBLUE,null,LYELLOW,YELLOW,YELLOW,            // I-N
      null,null,null,null,null,null,                      // O-T
      LYELLOW,LYELLOW,LYELLOW,null,LYELLOW,              // U-Y
      LBLUE,LBLUE,LBLUE,                                  // Z,AA,AB
    ];
    const widths: Record<string, number> = {
      A:4, B:13.71, C:14.71, D:16.86, E:10.29, F:11.14, H:8.43, I:14.43, J:10.43,
      L:6.43, M:10.29, N:10.71, O:11, P:12.14, Q:7, R:7.71, T:9.14, U:8.86,
      V:7.86, W:9, Y:7.71, AA:8.29, AB:6.14,
    };

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('PLANILHÃO', {
      views: [{ state: 'normal', zoomScale: 70, showGridLines: false }],
    });

    // Column widths
    Object.entries(widths).forEach(([col, w]) => { ws.getColumn(col).width = w; });

    // Row heights
    const rowHeights: Record<number, number> = {
      17: 15.75, 18: 12.0, 19: 12.75, 20: 12.0, 21: 22.5,
    };
    Object.entries(rowHeights).forEach(([r, h]) => { ws.getRow(Number(r)).height = h; });

    const thinBorder = {
      top: { style: 'thin' as const },
      bottom: { style: 'thin' as const },
      left: { style: 'thin' as const },
      right: { style: 'thin' as const },
    };

    // Title row 17 (B17:AB17)
    ws.mergeCells('B17:AB17');
    const title = ws.getCell('B17');
    title.value = 'Dados de Entrada';
    title.font = { name: 'Arial', size: 10, bold: true };
    title.alignment = { horizontal: 'center', vertical: 'middle' };
    title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF99CCFF' } };
    title.border = thinBorder;
    // Apply borders to all merged title cells
    for (let i = 0; i < 27; i++) {
      ws.getCell(`${(() => { const n = i + 2; let s = ''; let x = n; while (x > 0) { const r = (x - 1) % 26; s = String.fromCharCode(65 + r) + s; x = Math.floor((x - 1) / 26); } return s; })()}17`).border = thinBorder;
    }

    const colLetter = (i: number) => {
      // i=0 -> B, i=26 -> AB
      const n = i + 2; // column number (1-based); B=2
      let s = '';
      let x = n;
      while (x > 0) { const r = (x - 1) % 26; s = String.fromCharCode(65 + r) + s; x = Math.floor((x - 1) / 26); }
      return s;
    };

    // Headers row 18 (merged with row 19) + sub-headers row 21
    headers.forEach((h, i) => {
      const letter = colLetter(i);
      ws.mergeCells(`${letter}18:${letter}19`);
      const cell = ws.getCell(`${letter}18`);
      cell.value = h;
      cell.font = { name: 'Arial', size: 10, bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      const fill = colorByIdx[i];
      if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
      cell.border = thinBorder;
      ws.getCell(`${letter}19`).border = thinBorder;

      const sub = ws.getCell(`${letter}21`);
      sub.value = subHeaders[i];
      sub.font = { name: 'Arial', size: 8, italic: true };
      sub.alignment = { horizontal: 'center', vertical: 'middle' };
      sub.border = thinBorder;
    });

    // AutoFilter on row 21
    ws.autoFilter = 'B21:AB21';

    // Data rows starting at row 22
    const sortedOrdens = [...ordens].sort((a, b) => naturalCompare(a.trecho, b.trecho));
    sortedOrdens.forEach((os, idx) => {
      const r = 22 + idx;
      ws.getRow(r).height = 12.0;
      const values = [
        os.trecho, os.bacia, os.pv_montante, os.pv_jusante,
        os.comprimento_previsto, os.comprimento_real, os.largura_vala,
        os.prof_media_executada, os.prof_media_prevista, os.prof_media_real,
        os.dn, os.prof_montante, os.prof_jusante,
        os.pav_previsto, os.pav_real, os.largura_pav_prevista, os.largura_pav_real,
        os.pav_m2_previsto, os.pav_m2_real, os.areia, os.brita,
        os.ligacoes_previstas, os.ligacoes_real, os.bomba_rebaixo ? 'SIM' : 'NÃO',
        os.prazo_previsto, os.prazo_arredondado, os.bms,
      ];
      values.forEach((v, i) => {
        const cell = ws.getCell(`${colLetter(i)}${r}`);
        cell.value = v as any;
        cell.font = { name: 'Arial', size: 10 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = thinBorder;
      });
    });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Planilhao_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const OSTable = ({ data }: { data: typeof ordens }) => (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Trecho</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Bacia</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Comp. (m)</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Prof. Média (m)</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Executado (m)</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell w-[160px]">%</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Responsável</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
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
              return (
                <tr key={os.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/ordens/${os.id}`} className="font-medium text-secondary hover:underline">{os.trecho}</Link>
                  </td>
                  <td className="px-4 py-3 text-foreground">{os.bacia}</td>
                  <td className="px-4 py-3 text-foreground hidden md:table-cell">{os.comprimento_previsto ?? '—'}</td>
                  <td className="px-4 py-3 text-foreground hidden md:table-cell">{os.prof_media_prevista != null ? Number(os.prof_media_prevista).toFixed(2) : '—'}</td>
                  <td className="px-4 py-3 text-foreground hidden md:table-cell">{executado.toFixed(2).replace('.', ',')}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground tabular-nums w-10">{pct.toFixed(0)}%</span>
                      <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden min-w-[60px]">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
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
                            <TooltipContent>
                              <span>⚠️ Parado há {dias} dias</span>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {data.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
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
    </AppLayout>
  );
};

export default OrdensPage;
