// Edge Function: export-planilhao
// Streams the official PLANILHÃO workbook for backup automation.
// Auth: either a valid user session (admin/sala_tecnica/gerencia) OR
//       header `Authorization: Bearer <EXPORT_PLANILHAO_TOKEN>` for cron.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import ExcelJS from 'npm:exceljs@4.4.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const EXPORT_TOKEN = Deno.env.get('EXPORT_PLANILHAO_TOKEN') || '';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

function naturalCompare(a: string, b: string) {
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true, sensitivity: 'base' });
}

const colLetter = (i: number) => {
  const n = i + 2;
  let s = '';
  let x = n;
  while (x > 0) { const r = (x - 1) % 26; s = String.fromCharCode(65 + r) + s; x = Math.floor((x - 1) / 26); }
  return s;
};

async function buildWorkbook(ordens: any[], generatedAt: Date, sourceLabel: string, revisoesByOsId: Record<string, any[]> = {}) {
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
  const YELLOW='FFFFFF00', LBLUE='FF99CCFF', LYELLOW='FFFFFFCC';
  const colorByIdx: (string|null)[] = [
    YELLOW,YELLOW,YELLOW,YELLOW,YELLOW,null,YELLOW,
    LBLUE,null,LYELLOW,YELLOW,YELLOW,
    null,null,null,null,null,null,
    LYELLOW,LYELLOW,LYELLOW,null,LYELLOW,
    LBLUE,LBLUE,LBLUE,
  ];
  const widths: Record<string,number> = {
    A:4,B:13.71,C:14.71,D:16.86,E:10.29,F:11.14,H:8.43,I:14.43,
    J:10.43,K:6.43,L:10.29,M:10.71,N:11,O:12.14,P:7,Q:7.71,
    S:9.14,T:8.86,U:7.86,V:9,X:7.71,Z:8.29,AA:6.14,
  };

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('PLANILHÃO', { views: [{ state: 'normal', zoomScale: 70, showGridLines: false }] });
  Object.entries(widths).forEach(([c, w]) => { ws.getColumn(c).width = w; });
  ({ 17:15.75, 18:12.0, 19:12.75, 20:12.0, 21:22.5 } as Record<number,number>);
  [[17,15.75],[18,12],[19,12.75],[20,12],[21,22.5]].forEach(([r,h]) => { ws.getRow(r as number).height = h as number; });

  const thinBorder = {
    top:{style:'thin' as const}, bottom:{style:'thin' as const},
    left:{style:'thin' as const}, right:{style:'thin' as const},
  };

  const ts = `${String(generatedAt.getDate()).padStart(2,'0')}/${String(generatedAt.getMonth()+1).padStart(2,'0')}/${generatedAt.getFullYear()} ${String(generatedAt.getHours()).padStart(2,'0')}:${String(generatedAt.getMinutes()).padStart(2,'0')}`;
  const metaCell = ws.getCell('B16');
  metaCell.value = `Gerado em ${ts} (${sourceLabel}) — ${ordens.length} registros`;
  metaCell.font = { name:'Arial', size:9, italic:true, color:{ argb:'FF666666' } };
  ws.mergeCells('B16:AA16');

  ws.mergeCells('B17:AA17');
  const title = ws.getCell('B17');
  title.value = 'Dados de Entrada';
  title.font = { name:'Arial', size:10, bold:true };
  title.alignment = { horizontal:'center', vertical:'middle' };
  title.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF99CCFF' } };
  title.border = thinBorder;
  for (let i = 0; i < 26; i++) ws.getCell(`${colLetter(i)}17`).border = thinBorder;

  headers.forEach((h, i) => {
    const letter = colLetter(i);
    ws.mergeCells(`${letter}18:${letter}19`);
    const cell = ws.getCell(`${letter}18`);
    cell.value = h;
    cell.font = { name:'Arial', size:10, bold:true };
    cell.alignment = { horizontal:'center', vertical:'middle', wrapText:true };
    const fill = colorByIdx[i];
    if (fill) cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb: fill } };
    cell.border = thinBorder;
    ws.getCell(`${letter}19`).border = thinBorder;

    const sub = ws.getCell(`${letter}21`);
    sub.value = subHeaders[i];
    sub.font = { name:'Arial', size:8, italic:true };
    sub.alignment = { horizontal:'center', vertical:'middle' };
    sub.border = thinBorder;
  });

  ws.autoFilter = 'B21:AA21';

  const sorted = [...ordens].sort((a,b) => naturalCompare(a.trecho, b.trecho));
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
      cell.font = { name:'Arial', size:10 };
      cell.alignment = { horizontal:'center', vertical:'middle' };
      cell.border = thinBorder;
    });
  });

  // Blocos de revisão a partir da coluna AB
  addRevisionBlocks(ws, sorted, revisoesByOsId, thinBorder);

  // Aba REVISÕES
  addRevisoesSheet(wb, sorted, revisoesByOsId);

  return wb;
}

