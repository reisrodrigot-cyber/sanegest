import ExcelJS from 'exceljs';
import { supabase } from '@/integrations/supabase/client';
import type { OrdemServico } from '@/types/sanegest';

function naturalCompare(a: string, b: string) {
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true, sensitivity: 'base' });
}

const colLetter = (i: number) => {
  const n = i + 2;
  let s = '';
  let x = n;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
};

// Letter for absolute column (1 = A)
const absLetter = (n: number) => {
  let s = '';
  let x = n;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
};

export interface PlanilhaoBuildOptions {
  generatedAt?: Date;
  sourceLabel?: string;
  /** Map de revisões por os_id (já ordenadas por versão asc). */
  revisoesByOsId?: Record<string, any[]>;
}

/** Campos projetados controlados pela revisão (mesma lista do importador). */
export const REV_FIELDS: { key: keyof OrdemServico; label: string }[] = [
  { key: 'trecho', label: 'Trecho' },
  { key: 'bacia', label: 'Bacia' },
  { key: 'pv_montante', label: 'PV Montante' },
  { key: 'pv_jusante', label: 'PV Jusante' },
  { key: 'comprimento_previsto', label: 'Comprimento (m)' },
  { key: 'largura_vala', label: 'Largura de Vala' },
  { key: 'prof_media_prevista', label: 'Prof. Média (m)' },
  { key: 'dn', label: 'DN (m)' },
  { key: 'prof_montante', label: 'Prof. Mont. (m)' },
  { key: 'prof_jusante', label: 'Prof. Jus. (m)' },
  { key: 'pav_previsto', label: 'PAV' },
  { key: 'largura_pav_prevista', label: 'Larg. PAV' },
  { key: 'pav_m2_previsto', label: 'PAV (m²)' },
  { key: 'areia', label: 'Areia' },
  { key: 'brita', label: 'Brita' },
  { key: 'ligacoes_previstas', label: 'Ligações previstas' },
  { key: 'bomba_rebaixo', label: 'Bomba de Rebaixo' },
  { key: 'prazo_previsto', label: 'Prazo (dias)' },
  { key: 'prazo_arredondado', label: 'Prazo arred. (dias)' },
  { key: 'bms', label: "BM's" },
];

