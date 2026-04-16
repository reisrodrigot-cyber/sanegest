import { AppLayout } from '@/components/AppLayout';
import { FileSpreadsheet, Download, Upload, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface ParsedOS {
  trecho: string;
  bacia: string;
  pv_montante: string;
  pv_jusante: string;
  comprimento_previsto: number | null;
  comprimento_real: number | null;
  largura_vala: number | null;
  prof_media_executada: number | null;
  prof_media_prevista: number | null;
  prof_media_real: number | null;
  dn: number | null;
  prof_montante: number | null;
  prof_jusante: number | null;
  pav_previsto: string | null;
  pav_real: string | null;
  largura_pav_prevista: number | null;
  largura_pav_real: number | null;
  pav_m2_previsto: number | null;
  pav_m2_real: number | null;
  areia: string | null;
  brita: string | null;
  ligacoes_previstas: number | null;
  ligacoes_real: number | null;
  bomba_rebaixo: boolean;
  prazo_previsto: number | null;
  prazo_arredondado: number | null;
  bms: string | null;
}

function toNum(val: unknown): number | null {
  if (val == null || val === '') return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function toStr(val: unknown): string {
  if (val == null || val === '') return '';
  return String(val).trim();
}

function parseExcel(data: ArrayBuffer): ParsedOS[] {
  const wb = XLSX.read(data, { type: 'array' });
  // Try to find the sheet: match "PLANILHÃO", "PLANILHAO", or any name containing "PLANILH"
  let sheetName = wb.SheetNames.find(n => n.toUpperCase().includes('PLANILH'));
  // Fallback: use first sheet if only one exists
  if (!sheetName && wb.SheetNames.length === 1) {
    sheetName = wb.SheetNames[0];
  }
  if (!sheetName) {
    throw new Error(`Aba "PLANILHÃO" não encontrada. Abas disponíveis: ${wb.SheetNames.join(', ')}`);
  }
  const ws = wb.Sheets[sheetName];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const seen = new Set<string>();
  const result: ParsedOS[] = [];
  // Data starts at row 22 (index 21)
  for (let i = 21; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;
    const trecho = toStr(row[1]); // Column B
    if (!trecho) continue;
    // Deduplicate by composite key: trecho + bacia + pv_montante + pv_jusante
    const compositeKey = `${trecho}|${toStr(row[2])}|${toStr(row[3])}|${toStr(row[4])}`;
    if (seen.has(compositeKey)) continue;
    seen.add(compositeKey);

    result.push({
      trecho,
      bacia: toStr(row[2]),
      pv_montante: toStr(row[3]),
      pv_jusante: toStr(row[4]),
      comprimento_previsto: toNum(row[5]),
      comprimento_real: toNum(row[6]),
      largura_vala: toNum(row[7]),
      prof_media_executada: toNum(row[8]),
      prof_media_prevista: toNum(row[9]),
      prof_media_real: toNum(row[10]),
      dn: toNum(row[11]),
      prof_montante: toNum(row[12]),
      prof_jusante: toNum(row[13]),
      pav_previsto: toStr(row[14]) || null,
      pav_real: toStr(row[15]) || null,
      largura_pav_prevista: toNum(row[16]),
      largura_pav_real: toNum(row[17]),
      pav_m2_previsto: toNum(row[18]),
      pav_m2_real: toNum(row[19]),
      areia: toStr(row[20]) || null,
      brita: toStr(row[21]) || null,
      ligacoes_previstas: toNum(row[22]) != null ? Math.round(toNum(row[22])!) : null,
      ligacoes_real: toNum(row[23]) != null ? Math.round(toNum(row[23])!) : null,
      bomba_rebaixo: toStr(row[24]).toUpperCase() === 'SIM',
      prazo_previsto: toNum(row[25]) != null ? Math.round(toNum(row[25])!) : null,
      prazo_arredondado: toNum(row[26]) != null ? Math.round(toNum(row[26])!) : null,
      bms: toStr(row[27]) || null,
    });
  }
  return result;
}

const BATCH_SIZE = 50;

const ImportarPage = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedOS[] | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setParsing(true);
    setParsedData(null);

    try {
      const buffer = await f.arrayBuffer();
      const data = parseExcel(buffer);
      console.log(`Planilhão: ${data.length} trechos únicos identificados`);
      if (data.length === 0) {
        toast.error('Nenhum trecho válido encontrado (coluna B preenchida a partir da linha 22).');
        setParsing(false);
        return;
      }
      setParsedData(data);
      toast.success(`${data.length} trechos únicos identificados.`);
    } catch (err: any) {
      console.error('Parse error:', err);
      toast.error(err.message || 'Erro ao ler o arquivo.');
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!parsedData || parsedData.length === 0) return;
    setImporting(true);

    try {
      let totalUpserted = 0;
      for (let i = 0; i < parsedData.length; i += BATCH_SIZE) {
        const batch = parsedData.slice(i, i + BATCH_SIZE).map(os => ({
          ...os,
          status: 'CINZA' as const,
        }));

        const { error } = await supabase
          .from('ordens_servico')
          .upsert(batch, { onConflict: 'trecho,bacia,pv_montante,pv_jusante' });

        if (error) throw error;
        totalUpserted += batch.length;
      }

      toast.success(`${totalUpserted} OS importadas com sucesso!`);
      navigate('/ordens');
    } catch (err: any) {
      console.error('Import error:', err);
      toast.error(err.message || 'Erro ao importar. Verifique sua autenticação.');
    } finally {
      setImporting(false);
    }
  };

  const previewTrechos = parsedData?.map(os => os.trecho) ?? [];
  const MAX_PREVIEW = 50;
  const showAll = previewTrechos.length <= MAX_PREVIEW;

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-foreground mb-1">Importar Planilhão</h1>
      <p className="text-sm text-muted-foreground mb-6">Importe os dados da planilha Excel para criar as OS automaticamente</p>

      <div className="bg-card rounded-xl border border-border shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <AlertCircle size={20} className="text-status-yellow" />
          Como importar o Planilhão
        </h2>
        <ul className="space-y-2 text-sm text-foreground mb-6">
          <li className="flex items-start gap-2">
            <span className="font-semibold text-primary min-w-[20px]">1.</span>
            O arquivo deve ser <strong>.xlsx</strong> com uma aba chamada <strong>"PLANILHÃO"</strong>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold text-primary min-w-[20px]">2.</span>
            O cabeçalho deve estar na <strong>linha 18</strong> e os dados a partir da <strong>linha 22</strong>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold text-primary min-w-[20px]">3.</span>
            Linhas válidas são identificadas pela coluna B <strong>preenchida</strong> (qualquer valor)
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold text-primary min-w-[20px]">4.</span>
            OS já existentes com o mesmo código serão <strong>atualizadas</strong>, não duplicadas
          </li>
        </ul>

        <div className="flex flex-wrap gap-3">
          <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm cursor-pointer hover:opacity-90 transition-opacity">
            {parsing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {parsing ? 'Lendo arquivo...' : 'Selecionar Arquivo'}
            <input type="file" accept=".xlsx" onChange={handleFileChange} className="hidden" disabled={parsing || importing} />
          </label>
          <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-foreground font-medium text-sm hover:bg-muted transition-colors">
            <Download size={16} />
            Baixar Modelo
          </button>
        </div>

        {file && !parsing && (
          <p className="mt-3 text-sm text-muted-foreground">
            Arquivo selecionado: <strong className="text-foreground">{file.name}</strong>
          </p>
        )}
      </div>

      {parsedData && parsedData.length > 0 && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-6">
          <h2 className="text-lg font-semibold text-foreground mb-2">Prévia da Importação</h2>
          <p className="text-sm text-muted-foreground mb-4">
            <strong className="text-foreground">{parsedData.length}</strong> OS identificadas no arquivo
          </p>
          <div className="flex flex-wrap gap-2 mb-6">
            {(showAll ? previewTrechos : previewTrechos.slice(0, MAX_PREVIEW)).map(t => (
              <span key={t} className="px-3 py-1.5 rounded-lg bg-muted text-sm font-medium text-foreground">{t}</span>
            ))}
            {!showAll && (
              <span className="px-3 py-1.5 rounded-lg bg-muted text-sm text-muted-foreground">
                + {previewTrechos.length - MAX_PREVIEW} trechos
              </span>
            )}
          </div>
          <button
            onClick={handleImport}
            disabled={importing}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-status-green text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {importing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <CheckCircle2 size={16} />
                Confirmar Importação
              </>
            )}
          </button>
        </div>
      )}
    </AppLayout>
  );
};

export default ImportarPage;