const REV_BLOCK_FIELDS: { label: string; key: string }[] = [
  { label: 'Comprimento (m)', key: 'comprimento_previsto' },
  { label: 'PV Montante', key: 'pv_montante' },
  { label: 'PV Jusante', key: 'pv_jusante' },
  { label: 'Prof. Mont. (m)', key: 'prof_montante' },
  { label: 'Prof. Jus. (m)', key: 'prof_jusante' },
  { label: 'Largura de Vala', key: 'largura_vala' },
  { label: 'Prof. Média (m)', key: 'prof_media_prevista' },
  { label: 'DN (m)', key: 'dn' },
  { label: 'PAV', key: 'pav_previsto' },
  { label: 'Ligações previstas', key: 'ligacoes_previstas' },
  { label: 'Data', key: '__data__' },
  { label: 'Origem', key: '__origem__' },
];

function fmtBlockDate(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function fmtBlockOrigem(rev: any) {
  const parts: string[] = [];
  if (rev.rotulo) parts.push(rev.rotulo);
  if (rev.import_log?.filename) parts.push(rev.import_log.filename);
  if (rev.import_log?.user_email) parts.push(rev.import_log.user_email);
  return parts.join(' · ');
}

function addRevisionBlocks(ws: any, ordens: any[], revisoesByOsId: Record<string, any[]>, thinBorder: any) {
  let maxRev = 0;
  for (const arr of Object.values(revisoesByOsId)) {
    const top = arr.reduce((m, r) => Math.max(m, r.versao || 0), 0);
    if (top > maxRev) maxRev = top;
  }
  if (maxRev === 0) return;

  const PURPLE = 'FFE4D7F5';
  const PURPLE_DARK = 'FFB39DDB';
  const startCol = 27; // AB
  const n = REV_BLOCK_FIELDS.length;

  for (let v = 1; v <= maxRev; v++) {
    const blockStart = startCol + (v - 1) * n;
    const blockEnd = blockStart + n - 1;
    ws.mergeCells(17, blockStart, 17, blockEnd);
    const t = ws.getCell(17, blockStart);
    t.value = `Revisão ${String(v).padStart(2,'0')}`;
    t.font = { name:'Arial', size:10, bold:true };
    t.alignment = { horizontal:'center', vertical:'middle' };
    t.fill = { type:'pattern', pattern:'solid', fgColor:{ argb: PURPLE_DARK } };
    t.border = thinBorder;

    REV_BLOCK_FIELDS.forEach((f, i) => {
      const col = blockStart + i;
      ws.mergeCells(18, col, 19, col);
      const h = ws.getCell(18, col);
      h.value = `${f.label} Rev.${String(v).padStart(2,'0')}`;
      h.font = { name:'Arial', size:9, bold:true };
      h.alignment = { horizontal:'center', vertical:'middle', wrapText:true };
      h.fill = { type:'pattern', pattern:'solid', fgColor:{ argb: PURPLE } };
      h.border = thinBorder;
      ws.getCell(19, col).border = thinBorder;

      const sub = ws.getCell(21, col);
      sub.value = `rev${String(v).padStart(2,'0')}_${f.label.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')}`;
      sub.font = { name:'Arial', size:8, italic:true };
      sub.alignment = { horizontal:'center', vertical:'middle' };
      sub.border = thinBorder;

      ws.getColumn(col).width = f.label === 'Origem' ? 28 : (f.label === 'DN (m)' ? 8 : 12);
    });
  }

  ordens.forEach((os: any, idx: number) => {
    const r = 22 + idx;
    const revs = revisoesByOsId[os.id] || [];
    for (let v = 1; v <= maxRev; v++) {
      const rev = revs.find((x: any) => (x.versao || 0) === v);
      const blockStart = startCol + (v - 1) * n;
      REV_BLOCK_FIELDS.forEach((f, i) => {
        const cell = ws.getCell(r, blockStart + i);
        let val: any = '';
        if (rev) {
          if (f.key === '__data__') val = fmtBlockDate(rev.imported_at);
          else if (f.key === '__origem__') val = fmtBlockOrigem(rev);
          else val = rev[f.key];
        }
        cell.value = val === null || val === undefined ? '' : val;
        cell.font = { name:'Arial', size:10 };
        cell.alignment = { horizontal:'center', vertical:'middle' };
        cell.border = thinBorder;
      });
    }
  });
}

const REV_FIELDS: { key: string; label: string }[] = [
  { key:'trecho', label:'Trecho' },
  { key:'bacia', label:'Bacia' },
  { key:'pv_montante', label:'PV Montante' },
  { key:'pv_jusante', label:'PV Jusante' },
  { key:'comprimento_previsto', label:'Comprimento (m)' },
  { key:'largura_vala', label:'Largura de Vala' },
  { key:'prof_media_prevista', label:'Prof. Média (m)' },
  { key:'dn', label:'DN (m)' },
  { key:'prof_montante', label:'Prof. Mont. (m)' },
  { key:'prof_jusante', label:'Prof. Jus. (m)' },
  { key:'pav_previsto', label:'PAV' },
  { key:'largura_pav_prevista', label:'Larg. PAV' },
  { key:'pav_m2_previsto', label:'PAV (m²)' },
  { key:'areia', label:'Areia' },
  { key:'brita', label:'Brita' },
  { key:'ligacoes_previstas', label:'Ligações previstas' },
  { key:'bomba_rebaixo', label:'Bomba de Rebaixo' },
  { key:'prazo_previsto', label:'Prazo (dias)' },
  { key:'prazo_arredondado', label:'Prazo arred. (dias)' },
  { key:'bms', label:"BM's" },
];

function fmtRev(field: string, v: any) {
  if (v === null || v === undefined || v === '') return '';
  if (field === 'bomba_rebaixo') return v ? 'SIM' : 'NÃO';
  return v;
}

function addRevisoesSheet(wb: any, ordens: any[], revisoesByOsId: Record<string, any[]>) {
  const ws = wb.addWorksheet('REVISÕES', { views: [{ state: 'normal', zoomScale: 90, showGridLines: false }] });
  let maxRev = 0;
  for (const arr of Object.values(revisoesByOsId)) {
    const top = arr.reduce((m, r) => Math.max(m, r.versao || 0), 0);
    if (top > maxRev) maxRev = top;
  }
  const baseCols = ['Trecho','Bacia','PV Montante','PV Jusante','Vigência','Campo','Projeto Base'];
  const revCols: string[] = [];
  for (let v = 1; v <= maxRev; v++) revCols.push(`Rev.${String(v).padStart(2,'0')}`);
  const allCols = [...baseCols, ...revCols, 'Atual / Vigente'];
  const thin = { top:{style:'thin' as const}, bottom:{style:'thin' as const}, left:{style:'thin' as const}, right:{style:'thin' as const} };

  allCols.forEach((c, i) => {
    const cell = ws.getCell(1, i+1);
    cell.value = c;
    cell.font = { name:'Arial', size:10, bold:true };
    cell.alignment = { horizontal:'center', vertical:'middle', wrapText:true };
    cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF99CCFF' } };
    cell.border = thin;
  });
  ws.getRow(1).height = 26;
  ws.getColumn(1).width = 12; ws.getColumn(2).width = 14; ws.getColumn(3).width = 14;
  ws.getColumn(4).width = 14; ws.getColumn(5).width = 12; ws.getColumn(6).width = 22;
  for (let i = 7; i <= allCols.length; i++) ws.getColumn(i).width = 16;

  let r = 2;
  for (const os of ordens) {
    const revs = (revisoesByOsId[os.id] || []).slice().sort((a,b) => (a.versao||0) - (b.versao||0));
    if (!revs.some(x => (x.versao||0) > 0)) continue;
    const base = revs.find(x => (x.versao||0) === 0);
    const startRow = r;
    for (const field of REV_FIELDS) {
      const row = ws.getRow(r);
      const cells: any[] = [
        os.trecho, os.bacia, os.pv_montante, os.pv_jusante,
        os.status_vigencia || 'ATIVO',
        field.label,
        base ? fmtRev(field.key, base[field.key]) : '',
      ];
      for (let v = 1; v <= maxRev; v++) {
        const rev = revs.find(x => (x.versao||0) === v);
        cells.push(rev ? fmtRev(field.key, rev[field.key]) : '');
      }
      cells.push(fmtRev(field.key, os[field.key]));
      cells.forEach((val, i) => {
        const cell = row.getCell(i+1);
        cell.value = val;
        cell.font = { name:'Arial', size:9 };
        cell.alignment = { horizontal:'center', vertical:'middle' };
        cell.border = thin;
      });
      r++;
    }
    if (REV_FIELDS.length > 1) {
      for (let col = 1; col <= 5; col++) {
        ws.mergeCells(startRow, col, r-1, col);
        ws.getCell(startRow, col).alignment = { horizontal:'center', vertical:'middle' };
      }
    }
  }
  ws.autoFilter = { from: { row:1, column:1 }, to: { row:1, column: allCols.length } };
  ws.views = [{ state:'frozen', xSplit:6, ySplit:1 }];
}

async function fetchAllOrdens() {
  const all: any[] = [];
  const pageSize = 1000;
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await admin
      .from('ordens_servico')
      .select('id,trecho,bacia,pv_montante,pv_jusante,status_vigencia,comprimento_previsto,comprimento_real,largura_vala,prof_media_prevista,prof_media_real,dn,prof_montante,prof_jusante,pav_previsto,pav_real,largura_pav_prevista,largura_pav_real,pav_m2_previsto,pav_m2_real,areia,brita,ligacoes_previstas,ligacoes_real,bomba_rebaixo,prazo_previsto,prazo_arredondado,bms')
      .order('trecho', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function fetchAllRevisoes(osIds: string[]): Promise<Record<string, any[]>> {
  const map: Record<string, any[]> = {};
  if (osIds.length === 0) return map;
  const wanted = new Set(osIds);
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await admin
      .from('os_revisoes')
      .select('os_id,versao,rotulo,imported_at,trecho,bacia,pv_montante,pv_jusante,comprimento_previsto,largura_vala,prof_media_prevista,dn,prof_montante,prof_jusante,pav_previsto,largura_pav_prevista,pav_m2_previsto,areia,brita,ligacoes_previstas,bomba_rebaixo,prazo_previsto,prazo_arredondado,bms,suprimido,import_log:import_logs(filename,user_email)')
      .order('os_id', { ascending: true })
      .order('versao', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) { console.error('Falha ao carregar revisões:', error); break; }
    const rows = (data as any[]) || [];
    for (const row of rows) {
      if (wanted.has(row.os_id)) (map[row.os_id] ||= []).push(row);
    }
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return map;
}

function filename(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `sanegest_japaratinga_planilhao_${yyyy}-${mm}-${dd}.xlsx`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const now = new Date();
  let actor = 'unknown';
  let source = 'backup';
  let userId: string | null = null;

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (EXPORT_TOKEN && bearer === EXPORT_TOKEN) {
      actor = 'backup-cron';
      source = 'backup';
    } else if (bearer) {
      // Treat as user JWT
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
      });
      const { data, error } = await userClient.auth.getClaims(bearer);
      if (error || !data?.claims) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      userId = data.claims.sub as string;
      // Check role
      const { data: roles } = await admin
        .from('user_roles').select('role').eq('user_id', userId);
      const allowed = (roles || []).some((r: any) => ['admin','sala_tecnica','gerencia'].includes(r.role));
      if (!allowed) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      actor = (data.claims.email as string) || userId;
      source = 'manual';
    } else {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ordens = await fetchAllOrdens();
    const revisoesByOsId = await fetchAllRevisoes(ordens.map((o: any) => o.id));
    const wb = await buildWorkbook(ordens, now, source === 'backup' ? 'backup automático' : 'manual', revisoesByOsId);
    const buffer = await wb.xlsx.writeBuffer();
    const name = filename(now);

    await admin.from('export_logs').insert({
      actor, user_id: userId, source,
      registros_count: ordens.length,
      status: 'success', filename: name,
    });

    return new Response(buffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${name}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    await admin.from('export_logs').insert({
      actor, user_id: userId, source,
      status: 'error', error: String(e?.message || e),
    });
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
