import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Upload, Loader2, ArrowLeft, AlertTriangle, CheckCircle2, XCircle, Clock, Archive } from 'lucide-react';
import { Link } from 'react-router-dom';
import { importarBaseSS08, type ImportResumo } from '@/lib/mapaBaseImport';

interface Base {
  id: string;
  ss: string;
  versao: number;
  status: string;
  arquivo_bytes: number | null;
  arquivo_hash: string | null;
  feicoes_rede: number | null;
  feicoes_pv: number | null;
  motivo_falha: string | null;
  relatorio_validacao: any;
  created_at: string;
}

interface Divergencia {
  id: string;
  base_id: string;
  tipo: string;
  rotulo: string | null;
  detalhes: any;
  status: string;
  created_at: string;
}

const STATUS_STYLE: Record<string, string> = {
  processando: 'bg-blue-100 text-blue-800',
  preview: 'bg-amber-100 text-amber-800',
  falha: 'bg-red-100 text-red-800',
  ativa: 'bg-emerald-100 text-emerald-800',
  arquivada: 'bg-gray-100 text-gray-700',
};

const MapaBasesPage = () => {
  const { supabaseUser } = useAuth();
  const [bases, setBases] = useState<Base[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [resumo, setResumo] = useState<ImportResumo | null>(null);
  const [openBaseId, setOpenBaseId] = useState<string | null>(null);
  const [divs, setDivs] = useState<Divergencia[]>([]);
  const [loadingDivs, setLoadingDivs] = useState(false);

  const loadBases = async () => {
    const { data } = await supabase
      .from('mapa_bases' as any)
      .select('*')
      .order('created_at', { ascending: false });
    setBases((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { loadBases(); }, []);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!/\.zip$/i.test(f.name)) { toast.error('Envie um ZIP contendo o shapefile.'); return; }
    setImporting(true); setResumo(null); setProgress('Iniciando...');
    try {
      const r = await importarBaseSS08(f, supabaseUser?.id ?? null, (m) => setProgress(m));
      setResumo(r);
      toast.success(`Base SS-08 v${r.versao} importada como Preview`);
      await loadBases();
    } catch (err: any) {
      toast.error(err?.message ?? 'Falha na importação');
    } finally {
      setImporting(false);
      setProgress('');
    }
  };

  const loadDivergencias = async (baseId: string) => {
    setOpenBaseId(baseId);
    setLoadingDivs(true);
    const { data } = await supabase
      .from('mapa_divergencias' as any)
      .select('*')
      .eq('base_id', baseId)
      .order('tipo', { ascending: true });
    setDivs((data ?? []) as any);
    setLoadingDivs(false);
  };

  const arquivarBase = async (b: Base) => {
    if (!confirm(`Arquivar base ${b.ss} v${b.versao}? Ela deixará de aparecer no mapa.`)) return;
    const { error } = await supabase.from('mapa_bases' as any).update({ status: 'arquivada' } as any).eq('id', b.id);
    if (error) toast.error(error.message);
    else { toast.success('Base arquivada'); loadBases(); }
  };

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'processando') return <Loader2 size={14} className="animate-spin" />;
    if (status === 'preview') return <Clock size={14} />;
    if (status === 'falha') return <XCircle size={14} />;
    if (status === 'ativa') return <CheckCircle2 size={14} />;
    return <Archive size={14} />;
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bases geográficas do mapa</h1>
          <p className="text-sm text-muted-foreground">Fase 1 — Piloto SS-08 (Preview). O KMZ atual continua funcionando normalmente.</p>
        </div>
        <Link to="/mapa" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft size={16}/> Voltar ao mapa
        </Link>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <Upload size={18} /> Nova importação (ZIP de shapefile)
        </h2>
        <ul className="text-xs text-muted-foreground list-disc pl-5 mb-4 space-y-1">
          <li>O ZIP precisa conter os arquivos <code>.shp .shx .dbf .prj .cpg</code> das camadas <code>SS-08-REDE</code> (linhas) e <code>SS-08-PV</code> (pontos).</li>
          <li>A base entra como <strong>Preview</strong>. Nada é promovido para produção nesta fase.</li>
          <li>Em caso de falha, nenhum dado parcial aparece no mapa.</li>
        </ul>
        <label className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm cursor-pointer hover:opacity-90 ${importing ? 'opacity-60 pointer-events-none' : ''}`}>
          {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {importing ? progress || 'Processando...' : 'Selecionar ZIP'}
          <input type="file" accept=".zip" onChange={handleFile} className="hidden" disabled={importing} />
        </label>

        {resumo && (
          <div className="mt-4 p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-sm">
            <div className="font-semibold text-emerald-900 mb-1">Importação concluída — {resumo.ss} v{resumo.versao}</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-emerald-900">
              <Stat label="Linhas (REDE)" value={resumo.feicoes_rede} />
              <Stat label="Pontos (PV/TL/TQ)" value={resumo.feicoes_pv} />
              <Stat label="Vínculos automáticos" value={resumo.vinculos_auto} />
              <Stat label="Divergências" value={resumo.divergencias} />
              <Stat label="N.S. sem linha" value={resumo.ns_sem_linha} />
              <Stat label="Linhas sem N.S." value={resumo.linhas_sem_ns} />
              <Stat label="Colisões" value={resumo.colisoes} />
            </div>
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm">
        <h2 className="text-lg font-semibold p-4 border-b border-border">Histórico de bases</h2>
        {loading ? (
          <div className="p-6 text-center text-muted-foreground text-sm"><Loader2 className="inline animate-spin mr-2" size={14}/> Carregando...</div>
        ) : bases.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">Nenhuma base importada ainda.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">SS</th>
                  <th className="text-left p-3">Versão</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">REDE</th>
                  <th className="text-right p-3">PV</th>
                  <th className="text-left p-3">Hash</th>
                  <th className="text-left p-3">Importada em</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {bases.map((b) => (
                  <tr key={b.id} className="border-t border-border hover:bg-muted/30">
                    <td className="p-3 font-medium">{b.ss}</td>
                    <td className="p-3">v{b.versao}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[b.status] ?? ''}`}>
                        <StatusIcon status={b.status} /> {b.status}
                      </span>
                      {b.motivo_falha && (
                        <div className="text-[11px] text-red-700 mt-1 flex items-start gap-1">
                          <AlertTriangle size={12} className="mt-0.5"/> {b.motivo_falha}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-right">{b.feicoes_rede ?? '—'}</td>
                    <td className="p-3 text-right">{b.feicoes_pv ?? '—'}</td>
                    <td className="p-3 font-mono text-[11px] text-muted-foreground">{b.arquivo_hash?.slice(0, 12) ?? '—'}</td>
                    <td className="p-3 text-xs">{new Date(b.created_at).toLocaleString('pt-BR')}</td>
                    <td className="p-3 text-right space-x-2">
                      <button onClick={() => loadDivergencias(b.id)} className="text-xs text-primary hover:underline">Divergências</button>
                      {b.status !== 'arquivada' && (
                        <button onClick={() => arquivarBase(b)} className="text-xs text-muted-foreground hover:text-destructive">Arquivar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openBaseId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setOpenBaseId(null)}>
          <div className="bg-card rounded-xl shadow-lg max-w-3xl w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold">Divergências — Base {bases.find(b => b.id === openBaseId)?.ss} v{bases.find(b => b.id === openBaseId)?.versao}</h3>
              <button onClick={() => setOpenBaseId(null)} className="text-muted-foreground hover:text-foreground text-sm">Fechar</button>
            </div>
            <div className="p-4">
              {loadingDivs ? (
                <p className="text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14}/> Carregando...</p>
              ) : divs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem divergências.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                    <tr>
                      <th className="text-left p-2">Tipo</th>
                      <th className="text-left p-2">Rótulo</th>
                      <th className="text-left p-2">Detalhes</th>
                      <th className="text-left p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {divs.map((d) => (
                      <tr key={d.id} className="border-b border-border">
                        <td className="p-2 font-medium">{d.tipo}</td>
                        <td className="p-2">{d.rotulo || '—'}</td>
                        <td className="p-2 text-xs text-muted-foreground">{d.detalhes?.motivo || JSON.stringify(d.detalhes ?? {}).slice(0, 120)}</td>
                        <td className="p-2 text-xs">{d.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div>
    <div className="text-[11px] uppercase tracking-wide opacity-70">{label}</div>
    <div className="text-xl font-bold">{value}</div>
  </div>
);

export default MapaBasesPage;
