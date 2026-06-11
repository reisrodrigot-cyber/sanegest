import ExcelJS from 'exceljs';
import type { OrdemServico } from '@/types/sanegest';

function naturalCompare(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
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

export interface PlanilhaoBuildOptions {
  /** ISO timestamp included in the metadata row. Defaults to now. */
  generatedAt?: Date;
  /** Optional label shown alongside the timestamp ("manual", "backup automático"...). */
  sourceLabel?: string;
}

/**
 * Builds the official "PLANILHÃO" workbook used by SaneGest.
 * Same layout used by the manual export button and the backup edge function.
 */
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

  // Metadata row (B16) — generation timestamp, ignored by the importer (it reads from row 22)
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

  // Title row 17
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

  // Headers row 18+19, sub-headers row 21
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

  return wb;
}

export function planilhaoFilename(date: Date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `sanegest_japaratinga_planilhao_${yyyy}-${mm}-${dd}.xlsx`;
}

/** Triggers a browser download of the Planilhão for the given OS list. */
export async function downloadPlanilhao(ordens: OrdemServico[]) {
  const now = new Date();
  const wb = await buildPlanilhaoWorkbook(ordens, { generatedAt: now, sourceLabel: 'manual' });
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = planilhaoFilename(now);
  a.click();
  URL.revokeObjectURL(url);
}
