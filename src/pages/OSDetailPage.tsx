import { useParams, Link } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { ArrowLeft, Loader2, Send, CheckCircle, Pencil, Save, X } from 'lucide-react';
import { useOrdemServico } from '@/hooks/useOrdensServico';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MOCK_USERS } from '@/data/mockData';

function fmt(val: unknown): string {
  if (val == null) return '—';
  const n = Number(val);
  if (isNaN(n)) return String(val);
  return n.toFixed(2).replace(/\.?0+$/, '') || '0';
}

const DataRow = ({ label, previsto, real }: { label: string; previsto: unknown; real?: unknown }) => (
  <div className="grid grid-cols-3 gap-2 py-2 border-b border-border last:border-0">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-medium text-foreground">{fmt(previsto)}</span>
    <span className={`text-sm font-medium ${real !== undefined && real !== null ? 'text-secondary' : 'text-muted-foreground'}`}>
      {fmt(real)}
    </span>
  </div>
);

const EditableRow = ({ label, previstoValue, realValue, previstoField, realField, onChange }: {
  label: string;
  previstoValue: string;
  realValue: string;
  previstoField: string;
  realField: string;
  onChange: (field: string, val: string) => void;
}) => (
  <div className="grid grid-cols-3 gap-2 py-2 border-b border-border last:border-0 items-center">
    <span className="text-sm text-muted-foreground">{label}</span>
    <input
      value={previstoValue}
      onChange={e => onChange(previstoField, e.target.value)}
      className="px-2 py-1 rounded border border-input bg-background text-foreground text-sm w-full"
    />
    <input
      value={realValue}
      onChange={e => onChange(realField, e.target.value)}
      className="px-2 py-1 rounded border border-input bg-background text-foreground text-sm w-full"
    />
  </div>
);

