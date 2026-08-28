import { useMemo, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Save, ChevronLeft, CheckCircle2, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { fmtM2, formatBR, hojeMaceio } from '@/lib/pavimentacao';
import { MeusRegistrosPavimentacao } from '@/components/pavimentacao/MeusRegistrosPavimentacao';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

interface NSPav {
  os_id: string;
  trecho: string;
  sub_bacia: string;
  pv_montante: string | null;
  pv_jusante: string | null;
  comprimento_previsto: number | null;
  pav_previsto: string | null;
  liberado: boolean;
  area_prevista_m2: number | null;
  area_realizada_m2: number | null;
  concluido: boolean;
}

const PavimentacaoPage = () => {
  const { actingUserId, effectiveUser } = useAuth();
  const userId = actingUserId ?? effectiveUser?.id ?? '';
  const [tab, setTab] = useState<'lancar' | 'historico'>('lancar');
  const [openOsId, setOpenOsId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: lista = [], isLoading, refetch } = useQuery({
    queryKey: ['pav-minhas-ns', userId],
    queryFn: async (): Promise<NSPav[]> => {
      const { data, error } = await supabase.rpc('pavimentacao_minhas_ns', { _user_id: userId });
      if (error) throw error;
      return (data ?? []) as unknown as NSPav[];
    },
    enabled: !!userId,
  });

  const aberta = useMemo(() => lista.find((n) => n.os_id === openOsId) ?? null, [lista, openOsId]);

  return (
    <AppLayout>
      <div className="mb-3">
        <h1 className="text-lg sm:text-xl font-bold text-foreground leading-tight">Pavimentação</h1>
        <p className="text-muted-foreground text-xs">Registro de produção de pavimentação</p>
      </div>

      <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-muted mb-3">
        {([['lancar', 'Lançar produção'], ['historico', 'Meus registros']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`h-9 rounded-md text-xs sm:text-sm font-semibold transition-colors ${
              tab === id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'historico' ? (
        <MeusRegistrosPavimentacao refreshKey={refreshKey} />
      ) : isLoading ? (
        <div className="flex justify-center py-14"><Loader2 className="animate-spin text-muted-foreground" size={28} /></div>
      ) : lista.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-10 text-center">
          Nenhuma N.S. liberada para pavimentação no momento.
        </p>
      ) : (
        <div className="space-y-2">
          {lista.map((ns) => (
            <button
              key={ns.os_id}
              onClick={() => setOpenOsId(ns.os_id)}
              className="w-full text-left rounded-lg border border-border bg-card p-3 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{ns.trecho}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{ns.sub_bacia}</p>
                </div>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                  ns.concluido ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                               : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                }`}>
                  {ns.concluido ? 'Pavimentação finalizada' : 'Pavimentação em execução'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 mt-2 text-[11px]">
                <div><span className="text-muted-foreground">Prevista</span><br />
                  <span className="font-semibold">{ns.area_prevista_m2 == null ? 'sem previsão' : `${fmtM2(ns.area_prevista_m2)} m²`}</span></div>
                <div><span className="text-muted-foreground">Realizada</span><br />
                  <span className="font-semibold">{fmtM2(ns.area_realizada_m2 ?? 0)} m²</span></div>
                <div><span className="text-muted-foreground">Saldo</span><br />
                  <span className="font-semibold">
                    {ns.area_prevista_m2 == null ? '—' : `${fmtM2(Math.max(ns.area_prevista_m2 - Number(ns.area_realizada_m2 ?? 0), 0))} m²`}
                  </span></div>
              </div>
            </button>
          ))}
        </div>
      )}

      {aberta && (
        <DetalheTrecho
          ns={aberta}
          userId={userId}
          onClose={() => setOpenOsId(null)}
          onSaved={() => { refetch(); setRefreshKey((k) => k + 1); }}
        />
      )}
    </AppLayout>
  );
};