export async function buildPlanilhaoWorkbook(
  ordens: OrdemServico[],
  options: PlanilhaoBuildOptions = {},
): Promise<ExcelJS.Workbook> {
  const headers = [
    'Trecho','BACIA','PV de Montante','PV de Jusante',
    'Comprimento (m)','Comprimento REAL (m)','Largura de Vala',
    'Prof. Média  (m)','Prof. Média REAL  (m)',
    'DN (m)','Prof. Mont.  (m)','Prof. Jus.  (m)',
    'PAV','PAV REAL','LARG. PAV.','LARG. PAV REAL','PAV. M2','PAV. REAL(M2)',
    'AREIA','BRITA','Previsão de ligação por TR',' ligação por TR REAL',
    'Bomba de Rebaixo','PRAZO               (dias)','PRAZO               (dias arrend)',"BM'S",
  ];
  const subHeaders = [
    'trecho','bacia','pv_montante','pv_jusante',
    'comprimento_previsto','comprimento_real','largura_vala',
    'prof_media_prevista','prof_media_real',
    'dn','prof_montante','prof_jusante',
    'pav_previsto','pav_real','largura_pav_prevista','largura_pav_real',
    'pav_m2_previsto','pav_m2_real','areia','brita',
    'ligacoes_previstas','ligacoes_real','bomba_rebaixo',
    'prazo_previsto','prazo_arredondado','bms',
  ];
  const YELLOW = 'FFFFFF00', LBLUE = 'FF99CCFF', LYELLOW = 'FFFFFFCC';
  const colorByIdx: (string | null)[] = [
    YELLOW,YELLOW,YELLOW,YELLOW,YELLOW,null,YELLOW,
    LBLUE,null,LYELLOW,YELLOW,YELLOW,
    null,null,null,null,null,null,
    LYELLOW,LYELLOW,LYELLOW,null,LYELLOW,
    LBLUE,LBLUE,LBLUE,
  ];
  const widths: Record<string, number> = {
    A:4, B:13.71, C:14.71, D:16.86, E:10.29, F:11.14, H:8.43, I:14.43,
    J:10.43, K:6.43, L:10.29, M:10.71, N:11, O:12.14, P:7, Q:7.71,
    S:9.14, T:8.86, U:7.86, V:9, X:7.71, Z:8.29, AA:6.14,
  };

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('PLANILHÃO', {
    views: [{ state: 'normal', zoomScale: 70, showGridLines: false }],
  });

  Object.entries(widths).forEach(([col, w]) => { ws.getColumn(col).width = w; });

  const rowHeights: Record<number, number> = { 17: 15.75, 18: 12.0, 19: 12.75, 20: 12.0, 21: 22.5 };
  Object.entries(rowHeights).forEach(([r, h]) => { ws.getRow(Number(r)).height = h; });

  const thinBorder = {
    top: { style: 'thin' as const },
    bottom: { style: 'thin' as const },
    left: { style: 'thin' as const },
    right: { style: 'thin' as const },
  };

  const generatedAt = options.generatedAt ?? new Date();
  const ts =
    `${String(generatedAt.getDate()).padStart(2, '0')}/` +
    `${String(generatedAt.getMonth() + 1).padStart(2, '0')}/` +
    `${generatedAt.getFullYear()} ` +
    `${String(generatedAt.getHours()).padStart(2, '0')}:` +
    `${String(generatedAt.getMinutes()).padStart(2, '0')}`;
  const metaCell = ws.getCell('B16');
  metaCell.value = `Gerado em ${ts}${options.sourceLabel ? ` (${options.sourceLabel})` : ''} — ${ordens.length} registros`;
  metaCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF666666' } };
  ws.mergeCells('B16:AA16');

  ws.mergeCells('B17:AA17');
  const title = ws.getCell('B17');
  title.value = 'Dados de Entrada';
  title.font = { name: 'Arial', size: 10, bold: true };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF99CCFF' } };
  title.border = thinBorder;
  for (let i = 0; i < 26; i++) {
    ws.getCell(`${colLetter(i)}17`).border = thinBorder;
  }

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

  ws.autoFilter = 'B21:AA21';

  const sorted = [...ordens].sort((a, b) => naturalCompare(a.trecho, b.trecho));
  sorted.forEach((os, idx) => {
    const r = 22 + idx;
    ws.getRow(r).height = 12.0;
    const values: any[] = [
      os.trecho, os.bacia, os.pv_montante, os.pv_jusante,
      os.comprimento_previsto, os.comprimento_real, os.largura_vala,
      os.prof_media_prevista, os.prof_media_real,
      os.dn, os.prof_montante, os.prof_jusante,
      os.pav_previsto, os.pav_real, os.largura_pav_prevista, os.largura_pav_real,
      os.pav_m2_previsto, os.pav_m2_real, os.areia, os.brita,
      os.ligacoes_previstas, os.ligacoes_real, os.bomba_rebaixo ? 'SIM' : 'NÃO',
      os.prazo_previsto, os.prazo_arredondado, os.bms,
    ];
    values.forEach((v, i) => {
      const cell = ws.getCell(`${colLetter(i)}${r}`);
      cell.value = v;
      cell.font = { name: 'Arial', size: 10 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder;
    });
  });

  // Blocos de revisão a partir da coluna AB (índice 26)
  if (options.revisoesByOsId) {
    addRevisionBlocks(ws, sorted, options.revisoesByOsId, thinBorder);
    addRevisoesSheet(wb, sorted, options.revisoesByOsId);
  }

  return wb;
}

interface RevBlockField {
  label: string;
  get: (rev: any) => any;
  width?: number;
}

const REV_BLOCK_FIELDS: RevBlockField[] = [
  { label: 'Comprimento (m)', get: r => r.comprimento_previsto, width: 12 },
  { label: 'PV Montante', get: r => r.pv_montante, width: 12 },
  { label: 'PV Jusante', get: r => r.pv_jusante, width: 12 },
  { label: 'Prof. Mont. (m)', get: r => r.prof_montante, width: 11 },
  { label: 'Prof. Jus. (m)', get: r => r.prof_jusante, width: 11 },
  { label: 'Largura de Vala', get: r => r.largura_vala, width: 11 },
  { label: 'Prof. Média (m)', get: r => r.prof_media_prevista, width: 12 },
  { label: 'DN (m)', get: r => r.dn, width: 8 },
  { label: 'PAV', get: r => r.pav_previsto, width: 10 },
  { label: 'Ligações previstas', get: r => r.ligacoes_previstas, width: 11 },
  { label: 'Data', get: r => r.imported_at ? fmtRevDate(r.imported_at) : '', width: 12 },
  { label: 'Origem', get: r => buildOrigem(r), width: 28 },
];

function fmtRevDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function buildOrigem(rev: any): string {
  const parts: string[] = [];
  if (rev.rotulo) parts.push(rev.rotulo);
  const log = rev.import_log;
  if (log?.filename) parts.push(log.filename);
  if (log?.user_email) parts.push(log.user_email);
  return parts.join(' · ');
}

function addRevisionBlocks(
  ws: ExcelJS.Worksheet,
  ordens: OrdemServico[],
  revisoesByOsId: Record<string, any[]>,
  thinBorder: any,
) {
  let maxRev = 0;
  for (const arr of Object.values(revisoesByOsId)) {
    const top = arr.reduce((m, r) => Math.max(m, r.versao || 0), 0);
    if (top > maxRev) maxRev = top;
  }
  if (maxRev === 0) return;

  const PURPLE = 'FFE4D7F5';
  const PURPLE_DARK = 'FFB39DDB';
  const startCol = 27; // coluna AB (A=1)
  const fieldsCount = REV_BLOCK_FIELDS.length;

  for (let v = 1; v <= maxRev; v++) {
    const blockStart = startCol + (v - 1) * fieldsCount;
    const blockEnd = blockStart + fieldsCount - 1;

    ws.mergeCells(17, blockStart, 17, blockEnd);
    const titleCell = ws.getCell(17, blockStart);
    titleCell.value = `Revisão ${String(v).padStart(2, '0')}`;
    titleCell.font = { name: 'Arial', size: 10, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PURPLE_DARK } };
    titleCell.border = thinBorder;

    REV_BLOCK_FIELDS.forEach((f, i) => {
      const col = blockStart + i;
      ws.mergeCells(18, col, 19, col);
      const h = ws.getCell(18, col);
      h.value = `${f.label} Rev.${String(v).padStart(2, '0')}`;
      h.font = { name: 'Arial', size: 9, bold: true };
      h.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PURPLE } };
      h.border = thinBorder;
      ws.getCell(19, col).border = thinBorder;

      const sub = ws.getCell(21, col);
      sub.value = `rev${String(v).padStart(2, '0')}_${f.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
      sub.font = { name: 'Arial', size: 8, italic: true };
      sub.alignment = { horizontal: 'center', vertical: 'middle' };
      sub.border = thinBorder;

      if (f.width) ws.getColumn(col).width = f.width;
    });
  }

  ordens.forEach((os, idx) => {
    const r = 22 + idx;
    const revs = revisoesByOsId[os.id] || [];
    for (let v = 1; v <= maxRev; v++) {
      const rev = revs.find(x => (x.versao || 0) === v);
      const blockStart = startCol + (v - 1) * fieldsCount;
      REV_BLOCK_FIELDS.forEach((f, i) => {
        const cell = ws.getCell(r, blockStart + i);
        const val = rev ? f.get(rev) : '';
        cell.value = val === null || val === undefined ? '' : val;
        cell.font = { name: 'Arial', size: 10 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = thinBorder;
      });
    }
  });
}

function fmtRevValue(field: keyof OrdemServico, v: any): any {
  if (v === null || v === undefined || v === '') return '';
  if (field === 'bomba_rebaixo') return v ? 'SIM' : 'NÃO';
  return v;
}

function addRevisoesSheet(
  wb: ExcelJS.Workbook,
  ordens: OrdemServico[],
  revisoesByOsId: Record<string, any[]>,
) {
  const ws = wb.addWorksheet('REVISÕES', {
    views: [{ state: 'normal', zoomScale: 90, showGridLines: false }],
  });

  // Quantidade máxima de revisões (excluindo base versao=0)
  let maxRev = 0;
  for (const arr of Object.values(revisoesByOsId)) {
    const top = arr.reduce((m, r) => Math.max(m, r.versao || 0), 0);
    if (top > maxRev) maxRev = top;
  }

  const baseCols = ['Trecho', 'Bacia', 'PV Montante', 'PV Jusante', 'Vigência', 'Campo', 'Projeto Base'];
  const revCols: string[] = [];
  for (let v = 1; v <= maxRev; v++) revCols.push(`Rev.${String(v).padStart(2, '0')}`);
  const allCols = [...baseCols, ...revCols, 'Atual / Vigente'];

  const thinBorder = {
    top: { style: 'thin' as const }, bottom: { style: 'thin' as const },
    left: { style: 'thin' as const }, right: { style: 'thin' as const },
  };

  // Header
  allCols.forEach((c, i) => {
    const cell = ws.getCell(1, i + 1);
    cell.value = c;
    cell.font = { name: 'Arial', size: 10, bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF99CCFF' } };
    cell.border = thinBorder;
  });
  ws.getRow(1).height = 26;

  // Widths
  ws.getColumn(1).width = 12;
  ws.getColumn(2).width = 14;
  ws.getColumn(3).width = 14;
  ws.getColumn(4).width = 14;
  ws.getColumn(5).width = 12;
  ws.getColumn(6).width = 22;
  for (let i = 7; i <= allCols.length; i++) ws.getColumn(i).width = 16;

  let r = 2;
  for (const os of ordens) {
    const revs = (revisoesByOsId[os.id] || []).slice().sort((a, b) => (a.versao || 0) - (b.versao || 0));
    if (!revs.some(x => (x.versao || 0) > 0)) continue;
    const base = revs.find(x => (x.versao || 0) === 0);
    const startRow = r;

    for (const field of REV_FIELDS) {
      const row = ws.getRow(r);
      const cells: any[] = [
        os.trecho, os.bacia, os.pv_montante, os.pv_jusante,
        (os as any).status_vigencia || 'ATIVO',
        field.label,
        base ? fmtRevValue(field.key, base[field.key as string]) : '',
      ];
      for (let v = 1; v <= maxRev; v++) {
        const rev = revs.find(x => (x.versao || 0) === v);
        cells.push(rev ? fmtRevValue(field.key, rev[field.key as string]) : '');
      }
      cells.push(fmtRevValue(field.key, (os as any)[field.key]));

      cells.forEach((val, i) => {
        const cell = row.getCell(i + 1);
        cell.value = val;
        cell.font = { name: 'Arial', size: 9 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = thinBorder;
      });
      r++;
    }

    // Mescla as 4 primeiras colunas (Trecho..PV Jusante) + Vigência para a OS
    if (REV_FIELDS.length > 1) {
      for (let col = 1; col <= 5; col++) {
        ws.mergeCells(startRow, col, r - 1, col);
        const c = ws.getCell(startRow, col);
        c.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    }
  }

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: allCols.length } };
  ws.views = [{ state: 'frozen', xSplit: 6, ySplit: 1 }];
}

export function planilhaoFilename(date: Date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `sanegest_japaratinga_planilhao_${yyyy}-${mm}-${dd}.xlsx`;
}

/** Busca todas as revisões em lote e agrupa por os_id. */
export async function fetchRevisoesByOsId(osIds: string[]): Promise<Record<string, any[]>> {
  const map: Record<string, any[]> = {};
  if (osIds.length === 0) return map;
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('os_revisoes' as any)
      .select('*, import_log:import_logs(filename,user_email,created_at)')
      .in('os_id', osIds)
      .order('versao', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) { console.error('Falha ao carregar revisões:', error); break; }
    const rows = (data as any[]) || [];
    for (const row of rows) {
      (map[row.os_id] ||= []).push(row);
    }
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return map;
}

export async function downloadPlanilhao(ordens: OrdemServico[]) {
  const now = new Date();
  const revisoesByOsId = await fetchRevisoesByOsId(ordens.map(o => o.id));
  const wb = await buildPlanilhaoWorkbook(ordens, { generatedAt: now, sourceLabel: 'manual', revisoesByOsId });
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = planilhaoFilename(now);
  a.click();
  URL.revokeObjectURL(url);
}
