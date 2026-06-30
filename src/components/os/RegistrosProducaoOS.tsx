import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { permissions } from '@/lib/permissions';
import { Loader2, Pencil, Ban, RotateCcw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface RegistroRow {
  id: string;
  os_id: string;
  user_id: string;
  data_registro: string;
  comprimento_dia: number;
  ligacoes_dia: number;
  comprimento_ajustado: number | null;
  ligacoes_ajustadas: number | null;
  motivo_ajuste: string | null;
  ajustado_em: string | null;
  ajustado_por: string | null;
  status: string;
  motivo_cancelamento: string | null;
  cancelado_em: string | null;
  cancelado_por: string | null;
  excluido: boolean;
  observacao: string | null;
  pv_final_assentado: boolean | null;
  pv_final_assentado_em: string | null;
  pv_final_assentado_por: string | null;
  created_at: string;
}

const fmtN = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtData = (d: string) => {
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}`;
};

interface Props {
  osId: string;
}

export function RegistrosProducaoOS({ osId }: Props) {
  const { user, effectiveRole } = useAuth();
  const [rows, setRows] = useState<RegistroRow[]>([]);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  const podeGerir = permissions.canEditOS(effectiveRole); // sala_tecnica / gerencia / admin

  // Ajuste
  const [ajustando, setAjustando] = useState<RegistroRow | null>(null);
  const [ajComp, setAjComp] = useState('');
  const [ajLig, setAjLig] = useState('');
  const [ajMotivo, setAjMotivo] = useState('');
  const [savingAj, setSavingAj] = useState(false);

  // Cancelar
  const [cancelando, setCancelando] = useState<RegistroRow | null>(null);
  const [cancMotivo, setCancMotivo] = useState('');
  const [savingCanc, setSavingCanc] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('registros_producao')
        .select('*')
        .eq('os_id', osId)
        .order('data_registro', { ascending: false })
        .order('created_at', { ascending: false });
      if (cancel) return;
      const rs = ((data ?? []) as any[]) as RegistroRow[];
      setRows(rs);
      const userIds = Array.from(new Set(rs.map((r) => r.user_id).filter(Boolean)));
      if (userIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, display_name, email')
          .in('user_id', userIds);
        const m: Record<string, string> = {};
        (profs ?? []).forEach((p: any) => {
          m[p.user_id] = p.display_name || p.email || '—';
        });
        setNomes(m);
      }
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [osId, reload]);

  useEffect(() => {
    const ch = supabase
      .channel('rp-os-' + osId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registros_producao', filter: `os_id=eq.${osId}` },
        () => setReload((k) => k + 1))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [osId]);

  const ativos = rows.filter((r) => !r.excluido && r.status === 'ativo');
  const totalComp = ativos.reduce((s, r) => s + (Number(r.comprimento_ajustado ?? r.comprimento_dia) || 0), 0);
  const totalLig = ativos.reduce((s, r) => s + (Number(r.ligacoes_ajustadas ?? r.ligacoes_dia) || 0), 0);

  const abrirAjuste = (r: RegistroRow) => {
    setAjustando(r);
    setAjComp(String(r.comprimento_ajustado ?? r.comprimento_dia ?? ''));
    setAjLig(String(r.ligacoes_ajustadas ?? r.ligacoes_dia ?? ''));
    setAjMotivo(r.motivo_ajuste ?? '');
  };

  const salvarAjuste = async () => {
    if (!ajustando || !user) return;
    const comp = Number(String(ajComp).replace(',', '.'));
    const lig = Math.max(0, Math.floor(Number(ajLig) || 0));
    if (isNaN(comp) || comp < 0) { toast.error('Comprimento inválido'); return; }
    if (!ajMotivo.trim()) { toast.error('Informe o motivo do ajuste'); return; }
    setSavingAj(true);
    const valor_anterior = {
      comprimento_ajustado: ajustando.comprimento_ajustado,
      ligacoes_ajustadas: ajustando.ligacoes_ajustadas,
      motivo_ajuste: ajustando.motivo_ajuste,
    };
    const valor_novo: any = {
      comprimento_ajustado: comp,
      ligacoes_ajustadas: lig,
      motivo_ajuste: ajMotivo.trim(),
      ajustado_por: user.id,
      ajustado_em: new Date().toISOString(),
    };
    const { error } = await supabase
      .from('registros_producao')
      .update(valor_novo)
      .eq('id', ajustando.id);
    if (error) {
      setSavingAj(false);
      toast.error('Erro ao ajustar: ' + error.message);
      return;
    }
    await supabase.from('registros_producao_auditoria').insert({
      registro_producao_id: ajustando.id,
      usuario_id: user.id,
      acao: 'ajuste',
      valor_anterior,
      valor_novo,
    });
    setSavingAj(false);
    setAjustando(null);
    setReload((k) => k + 1);
    toast.success('Registro ajustado');
  };

  const removerAjuste = async (r: RegistroRow) => {
    if (!user) return;
    const valor_anterior = {
      comprimento_ajustado: r.comprimento_ajustado,
      ligacoes_ajustadas: r.ligacoes_ajustadas,
      motivo_ajuste: r.motivo_ajuste,
    };
    const valor_novo: any = {
      comprimento_ajustado: null,
      ligacoes_ajustadas: null,
      motivo_ajuste: null,
      ajustado_por: null,
      ajustado_em: null,
    };
    const { error } = await supabase
      .from('registros_producao')
      .update(valor_novo)
      .eq('id', r.id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    await supabase.from('registros_producao_auditoria').insert({
      registro_producao_id: r.id,
      usuario_id: user.id,
      acao: 'remocao_ajuste',
      valor_anterior,
      valor_novo,
    });
    setReload((k) => k + 1);
    toast.success('Ajuste removido — voltou ao valor informado');
  };

  const salvarCancelamento = async () => {
    if (!cancelando || !user) return;
    if (!cancMotivo.trim()) { toast.error('Informe o motivo do cancelamento'); return; }
    setSavingCanc(true);
    const valor_novo: any = {
      status: 'cancelado',
      motivo_cancelamento: cancMotivo.trim(),
      cancelado_por: user.id,
      cancelado_em: new Date().toISOString(),
    };
    const { error } = await supabase
      .from('registros_producao')
      .update(valor_novo)
      .eq('id', cancelando.id);
    if (error) { setSavingCanc(false); toast.error('Erro: ' + error.message); return; }
    await supabase.from('registros_producao_auditoria').insert({
      registro_producao_id: cancelando.id,
      usuario_id: user.id,
      acao: 'cancelamento',
      valor_anterior: { status: cancelando.status },
      valor_novo,
    });
    setSavingCanc(false);
    setCancelando(null);
    setCancMotivo('');
    setReload((k) => k + 1);
    toast.success('Registro cancelado');
  };

  const restaurar = async (r: RegistroRow) => {
    if (!user) return;
    const valor_novo: any = {
      status: 'ativo',
      motivo_cancelamento: null,
      cancelado_por: null,
      cancelado_em: null,
      excluido: false,
      excluido_em: null,
      excluido_por: null,
    };
    const { error } = await supabase
      .from('registros_producao')
      .update(valor_novo)
      .eq('id', r.id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    await supabase.from('registros_producao_auditoria').insert({
      registro_producao_id: r.id,
      usuario_id: user.id,
      acao: 'restauracao',
      valor_anterior: { status: r.status, excluido: r.excluido },
      valor_novo,
    });
    setReload((k) => k + 1);
    toast.success('Registro restaurado');
  };

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-6 mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Registros de Produção</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Fonte única da produção executada desta N.S. — soma dos valores contabilizados de cada lançamento ativo.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-muted-foreground uppercase">Total ativo</p>
          <p className="text-sm font-bold text-foreground">{fmtN(totalComp)} m · {totalLig} ligação(ões)</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" size={20} /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Nenhum registro de produção lançado nesta N.S.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border bg-muted/30 text-left">
                <th className="px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Data</th>
                <th className="px-3 py-2 font-medium text-muted-foreground">Encarregado</th>
                <th className="px-3 py-2 font-medium text-muted-foreground text-right">Comp. informado</th>
                <th className="px-3 py-2 font-medium text-muted-foreground text-right">Comp. final</th>
                <th className="px-3 py-2 font-medium text-muted-foreground text-right">Ligações</th>
                <th className="px-3 py-2 font-medium text-muted-foreground">Status</th>
                {podeGerir && <th className="px-3 py-2 font-medium text-muted-foreground">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const inativo = r.excluido || r.status === 'cancelado';
                const compFinal = Number(r.comprimento_ajustado ?? r.comprimento_dia) || 0;
                const ligFinal = Number(r.ligacoes_ajustadas ?? r.ligacoes_dia) || 0;
                const temAjuste = r.comprimento_ajustado != null || r.ligacoes_ajustadas != null;
                return (
                  <tr key={r.id} className={`border-b border-border ${inativo ? 'opacity-50' : ''}`}>
                    <td className="px-3 py-2 whitespace-nowrap text-foreground">{fmtData(r.data_registro)}</td>
                    <td className="px-3 py-2 text-foreground">{nomes[r.user_id] ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-foreground">{fmtN(Number(r.comprimento_dia) || 0)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-foreground">
                      {fmtN(compFinal)}
                      {temAjuste && (
                        <span className="ml-1 inline-block text-[10px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-700 dark:text-orange-300" title={r.motivo_ajuste ?? undefined}>ajustado</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-foreground">{ligFinal}</td>
                    <td className="px-3 py-2">
                      {r.excluido ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><AlertTriangle size={12} /> Excluído pelo encarregado</span>
                      ) : r.status === 'cancelado' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-destructive" title={r.motivo_cancelamento ?? undefined}><Ban size={12} /> Cancelado</span>
                      ) : (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">Ativo</span>
                      )}
                    </td>
                    {podeGerir && (
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1.5">
                          {!inativo && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => abrirAjuste(r)}>
                                <Pencil size={12} className="mr-1" /> Ajustar
                              </Button>
                              {temAjuste && (
                                <Button size="sm" variant="ghost" onClick={() => removerAjuste(r)} title="Remover ajuste (volta ao valor informado)">
                                  <RotateCcw size={12} className="mr-1" /> Remover ajuste
                                </Button>
                              )}
                              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setCancelando(r)}>
                                <Ban size={12} className="mr-1" /> Cancelar
                              </Button>
                            </>
                          )}
                          {inativo && (
                            <Button size="sm" variant="outline" onClick={() => restaurar(r)}>
                              <RotateCcw size={12} className="mr-1" /> Restaurar
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Ajuste */}
      <Dialog open={!!ajustando} onOpenChange={(o) => !o && setAjustando(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajustar registro</DialogTitle>
            <DialogDescription>
              O valor informado pelo encarregado é preservado. O valor ajustado passa a ser usado para contabilizar a produção da N.S.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="aj-comp">Comprimento final (m)</Label>
              <Input id="aj-comp" inputMode="decimal" value={ajComp} onChange={(e) => setAjComp(e.target.value)} className="h-11" />
              {ajustando && (
                <p className="text-[11px] text-muted-foreground mt-1">Informado pelo encarregado: {fmtN(Number(ajustando.comprimento_dia) || 0)} m</p>
              )}
            </div>
            <div>
              <Label htmlFor="aj-lig">Ligações finais</Label>
              <Input id="aj-lig" inputMode="numeric" value={ajLig} onChange={(e) => setAjLig(e.target.value)} className="h-11" />
              {ajustando && (
                <p className="text-[11px] text-muted-foreground mt-1">Informado pelo encarregado: {ajustando.ligacoes_dia ?? 0}</p>
              )}
            </div>
            <div>
              <Label htmlFor="aj-motivo">Motivo do ajuste *</Label>
              <Textarea id="aj-motivo" rows={3} value={ajMotivo} onChange={(e) => setAjMotivo(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setAjustando(null)} disabled={savingAj}>Cancelar</Button>
            <Button onClick={salvarAjuste} disabled={savingAj}>
              {savingAj && <Loader2 className="animate-spin mr-2" size={14} />} Salvar ajuste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancelamento */}
      <Dialog open={!!cancelando} onOpenChange={(o) => !o && setCancelando(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar registro</DialogTitle>
            <DialogDescription>
              O lançamento permanece para auditoria, mas deixa de contabilizar na produção. Pode ser restaurado depois.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="cc-motivo">Motivo do cancelamento *</Label>
              <Textarea id="cc-motivo" rows={3} value={cancMotivo} onChange={(e) => setCancMotivo(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setCancelando(null)} disabled={savingCanc}>Voltar</Button>
            <Button variant="destructive" onClick={salvarCancelamento} disabled={savingCanc}>
              {savingCanc && <Loader2 className="animate-spin mr-2" size={14} />} Cancelar registro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
