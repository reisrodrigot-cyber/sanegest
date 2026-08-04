import { AppLayout } from '@/components/AppLayout';
import { MeusRegistrosEnviados } from '@/components/encarregado/MeusRegistrosEnviados';


import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrdensServico } from '@/hooks/useOrdensServico';
import { Loader2, Save, MapPin, Eye, Pencil, X, Check, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { OrdemServico } from '@/types/sanegest';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatDN } from '@/lib/format';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const PAV_OPTIONS = [
  'Solo Natural',
  'Asfalto',
  'Paralelepípedo',
  'Solo Natural / Asfalto',
  'Solo Natural / Paralelepípedo',
  'Asfalto / Paralelepípedo',
  'Solo Natural / Asfalto / Paralelepípedo',
];

interface RegistroDia {
  id: string;
  data_registro: string;
  comprimento_dia: number;
  ligacoes_dia: number;
  tipo_pavimento: string | null;
}

interface LigacaoRow {
  id: string;
  comprimento: number | null;
  referencia: string | null;
  latitude: number | null;
  longitude: number | null;
  data_topografia: string | null;
  registro_producao_id: string | null;
  encarregado_id: string;
  created_at: string;
}

interface LigacaoNova {
  comprimento: string;
  referencia: string;
}

// "Hoje" sempre em America/Maceio (UTC-03), como data de calendário YYYY-MM-DD.
const hojeMaceio = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Maceio',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const formatBR = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const fmt = (v: unknown) => {
  if (v == null) return '—';
  const n = Number(v);
  if (isNaN(n)) return String(v);
  return n.toFixed(2).replace(/\.?0+$/, '') || '0';
};

const ReadField = ({ label, value }: { label: string; value: unknown }) => (
  <div className="flex justify-between py-1.5 border-b border-border last:border-0 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-foreground font-medium">{fmt(value)}</span>
  </div>
);