const OSDetailPage = () => {
  const { id } = useParams();
  const { os, estacas, loading } = useOrdemServico(id);
  const { user } = useAuth();
  const [liberando, setLiberando] = useState(false);
  const [selectedEncarregado, setSelectedEncarregado] = useState('');
  const [editing, setEditing] = useState(false);
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [validando, setValidando] = useState(false);

  const encarregados = MOCK_USERS.filter(u => u.role === 'encarregado');
  const isSalaTecnica = user?.role === 'sala_tecnica';

  const startEditing = () => {
    if (!os) return;
    setEditFields({
      comprimento_previsto: os.comprimento_previsto != null ? String(os.comprimento_previsto) : '',
      comprimento_real: os.comprimento_real != null ? String(os.comprimento_real) : '',
      prof_media_prevista: os.prof_media_prevista != null ? String(os.prof_media_prevista) : '',
      prof_media_real: os.prof_media_real != null ? String(os.prof_media_real) : '',
      dn: os.dn != null ? String(os.dn) : '',
      largura_vala: os.largura_vala != null ? String(os.largura_vala) : '',
      prof_montante: os.prof_montante != null ? String(os.prof_montante) : '',
      prof_jusante: os.prof_jusante != null ? String(os.prof_jusante) : '',
      pav_previsto: os.pav_previsto ?? '',
      pav_real: os.pav_real ?? '',
      largura_pav_prevista: os.largura_pav_prevista != null ? String(os.largura_pav_prevista) : '',
      largura_pav_real: os.largura_pav_real != null ? String(os.largura_pav_real) : '',
      pav_m2_previsto: os.pav_m2_previsto != null ? String(os.pav_m2_previsto) : '',
      pav_m2_real: os.pav_m2_real != null ? String(os.pav_m2_real) : '',
      ligacoes_previstas: os.ligacoes_previstas != null ? String(os.ligacoes_previstas) : '',
      ligacoes_real: os.ligacoes_real != null ? String(os.ligacoes_real) : '',
      areia: os.areia ?? '',
      brita: os.brita ?? '',
      prazo_previsto: os.prazo_previsto != null ? String(os.prazo_previsto) : '',
      bms: os.bms ?? '',
      executor: os.executor ?? '',
    });
    setEditing(true);
  };

  const updateEditField = (field: string, val: string) => {
    setEditFields(prev => ({ ...prev, [field]: val }));
  };

  const handleSaveEdit = async () => {
    if (!os) return;
    setSavingEdit(true);
    const toNum = (v: string) => v ? Number(v) : null;
    const toInt = (v: string) => v ? parseInt(v) : null;
    const update: any = {
      comprimento_previsto: toNum(editFields.comprimento_previsto),
      comprimento_real: toNum(editFields.comprimento_real),
      prof_media_prevista: toNum(editFields.prof_media_prevista),
      prof_media_real: toNum(editFields.prof_media_real),
      dn: toNum(editFields.dn),
      largura_vala: toNum(editFields.largura_vala),
      prof_montante: toNum(editFields.prof_montante),
      prof_jusante: toNum(editFields.prof_jusante),
      pav_previsto: editFields.pav_previsto || null,
      pav_real: editFields.pav_real || null,
      largura_pav_prevista: toNum(editFields.largura_pav_prevista),
      largura_pav_real: toNum(editFields.largura_pav_real),
      pav_m2_previsto: toNum(editFields.pav_m2_previsto),
      pav_m2_real: toNum(editFields.pav_m2_real),
      ligacoes_previstas: toInt(editFields.ligacoes_previstas),
      ligacoes_real: toInt(editFields.ligacoes_real),
      areia: editFields.areia || null,
      brita: editFields.brita || null,
      prazo_previsto: toInt(editFields.prazo_previsto),
      bms: editFields.bms || null,
      executor: editFields.executor || null,
    };
    const { error } = await supabase.from('ordens_servico').update(update).eq('id', os.id);
    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
    } else {
      toast.success('OS atualizada com sucesso!');
      setEditing(false);
      window.location.reload();
    }
    setSavingEdit(false);
  };

  const handleValidar = async () => {
    if (!os) return;
    setValidando(true);
    const { error } = await supabase
      .from('ordens_servico')
      .update({ status: 'AMARELO' } as any)
      .eq('id', os.id);
    if (error) {
      toast.error('Erro ao validar: ' + error.message);
    } else {
      toast.success('OS validada — status alterado para AMARELO');
      window.location.reload();
    }
    setValidando(false);
  };

  const handleLiberar = async () => {
    if (!os || !selectedEncarregado) return;
    setLiberando(true);
    const { error } = await supabase
      .from('ordens_servico')
      .update({ liberado: true, liberado_para: selectedEncarregado } as any)
      .eq('id', os.id);
    if (error) {
      toast.error('Erro ao liberar OS: ' + error.message);
    } else {
      toast.success('OS liberada para o encarregado!');
      window.location.reload();
    }
    setLiberando(false);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      </AppLayout>
    );
  }

  if (!os) {
    return (
      <AppLayout>
        <p className="text-muted-foreground">OS não encontrada.</p>
        <Link to="/ordens" className="text-secondary hover:underline">Voltar</Link>
      </AppLayout>
    );
  }

  const hasRealData = os.comprimento_real != null || os.prof_media_real != null || os.pav_real != null;

  return (
    <AppLayout>
      <div className="mb-6">
        <Link to="/ordens" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft size={16} /> Voltar
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">{os.trecho}</h1>
          <StatusBadge status={os.status} />
          {os.liberado && (
            <span className="text-xs px-2 py-1 rounded-full bg-status-green/20 text-status-green font-medium">
              Liberada para {os.liberado_para}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">{os.bacia} • PV {os.pv_montante} → {os.pv_jusante}</p>
      </div>

      {/* Ações da Sala Técnica */}
      {isSalaTecnica && (
        <div className="flex flex-wrap gap-3 mb-6">
          {/* Validar produção — só aparece se tem dados reais preenchidos */}
          {hasRealData && os.status === 'VERMELHO' && (
            <button
              onClick={handleValidar}
              disabled={validando}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-status-green text-white text-sm font-medium disabled:opacity-50"
            >
              {validando ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              ✓ Validar
            </button>
          )}
          {/* Editar */}
          {!editing && (
            <button
              onClick={startEditing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-status-yellow text-white text-sm font-medium"
            >
              <Pencil size={14} />
              ✏ Editar
            </button>
          )}
        </div>
      )}

      {/* Liberação pela Sala Técnica */}
      {isSalaTecnica && !os.liberado && !editing && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-4 mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Send size={16} className="text-primary" />
            Liberar OS para Encarregado
          </h3>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Selecionar Encarregado</label>
              <select
                value={selectedEncarregado}
                onChange={e => setSelectedEncarregado(e.target.value)}
                className="px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm min-w-[200px]"
              >
                <option value="">— Selecione —</option>
                {encarregados.map(e => (
                  <option key={e.id} value={e.nome}>{e.nome}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleLiberar}
              disabled={!selectedEncarregado || liberando}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              {liberando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Liberar
            </button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Dados do Trecho</h2>
            {editing && (
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
                >
                  {savingEdit ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Salvar
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-foreground text-xs"
                >
                  <X size={12} /> Cancelar
                </button>
              </div>
            )}
          </div>

          {!editing ? (
            <>
              <div className="grid grid-cols-3 gap-2 pb-2 border-b-2 border-border mb-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Campo</span>
                <span className="text-xs font-semibold text-foreground uppercase">Previsto</span>
                <span className="text-xs font-semibold text-secondary uppercase">Real</span>
              </div>
              <DataRow label="Comprimento (m)" previsto={os.comprimento_previsto} real={os.comprimento_real} />
              <DataRow label="Prof. Média (m)" previsto={os.prof_media_prevista} real={os.prof_media_real} />
              <DataRow label="DN (m)" previsto={os.dn} />
              <DataRow label="Largura Vala (m)" previsto={os.largura_vala} />
              <DataRow label="Prof. Montante (m)" previsto={os.prof_montante} />
              <DataRow label="Prof. Jusante (m)" previsto={os.prof_jusante} />
              <DataRow label="Pavimento" previsto={os.pav_previsto} real={os.pav_real} />
              <DataRow label="Largura PAV (m)" previsto={os.largura_pav_prevista} real={os.largura_pav_real} />
              <DataRow label="PAV (m²)" previsto={os.pav_m2_previsto} real={os.pav_m2_real} />
              <DataRow label="Ligações" previsto={os.ligacoes_previstas} real={os.ligacoes_real} />
              <DataRow label="Areia" previsto={os.areia} />
              <DataRow label="Brita" previsto={os.brita} />
              <DataRow label="Bomba Rebaixo" previsto={os.bomba_rebaixo ? 'SIM' : 'NÃO'} />
              <DataRow label="Prazo (dias)" previsto={os.prazo_previsto} />
              <DataRow label="BMs" previsto={os.bms} />
            </>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 pb-2 border-b-2 border-border mb-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Campo</span>
                <span className="text-xs font-semibold text-foreground uppercase">Previsto</span>
                <span className="text-xs font-semibold text-secondary uppercase">Real</span>
              </div>
              <EditableRow label="Comprimento (m)" previstoValue={editFields.comprimento_previsto} realValue={editFields.comprimento_real} previstoField="comprimento_previsto" realField="comprimento_real" onChange={updateEditField} />
              <EditableRow label="Prof. Média (m)" previstoValue={editFields.prof_media_prevista} realValue={editFields.prof_media_real} previstoField="prof_media_prevista" realField="prof_media_real" onChange={updateEditField} />
              <EditableRow label="DN (m)" previstoValue={editFields.dn} realValue="" previstoField="dn" realField="" onChange={updateEditField} />
              <EditableRow label="Largura Vala (m)" previstoValue={editFields.largura_vala} realValue="" previstoField="largura_vala" realField="" onChange={updateEditField} />
              <EditableRow label="Prof. Montante (m)" previstoValue={editFields.prof_montante} realValue="" previstoField="prof_montante" realField="" onChange={updateEditField} />
              <EditableRow label="Prof. Jusante (m)" previstoValue={editFields.prof_jusante} realValue="" previstoField="prof_jusante" realField="" onChange={updateEditField} />
              <EditableRow label="Pavimento" previstoValue={editFields.pav_previsto} realValue={editFields.pav_real} previstoField="pav_previsto" realField="pav_real" onChange={updateEditField} />
              <EditableRow label="Largura PAV (m)" previstoValue={editFields.largura_pav_prevista} realValue={editFields.largura_pav_real} previstoField="largura_pav_prevista" realField="largura_pav_real" onChange={updateEditField} />
              <EditableRow label="PAV (m²)" previstoValue={editFields.pav_m2_previsto} realValue={editFields.pav_m2_real} previstoField="pav_m2_previsto" realField="pav_m2_real" onChange={updateEditField} />
              <EditableRow label="Ligações" previstoValue={editFields.ligacoes_previstas} realValue={editFields.ligacoes_real} previstoField="ligacoes_previstas" realField="ligacoes_real" onChange={updateEditField} />
              <EditableRow label="Areia" previstoValue={editFields.areia} realValue="" previstoField="areia" realField="" onChange={updateEditField} />
              <EditableRow label="Brita" previstoValue={editFields.brita} realValue="" previstoField="brita" realField="" onChange={updateEditField} />
              <EditableRow label="Prazo (dias)" previstoValue={editFields.prazo_previsto} realValue="" previstoField="prazo_previsto" realField="" onChange={updateEditField} />
              <EditableRow label="BMs" previstoValue={editFields.bms} realValue="" previstoField="bms" realField="" onChange={updateEditField} />
              <EditableRow label="Executor" previstoValue={editFields.executor} realValue="" previstoField="executor" realField="" onChange={updateEditField} />
            </>
          )}
        </div>

        <div className="space-y-6">
          {os.executor && !editing && (
            <div className="bg-card rounded-xl border border-border shadow-sm p-6">
              <h2 className="text-lg font-semibold text-foreground mb-2">Executor</h2>
              <p className="text-foreground">{os.executor}</p>
            </div>
          )}

          {os.as_built_lat && (
            <div className="bg-card rounded-xl border border-border shadow-sm p-6">
              <h2 className="text-lg font-semibold text-foreground mb-2">Coordenadas As-Built</h2>
              <p className="text-sm text-foreground">Lat: {fmt(os.as_built_lat)}</p>
              <p className="text-sm text-foreground">Lng: {fmt(os.as_built_lng)}</p>
            </div>
          )}
        </div>
      </div>

      {estacas.length > 0 && (
        <div className="mt-6 bg-card rounded-xl border border-border shadow-sm p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Tabela de Estacas</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-border bg-muted/30">
                  {['Estaca', 'N', 'E', 'CT', 'CC', 'I', 'D', 'G', 'P', 'CR', 'R', 'H', 'PV', 'Tipo', 'Prof. PV'].map(h => (
                    <th key={h} className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {estacas.map(e => (
                  <tr key={e.id} className="border-b border-border hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{e.nome}</td>
                    <td className="px-3 py-2 text-foreground">{fmt(e.coord_n)}</td>
                    <td className="px-3 py-2 text-foreground">{fmt(e.coord_e)}</td>
                    <td className="px-3 py-2 text-foreground">{fmt(e.ct)}</td>
                    <td className="px-3 py-2 text-foreground">{fmt(e.cc)}</td>
                    <td className="px-3 py-2 text-foreground">{fmt(e.declividade)}</td>
                    <td className="px-3 py-2 text-foreground">{fmt(e.diametro)}</td>
                    <td className="px-3 py-2 text-foreground">{fmt(e.g)}</td>
                    <td className="px-3 py-2 text-foreground">{fmt(e.p)}</td>
                    <td className="px-3 py-2 text-foreground">{fmt(e.cr)}</td>
                    <td className="px-3 py-2 text-foreground">{fmt(e.r)}</td>
                    <td className="px-3 py-2 text-foreground">{fmt(e.h)}</td>
                    <td className="px-3 py-2 text-foreground">{e.pv_nome || '—'}</td>
                    <td className="px-3 py-2 text-foreground">{e.pv_tipo || '—'}</td>
                    <td className="px-3 py-2 text-foreground">{fmt(e.pv_prof)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default OSDetailPage;
