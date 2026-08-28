import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Pencil, Trash2, CalendarClock, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { fmtM2, formatBR, hojeMaceio } from '@/lib/pavimentacao';
import { permissions } from '@/lib/permissions';

interface RegistroPav {
  id: string;
  os_id: string;
  user_id: string;
  data_registro: string;
  comprimento_m: number;
  largura_m: number;
  area_m2: number;
  observacao: string | null;
  created_at: string;
  ordens_servico: { trecho: string; bacia: string } | null;
}

export const MeusRegistrosPavimentacao = ({ refreshKey = 0 }: { refreshKey?: number }) => {
  const { effectiveUser, actingUserId, user } = useAuth();
  const podeGerirTudo = permissions.canEditOS(user?.role) || user?.role === 'admin';
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ data_registro: '', comprimento_m: '', largura_m: '', observacao: '' });
  const [busy, setBusy] = useState(false);

  const userId = actingUserId ?? effectiveUser?.id ?? '';

  const { data: registros = [], isLoading, refetch } = useQuery({
    queryKey: ['pav-registros', userId, refreshKey],
    queryFn: async (): Promise<RegistroPav[]> => {
      const { data, error } = await supabase
        .from('registros_pavimentacao')
        .select('id, os_id, user_id, data_registro, comprimento_m, largura_m, area_m2, observacao, created_at, ordens_servico(trecho, bacia)')
        .eq('user_id', userId)
        .eq('excluido', false)
        .eq('status', 'ativo')
        .order('data_registro', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RegistroPav[];
    },
    enabled: !!userId,
  });

  const filtrados = useMemo(
    () =>
      registros.filter((r) => {
        if (de && r.data_registro < de) return false;
        if (ate && r.data_registro > ate) return false;
        return true;
      }),
    [registros, de, ate],
  );

  const grupos = useMemo(() => {
    const m = new Map<string, RegistroPav[]>();
    filtrados.forEach((r) => {
      const arr = m.get(r.data_registro) ?? [];
      arr.push(r);
      m.set(r.data_registro, arr);
    });
    return Array.from(m.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtrados]);

  const startEdit = (r: RegistroPav) => {
    setEditId(r.id);
    setForm({
      data_registro: r.data_registro,
      comprimento_m: String(r.comprimento_m ?? ''),
      largura_m: String(r.largura_m ?? ''),
      observacao: r.observacao ?? '',
    });
  };

  const salvarEdicao = async (r: RegistroPav) => {
    const c = parseFloat(form.comprimento_m) || 0;
    const l = parseFloat(form.largura_m) || 0;
    if (c <= 0 || l <= 0) { toast.error('Informe comprimento e largura executados.'); return; }
    if (form.data_registro > hojeMaceio()) { toast.error('A data da produção não pode ser futura.'); return; }
    const retroativo = form.data_registro !== hojeMaceio();
    if (retroativo && !window.confirm(`Confirmar produção com data física ${formatBR(form.data_registro)}?`)) return;
    setBusy(true);
    const { error } = await supabase
      .from('registros_pavimentacao')
      .update({
        data_registro: form.data_registro,
        comprimento_m: c,
        largura_m: l,
        observacao: form.observacao || null,
        data_retroativa_confirmada: retroativo,
      })
      .eq('id', r.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Registro atualizado.');
    setEditId(null);
    refetch();
  };

  const excluir = async (r: RegistroPav) => {
    if (!window.confirm(`Excluir o registro de ${formatBR(r.data_registro)} do trecho ${r.ordens_servico?.trecho ?? ''}?`)) return;
    setBusy(true);
    const { error } = await supabase
      .from('registros_pavimentacao')
      .update({ excluido: true, status: 'excluido', excluido_em: new Date().toISOString(), excluido_por: userId })
      .eq('id', r.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Registro excluído.');
    refetch();
  };

  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" size={26} /></div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-2">
        <div className="space-y-0.5">
          <label className="text-[10px] uppercase font-semibold text-muted-foreground">De</label>
          <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="h-8 text-xs w-[140px]" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[10px] uppercase font-semibold text-muted-foreground">Até</label>
          <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="h-8 text-xs w-[140px]" />
        </div>
        {(de || ate) && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setDe(''); setAte(''); }}>
            Limpar
          </Button>
        )}
      </div>

      {grupos.length === 0 && (
        <p className="text-sm text-muted-foreground italic py-6 text-center">Nenhum registro de pavimentação.</p>
      )}

      {grupos.map(([data, itens]) => (
        <div key={data} className="space-y-1.5">
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs font-bold text-foreground">{formatBR(data)}</span>
            <span className="text-[11px] text-muted-foreground">
              {itens.length} registro{itens.length > 1 ? 's' : ''} • {fmtM2(itens.reduce((s, r) => s + Number(r.area_m2 || 0), 0))} m²
            </span>
          </div>

          {itens.map((r) => {
            const retroativo = r.data_registro !== r.created_at.slice(0, 10);
            const editando = editId === r.id;
            const podeEditar = podeGerirTudo || r.user_id === userId;
            return (
              <div key={r.id} className="rounded-lg border border-border bg-card p-2.5 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{r.ordens_servico?.trecho ?? '—'}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{r.ordens_servico?.bacia ?? '—'}</p>
                  </div>
                  {podeEditar && !editando && (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => startEdit(r)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" title="Editar">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => excluir(r)} className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive" title="Excluir">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {retroativo && (
                  <div className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                    <CalendarClock size={11} /> REGISTRO RETROATIVO
                  </div>
                )}

                {editando ? (
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] uppercase text-muted-foreground">Data</label>
                        <Input type="date" value={form.data_registro} max={hojeMaceio()}
                          onChange={(e) => setForm({ ...form, data_registro: e.target.value })} className="h-8 text-xs" />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase text-muted-foreground">Compr. (m)</label>
                        <Input type="number" inputMode="decimal" value={form.comprimento_m}
                          onChange={(e) => setForm({ ...form, comprimento_m: e.target.value })} className="h-8 text-xs" />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase text-muted-foreground">Larg. (m)</label>
                        <Input type="number" inputMode="decimal" value={form.largura_m}
                          onChange={(e) => setForm({ ...form, largura_m: e.target.value })} className="h-8 text-xs" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase text-muted-foreground">Observação</label>
                      <Input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} className="h-8 text-xs" />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Área: <span className="font-semibold text-foreground">
                        {fmtM2((parseFloat(form.comprimento_m) || 0) * (parseFloat(form.largura_m) || 0))} m²
                      </span>
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" className="h-8 text-xs flex-1" disabled={busy} onClick={() => salvarEdicao(r)}>
                        <Check size={13} className="mr-1" /> Salvar
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditId(null)}>
                        <X size={13} />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1 text-[11px]">
                    <div><span className="text-muted-foreground">Compr.</span><br /><span className="font-semibold">{fmtM2(r.comprimento_m)} m</span></div>
                    <div><span className="text-muted-foreground">Largura</span><br /><span className="font-semibold">{fmtM2(r.largura_m)} m</span></div>
                    <div><span className="text-muted-foreground">Área</span><br /><span className="font-semibold text-primary">{fmtM2(r.area_m2)} m²</span></div>
                  </div>
                )}

                {!editando && r.observacao && (
                  <p className="text-[11px] text-muted-foreground italic">{r.observacao}</p>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
