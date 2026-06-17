import { AppLayout } from '@/components/AppLayout';
import { FileSpreadsheet, Upload, AlertCircle, Loader2, CheckCircle2, History, ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

// Campos que a planilha controla (PROJETADO). Demais campos são preservados.
const PROJ_FIELDS = [
  'bacia',
  'comprimento_previsto', 'largura_vala', 'prof_media_prevista',
  'dn', 'prof_montante', 'prof_jusante',
  'pav_previsto', 'largura_pav_prevista', 'pav_m2_previsto',
  'areia', 'brita',
  'ligacoes_previstas', 'bomba_rebaixo',
  'prazo_previsto', 'prazo_arredondado', 'bms',
] as const;

type ProjField = typeof PROJ_FIELDS[number];

interface ParsedOS {
  trecho: string;
  bacia: string;
  pv_montante: string;
  pv_jusante: string;
  comprimento_previsto: number | null;
  largura_vala: number | null;
  prof_media_prevista: number | null;
  dn: number | null;
  prof_montante: number | null;
  prof_jusante: number | null;
  pav_previsto: string | null;
  largura_pav_prevista: number | null;
  pav_m2_previsto: number | null;
  areia: string | null;
  brita: string | null;
  ligacoes_previstas: number | null;
  bomba_rebaixo: boolean;
  prazo_previsto: number | null;
  prazo_arredondado: number | null;
  bms: string | null;
}

interface DiffRow {
  field: ProjField;
  oldValue: unknown;
  newValue: unknown;
}

interface AnalyzedRow {
  parsed: ParsedOS;
  key: string;
  classification: 'NEW' | 'UPDATE' | 'UNCHANGED' | 'ERROR';
  existingId?: string;
  diffs?: DiffRow[];
  error?: string;
}

const toNum = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v); return isNaN(n) ? null : n;
};
const toStr = (v: unknown): string => v == null ? '' : String(v).trim();
const keyOf = (t: string, b: string, m: string, j: string) =>
  `${t}|${b}|${m}|${j}`.toLowerCase();

function parseExcel(data: ArrayBuffer): ParsedOS[] {
  const wb = XLSX.read(data, { type: 'array' });
  let sheetName = wb.SheetNames.find(n => n.toUpperCase().includes('PLANILH'));
  if (!sheetName && wb.SheetNames.length === 1) sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error(`Aba "PLANILHÃO" não encontrada. Abas: ${wb.SheetNames.join(', ')}`);
  const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });

  const seen = new Set<string>(); const result: ParsedOS[] = [];
  for (let i = 21; i < rows.length; i++) {
    const row = rows[i]; if (!row || row.length < 2) continue;
    const trecho = toStr(row[1]); if (!trecho) continue;
    const k = `${trecho}|${toStr(row[2])}|${toStr(row[3])}|${toStr(row[4])}`;
    if (seen.has(k)) continue; seen.add(k);

    result.push({
      trecho, bacia: toStr(row[2]),
      pv_montante: toStr(row[3]), pv_jusante: toStr(row[4]),
      comprimento_previsto: toNum(row[5]),
      largura_vala: toNum(row[7]),
      prof_media_prevista: toNum(row[9]),
      dn: toNum(row[11]),
      prof_montante: toNum(row[12]),
      prof_jusante: toNum(row[13]),
      pav_previsto: toStr(row[14]) || null,
      largura_pav_prevista: toNum(row[16]),
      pav_m2_previsto: toNum(row[18]),
      areia: toStr(row[20]) || null,
      brita: toStr(row[21]) || null,
      ligacoes_previstas: toNum(row[22]) != null ? Math.round(toNum(row[22])!) : null,
      bomba_rebaixo: toStr(row[24]).toUpperCase() === 'SIM',
      prazo_previsto: toNum(row[25]) != null ? Math.round(toNum(row[25])!) : null,
      prazo_arredondado: toNum(row[26]) != null ? Math.round(toNum(row[26])!) : null,
      bms: toStr(row[27]) || null,
    });
  }
  return result;
}