const OSPanel = ({ os }: { os: OrdemServico }) => {
  const { user, effectiveUser } = useAuth();
  const isEncarregado = effectiveUser?.role === 'encarregado';
  const [registros, setRegistros] = useState<RegistroDia[]>([]);
  const [ligacoesAll, setLigacoesAll] = useState<LigacaoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [comprimento, setComprimento] = useState('');
  const [numLigacoes, setNumLigacoes] = useState('');
  const [tipoPavimento, setTipoPavimento] = useState<string>('');
  const [ligacoes, setLigacoes] = useState<LigacaoNova[]>([]);
  const [pvFinalAssentado, setPvFinalAssentado] = useState(false);
  const [dataProducao, setDataProducao] = useState<string>(() => hojeMaceio());
  const [confirmDataOpen, setConfirmDataOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [popupRegistroId, setPopupRegistroId] = useState<string | null>(null);
  const [popupAcumOpen, setPopupAcumOpen] = useState(false);

  // Inline edit state for ligações no modal
  const [editingLigId, setEditingLigId] = useState<string | null>(null);
  const [editLig, setEditLig] = useState<{ comprimento: string; referencia: string; latitude: string; longitude: string }>({
    comprimento: '', referencia: '', latitude: '', longitude: '',
  });
  const [savingLig, setSavingLig] = useState(false);

  const filterUserId = effectiveUser?.id ?? user?.id ?? '';

  const fetchRegistros = useCallback(async () => {
    const [regRes, ligRes] = await Promise.all([
      supabase
        .from('registros_producao')
        .select('id, data_registro, comprimento_dia, ligacoes_dia, tipo_pavimento')
        .eq('excluido', false)
        .eq('os_id', os.id)
        .eq('user_id', filterUserId)
        .order('data_registro', { ascending: false }),
      supabase
        .from('ligacoes')
        .select('id, comprimento, referencia, latitude, longitude, data_topografia, registro_producao_id, encarregado_id, created_at')
        .eq('os_id', os.id)
        .eq('encarregado_id', filterUserId)
        .order('created_at', { ascending: true }),
    ]);
    setRegistros((regRes.data ?? []) as RegistroDia[]);
    setLigacoesAll((ligRes.data ?? []) as LigacaoRow[]);
    setLoading(false);
  }, [os.id, filterUserId]);

  useEffect(() => {
    fetchRegistros();
  }, [fetchRegistros]);

  useEffect(() => {
    const n = parseInt(numLigacoes) || 0;
    setLigacoes((prev) => {
      const next = [...prev];
      while (next.length < n) next.push({ comprimento: '', referencia: '' });
      while (next.length > n) next.pop();
      return next;
    });
  }, [numLigacoes]);

  const updateLigacao = (idx: number, field: keyof LigacaoNova, val: string) => {
    setLigacoes((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: val } : l)));
  };

  const acumComprimento = registros.reduce((s, r) => s + Number(r.comprimento_dia || 0), 0);
  const acumLigacoes = registros.reduce((s, r) => s + (r.ligacoes_dia || 0), 0);

  const handleSave = async () => {
    const compNum = parseFloat(comprimento) || 0;
    const ligNum = parseInt(numLigacoes) || 0;
    const compLigTotal = ligacoes.reduce((s, l) => s + (parseFloat(l.comprimento) || 0), 0);
    if (compNum < 0 || ligNum < 0 || ligacoes.some((l) => (parseFloat(l.comprimento) || 0) < 0)) {
      toast.error('Valores não podem ser negativos.');
      return;
    }
    // Basta UMA informação operacional válida: rede, ligações, comprimento de
    // ligação ou PV batido. Observação isolada não libera o registro.
    if (compNum <= 0 && ligNum <= 0 && compLigTotal <= 0 && !pvFinalAssentado) {
      toast.error('Informe rede, ligação, comprimento de ligação ou marque PV batido para registrar a produção.');
      return;
    }
    // Aviso de possível duplicidade: já existe envio hoje para esta OS pelo mesmo
    // encarregado? Não bloqueia (pode haver produção complementar), apenas confirma.
    const hojeStr = new Date().toISOString().slice(0, 10);
    const jaEnviadoHoje = registros.some((r) => r.data_registro === hojeStr);
    if (jaEnviadoHoje) {
      const ok = window.confirm(
        `Você já enviou produção hoje para o trecho ${os.trecho}.\nDeseja registrar outro envio mesmo assim?`,
      );
      if (!ok) return;
    }

    // Pavimento só é exigido quando houve execução de rede (abertura de vala).
    if (compNum > 0 && !tipoPavimento) {
      toast.error('Selecione o Tipo de Pavimento.');
      return;
    }

    if (!user) return;
    setSaving(true);

    const { data: reg, error: regErr } = await supabase
      .from('registros_producao')
      .insert({
        os_id: os.id,
        user_id: user.id,
        comprimento_dia: compNum,
        ligacoes_dia: ligNum,
        tipo_pavimento: tipoPavimento || null,
        pv_final_assentado: pvFinalAssentado,
        pv_final_assentado_em: pvFinalAssentado ? new Date().toISOString() : null,
        pv_final_assentado_por: pvFinalAssentado ? user.id : null,
      } as any)
      .select('id')
      .single();

    if (regErr || !reg) {
      toast.error('Erro ao salvar registro: ' + (regErr?.message ?? ''));
      setSaving(false);
      return;
    }

    if (ligNum > 0) {
      const ligRows = ligacoes.map((l) => ({
        os_id: os.id,
        registro_producao_id: reg.id,
        encarregado_id: user.id,
        comprimento: l.comprimento ? Number(l.comprimento) : null,
        referencia: l.referencia.trim() || null,
      }));
      const { error: ligErr } = await supabase.from('ligacoes').insert(ligRows);
      if (ligErr) {
        toast.error('Registro salvo, mas erro nas ligações: ' + ligErr.message);
      }
    }

    // O cache `comprimento_real` / `ligacoes_real` em ordens_servico é
    // mantido por trigger no banco a partir dos registros_producao ativos.
    // Aqui só atualizamos o pavimento real, que não vem do registro.
    if (tipoPavimento) {
      await supabase
        .from('ordens_servico')
        .update({ pav_real: tipoPavimento })
        .eq('id', os.id);
    }

    toast.success(
      pvFinalAssentado
        ? 'Produção registrada — trecho marcado como concluído (PV final assentado).'
        : 'Produção do dia registrada!'
    );
    setComprimento('');
    setNumLigacoes('');
    setTipoPavimento('');
    setLigacoes([]);
    setPvFinalAssentado(false);
    fetchRegistros();
    setSaving(false);
  };

  const startEditLig = (l: LigacaoRow) => {
    setEditingLigId(l.id);
    setEditLig({
      comprimento: l.comprimento != null ? String(l.comprimento) : '',
      referencia: l.referencia ?? '',
      latitude: l.latitude != null ? String(l.latitude) : '',
      longitude: l.longitude != null ? String(l.longitude) : '',
    });
  };

  const saveEditLig = async (id: string) => {
    setSavingLig(true);
    const update: any = {
      comprimento: editLig.comprimento ? Number(editLig.comprimento) : null,
      referencia: editLig.referencia.trim() || null,
      latitude: editLig.latitude ? Number(editLig.latitude) : null,
      longitude: editLig.longitude ? Number(editLig.longitude) : null,
    };
    const { error } = await supabase.from('ligacoes').update(update).eq('id', id);
    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
    } else {
      toast.success('Ligação atualizada!');
      setEditingLigId(null);
      await fetchRegistros();
    }
    setSavingLig(false);
  };

  return (
    <div className="mt-4 pt-4 border-t border-border space-y-5">
      {/* Dados da OS (read-only) */}
      <div className="bg-muted/30 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-foreground mb-2">Dados da OS</h3>
        <div className="grid md:grid-cols-2 gap-x-6">
          <ReadField label="Comprimento (m)" value={os.comprimento_previsto} />
          <ReadField label="DN" value={formatDN(os.dn)} />
          <ReadField label="Prof. Média (m)" value={os.prof_media_prevista} />
          <ReadField label="Prof. Montante (m)" value={os.prof_montante} />
          <ReadField label="Prof. Jusante (m)" value={os.prof_jusante} />
          {!isEncarregado && <ReadField label="Largura Vala (m)" value={os.largura_vala} />}
          <ReadField label="Pavimento" value={os.pav_previsto} />
          <ReadField label="Ligações previstas" value={os.ligacoes_previstas} />
        </div>
      </div>

      {/* Acumulado */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Rede executada (trechos)</p>
          <p className="text-xl font-bold text-foreground">
            {acumComprimento.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m
          </p>
        </div>
        <button
          type="button"
          onClick={() => acumLigacoes > 0 && setPopupAcumOpen(true)}
          disabled={acumLigacoes === 0}
          className="bg-card border border-border rounded-lg p-3 text-left transition hover:border-secondary hover:bg-muted/40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-card"
        >
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            Ligações (quantidade)
            {acumLigacoes > 0 && <Eye size={11} className="opacity-60" />}
          </p>
          <p className="text-xl font-bold text-foreground">{acumLigacoes}</p>
          {(() => {
            const extensao = ligacoesAll.reduce(
              (s, l) => s + (Number(l.comprimento) || 0),
              0,
            );
            return extensao > 0 ? (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Extensão: {extensao.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m
                <span className="ml-1 italic">(não soma na rede)</span>
              </p>
            ) : null;
          })()}
        </button>
      </div>

      {/* Novo registro do dia */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Registro de hoje</h3>
        <div
          className="flex items-start gap-2.5 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm leading-snug text-destructive"
          role="alert"
          aria-live="assertive"
        >
          <AlertTriangle className="mt-0.5 shrink-0" size={18} />
          <span className="font-semibold">
            PREENCHER COM O EXECUTADO REAL DE CAMPO, A O.S. DO SANEGEST PODE NÃO ESTAR ATUALIZADA, USE A SUA PRODUÇÃO REAL DO DIA
          </span>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Rede do dia — comprimento de trecho (m)</label>
            <Input
              type="number"
              step="any"
              value={comprimento}
              onChange={(e) => setComprimento(e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Ligações do dia</label>
            <Input
              type="number"
              min="0"
              value={numLigacoes}
              onChange={(e) => setNumLigacoes(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground">
              Tipo de Pavimento{(parseFloat(comprimento) || 0) > 0 ? ' *' : ''}
            </label>

            <Select value={tipoPavimento} onValueChange={setTipoPavimento}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo de pavimento" />
              </SelectTrigger>
              <SelectContent>
                {PAV_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {ligacoes.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Detalhes das ligações</p>
            {ligacoes.map((l, idx) => (
              <div key={idx} className="grid md:grid-cols-3 gap-2 items-center">
                <Input
                  type="number"
                  step="any"
                  placeholder="Comprimento (m)"
                  value={l.comprimento}
                  onChange={(e) => updateLigacao(idx, 'comprimento', e.target.value)}
                />
                <Input
                  placeholder="Referência (ex: Casa nº 47)"
                  value={l.referencia}
                  onChange={(e) => updateLigacao(idx, 'referencia', e.target.value)}
                />
                <div className="text-xs text-muted-foreground italic flex items-center gap-1">
                  <MapPin size={12} /> Coord. preenchida pelo Topógrafo
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-3 border-t border-border">
          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-border accent-secondary"
              checked={pvFinalAssentado}
              onChange={(e) => setPvFinalAssentado(e.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium text-foreground">
                PV final assentado / trecho concluído
              </span>
              <span className="block text-xs text-muted-foreground">
                Marque apenas se o PV final do trecho já foi assentado/instalado.
              </span>
            </span>
          </label>
        </div>

        {(() => {
          const vazio =
            (parseFloat(comprimento) || 0) <= 0 &&
            (parseInt(numLigacoes) || 0) <= 0 &&
            ligacoes.reduce((s, l) => s + (parseFloat(l.comprimento) || 0), 0) <= 0 &&
            !pvFinalAssentado;
          return vazio ? (
            <p className="text-xs text-muted-foreground leading-snug">
              Informe rede, ligação, comprimento de ligação ou marque PV batido para registrar a produção.
            </p>
          ) : null;
        })()}

        <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
          {saving ? <Loader2 className="animate-spin mr-2" size={14} /> : <Save size={14} className="mr-2" />}
          Salvar registro do dia
        </Button>

      </div>

      {/* Histórico do encarregado */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">Meus registros ({registros.length})</h3>
        {loading ? (
          <Loader2 className="animate-spin text-muted-foreground" size={16} />
        ) : registros.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-1 font-medium">Data</th>
                <th className="py-1 font-medium text-right">Rede (m)</th>
                <th className="py-1 font-medium text-right">Ligações</th>
                <th className="py-1 font-medium">Pavimento</th>
                <th className="py-1 font-medium text-right w-12"></th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="py-1 text-foreground">
                    {new Date(r.data_registro + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </td>
                  <td className="py-1 text-right text-foreground">{Number(r.comprimento_dia).toFixed(2)}</td>
                  <td className="py-1 text-right text-foreground">{r.ligacoes_dia}</td>
                  <td className="py-1 text-foreground text-xs">{r.tipo_pavimento || '—'}</td>
                  <td className="py-1 text-right">
                    {r.ligacoes_dia > 0 && (
                      <button
                        type="button"
                        onClick={() => setPopupRegistroId(r.id)}
                        className="text-secondary hover:text-secondary/80"
                        title="Ver ligações"
                      >
                        <Eye size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Popup: ligações de um registro específico */}
      <Dialog open={!!popupRegistroId} onOpenChange={(o) => { if (!o) { setPopupRegistroId(null); setEditingLigId(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ligações do registro</DialogTitle>
            <DialogDescription>
              {(() => {
                const reg = registros.find((r) => r.id === popupRegistroId);
                return reg
                  ? new Date(reg.data_registro + 'T00:00:00').toLocaleDateString('pt-BR')
                  : '';
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {(() => {
              const ligs = ligacoesAll.filter((l) => l.registro_producao_id === popupRegistroId);
              if (ligs.length === 0) {
                return <p className="text-sm text-muted-foreground">Sem detalhes salvos.</p>;
              }
              return ligs.map((l, i) => {
                const temCoord = l.latitude != null && l.longitude != null;
                const isEditing = editingLigId === l.id;
                const canEdit = isEncarregado && l.encarregado_id === user?.id;
                if (isEditing) {
                  return (
                    <div key={l.id} className="bg-muted/40 rounded-lg p-3 text-sm space-y-2">
                      <p className="font-semibold text-foreground">Ligação {i + 1}</p>
                      <div>
                        <label className="text-xs text-muted-foreground">Comprimento (m)</label>
                        <Input type="number" step="any" value={editLig.comprimento}
                          onChange={(e) => setEditLig((p) => ({ ...p, comprimento: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Referência</label>
                        <Input value={editLig.referencia}
                          onChange={(e) => setEditLig((p) => ({ ...p, referencia: e.target.value }))} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-muted-foreground">Latitude</label>
                          <Input type="number" step="any" value={editLig.latitude}
                            onChange={(e) => setEditLig((p) => ({ ...p, latitude: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Longitude</label>
                          <Input type="number" step="any" value={editLig.longitude}
                            onChange={(e) => setEditLig((p) => ({ ...p, longitude: e.target.value }))} />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end pt-1">
                        <Button size="sm" variant="outline" onClick={() => setEditingLigId(null)} disabled={savingLig}>
                          <X size={14} className="mr-1" /> Cancelar
                        </Button>
                        <Button size="sm" onClick={() => saveEditLig(l.id)} disabled={savingLig}>
                          {savingLig ? <Loader2 className="animate-spin mr-1" size={14} /> : <Check size={14} className="mr-1" />}
                          Salvar
                        </Button>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={l.id} className="bg-muted/40 rounded-lg p-3 text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold text-foreground">Ligação {i + 1}</p>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => startEditLig(l)}
                          className="text-secondary hover:text-secondary/80 inline-flex items-center gap-1 text-xs"
                        >
                          <Pencil size={12} /> Editar
                        </button>
                      )}
                    </div>
                    <p className="text-muted-foreground">
                      <span className="text-foreground">Comprimento:</span>{' '}
                      {l.comprimento != null ? `${Number(l.comprimento).toFixed(2)} m` : '—'}
                    </p>
                    <p className="text-muted-foreground">
                      <span className="text-foreground">Referência:</span>{' '}
                      {l.referencia || '—'}
                    </p>
                    <p className="text-muted-foreground flex items-center gap-1">
                      <MapPin size={12} />
                      <span className="text-foreground">Coordenada:</span>{' '}
                      {temCoord ? (
                        <span className="text-status-green">
                          ✓ {Number(l.latitude).toFixed(6)}, {Number(l.longitude).toFixed(6)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">⏳ Pendente</span>
                      )}
                    </p>
                  </div>
                );
              });
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Popup: todas as ligações da OS, agrupadas por data */}
      <Dialog open={popupAcumOpen} onOpenChange={setPopupAcumOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ligações registradas — {os.trecho}</DialogTitle>
            <DialogDescription>
              {ligacoesAll.length} ligação(ões) · Extensão total:{' '}
              {ligacoesAll
                .reduce((s, l) => s + (Number(l.comprimento) || 0), 0)
                .toLocaleString('pt-BR', { maximumFractionDigits: 2 })}{' '}
              m <span className="italic">(separada da rede — não soma)</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto">
            {(() => {
              const regById = new Map(registros.map((r) => [r.id, r.data_registro]));
              const groups = new Map<string, LigacaoRow[]>();
              ligacoesAll.forEach((l) => {
                const data =
                  (l.registro_producao_id && regById.get(l.registro_producao_id)) ||
                  l.created_at.slice(0, 10);
                if (!groups.has(data)) groups.set(data, []);
                groups.get(data)!.push(l);
              });
              const sorted = Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
              if (sorted.length === 0) {
                return <p className="text-sm text-muted-foreground">Nenhuma ligação registrada.</p>;
              }
              return sorted.map(([data, ligs]) => (
                <div key={data}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    {new Date(data + 'T00:00:00').toLocaleDateString('pt-BR')} — {ligs.length} ligação(ões)
                  </p>
                  <div className="space-y-2">
                    {ligs.map((l, i) => {
                      const temCoord = l.latitude != null && l.longitude != null;
                      return (
                        <div
                          key={l.id}
                          className="bg-muted/40 rounded-lg p-3 text-sm flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">
                              {l.referencia || `Ligação ${i + 1}`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {l.comprimento != null ? `${Number(l.comprimento).toFixed(2)} m` : 'sem comprimento'}
                            </p>
                          </div>
                          {temCoord ? (
                            <span className="text-xs font-medium text-status-green whitespace-nowrap">
                              ✓ Preenchida
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                              ⏳ Pendente
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const ProducaoPage = () => {
  const { effectiveUser } = useAuth();
  const { ordens, loading } = useOrdensServico();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusTab, setStatusTab] = useState<'em-execucao' | 'concluido'>('em-execucao');
  const [concluidosIds, setConcluidosIds] = useState<Set<string>>(new Set());
  const [statusLoading, setStatusLoading] = useState(true);
  const [myNames, setMyNames] = useState<Set<string>>(new Set());


  // Scroll para "Meus registros enviados" quando vier do dashboard via #meus-registros
  useEffect(() => {
    if (loading) return;
    if (typeof window === 'undefined') return;
    if (window.location.hash === '#meus-registros') {
      setTimeout(() => {
        document.getElementById('meus-registros')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    }
  }, [loading]);

  // Carrega TODOS os nomes/apelidos que identificam este encarregado em `liberado_para`/`executor`.
  // Necessário porque OS antigas podem estar vinculadas ao display_name enquanto o apelido mudou.
  useEffect(() => {
    if (!effectiveUser?.id) { setMyNames(new Set()); return; }
    const load = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('display_name, apelido')
        .eq('user_id', effectiveUser.id)
        .maybeSingle();
      const names = new Set<string>();
      if (effectiveUser.nome) names.add(effectiveUser.nome);
      if ((data as any)?.display_name) names.add((data as any).display_name);
      if ((data as any)?.apelido) names.add((data as any).apelido);
      setMyNames(names);
    };
    load();
  }, [effectiveUser?.id, effectiveUser?.nome]);

  // Carrega os ids das OS já marcadas como concluídas (PV final assentado) pelo usuário atual
  useEffect(() => {
    if (!effectiveUser?.id) {
      setConcluidosIds(new Set());
      setStatusLoading(false);
      return;
    }
    const fetchConcluidos = async () => {
      setStatusLoading(true);
      let allIds = new Set<string>();
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from('registros_producao')
          .select('os_id')
          .eq('user_id', effectiveUser.id)
          .eq('excluido', false)
          .eq('pv_final_assentado', true)
          .range(from, from + pageSize - 1);
        if (error) {
          console.error('Error fetching concluidos:', error);
          break;
        }
        (data || []).forEach((r) => allIds.add(r.os_id));
        hasMore = (data?.length || 0) === pageSize;
        from += pageSize;
      }
      setConcluidosIds(allIds);
      setStatusLoading(false);
    };
    fetchConcluidos();
  }, [effectiveUser?.id]);

  const minhasOS = useMemo(() => {
    return ordens.filter((os) => {
      if (!os.liberado) return false;
      if (effectiveUser?.role === 'admin') return true;
      return (
        (os.liberado_para != null && myNames.has(os.liberado_para)) ||
        (os.executor != null && myNames.has(os.executor))
      );
    });
  }, [ordens, effectiveUser, myNames]);

  const displayedOS = useMemo(() => {
    if (statusTab === 'concluido') {
      return minhasOS.filter((os) => concluidosIds.has(os.id));
    }
    return minhasOS.filter((os) => !concluidosIds.has(os.id));
  }, [minhasOS, concluidosIds, statusTab]);

  const countEmExecucao = useMemo(
    () => minhasOS.filter((os) => !concluidosIds.has(os.id)).length,
    [minhasOS, concluidosIds],
  );
  const countConcluido = useMemo(
    () => minhasOS.filter((os) => concluidosIds.has(os.id)).length,
    [minhasOS, concluidosIds],
  );

  if (loading || statusLoading) {

    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-foreground mb-1">Registro de Produção</h1>
      <p className="text-sm text-muted-foreground mb-3">
        Registre a produção do dia em cada NS atribuída a você
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => setStatusTab('em-execucao')}
          className={`min-h-[44px] px-4 rounded-lg text-sm font-semibold transition-colors border ${
            statusTab === 'em-execucao'
              ? 'bg-secondary text-secondary-foreground border-secondary'
              : 'bg-card text-foreground border-border hover:bg-muted/60'
          }`}
        >
          Em execução ({countEmExecucao})
        </button>
        <button
          type="button"
          onClick={() => setStatusTab('concluido')}
          className={`min-h-[44px] px-4 rounded-lg text-sm font-semibold transition-colors border ${
            statusTab === 'concluido'
              ? 'bg-secondary text-secondary-foreground border-secondary'
              : 'bg-card text-foreground border-border hover:bg-muted/60'
          }`}
        >
          Concluído ({countConcluido})
        </button>
      </div>

      {minhasOS.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">
          Nenhuma OS liberada para você no momento.
        </div>
      ) : displayedOS.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">
          {statusTab === 'concluido'
            ? 'Nenhuma OS concluída no momento.'
            : 'Nenhuma OS em execução no momento.'}
        </div>
      ) : (
        <div className="space-y-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {displayedOS.map((os) => (

            <div key={os.id} className="bg-card rounded-xl border border-border shadow-sm p-4 max-w-full">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0">
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{os.trecho}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {os.bacia} • PV {os.pv_montante} → {os.pv_jusante} • {fmt(os.comprimento_previsto)}m previsto
                  </p>
                </div>
                <button
                  onClick={() => setExpandedId(expandedId === os.id ? null : os.id)}
                  className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-md text-sm font-medium bg-[hsl(var(--status-green))] text-white shadow-sm hover:bg-[hsl(135_64%_40%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--status-green))] focus-visible:ring-offset-2 focus-visible:ring-offset-card transition-colors"
                >
                  {expandedId === os.id ? 'Fechar' : statusTab === 'concluido' ? 'Ver Produção' : 'Registrar Dia'}
                </button>
              </div>
              {expandedId === os.id && <OSPanel os={os} />}
            </div>
          ))}
        </div>
      )}

      {(effectiveUser?.role === 'encarregado' || effectiveUser?.role === 'admin') && (
        <div className="mt-6">
          <MeusRegistrosEnviados />
        </div>
      )}
    </AppLayout>
  );
};


export default ProducaoPage;
