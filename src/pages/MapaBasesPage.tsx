import { useEffect, useState, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Upload, Loader2, ArrowLeft, AlertTriangle, CheckCircle2, XCircle, Clock, Archive, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { importarBase, normalizarSS, type ImportResumo } from '@/lib/mapaBaseImport';

interface Base {
  id: string;
  ss: string;
  versao: number;
  status: string;
  arquivo_path: string | null;
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

// Lista oficial de SSes do projeto (cada uma é uma base independente).
const SS_OPCOES = [
  'SS-08','SS-09','SS-10','SS-11','SS-12','SS-13A','SS-13B','SS-14A','SS-14B'
];

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
  const [ssSelecionada, setSsSelecionada] = useState<string>('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [ssDetectada, setSsDetectada] = useState<string | null>(null);

  const loadBases = async () => {
    const { data } = await supabase
      .from('mapa_bases' as any)
      .select('*')
      .order('ss', { ascending: true })
      .order('versao', { ascending: false });
    setBases((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { loadBases(); }, []);

  const handlePickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    e.target.value = '';
    setResumo(null);
    setArquivo(null);
    setSsDetectada(null);
    setSsSelecionada('');
    if (!f) return;
    if (!/\.zip$/i.test(f.name)) { toast.error('Envie um ZIP contendo o shapefile.'); return; }
    const det = normalizarSS(f.name);
    if (!det) {
      toast.error('Não foi possível identificar a SS pelo nome do arquivo. Renomeie o arquivo no padrão SS-XX.zip ou SS-XXA.zip.');
      return;
    }
    if (!SS_OPCOES.includes(det)) {
      toast.error(`SS "${det}" não está na lista oficial de projetos. Verifique o nome do arquivo.`);
      return;
    }
    setArquivo(f);
    setSsDetectada(det);
    setSsSelecionada(det);
  };

  const iniciarImportacao = async () => {
    if (!arquivo || !ssDetectada) { toast.error('Selecione um arquivo ZIP com SS identificável.'); return; }
    setImporting(true); setResumo(null); setProgress('Iniciando...');
    try {
      const r = await importarBase(arquivo, ssDetectada, supabaseUser?.id ?? null, (m) => setProgress(m));
      setResumo(r);
      toast.success(`Base ${r.ss} v${r.versao} importada como Preview`);
      setArquivo(null);
      setSsDetectada(null);
      setSsSelecionada('');
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

  const publicarBase = async (b: Base) => {
    if (b.status !== 'preview') { toast.error('Só é possível publicar bases em Preview.'); return; }
    const ativa = bases.find((x) => x.ss === b.ss && x.status === 'ativa');
    const msg = ativa
      ? `Publicar ${b.ss} v${b.versao} como a versão ATIVA do mapa?\n\nA versão atual (v${ativa.versao}) será ARQUIVADA e mantida para consulta.`
      : `Publicar ${b.ss} v${b.versao} como a versão ATIVA do mapa?`;
    if (!confirm(msg)) return;
    if (ativa) {
      const { error: e1 } = await supabase.from('mapa_bases' as any)
        .update({ status: 'arquivada' } as any).eq('id', ativa.id);
      if (e1) { toast.error(e1.message); return; }
    }
    const { error } = await supabase.from('mapa_bases' as any)
      .update({ status: 'ativa' } as any).eq('id', b.id);
    if (error) toast.error(error.message);
    else { toast.success(`Base ${b.ss} v${b.versao} publicada`); loadBases(); }
  };

  const excluirBase = async (b: Base) => {
    const ok = confirm(
      `Excluir definitivamente a camada ${b.ss} • v${b.versao}?\n\n` +
      `Esta ação removerá o arquivo, trechos, pontos, vínculos e divergências desta importação.\n\n` +
      `Ordens de Serviço, N.S., produção e demais dados operacionais NÃO são afetados.`
    );
    if (!ok) return;
    const { error } = await supabase.from('mapa_bases' as any).delete().eq('id', b.id);
    if (error) { toast.error(error.message); return; }
    if (b.arquivo_path) {
      await supabase.storage.from('mapa-base').remove([b.arquivo_path]);
    }
    toast.success(`Camada ${b.ss} v${b.versao} excluída`);
    loadBases();
  };

  const proximaVersao = useMemo(() => {
    if (!ssDetectada) return null;
    const maior = bases
      .filter((b) => b.ss === ssDetectada)
      .reduce((m, b) => Math.max(m, b.versao), 0);
    return maior + 1;
  }, [bases, ssDetectada]);

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'processando') return <Loader2 size={14} className="animate-spin" />;
    if (status === 'preview') return <Clock size={14} />;
    if (status === 'falha') return <XCircle size={14} />;
    if (status === 'ativa') return <CheckCircle2 size={14} />;
    return <Archive size={14} />;
  };

  const podeImportar = !!arquivo && !!ssDetectada && !importing;

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bases geográficas do mapa</h1>
          <p className="text-sm text-muted-foreground">Importação de shapefiles por SS. O KMZ atual continua funcionando normalmente.</p>
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
          <li>O ZIP precisa conter os arquivos <code>.shp .shx .dbf .prj .cpg</code> das camadas de REDE (linhas) e PV (pontos).</li>
          <li>A base entra como <strong>Preview</strong>. Nada é promovido para produção até você publicar.</li>
          <li>A <strong>SS é identificada automaticamente</strong> pelo nome do arquivo (ex: <code>SS-13A.zip</code>). Se o nome não seguir o padrão, renomeie antes de enviar.</li>
        </ul>

        <div className="grid md:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Arquivo ZIP *</label>
            <label className={`mt-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border bg-background text-sm cursor-pointer hover:bg-muted/40 ${importing ? 'opacity-60 pointer-events-none' : ''}`}>
              <Upload size={14} />
              <span className="truncate">{arquivo ? arquivo.name : 'Selecionar ZIP...'}</span>
              <input type="file" accept=".zip" onChange={handlePickFile} className="hidden" disabled={importing} />
            </label>
            <p className="text-[11px] text-muted-foreground mt-1">
              Padrão aceito: <code>SS-08.zip</code>, <code>SS08.zip</code>, <code>SS-13A.zip</code>...
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">SS identificada</label>
            <input
              type="text"
              value={ssDetectada ?? ''}
              readOnly
              placeholder="— aguardando arquivo —"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-muted/40 text-sm font-semibold text-foreground cursor-not-allowed"
            />
            {ssDetectada && proximaVersao != null && (
              <p className="text-[11px] text-emerald-700 mt-1">
                SS identificada automaticamente: <strong>{ssDetectada}</strong>
              </p>
            )}
          </div>

          <div className="flex items-end">
            <button
              onClick={iniciarImportacao}
              disabled={!podeImportar}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm disabled:opacity-50 hover:opacity-90"
            >
              {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {importing ? (progress || 'Processando...') : 'Importar'}
            </button>
          </div>
        </div>

        {arquivo && !ssDetectada && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5"/>
            <div>
              <strong>Não foi possível identificar a SS pelo nome do arquivo.</strong> Renomeie o arquivo no padrão <code>SS-XX.zip</code> ou <code>SS-XXA.zip</code> (ex: <code>SS-13A.zip</code>).
            </div>
          </div>
        )}

        {arquivo && ssDetectada && proximaVersao != null && !resumo && (
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-900">
            <div className="font-semibold mb-1 flex items-center gap-2">
              <CheckCircle2 size={14} /> Pronto para importar
            </div>
            <ul className="text-xs space-y-0.5 pl-1">
              <li>Arquivo: <strong>{arquivo.name}</strong></li>
              <li>SS identificada: <strong>{ssDetectada}</strong></li>
              <li>Versão a criar: <strong>v{proximaVersao}</strong></li>
            </ul>
          </div>
        )}


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
        <div className="flex items-center justify-between p-4 border-b border-border gap-3 flex-wrap">
          <h2 className="text-lg font-semibold">Histórico de bases</h2>
        </div>
        {loading ? (
          <div className="p-6 text-center text-muted-foreground text-sm"><Loader2 className="inline animate-spin mr-2" size={14}/> Carregando...</div>
        ) : bases.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">Nenhuma base importada ainda.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Camada</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">REDE</th>
                  <th className="text-right p-3">PV</th>
                  <th className="text-left p-3">Arquivo</th>
                  <th className="text-left p-3">Importada em</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {bases.map((b) => (
                  <tr key={b.id} className="border-t border-border hover:bg-muted/30">
                    <td className="p-3">
                      <div className="font-semibold text-foreground whitespace-nowrap">{b.ss} • v{b.versao}</div>
                    </td>
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
                    <td className="p-3 font-mono text-[11px] text-muted-foreground max-w-[240px] truncate" title={b.arquivo_path ?? ''}>
                      {b.arquivo_path?.split('/').pop() ?? '—'}
                    </td>
                    <td className="p-3 text-xs whitespace-nowrap">{new Date(b.created_at).toLocaleString('pt-BR')}</td>
                    <td className="p-3 text-right space-x-2 whitespace-nowrap">
                      <button onClick={() => loadDivergencias(b.id)} className="text-xs text-primary hover:underline">Divergências</button>
                      {b.status === 'preview' && (
                        <button onClick={() => publicarBase(b)} className="text-xs font-medium text-emerald-700 hover:underline">Publicar versão</button>
                      )}
                      <button
                        onClick={() => excluirBase(b)}
                        className="text-xs text-destructive hover:underline inline-flex items-center gap-1"
                      >
                        <Trash2 size={12}/> Excluir camada
                      </button>
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
    <div className="text-[11px] uppercase tracking-wide text-emerald-800/70">{label}</div>
    <div className="text-lg font-semibold">{value}</div>
  </div>
);

export default MapaBasesPage;
