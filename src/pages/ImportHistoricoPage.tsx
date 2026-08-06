import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, ChevronDown, ChevronRight } from 'lucide-react';

interface ImportLog {
  id: string;
  user_email: string | null;
  filename: string | null;
  total_rows: number;
  created_count: number;
  updated_count: number;
  unchanged_count: number;
  error_count: number;
  changes: any[];
  errors: any[];
  created_at: string;
}

const ImportHistoricoPage = () => {
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('import_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) console.error(error);
      setLogs((data || []) as any);
      setLoading(false);
    })();
  }, []);

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Histórico de importações</h1>
          <p className="text-sm text-muted-foreground">{logs.length} importações registradas</p>
        </div>
        <Link to="/importar" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft size={16}/> Voltar
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-muted-foreground"/></div>
      ) : logs.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">Nenhuma importação registrada ainda.</div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary">
              <tr>
                <th className="px-2 py-3 w-8"></th>
                <th className="text-left px-3 py-3 font-medium text-muted-foreground">Data</th>
                <th className="text-left px-3 py-3 font-medium text-muted-foreground">Usuário</th>
                <th className="text-left px-3 py-3 font-medium text-muted-foreground">Arquivo</th>
                <th className="text-right px-3 py-3 font-medium text-muted-foreground">Novas</th>
                <th className="text-right px-3 py-3 font-medium text-muted-foreground">Atualizadas</th>
                <th className="text-right px-3 py-3 font-medium text-muted-foreground">Sem mudança</th>
                <th className="text-right px-3 py-3 font-medium text-muted-foreground">Erros</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => {
                const isOpen = expanded === l.id;
                return (
                  <>
                    <tr key={l.id} className="border-t border-border hover:bg-muted/20 cursor-pointer"
                        onClick={() => setExpanded(isOpen ? null : l.id)}>
                      <td className="px-2 py-2">{isOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</td>
                      <td className="px-3 py-2">{new Date(l.created_at).toLocaleString('pt-BR')}</td>
                      <td className="px-3 py-2">{l.user_email || '—'}</td>
                      <td className="px-3 py-2">{l.filename || '—'}</td>
                      <td className="px-3 py-2 text-right text-status-green font-medium">{l.created_count}</td>
                      <td className="px-3 py-2 text-right text-status-yellow font-medium">{l.updated_count}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{l.unchanged_count}</td>
                      <td className={`px-3 py-2 text-right font-medium ${l.error_count ? 'text-destructive' : 'text-muted-foreground'}`}>{l.error_count}</td>
                    </tr>
                    {isOpen && (
                      <tr key={`${l.id}-d`} className="border-t border-border bg-muted/10">
                        <td colSpan={8} className="p-4">
                          {l.changes?.length > 0 && (
                            <details open className="mb-3">
                              <summary className="text-sm font-medium cursor-pointer mb-2">Alterações ({l.changes.length})</summary>
                              <div className="max-h-72 overflow-auto border border-border rounded">
                                <table className="w-full text-xs">
                                  <thead className="bg-secondary"><tr><th className="text-left p-2">Trecho</th><th className="text-left p-2">Campo</th><th className="text-left p-2">Antigo</th><th className="text-left p-2">Novo</th></tr></thead>
                                  <tbody>
                                    {l.changes.flatMap((c: any) =>
                                      (c.diffs || []).map((d: any, i: number) => (
                                        <tr key={`${c.trecho}-${d.field}-${i}`} className="border-t border-border">
                                          <td className="p-2">{c.trecho}</td>
                                          <td className="p-2 text-muted-foreground">{d.field}</td>
                                          <td className="p-2 text-destructive line-through">{String(d.oldValue ?? '—')}</td>
                                          <td className="p-2 text-status-green">{String(d.newValue ?? '—')}</td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </details>
                          )}
                          {l.errors?.length > 0 && (
                            <details>
                              <summary className="text-sm font-medium cursor-pointer mb-2 text-destructive">Erros ({l.errors.length})</summary>
                              <ul className="text-xs space-y-0.5 max-h-48 overflow-auto">
                                {l.errors.map((e: any, i: number) => (
                                  <li key={i}>• <strong>{e.trecho}</strong>: {e.erro}</li>
                                ))}
                              </ul>
                            </details>
                          )}
                          {l.changes?.length === 0 && l.errors?.length === 0 && (
                            <p className="text-sm text-muted-foreground">Sem detalhes adicionais.</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
};

export default ImportHistoricoPage;
