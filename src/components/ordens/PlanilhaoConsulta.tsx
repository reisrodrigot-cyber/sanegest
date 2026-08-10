import { useMemo, useRef, useState } from 'react';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Columns3, Download, FileText, Loader2, RotateCcw, Search, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { usePlanilhaoTabela, defaultPrefs } from '@/hooks/usePlanilhaoTabela';
import { ColumnFilterMenu } from '@/components/tabela/ColumnFilterMenu';
import { isFilterActive, type ColumnFilterValue } from '@/lib/columnFilter';
import {
  aplicarFiltrosColuna,
  calcularTotais,
  cellText,
  colFilterType,
  fmtNumber,
  ordenar,
  valoresDistintos,
  PLANILHAO_COLUMNS,
  type PlanilhaoColumn,
} from '@/lib/planilhaoTabela';

/**
 * Planilhão — consulta consolidada (uma linha por Bacia + Trecho).
 * Somente leitura: filtros, personalização da grade e exportação.
 */
export const PlanilhaoConsulta = () => {
  const { rows, loading, erro, recarregar, prefs, setPrefs, visibleColumns } = usePlanilhaoTabela();
  const [busca, setBusca] = useState('');
  const [buscaColuna, setBuscaColuna] = useState('');
  const [exportando, setExportando] = useState<'xlsx' | 'pdf' | null>(null);
  const dragCol = useRef<string | null>(null);

  const filtradas = useMemo(
    () => aplicarFiltrosColuna(rows, prefs.colFilters, busca, prefs.visible),
    [rows, prefs.colFilters, prefs.visible, busca],
  );
  const dados = useMemo(() => ordenar(filtradas, prefs.sort), [filtradas, prefs.sort]);
  const totais = useMemo(() => calcularTotais(dados, prefs.visible), [dados, prefs.visible]);

  const setColFiltro = (id: string, f: ColumnFilterValue) =>
    setPrefs(p => ({ ...p, colFilters: { ...p.colFilters, [id]: f } }));

  const setOrdenacao = (id: string, dir: 'asc' | 'desc' | null) =>
    setPrefs(p => ({ ...p, sort: dir ? { id, dir } : null }));

  const toggleColuna = (id: string) =>
    setPrefs(p => ({
      ...p,
      visible: p.visible.includes(id) ? p.visible.filter(v => v !== id) : [...p.visible, id],
    }));

  const alternarOrdenacao = (id: string) =>
    setPrefs(p => ({
      ...p,
      sort: p.sort?.id === id ? (p.sort.dir === 'asc' ? { id, dir: 'desc' } : null) : { id, dir: 'asc' },
    }));

  const iniciarResize = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = prefs.widths[id] ?? 120;
    const onMove = (ev: MouseEvent) => {
      const w = Math.max(70, startW + (ev.clientX - startX));
      setPrefs(p => ({ ...p, widths: { ...p.widths, [id]: w } }));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const soltarColuna = (destino: string) => {
    const origem = dragCol.current;
    dragCol.current = null;
    if (!origem || origem === destino) return;
    setPrefs(p => {
      const order = p.order.filter(id => id !== origem);
      const idx = order.indexOf(destino);
      order.splice(idx < 0 ? order.length : idx, 0, origem);
      return { ...p, order };
    });
  };

  const nomeArquivo = (ext: string) => {
    const d = new Date();
    const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return `sanegest_planilhao_consulta_${s}.${ext}`;
  };

  const baixar = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  /** Exporta exatamente a visão ativa: colunas visíveis, ordem, filtros e ordenação. */
  const exportarExcel = async () => {
    setExportando('xlsx');
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('PLANILHÃO');
      ws.addRow(visibleColumns.map(c => c.label));
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      visibleColumns.forEach((c, i) => { ws.getColumn(i + 1).width = Math.max(12, (prefs.widths[c.id] ?? c.width) / 7); });
      dados.forEach(r => {
        ws.addRow(visibleColumns.map(c => {
          const v = r[c.id];
          if (c.type === 'number') {
            if (v == null) return null;
            const d = c.decimals ?? 2;
            return Number(Number(v).toFixed(d));
          }
          return cellText(r, c) === '—' ? '' : cellText(r, c);
        }));
      });
      const totalRow = ws.addRow(visibleColumns.map((c, i) =>
        i === 0
          ? `TOTAL (${dados.length} linhas)`
          : (c.id in totais ? Number(totais[c.id].toFixed(c.decimals ?? 2)) : null),
      ));
      totalRow.font = { bold: true };
      const buf = await wb.xlsx.writeBuffer();
      baixar(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nomeArquivo('xlsx'));
      toast({ title: 'Excel exportado', description: `${dados.length} linhas, ${visibleColumns.length} colunas.` });
    } catch (e) {
      toast({ title: 'Erro ao exportar Excel', description: String(e), variant: 'destructive' });
    } finally {
      setExportando(null);
    }
  };

  const exportarPDF = async () => {
    setExportando('pdf');
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      doc.setFontSize(13);
      doc.text('SaneGest — Planilhão (consulta consolidada)', 32, 32);
      doc.setFontSize(9);
      doc.text(`${dados.length} linhas · gerado em ${new Date().toLocaleString('pt-BR')}`, 32, 46);
      autoTable(doc, {
        startY: 58,
        head: [visibleColumns.map(c => c.label)],
        body: dados.map(r => visibleColumns.map(c => cellText(r, c))),
        foot: [visibleColumns.map((c, i) =>
          i === 0 ? `TOTAL (${dados.length})` : (c.id in totais ? fmtNumber(totais[c.id], c.decimals ?? 2) : ''),
        )],
        styles: { fontSize: 7, cellPadding: 3 },
        headStyles: { fillColor: [12, 68, 124], textColor: 255, fontSize: 7 },
        footStyles: { fillColor: [235, 235, 235], textColor: 20, fontStyle: 'bold' },
      });
      baixar(doc.output('blob'), nomeArquivo('pdf'));
      toast({ title: 'PDF exportado', description: `${dados.length} linhas, ${visibleColumns.length} colunas.` });
    } catch (e) {
      toast({ title: 'Erro ao exportar PDF', description: String(e), variant: 'destructive' });
    } finally {
      setExportando(null);
    }
  };

  const colunasBusca = PLANILHAO_COLUMNS.filter(c =>
    c.label.toLowerCase().includes(buscaColuna.trim().toLowerCase()),
  );
  const temFiltro = busca.trim() !== '' || Object.values(prefs.filters).some(v => v.trim() !== '');

  return (
    <div className="space-y-3">
      {/* Barra de ações */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar nas colunas visíveis..."
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-card text-sm text-foreground"
          />
        </div>

        {/* Mobile: quatro ações compactas em uma faixa; desktop: inalterado */}
        <div className="grid grid-cols-4 gap-2 lg:flex lg:items-center lg:gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <button
              aria-label="Colunas visíveis"
              title="Colunas visíveis"
              className="inline-flex items-center justify-center lg:justify-start gap-1.5 px-2 lg:px-3 py-2.5 rounded-lg border border-border bg-card text-xs lg:text-sm font-medium hover:bg-muted transition-colors"
            >
              <Columns3 size={16} />
              <span className="hidden lg:inline">Colunas ({visibleColumns.length}/{PLANILHAO_COLUMNS.length})</span>
              <span className="lg:hidden">Colunas</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-0">
            <div className="p-2 border-b border-border">
              <input
                type="text"
                value={buscaColuna}
                onChange={e => setBuscaColuna(e.target.value)}
                placeholder="Pesquisar coluna..."
                className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-sm"
              />
            </div>
            <div className="max-h-72 overflow-y-auto p-2 space-y-1">
              {colunasBusca.map(c => (
                <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer text-sm">
                  <Checkbox
                    checked={prefs.visible.includes(c.id)}
                    onCheckedChange={() => toggleColuna(c.id)}
                  />
                  <span>{c.label}</span>
                </label>
              ))}
              {colunasBusca.length === 0 && (
                <p className="text-sm text-muted-foreground px-2 py-3">Nenhuma coluna encontrada.</p>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <button
          onClick={() => { setBusca(''); setPrefs(p => ({ ...p, filters: {} })); }}
          disabled={!temFiltro}
          aria-label="Limpar filtros"
          title="Limpar filtros"
          className="inline-flex lg:hidden items-center justify-center gap-1.5 px-2 py-2.5 rounded-lg border border-border bg-card text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
        >
          <X size={16} /> Limpar
        </button>

        <button
          onClick={() => { setPrefs(defaultPrefs()); setBusca(''); }}
          className="hidden lg:inline-flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
          title="Restaurar grade padrão"
        >
          <RotateCcw size={16} /> <span className="hidden sm:inline">Restaurar</span>
        </button>

        <button
          onClick={exportarExcel}
          disabled={exportando !== null || dados.length === 0}
          aria-label="Exportar Excel"
          title="Exportar Excel"
          className="inline-flex items-center justify-center lg:justify-start gap-1.5 px-2 lg:px-3 py-2.5 rounded-lg border border-border bg-card text-xs lg:text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
        >
          {exportando === 'xlsx' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Excel
        </button>
        <button
          onClick={exportarPDF}
          disabled={exportando !== null || dados.length === 0}
          aria-label="Exportar PDF"
          title="Exportar PDF"
          className="inline-flex items-center justify-center lg:justify-start gap-1.5 px-2 lg:px-3 py-2.5 rounded-lg bg-primary text-primary-foreground text-xs lg:text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {exportando === 'pdf' ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} PDF
        </button>
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>{dados.length} de {rows.length} trechos</span>
        {temFiltro && (
          <button
            onClick={() => { setBusca(''); setPrefs(p => ({ ...p, filters: {} })); }}
            className="inline-flex items-center gap-1 text-foreground hover:underline"
          >
            <X size={13} /> limpar filtros
          </button>
        )}
      </div>

      {/* Grade */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="text-sm" style={{ tableLayout: 'fixed', minWidth: '100%' }}>
            <thead>
              <tr className="border-b border-border bg-secondary">
                {visibleColumns.map((c: PlanilhaoColumn) => (
                  <th
                    key={c.id}
                    draggable
                    onDragStart={() => { dragCol.current = c.id; }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => soltarColuna(c.id)}
                    style={{ width: prefs.widths[c.id] ?? c.width }}
                    className="relative px-3 py-2 text-left align-top font-semibold text-foreground select-none"
                  >
                    <button
                      onClick={() => alternarOrdenacao(c.id)}
                      className="w-full text-left truncate hover:text-primary"
                      title={`Ordenar por ${c.label}`}
                    >
                      {c.label}
                      {prefs.sort?.id === c.id ? (prefs.sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                    </button>
                    <input
                      type="text"
                      value={prefs.filters[c.id] ?? ''}
                      onChange={e => setFiltro(c.id, e.target.value)}
                      placeholder="Filtrar..."
                      className="mt-1 w-full px-2 py-1 rounded border border-border bg-background text-xs font-normal"
                    />
                    <span
                      onMouseDown={e => iniciarResize(e, c.id)}
                      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40"
                      aria-hidden
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dados.map(r => (
                <tr key={r.key} className="border-b border-border/60 hover:bg-muted/20">
                  {visibleColumns.map(c => (
                    <td
                      key={c.id}
                      style={{ width: prefs.widths[c.id] ?? c.width }}
                      className={`px-3 py-2 truncate ${c.type === 'number' ? 'text-right tabular-nums' : ''}`}
                      title={cellText(r, c)}
                    >
                      {cellText(r, c)}
                    </td>
                  ))}
                </tr>
              ))}
              {!loading && dados.length === 0 && (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-4 py-10 text-center text-muted-foreground">
                    {erro
                      ? 'Não foi possível carregar o Planilhão.'
                      : rows.length === 0
                        ? 'Nenhuma N.S. vigente encontrada.'
                        : 'Nenhum registro para os filtros aplicados.'}
                    {erro && (
                      <button onClick={recarregar} className="ml-2 underline text-foreground">Tentar novamente</button>
                    )}
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-4 py-10 text-center text-muted-foreground">
                    <Loader2 size={18} className="inline animate-spin mr-2" /> Carregando...
                  </td>
                </tr>
              )}
            </tbody>
            {dados.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border bg-secondary font-semibold">
                  {visibleColumns.map((c, i) => (
                    <td key={c.id} className={`px-3 py-2 ${c.type === 'number' ? 'text-right tabular-nums' : ''}`}>
                      {i === 0
                        ? `TOTAL (${dados.length})`
                        : c.id in totais
                          ? fmtNumber(totais[c.id], c.decimals ?? 2)
                          : ''}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default PlanilhaoConsulta;
