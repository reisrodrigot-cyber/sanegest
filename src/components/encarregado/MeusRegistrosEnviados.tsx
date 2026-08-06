import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, CheckCircle2, AlertTriangle, MapPin, Pencil, Trash2, CalendarIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';

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
  pv_final_assentado: boolean | null;
  pv_final_assentado_em: string | null;
  created_at: string;
}

interface OSRow {
  id: string;
  trecho: string;
  comprimento_real: number | null;
  ligacoes_real: number | null;
}


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
// "Hoje" em America/Maceio (mesma regra do cadastro de produção)
const hojeMaceio = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Maceio', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
const formatBRData = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};
const fmtMetros = (n: number) => `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;

interface Props {
  limit?: number;
  hideFilters?: boolean;
  filtroInicial?: 'hoje' | 'semana' | 'mes';
}

export function MeusRegistrosEnviados({ limit, hideFilters: _hideFilters, filtroInicial: _filtroInicial }: Props) {
  const { user, effectiveUser } = useAuth();
  const userId = effectiveUser?.id ?? user?.id ?? '';
  const [registros, setRegistros] = useState<RegistroRow[]>([]);
  const [ordens, setOrdens] = useState<Record<string, OSRow>>({});
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [, setTick] = useState(0);

  // Edição
  const [editing, setEditing] = useState<RegistroRow | null>(null);
  const [editComp, setEditComp] = useState('');
  const [editLig, setEditLig] = useState('');
  const [editObs, setEditObs] = useState('');
  const [editData, setEditData] = useState('');
  const [saving, setSaving] = useState(false);
  // Ligações do registro em edição
  type LigItem = {
    id?: string;
    comprimento: string;
    comprimento_original: number | null;
    isNew?: boolean;
    dirty?: boolean;
  };
  const [editLigItems, setEditLigItems] = useState<LigItem[]>([]);
  const [loadingLigs, setLoadingLigs] = useState(false);

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
      const { data: regs } = await supabase
        .from('registros_producao')
        .select('id, os_id, data_registro, comprimento_dia, ligacoes_dia, comprimento_ajustado, ligacoes_ajustadas, ajustado_por, ajustado_em, cancelado_por, status, motivo_cancelamento, motivo_ajuste, observacao, tipo_pavimento, pv_final_assentado, pv_final_assentado_em, created_at')
        .eq('user_id', userId)
        .eq('excluido', false)
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
  }, [userId, reloadKey]);

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel('meus-registros-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registros_producao', filter: `user_id=eq.${userId}` },
        () => setReloadKey((k) => k + 1))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  // Filtro de período
  type PeriodoTipo = 'semana' | 'mes' | 'todos' | 'personalizado';
  const [periodo, setPeriodo] = useState<PeriodoTipo>('semana');
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [tempRange, setTempRange] = useState<DateRange | undefined>(undefined);
  const [pickerOpen, setPickerOpen] = useState(false);
  const isMobile = useIsMobile();

  const toKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };
  const fmtBR = (d: Date) => d.toLocaleDateString('pt-BR');

  const filtrados = useMemo(() => {
    if (periodo === 'todos') return registros;
    if (periodo === 'personalizado') {
      if (!range?.from) return registros;
      const from = toKey(range.from);
      const to = toKey(range.to ?? range.from);
      return registros.filter((r) => r.data_registro >= from && r.data_registro <= to);
    }
    const dias = periodo === 'semana' ? 7 : 30;
    const limite = new Date();
    limite.setHours(0, 0, 0, 0);
    limite.setDate(limite.getDate() - (dias - 1));
    const limKey = toKey(limite);
    return registros.filter((r) => r.data_registro >= limKey);
  }, [registros, periodo, range]);

  const itens = useMemo(() => (limit ? filtrados.slice(0, limit) : filtrados), [filtrados, limit]);

  const aplicarRange = (r: DateRange | undefined) => {
    if (!r?.from) return;
    setRange({ from: r.from, to: r.to ?? r.from });
    setPeriodo('personalizado');
    setPickerOpen(false);
  };
  const limparPeriodo = () => {
    setRange(undefined);
    setTempRange(undefined);
    setPeriodo('semana');
    setPickerOpen(false);
  };
  const abrirPicker = () => {
    setTempRange(range);
    setPickerOpen(true);
  };

  const periodoLabel = (() => {
    if (periodo !== 'personalizado' || !range?.from) return null;
    const a = fmtBR(range.from);
    const b = fmtBR(range.to ?? range.from);
    return a === b ? `Período: ${a}` : `Período: ${a} a ${b}`;
  })();

  const CalendarPicker = (
    <Calendar
      mode="range"
      selected={tempRange}
      onSelect={(r) => {
        setTempRange(r);
        if (!isMobile && r?.from && r?.to) aplicarRange(r);
      }}
      numberOfMonths={isMobile ? 1 : 2}
      className={cn('p-3 pointer-events-auto')}
    />
  );


  const temIntervencaoTecnica = (r: RegistroRow) =>
    (r.status ?? 'ativo') === 'cancelado'
    || r.comprimento_ajustado != null
    || r.ligacoes_ajustadas != null
    || !!r.ajustado_por
    || !!r.cancelado_por;

  const podeEditar = (r: RegistroRow) => !temIntervencaoTecnica(r);

  const abrirEdicao = async (r: RegistroRow) => {
    setEditing(r);
    setEditComp(String(r.comprimento_dia ?? ''));
    setEditLig(String(r.ligacoes_dia ?? ''));
    setEditObs(r.observacao ?? '');
    setEditData(r.data_registro);
    setEditLigItems([]);
    setLoadingLigs(true);
    const { data: ligs } = await supabase
      .from('ligacoes')
      .select('id, comprimento, comprimento_original')
      .eq('registro_producao_id', r.id)
      .order('created_at', { ascending: true });
    const items: LigItem[] = (ligs ?? []).map((l: any) => ({
      id: l.id,
      comprimento: l.comprimento != null ? String(l.comprimento).replace('.', ',') : '',
      comprimento_original: l.comprimento_original,
    }));
    // Ajusta para bater com ligacoes_dia (mantém valores existentes)
    const alvo = Math.max(0, Number(r.ligacoes_dia) || 0);
    while (items.length < alvo) items.push({ comprimento: '', comprimento_original: null, isNew: true });
    setEditLigItems(items);
    setLoadingLigs(false);
  };

  // Ajusta lista quando editLig muda (sem apagar preenchidos)
  useEffect(() => {
    if (!editing) return;
    const target = Math.max(0, Math.floor(Number(editLig) || 0));
    setEditLigItems((prev) => {
      if (prev.length === target) return prev;
      if (prev.length < target) {
        const add: LigItem[] = [];
        for (let i = 0; i < target - prev.length; i++) {
          add.push({ comprimento: '', comprimento_original: null, isNew: true });
        }
        return [...prev, ...add];
      }
      return prev.slice(0, target);
    });
  }, [editLig, editing]);

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
    if (novoComp < 0) { toast({ title: 'Valor inválido', description: 'Comprimento não pode ser negativo.', variant: 'destructive' }); return; }
    // Validação ligações
    const ligsParsed: Array<{ id?: string; comprimento: number; comprimento_original: number | null; isNew?: boolean }> = [];
    for (let i = 0; i < novoLig; i++) {
      const raw = (editLigItems[i]?.comprimento ?? '').toString().trim();
      if (raw === '') {
        toast({ title: 'Comprimento obrigatório', description: `Informe o comprimento da ligação ${i + 1}.`, variant: 'destructive' });
        return;
      }
      const v = Number(raw.replace(',', '.'));
      if (!Number.isFinite(v) || v < 0) {
        toast({ title: 'Valor inválido', description: `Comprimento inválido na ligação ${i + 1}.`, variant: 'destructive' });
        return;
      }
      ligsParsed.push({
        id: editLigItems[i]?.id,
        comprimento: v,
        comprimento_original: editLigItems[i]?.comprimento_original ?? null,
        isNew: editLigItems[i]?.isNew,
      });
    }
    setSaving(true);
    if (!editData) {
      setSaving(false);
      toast({ title: 'Data obrigatória', description: 'Informe a data da produção.', variant: 'destructive' });
      return;
    }
    if (editData > hojeMaceio()) {
      setSaving(false);
      toast({ title: 'Data inválida', description: 'A data da produção não pode ser futura.', variant: 'destructive' });
      return;
    }
    const valor_anterior = {
      comprimento_dia: editing.comprimento_dia,
      ligacoes_dia: editing.ligacoes_dia,
      observacao: editing.observacao,
      data_registro: editing.data_registro,
    };
    const valor_novo = { comprimento_dia: novoComp, ligacoes_dia: novoLig, observacao: editObs || null, data_registro: editData };
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

    // Sincroniza ligacoes (comprimentos individuais) com auditoria
    try {
      const { data: existentes } = await supabase
        .from('ligacoes')
        .select('id, comprimento, comprimento_original')
        .eq('registro_producao_id', editing.id)
        .order('created_at', { ascending: true });
      const existMap = new Map<string, any>((existentes ?? []).map((l: any) => [l.id, l]));
      const keepIds = new Set<string>();
      const nowIso = new Date().toISOString();

      for (const item of ligsParsed) {
        if (item.id && existMap.has(item.id)) {
          keepIds.add(item.id);
          const prev = existMap.get(item.id);
          const prevComp = Number(prev.comprimento) || 0;
          if (Math.abs(prevComp - item.comprimento) > 1e-9) {
            const patch: any = {
              comprimento: item.comprimento,
              ajustado_por: userId,
              ajustado_em: nowIso,
            };
            if (prev.comprimento_original == null) {
              patch.comprimento_original = prevComp;
            }
            await supabase.from('ligacoes').update(patch).eq('id', item.id);
          }
        } else {
          // nova ligação
          await supabase.from('ligacoes').insert({
            os_id: editing.os_id,
            registro_producao_id: editing.id,
            encarregado_id: userId,
            comprimento: item.comprimento,
          });
        }
      }
      // Remove ligações excedentes (as que não estão mais na lista)
      const toDelete = (existentes ?? [])
        .map((l: any) => l.id as string)
        .filter((id) => !keepIds.has(id) && !ligsParsed.some((p) => p.id === id));
      if (toDelete.length > 0) {
        await supabase.from('ligacoes').delete().in('id', toDelete);
      }
    } catch (e: any) {
      toast({ title: 'Aviso', description: 'Registro salvo, mas houve um problema ao sincronizar ligações: ' + (e?.message ?? ''), variant: 'destructive' });
    }

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
      .is('comprimento_ajustado', null)
      .is('ligacoes_ajustadas', null)
      .is('ajustado_por', null)
      .is('cancelado_por', null)
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

  return (
    <section id="meus-registros" className="bg-card rounded-xl border border-border shadow-sm p-4 sm:p-5">
      <div className="mb-3">
        <h2 className="text-lg font-bold text-foreground">Meus registros enviados</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Cada envio já conta como produção. Você pode editar ou excluir seus registros enquanto eles estiverem ativos. A sala técnica pode ajustar, cancelar ou restaurar lançamentos com auditoria.
        </p>
      </div>

      {/* Filtros de período */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {([
          { key: 'semana', label: '7 dias' },
          { key: 'mes', label: '30 dias' },
          { key: 'todos', label: 'Todos' },
        ] as { key: PeriodoTipo; label: string }[]).map((opt) => (
          <Button
            key={opt.key}
            type="button"
            size="sm"
            variant={periodo === opt.key ? 'default' : 'outline'}
            className="min-h-[36px]"
            onClick={() => { setPeriodo(opt.key); setRange(undefined); }}
          >
            {opt.label}
          </Button>
        ))}

        {isMobile ? (
          <>
            <Button
              type="button"
              size="sm"
              variant={periodo === 'personalizado' ? 'default' : 'outline'}
              className="min-h-[36px]"
              onClick={abrirPicker}
            >
              <CalendarIcon size={14} className="mr-1.5" />
              {periodo === 'personalizado' && range?.from ? (
                (() => {
                  const a = fmtBR(range.from);
                  const b = fmtBR(range.to ?? range.from);
                  return a === b ? a : `${a} – ${b}`;
                })()
              ) : 'Personalizado'}
            </Button>
            <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
              <SheetContent side="bottom" className="h-[85vh] flex flex-col">
                <SheetHeader>
                  <SheetTitle>Selecionar período</SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto flex justify-center py-2">
                  {CalendarPicker}
                </div>
                <div className="text-center text-xs text-muted-foreground pb-2">
                  {tempRange?.from ? (
                    (() => {
                      const a = fmtBR(tempRange.from);
                      const b = tempRange.to ? fmtBR(tempRange.to) : a;
                      return a === b ? `Dia: ${a}` : `${a} até ${b}`;
                    })()
                  ) : 'Toque em uma data inicial e depois na final.'}
                </div>
                <SheetFooter className="flex-row gap-2 sm:flex-row">
                  <Button variant="ghost" className="flex-1 min-h-[44px]" onClick={() => setPickerOpen(false)}>
                    Cancelar
                  </Button>
                  {tempRange?.from && !tempRange?.to && (
                    <Button
                      variant="outline"
                      className="flex-1 min-h-[44px]"
                      onClick={() => aplicarRange({ from: tempRange.from, to: tempRange.from })}
                    >
                      Usar este dia
                    </Button>
                  )}
                  <Button
                    className="flex-1 min-h-[44px]"
                    disabled={!tempRange?.from}
                    onClick={() => aplicarRange(tempRange)}
                  >
                    Aplicar
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </>
        ) : (
          <Popover open={pickerOpen} onOpenChange={(o) => { setPickerOpen(o); if (o) setTempRange(range); }}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant={periodo === 'personalizado' ? 'default' : 'outline'}
                className="min-h-[36px]"
              >
                <CalendarIcon size={14} className="mr-1.5" />
                {periodo === 'personalizado' && range?.from ? (
                  (() => {
                    const a = fmtBR(range.from);
                    const b = fmtBR(range.to ?? range.from);
                    return a === b ? a : `${a} – ${b}`;
                  })()
                ) : 'Personalizado'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              {CalendarPicker}
              <div className="flex items-center justify-between gap-2 p-2 border-t border-border">
                <span className="text-xs text-muted-foreground px-1">
                  {tempRange?.from ? (
                    (() => {
                      const a = fmtBR(tempRange.from);
                      const b = tempRange.to ? fmtBR(tempRange.to) : a;
                      return a === b ? `Dia: ${a}` : `${a} até ${b}`;
                    })()
                  ) : 'Selecione um intervalo.'}
                </span>
                <div className="flex gap-1">
                  {tempRange?.from && !tempRange?.to && (
                    <Button size="sm" variant="outline" onClick={() => aplicarRange({ from: tempRange.from, to: tempRange.from })}>
                      Aplicar este dia
                    </Button>
                  )}
                  <Button size="sm" disabled={!tempRange?.from} onClick={() => aplicarRange(tempRange)}>
                    Aplicar
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {periodo === 'personalizado' && range?.from && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="min-h-[36px] text-muted-foreground"
            onClick={limparPeriodo}
          >
            Limpar período
          </Button>
        )}
      </div>

      {periodoLabel && (
        <p className="mb-3 text-xs text-muted-foreground">{periodoLabel}</p>
      )}



      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-muted-foreground" size={20} />
        </div>
      ) : itens.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Nenhum envio encontrado.
        </p>
      ) : (
        <div className="space-y-4">
          {(() => {
            const groups: { date: string; items: RegistroRow[] }[] = [];
            itens.forEach((r) => {
              if (groups.length === 0 || groups[groups.length - 1].date !== r.data_registro) {
                groups.push({ date: r.data_registro, items: [r] });
              } else {
                groups[groups.length - 1].items.push(r);
              }
            });
            return groups.map((g) => (
              <div key={g.date}>
                <p className="text-sm font-semibold text-foreground py-1">
                  {fmtDataCurta(g.date)}
                </p>
                <ul className="space-y-3 mt-2">
                  {g.items.map((r) => {
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
                            <p className="text-base font-bold text-foreground flex items-center gap-1.5">
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

                        {r.pv_final_assentado && !cancelado && (
                          <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-secondary/10 px-2 py-1 text-[11px] font-semibold text-secondary">
                            <CheckCircle2 size={12} />
                            PV final assentado — trecho concluído pelo encarregado
                          </div>
                        )}

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
              </div>
            ));
          })()}
        </div>
      )}

      {/* Modal edição */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar registro</DialogTitle>
            <DialogDescription>
              Ajuste os dados operacionais e, se necessário, a data da produção. O trecho e a obra não podem ser alterados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            <div>
              <Label htmlFor="edit-data">Data da produção *</Label>
              <Input
                id="edit-data"
                type="date"
                value={editData}
                max={hojeMaceio()}
                onChange={(e) => setEditData(e.target.value)}
                className="h-11 text-base"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                {editData
                  ? editData === hojeMaceio()
                    ? `Hoje — ${formatBRData(editData)}`
                    : `Lançamento retroativo — ${formatBRData(editData)}`
                  : 'Informe a data em que a produção foi executada.'}
              </p>
            </div>
            <div>
              <Label htmlFor="edit-comp">Comprimento informado (m)</Label>
              <Input
                id="edit-comp" inputMode="decimal" value={editComp}
                onChange={(e) => setEditComp(e.target.value)} className="h-11"
                placeholder="Ex.: 29,60"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Metragem da rede/mainline informada no dia. Aceita vírgula ou ponto.
              </p>
            </div>
            <div>
              <Label htmlFor="edit-lig">Ligações informadas</Label>
              <Input
                id="edit-lig" inputMode="numeric" value={editLig}
                onChange={(e) => setEditLig(e.target.value.replace(/[^0-9]/g, ''))} className="h-11"
              />
            </div>

            {loadingLigs ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="animate-spin" size={14} /> Carregando ligações…
              </div>
            ) : (Math.max(0, Math.floor(Number(editLig) || 0)) > 0) && (
              <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">Comprimento de cada ligação (m)</p>
                  <p className="text-[11px] text-muted-foreground">
                    Soma: {editLigItems
                      .slice(0, Math.max(0, Math.floor(Number(editLig) || 0)))
                      .reduce((s, it) => s + (Number((it.comprimento || '0').toString().replace(',', '.')) || 0), 0)
                      .toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m
                  </p>
                </div>
                {Array.from({ length: Math.max(0, Math.floor(Number(editLig) || 0)) }).map((_, i) => {
                  const item = editLigItems[i];
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <Label htmlFor={`lig-${i}`} className="w-20 text-xs">Ligação {i + 1}</Label>
                      <Input
                        id={`lig-${i}`}
                        inputMode="decimal"
                        value={item?.comprimento ?? ''}
                        placeholder="0,00"
                        onChange={(e) => {
                          const v = e.target.value;
                          setEditLigItems((prev) => {
                            const next = [...prev];
                            while (next.length <= i) next.push({ comprimento: '', comprimento_original: null, isNew: true });
                            next[i] = { ...next[i], comprimento: v, dirty: true };
                            return next;
                          });
                        }}
                        className="h-10 flex-1"
                      />
                      {item?.comprimento_original != null && (
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          orig.: {Number(item.comprimento_original).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

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