function eq(a: unknown, b: unknown): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
  return String(a) === String(b);
}

const ImportarPage = () => {
  const navigate = useNavigate();
  const { supabaseUser } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [analyzed, setAnalyzed] = useState<AnalyzedRow[] | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setFile(f); setParsing(true); setAnalyzed(null);
    try {
      const buf = await f.arrayBuffer();
      const parsed = parseExcel(buf);
      if (parsed.length === 0) { toast.error('Nenhum trecho válido encontrado.'); setParsing(false); return; }
      setParsing(false); setAnalyzing(true);

      // Buscar OS existentes
      let all: any[] = []; let from = 0; const size = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('ordens_servico')
          .select(['id', ...PROJ_FIELDS, 'trecho', 'pv_montante', 'pv_jusante'].join(','))
          .range(from, from + size - 1);
        if (error) throw error;
        all = [...all, ...(data || [])];
        if ((data?.length || 0) < size) break;
        from += size;
      }
      const map = new Map<string, any>();
      all.forEach(r => map.set(keyOf(r.trecho, r.bacia, r.pv_montante, r.pv_jusante), r));

      const result: AnalyzedRow[] = parsed.map(p => {
        const k = keyOf(p.trecho, p.bacia, p.pv_montante, p.pv_jusante);
        const existing = map.get(k);
        if (!existing) return { parsed: p, key: k, classification: 'NEW' };
        const diffs: DiffRow[] = [];
        for (const f of PROJ_FIELDS) {
          const newV = (p as any)[f];
          const oldV = existing[f];
          if (!eq(oldV, newV)) diffs.push({ field: f, oldValue: oldV, newValue: newV });
        }
        if (diffs.length === 0) return { parsed: p, key: k, classification: 'UNCHANGED', existingId: existing.id };
        return { parsed: p, key: k, classification: 'UPDATE', existingId: existing.id, diffs };
      });
      setAnalyzed(result);
      setAnalyzing(false);
      toast.success(`${parsed.length} linhas analisadas.`);
    } catch (err: any) {
      console.error(err); toast.error(err.message || 'Erro ao processar.');
      setParsing(false); setAnalyzing(false);
    }
  };

  const summary = analyzed ? {
    total: analyzed.length,
    novas: analyzed.filter(a => a.classification === 'NEW').length,
    atualizadas: analyzed.filter(a => a.classification === 'UPDATE').length,
    semMudanca: analyzed.filter(a => a.classification === 'UNCHANGED').length,
    erros: analyzed.filter(a => a.classification === 'ERROR').length,
  } : null;

  const handleConfirm = async () => {
    if (!analyzed) return;
    setImporting(true);
    const novas = analyzed.filter(a => a.classification === 'NEW');
    const updates = analyzed.filter(a => a.classification === 'UPDATE');
    let createdOk = 0, updatedOk = 0;
    const erros: { trecho: string; erro: string }[] = [];

    const REMOVAL_MARKERS = ['SUPRIMIDO', 'RETIRADO', 'REMOVER', 'CANCELADO'];
    const isRemovalMarker = (v: unknown) =>
      typeof v === 'string' && REMOVAL_MARKERS.includes(v.trim().toUpperCase());
    const hasRemovalMarker = (p: ParsedOS) =>
      PROJ_FIELDS.some(f => isRemovalMarker((p as any)[f]));
    const isEmpty = (v: unknown) => v === null || v === undefined || v === '';
    // snapshot dos 17 campos projetados (para os_revisoes)
    const snapshotOf = (p: ParsedOS) => {
      const snap: Record<string, unknown> = {};
      for (const f of PROJ_FIELDS) snap[f] = (p as any)[f];
      return snap;
    };

    // INSERTs em batch — cada novo trecho vira "Projeto Base" (versao 0)
    for (let i = 0; i < novas.length; i += 100) {
      const slice = novas.slice(i, i + 100).map(a => ({
        ...a.parsed,
        status: 'CINZA' as const,
        liberado: false,
        status_vigencia: hasRemovalMarker(a.parsed) ? 'SUPRIMIDO' : 'ATIVO',
      }));
      const { data: inserted, error } = await supabase
        .from('ordens_servico')
        .insert(slice as any)
        .select('id, trecho, bacia, pv_montante, pv_jusante');
      if (error) {
        slice.forEach(s => erros.push({ trecho: s.trecho, erro: error.message }));
        continue;
      }
      createdOk += slice.length;
      // criar Projeto Base
      const baseRows = (inserted || []).map((row: any) => {
        const parsed = novas.find(a =>
          a.parsed.trecho === row.trecho &&
          a.parsed.bacia === row.bacia &&
          a.parsed.pv_montante === row.pv_montante &&
          a.parsed.pv_jusante === row.pv_jusante,
        )?.parsed;
        if (!parsed) return null;
        return {
          os_id: row.id,
          versao: 0,
          rotulo: 'Projeto Base',
          user_id: supabaseUser?.id ?? null,
          suprimido: hasRemovalMarker(parsed),
          ...snapshotOf(parsed),
        };
      }).filter(Boolean);
      if (baseRows.length) {
        const { error: revErr } = await supabase.from('os_revisoes' as any).insert(baseRows as any);
        if (revErr) console.error('Falha ao gravar Projeto Base:', revErr);
      }
    }

    // UPDATEs individuais: cria Rev.NN + atualiza vigente (apenas campos não-vazios)
    const concurrency = 6;
    for (let i = 0; i < updates.length; i += concurrency) {
      const batch = updates.slice(i, i + concurrency);
      await Promise.all(batch.map(async (a) => {
        // próxima versão
        const { data: maxRow } = await supabase
          .from('os_revisoes' as any)
          .select('versao')
          .eq('os_id', a.existingId!)
          .order('versao', { ascending: false })
          .limit(1)
          .maybeSingle();
        const nextVersao = ((maxRow as any)?.versao ?? -1) + 1 || 1;
        const versao = Math.max(nextVersao, 1);
        const suprimido = hasRemovalMarker(a.parsed);

        // 1) snapshot completo da nova versão
        const { error: revErr } = await supabase.from('os_revisoes' as any).insert({
          os_id: a.existingId!,
          versao,
          rotulo: `Rev.${String(versao).padStart(2, '0')}`,
          user_id: supabaseUser?.id ?? null,
          suprimido,
          ...snapshotOf(a.parsed),
        } as any);
        if (revErr) {
          erros.push({ trecho: a.parsed.trecho, erro: `Revisão: ${revErr.message}` });
          return;
        }

        // 2) atualiza vigente — só campos não-vazios; remove marcador antes de gravar
        const payload: Record<string, unknown> = {};
        for (const f of PROJ_FIELDS) {
          const v = (a.parsed as any)[f];
          if (isEmpty(v)) continue;
          if (isRemovalMarker(v)) continue; // marcador não vira valor vigente
          payload[f] = v;
        }
        if (suprimido) payload['status_vigencia'] = 'SUPRIMIDO';
        if (Object.keys(payload).length > 0) {
          const { error } = await supabase.from('ordens_servico').update(payload as any).eq('id', a.existingId!);
          if (error) { erros.push({ trecho: a.parsed.trecho, erro: error.message }); return; }
        }
        updatedOk++;
      }));
    }

    // Log
    const changes = updates.slice(0, 500).map(a => ({
      trecho: a.parsed.trecho,
      bacia: a.parsed.bacia,
      pv_montante: a.parsed.pv_montante,
      pv_jusante: a.parsed.pv_jusante,
      diffs: a.diffs,
    }));
    try {
      await supabase.from('import_logs').insert({
        user_id: supabaseUser?.id,
        user_email: supabaseUser?.email,
        filename: file?.name,
        total_rows: analyzed.length,
        created_count: createdOk,
        updated_count: updatedOk,
        unchanged_count: summary!.semMudanca,
        error_count: erros.length,
        changes,
        errors: erros,
      } as any);
    } catch (e) { console.error('Falha ao gravar import_log:', e); }

    setImporting(false);
    if (erros.length) toast.error(`Importação concluída com ${erros.length} erros.`);
    else toast.success(`${createdOk} novas, ${updatedOk} atualizadas.`);
    navigate('/ordens');
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-foreground">Importar Planilhão</h1>
        <Link to="/importar/historico" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <History size={16}/> Histórico de importações
        </Link>
      </div>
      <p className="text-sm text-muted-foreground mb-6">Importa apenas dados projetados. Dados reais/executados nunca são sobrescritos.</p>

      <div className="bg-card rounded-xl border border-border shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><AlertCircle size={20} className="text-status-yellow" /> Como funciona</h2>
        <ul className="space-y-1.5 text-sm text-foreground mb-5">
          <li>• Chave única: <strong>Trecho + Bacia + PV Montante + PV Jusante</strong></li>
          <li>• OS existentes têm <strong>apenas campos projetados</strong> atualizados</li>
          <li>• Campos REAIS, status, liberação, produção, materiais e topografia são <strong>preservados</strong></li>
          <li>• Arquivo .xlsx com aba <strong>PLANILHÃO</strong>, dados a partir da linha 22</li>
        </ul>
        <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm cursor-pointer hover:opacity-90 transition-opacity">
          {(parsing || analyzing) ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {parsing ? 'Lendo...' : analyzing ? 'Analisando...' : 'Selecionar Arquivo'}
          <input type="file" accept=".xlsx" onChange={handleFile} className="hidden" disabled={parsing || analyzing || importing} />
        </label>
        {file && <p className="mt-3 text-sm text-muted-foreground">Arquivo: <strong className="text-foreground">{file.name}</strong></p>}
      </div>

      {summary && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Análise prévia</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
            <Stat label="Total" value={summary.total} />
            <Stat label="Novas" value={summary.novas} color="text-status-green" />
            <Stat label="Atualizadas" value={summary.atualizadas} color="text-status-yellow" />
            <Stat label="Sem mudança" value={summary.semMudanca} color="text-muted-foreground" />
            <Stat label="Erros" value={summary.erros} color="text-destructive" />
          </div>

          {summary.atualizadas > 0 && (
            <div className="mb-5">
              <button onClick={() => setShowDiff(s => !s)} className="text-sm text-primary hover:underline mb-2">
                {showDiff ? 'Ocultar' : 'Ver'} {summary.atualizadas} conflito(s) detalhado(s)
              </button>
              {showDiff && (
                <div className="max-h-96 overflow-auto border border-border rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr><th className="text-left p-2">Trecho</th><th className="text-left p-2">Campo</th><th className="text-left p-2">Atual</th><th className="text-left p-2">Novo</th></tr>
                    </thead>
                    <tbody>
                      {analyzed!.filter(a => a.classification === 'UPDATE').flatMap(a =>
                        a.diffs!.map((d, i) => (
                          <tr key={`${a.key}-${d.field}`} className="border-t border-border">
                            {i === 0 ? <td className="p-2 font-medium align-top" rowSpan={a.diffs!.length}>{a.parsed.trecho}</td> : null}
                            <td className="p-2 text-muted-foreground">{d.field}</td>
                            <td className="p-2 text-destructive line-through">{String(d.oldValue ?? '—')}</td>
                            <td className="p-2 text-status-green">{String(d.newValue ?? '—')}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={importing || (summary.novas + summary.atualizadas === 0)}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-status-green text-primary-foreground font-medium text-sm hover:opacity-90 disabled:opacity-50"
            >
              {importing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Confirmar importação
            </button>
            <button onClick={() => { setAnalyzed(null); setFile(null); }} disabled={importing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-foreground text-sm hover:bg-muted">
              <ArrowLeft size={16}/> Cancelar
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

const Stat = ({ label, value, color = 'text-foreground' }: { label: string; value: number; color?: string }) => (
  <div className="rounded-lg border border-border p-3 bg-muted/20">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className={`text-2xl font-bold ${color}`}>{value}</div>
  </div>
);

export default ImportarPage;