const DetalheTrecho = ({
  ns, userId, onClose, onSaved,
}: { ns: NSPav; userId: string; onClose: () => void; onSaved: () => void }) => {
  const [data, setData] = useState(hojeMaceio());
  const [comprimento, setComprimento] = useState('');
  const [largura, setLargura] = useState('');
  const [observacao, setObservacao] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const area = (parseFloat(comprimento) || 0) * (parseFloat(largura) || 0);
  const retroativo = data !== hojeMaceio();

  const { data: doDia = [] } = useQuery({
    queryKey: ['pav-registros-dia', ns.os_id, userId, data],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from('registros_pavimentacao')
        .select('id')
        .eq('os_id', ns.os_id)
        .eq('user_id', userId)
        .eq('data_registro', data)
        .eq('excluido', false);
      return rows ?? [];
    },
    enabled: !!userId && !!data,
  });

  const validar = () => {
    const c = parseFloat(comprimento) || 0;
    const l = parseFloat(largura) || 0;
    if (c <= 0 || l <= 0) { toast.error('Informe comprimento e largura executados.'); return false; }
    if (!data) { toast.error('Informe a data da produção.'); return false; }
    if (data > hojeMaceio()) { toast.error('A data da produção não pode ser futura.'); return false; }
    return true;
  };

  const gravar = async () => {
    setSaving(true);
    const { error } = await supabase.from('registros_pavimentacao').insert({
      os_id: ns.os_id,
      user_id: userId,
      data_registro: data,
      comprimento_m: parseFloat(comprimento) || 0,
      largura_m: parseFloat(largura) || 0,
      observacao: observacao || null,
      data_retroativa_confirmada: retroativo,
    });
    setSaving(false);
    setConfirmOpen(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Produção de pavimentação registrada.');
    setComprimento(''); setLargura(''); setObservacao('');
    onSaved();
  };

  const submit = () => {
    if (!validar()) return;
    if (retroativo) { setConfirmOpen(true); return; }
    gravar();
  };

  const alternarConclusao = async () => {
    const { error } = ns.concluido
      ? await supabase.rpc('reabrir_pavimentacao', { _os_id: ns.os_id, _motivo: null })
      : await supabase.rpc('finalizar_pavimentacao', { _os_id: ns.os_id });
    if (error) { toast.error(error.message); return; }
    toast.success(ns.concluido ? 'Pavimentação reaberta.' : 'Trecho finalizado.');
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-1">
            <ChevronLeft size={16} className="text-muted-foreground" /> {ns.trecho}
          </DialogTitle>
          <DialogDescription className="text-xs">{ns.sub_bacia}</DialogDescription>
        </DialogHeader>

        {/* Dados do trecho — somente o necessário para pavimentação */}
        <div className="rounded-lg border border-border bg-muted/30 p-2.5 text-[12px] space-y-1">
          <Row label="PV montante → jusante" value={`${ns.pv_montante ?? '—'} → ${ns.pv_jusante ?? '—'}`} />
          <Row label="Comprimento previsto" value={ns.comprimento_previsto == null ? '—' : `${fmtM2(ns.comprimento_previsto)} m`} />
          <Row label="Tipo de pavimento" value={ns.pav_previsto ?? '—'} />
          <Row label="Liberação para Pavimentação" value={ns.liberado ? 'Liberada' : 'Não liberada'} />
          <Row label="Área prevista" value={ns.area_prevista_m2 == null ? 'sem previsão' : `${fmtM2(ns.area_prevista_m2)} m²`} />
          <Row label="Área realizada" value={`${fmtM2(ns.area_realizada_m2 ?? 0)} m²`} />
          <Row
            label="Saldo"
            value={ns.area_prevista_m2 == null ? '—' : `${fmtM2(Math.max(ns.area_prevista_m2 - Number(ns.area_realizada_m2 ?? 0), 0))} m²`}
          />
          <Row
            label="% Executado"
            value={
              ns.area_prevista_m2 == null || ns.area_prevista_m2 <= 0
                ? '—'
                : `${((Number(ns.area_realizada_m2 ?? 0) / ns.area_prevista_m2) * 100).toFixed(1)}%`
            }
          />
        </div>

        {/* Formulário */}
        <div className="space-y-2">
          <div>
            <label className="text-[11px] uppercase font-semibold text-muted-foreground">Data da produção</label>
            <Input type="date" value={data} max={hojeMaceio()} onChange={(e) => setData(e.target.value)} className="h-10 text-sm" />
          </div>
          {doDia.length > 0 && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              Você já registrou produção neste trecho em {formatBR(data)}. É possível registrar novamente.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] uppercase font-semibold text-muted-foreground">Comprimento (m)</label>
              <Input type="number" inputMode="decimal" value={comprimento} onChange={(e) => setComprimento(e.target.value)} className="h-10 text-sm" />
            </div>
            <div>
              <label className="text-[11px] uppercase font-semibold text-muted-foreground">Largura (m)</label>
              <Input type="number" inputMode="decimal" value={largura} onChange={(e) => setLargura(e.target.value)} className="h-10 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-[11px] uppercase font-semibold text-muted-foreground">Área executada (m²)</label>
            <Input readOnly value={fmtM2(area)} className="h-10 text-sm bg-muted font-semibold" />
          </div>
          <div>
            <label className="text-[11px] uppercase font-semibold text-muted-foreground">Observação (opcional)</label>
            <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} className="h-10 text-sm" />
          </div>

          <Button className="w-full h-11" onClick={submit} disabled={saving}>
            {saving ? <Loader2 size={16} className="animate-spin mr-1" /> : <Save size={16} className="mr-1" />}
            Registrar produção
          </Button>

          <Button variant="outline" className="w-full h-10" onClick={alternarConclusao}>
            {ns.concluido ? <><RotateCcw size={15} className="mr-1" /> Reabrir pavimentação</> : <><CheckCircle2 size={15} className="mr-1" /> Trecho finalizado</>}
          </Button>
        </div>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base">Confirmar lançamento retroativo</DialogTitle>
              <DialogDescription className="text-xs">
                A data física da produção informada é <strong>{formatBR(data)}</strong>, diferente de hoje.
                O lançamento ficará registrado como retroativo na auditoria.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
              <Button size="sm" onClick={gravar} disabled={saving}>Confirmar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-2 border-b border-border/60 last:border-0 py-0.5">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-foreground text-right">{value}</span>
  </div>
);

export default PavimentacaoPage;
