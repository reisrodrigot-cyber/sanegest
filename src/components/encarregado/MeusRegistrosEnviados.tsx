import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, CheckCircle2, Clock, AlertTriangle, MapPin, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';

interface RegistroRow {
  id: string;
  os_id: string;
  data_registro: string;
  comprimento_dia: number;
  ligacoes_dia: number;
  comprimento_ajustado: number | null;
  ligacoes_ajustadas: number | null;
  ajustado_por: string | null;
  ajustado_em: string | null;
  cancelado_por: string | null;
  status: string;
  motivo_cancelamento: string | null;
  motivo_ajuste: string | null;
  observacao: string | null;
  tipo_pavimento: string | null;
  created_at: string;
}

interface OSRow {
  id: string;
  trecho: string;
  comprimento_real: number | null;
  ligacoes_real: number | null;
}

type Filtro = 'hoje' | 'semana' | 'mes';



const startOf = (filtro: Filtro): string => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (filtro === 'hoje') return now.toISOString().slice(0, 10);
  if (filtro === 'semana') {
    const dow = (now.getDay() + 6) % 7;
    now.setDate(now.getDate() - dow);
    return now.toISOString().slice(0, 10);
  }
  now.setDate(1);
  return now.toISOString().slice(0, 10);
};

const fmtDataCurta = (key: string) => {
  const today = new Date().toISOString().slice(0, 10);
  const yest = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();
  const [y, m, d] = key.split('-');
  const label = `${d}/${m}/${y}`;
  if (key === today) return `Hoje — ${label}`;
  if (key === yest) return `Ontem — ${label}`;
  return label;
};
const fmtHora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const fmtMetros = (n: number) => `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;

interface Props {
  limit?: number;
  hideFilters?: boolean;
  filtroInicial?: Filtro;
}

export function MeusRegistrosEnviados({ limit, hideFilters, filtroInicial = 'hoje' }: Props) {
  const { user, effectiveUser } = useAuth();
  const userId = effectiveUser?.id ?? user?.id ?? '';
  // Quando admin está "vendo como" outro usuário, a sessão real é a do admin.
  // A RLS exige user_id = auth.uid() para editar/excluir → impersonação não pode alterar dados.
  const isImpersonating = !!user && !!effectiveUser && user.id !== effectiveUser.id;
  const [registros, setRegistros] = useState<RegistroRow[]>([]);
  const [ordens, setOrdens] = useState<Record<string, OSRow>>({});
  const [filtro, setFiltro] = useState<Filtro>(filtroInicial);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [, setTick] = useState(0);

  // Edição
  const [editing, setEditing] = useState<RegistroRow | null>(null);
  const [editComp, setEditComp] = useState('');
  const [editLig, setEditLig] = useState('');
  const [editObs, setEditObs] = useState('');
  const [saving, setSaving] = useState(false);

  // Exclusão
  const [deleting, setDeleting] = useState<RegistroRow | null>(null);
  const [removing, setRemoving] = useState(false);

  // Re-render leve para refletir mudanças de validação
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      const since = startOf(filtro);
      const { data: regs } = await supabase
        .from('registros_producao')
        .select('id, os_id, data_registro, comprimento_dia, ligacoes_dia, comprimento_ajustado, ligacoes_ajustadas, ajustado_por, ajustado_em, cancelado_por, status, motivo_cancelamento, motivo_ajuste, observacao, tipo_pavimento, created_at')
        .eq('user_id', userId)
        .eq('excluido', false)
        .gte('data_registro', since)
        .order('data_registro', { ascending: false })
        .order('created_at', { ascending: false });
      if (cancel) return;
      const rs = (regs ?? []) as RegistroRow[];
      const osIds = Array.from(new Set(rs.map((r) => r.os_id)));
      let osMap: Record<string, OSRow> = {};
      if (osIds.length > 0) {
        const { data: os } = await supabase
          .from('ordens_servico')
          .select('id, trecho, comprimento_real, ligacoes_real')
          .in('id', osIds);
        (os ?? []).forEach((o: any) => { osMap[o.id] = o as OSRow; });
      }
      if (cancel) return;
      setOrdens(osMap);
      setRegistros(rs);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [userId, filtro, reloadKey]);

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel('meus-registros-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registros_producao', filter: `user_id=eq.${userId}` },
        () => setReloadKey((k) => k + 1))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  const itens = useMemo(() => (limit ? registros.slice(0, limit) : registros), [registros, limit]);

  const somaPorOs = useMemo(() => {
    const m = new Map<string, { comp: number; lig: number }>();
    registros.forEach((r) => {
      const c = m.get(r.os_id) ?? { comp: 0, lig: 0 };
      c.comp += Number(r.comprimento_dia) || 0;
      c.lig += Number(r.ligacoes_dia) || 0;
      m.set(r.os_id, c);
    });
    return m;
  }, [registros]);

  const temIntervencaoTecnica = (r: RegistroRow) =>
    (r.status ?? 'ativo') === 'cancelado'
    || r.comprimento_ajustado != null
    || r.ligacoes_ajustadas != null
    || !!r.ajustado_por
    || !!r.cancelado_por;

  const podeEditar = (r: RegistroRow) => !temIntervencaoTecnica(r);

  const abrirEdicao = (r: RegistroRow) => {
    setEditing(r);
    setEditComp(String(r.comprimento_dia ?? ''));
    setEditLig(String(r.ligacoes_dia ?? ''));
    setEditObs(r.observacao ?? '');
  };

  const salvarEdicao = async () => {
    if (!editing) return;
    if (temIntervencaoTecnica(editing)) {
      toast({
        title: 'Edição bloqueada',
        description: 'Registro ajustado pela sala técnica. Solicite nova correção se necessário.',
        variant: 'destructive',
      });
      setEditing(null);
      return;
    }
    const novoComp = Number(editComp.replace(',', '.')) || 0;
    const novoLig = Math.max(0, Math.floor(Number(editLig) || 0));
    if (novoComp < 0) { toast({ title: 'Valor inválido', variant: 'destructive' }); return; }
    setSaving(true);
    const valor_anterior = {
      comprimento_dia: editing.comprimento_dia,
      ligacoes_dia: editing.ligacoes_dia,
      observacao: editing.observacao,
    };
    const valor_novo = { comprimento_dia: novoComp, ligacoes_dia: novoLig, observacao: editObs || null };
    const { data: updated, error } = await supabase
      .from('registros_producao')
      .update(valor_novo)
      .eq('id', editing.id)
      .eq('user_id', userId)
      .eq('excluido', false)
      .eq('status', 'ativo')
      .is('comprimento_ajustado', null)
      .is('ligacoes_ajustadas', null)
      .is('ajustado_por', null)
      .is('cancelado_por', null)
      .select('id');
    if (error) {
      setSaving(false);
      toast({ title: 'Não foi possível editar', description: error.message, variant: 'destructive' });
      return;
    }
    if (!updated || updated.length === 0) {
      setSaving(false);
      toast({
        title: 'Não foi possível editar',
        description: 'Verifique se o registro ainda é seu e se não foi cancelado pela sala técnica.',
        variant: 'destructive',
      });
      setEditing(null);
      setReloadKey((k) => k + 1);
      return;
    }

    await supabase.from('registros_producao_auditoria').insert({
      registro_producao_id: editing.id,
      usuario_id: userId,
      acao: 'edicao',
      valor_anterior,
      valor_novo,
    });
    setSaving(false);
    setEditing(null);
    setReloadKey((k) => k + 1);
    toast({ title: 'Registro atualizado' });
  };

  const confirmarExclusao = async () => {
    if (!deleting) return;
    if (temIntervencaoTecnica(deleting)) {
      toast({
        title: 'Exclusão bloqueada',
        description: 'Registro ajustado pela sala técnica. Solicite nova correção se necessário.',
        variant: 'destructive',
      });
      setDeleting(null);
      return;
    }
    setRemoving(true);
    const valor_anterior = {
      comprimento_dia: deleting.comprimento_dia,
      ligacoes_dia: deleting.ligacoes_dia,
      observacao: deleting.observacao,
    };
    const { data: updated, error } = await supabase
      .from('registros_producao')
      .update({ excluido: true, excluido_em: new Date().toISOString(), excluido_por: userId })
      .eq('id', deleting.id)
      .eq('user_id', userId)
      .eq('excluido', false)
      .eq('status', 'ativo')
      .select('id');
    if (error) {
      setRemoving(false);
      toast({ title: 'Não foi possível excluir', description: error.message, variant: 'destructive' });
      return;
    }
    if (!updated || updated.length === 0) {
      setRemoving(false);
      toast({
        title: 'Não foi possível excluir',
        description: 'Verifique se o registro ainda é seu e se não foi cancelado pela sala técnica.',
        variant: 'destructive',
      });
      setDeleting(null);
      setReloadKey((k) => k + 1);
      return;
    }

    // Remove imediatamente da UI para feedback instantâneo
    setRegistros((prev) => prev.filter((x) => x.id !== deleting.id));
    await supabase.from('registros_producao_auditoria').insert({
      registro_producao_id: deleting.id,
      usuario_id: userId,
      acao: 'exclusao',
      valor_anterior,
      valor_novo: { excluido: true },
    });
    setRemoving(false);
    setDeleting(null);
    setReloadKey((k) => k + 1);
    toast({ title: 'Registro excluído' });
  };

  const FilterBtn = ({ id, label }: { id: Filtro; label: string }) => (
    <button
      type="button"
      onClick={() => setFiltro(id)}
      className={`min-h-[44px] px-4 rounded-lg text-sm font-semibold transition-colors border ${
        filtro === id
          ? 'bg-secondary text-secondary-foreground border-secondary'
          : 'bg-card text-foreground border-border hover:bg-muted/60'
      }`}
    >
      {label}
    </button>
  );

  return (
    <section id="meus-registros" className="bg-card rounded-xl border border-border shadow-sm p-4 sm:p-5">
      <div className="mb-3">
        <h2 className="text-lg font-bold text-foreground">Meus registros enviados</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Cada envio já conta como produção. Você pode editar ou excluir seus registros enquanto eles estiverem ativos. A sala técnica pode ajustar, cancelar ou restaurar lançamentos com auditoria.
        </p>
      </div>

      {!hideFilters && (
        <div className="flex flex-wrap gap-2 mb-4">
          <FilterBtn id="hoje" label="Hoje" />
          <FilterBtn id="semana" label="Semana" />
          <FilterBtn id="mes" label="Mês" />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-muted-foreground" size={20} />
        </div>
      ) : itens.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Nenhum envio neste período.
        </p>
      ) : (
        <ul className="space-y-3">
          {itens.map((r) => {
            const os = ordens[r.os_id];
            const trecho = os?.trecho ?? 'Trecho —';
            const cancelado = (r.status ?? 'ativo') === 'cancelado';
            const ajustado = r.comprimento_ajustado != null || r.ligacoes_ajustadas != null;
            const compContab = Number(r.comprimento_ajustado ?? r.comprimento_dia) || 0;
            const ligContab = Number(r.ligacoes_ajustadas ?? r.ligacoes_dia) || 0;

            const statusLabel = cancelado
              ? 'Cancelado pela sala técnica'
              : ajustado ? 'Ajustado pela sala técnica' : 'Contabilizado na produção';
            const StatusIcon = cancelado ? AlertTriangle : ajustado ? AlertTriangle : CheckCircle2;
            const statusColor = cancelado
              ? 'text-destructive'
              : ajustado ? 'text-orange-600 dark:text-orange-400' : 'text-emerald-600 dark:text-emerald-400';

            const editavel = podeEditar(r);

            return (
              <li key={r.id} className={`rounded-lg border border-border bg-background p-3 sm:p-4 ${cancelado ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{fmtDataCurta(r.data_registro)}</p>
                    <p className="text-base font-bold text-foreground mt-0.5 flex items-center gap-1.5">
                      <MapPin size={14} className="text-muted-foreground shrink-0" />
                      <span className="truncate">{trecho}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Enviado às {fmtHora(r.created_at)}</p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="text-[11px] text-muted-foreground">Comprimento informado</p>
                    <p className="text-base font-bold text-foreground">{fmtMetros(Number(r.comprimento_dia) || 0)}</p>
                    {ajustado && r.comprimento_ajustado != null && (
                      <p className="text-[11px] text-orange-600 dark:text-orange-400 mt-0.5">
                        Ajustado: <span className="font-semibold">{fmtMetros(compContab)}</span>
                      </p>
                    )}
                  </div>
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="text-[11px] text-muted-foreground">Ligações informadas</p>
                    <p className="text-base font-bold text-foreground">{r.ligacoes_dia ?? 0}</p>
                    {ajustado && r.ligacoes_ajustadas != null && (
                      <p className="text-[11px] text-orange-600 dark:text-orange-400 mt-0.5">
                        Ajustado: <span className="font-semibold">{ligContab}</span>
                      </p>
                    )}
                  </div>
                </div>

                {r.motivo_ajuste && (
                  <p className="mt-2 text-[11px] text-orange-700 dark:text-orange-300 italic">Motivo do ajuste: {r.motivo_ajuste}</p>
                )}
                {cancelado && r.motivo_cancelamento && (
                  <p className="mt-2 text-[11px] text-destructive italic">Motivo do cancelamento: {r.motivo_cancelamento}</p>
                )}

                {r.observacao && (
                  <p className="mt-2 text-xs text-muted-foreground italic">Obs.: {r.observacao}</p>
                )}

                <div className={`mt-3 flex items-center gap-1.5 text-xs font-semibold ${statusColor}`}>
                  <StatusIcon size={14} />
                  <span>{statusLabel}</span>
                </div>

                {/* Ações de edição/exclusão do encarregado */}
                {editavel ? (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-[11px] text-muted-foreground mb-2">
                      Este registro está ativo e ainda não foi ajustado pela sala técnica. Você pode editá-lo ou excluí-lo.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-[44px]"
                        onClick={() => abrirEdicao(r)}
                      >
                        <Pencil size={16} className="mr-1.5" /> Editar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-[44px] text-destructive hover:text-destructive"
                        onClick={() => setDeleting(r)}
                      >
                        <Trash2 size={16} className="mr-1.5" /> Excluir
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className={`text-[11px] font-semibold ${cancelado ? 'text-destructive' : 'text-orange-700 dark:text-orange-300'}`}>
                      Registro {cancelado ? 'cancelado' : 'ajustado'} pela sala técnica
                    </p>
                    <p className="text-[11px] text-muted-foreground italic mt-0.5">
                      Registro ajustado pela sala técnica. Solicite nova correção se necessário.
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Modal edição */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar registro</DialogTitle>
            <DialogDescription>
              Ajuste apenas os dados operacionais. O trecho, a obra e a data original não podem ser alterados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="edit-comp">Comprimento informado (m)</Label>
              <Input
                id="edit-comp" inputMode="decimal" value={editComp}
                onChange={(e) => setEditComp(e.target.value)} className="h-11"
              />
            </div>
            <div>
              <Label htmlFor="edit-lig">Ligações informadas</Label>
              <Input
                id="edit-lig" inputMode="numeric" value={editLig}
                onChange={(e) => setEditLig(e.target.value)} className="h-11"
              />
            </div>
            <div>
              <Label htmlFor="edit-obs">Observação</Label>
              <Textarea
                id="edit-obs" rows={3} value={editObs}
                onChange={(e) => setEditObs(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={salvarEdicao} disabled={saving}>
              {saving ? <Loader2 className="animate-spin mr-2" size={16} /> : null} Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal exclusão */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir este registro?</DialogTitle>
            <DialogDescription>
              Essa ação remove o lançamento da sua produção provisória, mas ficará registrada para auditoria.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleting(null)} disabled={removing}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmarExclusao} disabled={removing}>
              {removing ? <Loader2 className="animate-spin mr-2" size={16} /> : null} Excluir registro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
