import { useParams, Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { ArrowLeft, Loader2, Send, CheckCircle, Pencil, Save, X, AlertTriangle, UserCheck, Trash2 } from 'lucide-react';
import { useOrdemServico } from '@/hooks/useOrdensServico';
import { MateriaisEntreguesSection } from '@/components/MateriaisEntreguesSection';
import { OSHistoricoSection } from '@/components/OSHistoricoSection';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { permissions } from '@/lib/permissions';
import { useQuery } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type OSStatus = 'CINZA' | 'VERMELHO' | 'LARANJA' | 'AMARELO' | 'VERDE';

const STATUS_CONFIG: { value: OSStatus; label: string; description: string; color: string; ring: string }[] = [
  { value: 'CINZA', label: 'Cinza', description: 'Não liberada', color: 'bg-status-gray', ring: 'ring-status-gray' },
  { value: 'VERMELHO', label: 'Vermelho', description: 'Aguardando entrega de material', color: 'bg-status-red', ring: 'ring-status-red' },
  { value: 'LARANJA', label: 'Laranja', description: 'Aguardando produção', color: 'bg-status-orange', ring: 'ring-status-orange' },
  { value: 'AMARELO', label: 'Amarelo', description: 'Aguardando registro topográfico', color: 'bg-status-yellow', ring: 'ring-status-yellow' },
  { value: 'VERDE', label: 'Verde', description: 'Concluída', color: 'bg-status-green', ring: 'ring-status-green' },
];

const PAV_OPTIONS = [
  'Terreno Natural',
  'Asfalto',
  'Paralelo',
  'Terreno Natural e Asfalto',
  'Terreno Natural e Paralelo',
  'Asfalto e Paralelo',
  'Terreno Natural, Asfalto e Paralelo',
];

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

const EditableSelectRow = ({ label, previstoValue, realValue, previstoField, realField, options, onChange }: {
  label: string;
  previstoValue: string;
  realValue: string;
  previstoField: string;
  realField: string;
  options: string[];
  onChange: (field: string, val: string) => void;
}) => (
  <div className="grid grid-cols-3 gap-2 py-2 border-b border-border last:border-0 items-center">
    <span className="text-sm text-muted-foreground">{label}</span>
    <input
      value={previstoValue}
      onChange={e => onChange(previstoField, e.target.value)}
      className="px-2 py-1 rounded border border-input bg-background text-foreground text-sm w-full"
    />
    <select
      value={realValue}
      onChange={e => onChange(realField, e.target.value)}
      className="px-2 py-1 rounded border border-input bg-background text-foreground text-sm w-full"
    >
      <option value="">— Selecione —</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

const RealEditableRow = ({ label, previsto, realValue, realField, onChange }: {
  label: string;
  previsto: unknown;
  realValue: string;
  realField: string;
  onChange: (field: string, val: string) => void;
}) => (
  <div className="grid grid-cols-3 gap-2 py-2 border-b border-border last:border-0 items-center">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-medium text-foreground">{fmt(previsto)}</span>
    <input
      value={realValue}
      onChange={e => onChange(realField, e.target.value)}
      className="px-2 py-1 rounded border border-input bg-background text-foreground text-sm w-full"
      placeholder="—"
    />
  </div>
);

const RealSelectRow = ({ label, previsto, realValue, realField, options, onChange }: {
  label: string;
  previsto: unknown;
  realValue: string;
  realField: string;
  options: string[];
  onChange: (field: string, val: string) => void;
}) => (
  <div className="grid grid-cols-3 gap-2 py-2 border-b border-border last:border-0 items-center">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-medium text-foreground">{fmt(previsto)}</span>
    <select
      value={realValue}
      onChange={e => onChange(realField, e.target.value)}
      className="px-2 py-1 rounded border border-input bg-background text-foreground text-sm w-full"
    >
      <option value="">— Selecione —</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

const OSDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { os, estacas, loading } = useOrdemServico(id);
  const { user, effectiveRole } = useAuth();
  const [liberando, setLiberando] = useState(false);
  const [selectedEncarregado, setSelectedEncarregado] = useState('');
  const [editing, setEditing] = useState(false);
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [validando, setValidando] = useState(false);
  const [editingReal, setEditingReal] = useState(false);
  const [realFields, setRealFields] = useState<Record<string, string>>({});
  const [savingReal, setSavingReal] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<OSStatus | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);
  const [pendenciasCoord, setPendenciasCoord] = useState<{ estacas: number; ligacoes: number } | null>(null);
  const [checkingPendencias, setCheckingPendencias] = useState(false);
  const [savingEncarregado, setSavingEncarregado] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingOs, setDeletingOs] = useState(false);

  const handleDeleteOs = async () => {
    if (!os) return;
    setDeletingOs(true);
    // Delete dependent records first to be safe (no FK cascades)
    await Promise.all([
      supabase.from('registros_producao').delete().eq('os_id', os.id),
      supabase.from('ligacoes').delete().eq('os_id', os.id),
      supabase.from('topografia_asbuilt').delete().eq('os_id', os.id),
      supabase.from('materiais_entrega').delete().eq('os_id', os.id),
      supabase.from('estacas').delete().eq('os_id', os.id),
      supabase.from('os_status_historico').delete().eq('os_id', os.id),
    ]);
    const { error } = await supabase.from('ordens_servico').delete().eq('id', os.id);
    setDeletingOs(false);
    setDeleteDialogOpen(false);
    if (error) {
      toast.error('Erro ao excluir OS: ' + error.message);
      return;
    }
    toast.success('OS excluída com sucesso!');
    navigate('/ordens');
  };

  // Fetch encarregados from user_roles + profiles
  const { data: encarregados = [] } = useQuery({
    queryKey: ['encarregados-list'],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'encarregado');
      if (!roles || roles.length === 0) return [];
      const userIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, email')
        .in('user_id', userIds);
      return (profiles ?? []).map(p => ({
        user_id: p.user_id,
        name: p.display_name || p.email || 'Sem nome',
      }));
    },
  });

  const isSalaTecnica = permissions.canEditOS(effectiveRole);
  const isEncarregado = permissions.canEditProducao(effectiveRole) && effectiveRole === 'encarregado';

  const handleStatusChange = (newStatus: OSStatus) => {
    if (!os || newStatus === os.status) return;
    setPendingStatus(newStatus);
    // Check as-built warning for VERDE
    if (newStatus === 'VERDE' && !os.as_built_lat) {
      setAsBuiltWarning(true);
    } else {
      setAsBuiltWarning(false);
    }
    setStatusDialogOpen(true);
  };

  const confirmStatusChange = async () => {
    if (!os || !pendingStatus) return;
    setChangingStatus(true);
    const previousStatus = os.status;
    const { error } = await supabase
      .from('ordens_servico')
      .update({ status: pendingStatus } as any)
      .eq('id', os.id);
    if (error) {
      toast.error('Erro ao alterar status: ' + error.message);
    } else {
      const now = new Date().toLocaleString('pt-BR');
      toast.success(`Status alterado de ${previousStatus} para ${pendingStatus} por Sala Técnica em ${now}`);
      window.location.reload();
    }
    setChangingStatus(false);
    setStatusDialogOpen(false);
  };

  const startEditing = () => {
    if (!os) return;
    const fields: Record<string, string> = {
      comprimento_previsto: os.comprimento_previsto != null ? String(os.comprimento_previsto) : '',
      comprimento_real: os.comprimento_real != null ? String(os.comprimento_real) : '',
      prof_media_prevista: os.prof_media_prevista != null ? String(os.prof_media_prevista) : '',
      prof_media_real: os.prof_media_real != null ? String(os.prof_media_real) : '',
      dn: os.dn != null ? String(os.dn) : '',
      dn_real: os.dn_real != null ? String(os.dn_real) : '',
      largura_vala: os.largura_vala != null ? String(os.largura_vala) : '',
      largura_vala_real: os.largura_vala_real != null ? String(os.largura_vala_real) : '',
      prof_montante: os.prof_montante != null ? String(os.prof_montante) : '',
      prof_montante_real: os.prof_montante_real != null ? String(os.prof_montante_real) : '',
      prof_jusante: os.prof_jusante != null ? String(os.prof_jusante) : '',
      prof_jusante_real: os.prof_jusante_real != null ? String(os.prof_jusante_real) : '',
      pav_previsto: os.pav_previsto ?? '',
      pav_real: os.pav_real ?? '',
      largura_pav_prevista: os.largura_pav_prevista != null ? String(os.largura_pav_prevista) : '',
      largura_pav_real: os.largura_pav_real != null ? String(os.largura_pav_real) : '',
      pav_m2_previsto: os.pav_m2_previsto != null ? String(os.pav_m2_previsto) : '',
      pav_m2_real: os.pav_m2_real != null ? String(os.pav_m2_real) : '',
      ligacoes_previstas: os.ligacoes_previstas != null ? String(os.ligacoes_previstas) : '',
      ligacoes_real: os.ligacoes_real != null ? String(os.ligacoes_real) : '',
      areia: os.areia ?? '',
      areia_real: os.areia_real ?? '',
      brita: os.brita ?? '',
      brita_real: os.brita_real ?? '',
      prazo_previsto: os.prazo_previsto != null ? String(os.prazo_previsto) : '',
      prazo_real: os.prazo_real != null ? String(os.prazo_real) : '',
      bms: os.bms ?? '',
      bms_real: os.bms_real ?? '',
      executor: os.executor ?? '',
      executor_real: os.executor_real ?? '',
    };
    setEditFields(fields);
    setEditing(true);
  };

  const startEditingReal = () => {
    if (!os) return;
    const fields: Record<string, string> = {
      comprimento_real: os.comprimento_real != null ? String(os.comprimento_real) : '',
      prof_media_real: os.prof_media_real != null ? String(os.prof_media_real) : '',
      dn_real: os.dn_real != null ? String(os.dn_real) : '',
      largura_vala_real: os.largura_vala_real != null ? String(os.largura_vala_real) : '',
      prof_montante_real: os.prof_montante_real != null ? String(os.prof_montante_real) : '',
      prof_jusante_real: os.prof_jusante_real != null ? String(os.prof_jusante_real) : '',
      pav_real: os.pav_real ?? '',
      largura_pav_real: os.largura_pav_real != null ? String(os.largura_pav_real) : '',
      pav_m2_real: os.pav_m2_real != null ? String(os.pav_m2_real) : '',
      ligacoes_real: os.ligacoes_real != null ? String(os.ligacoes_real) : '',
      areia_real: os.areia_real ?? '',
      brita_real: os.brita_real ?? '',
      prazo_real: os.prazo_real != null ? String(os.prazo_real) : '',
      bms_real: os.bms_real ?? '',
      executor_real: os.executor_real ?? '',
    };
    setRealFields(fields);
    setEditingReal(true);
  };

  const updateEditField = (field: string, val: string) => {
    setEditFields(prev => ({ ...prev, [field]: val }));
  };

  const updateRealField = (field: string, val: string) => {
    setRealFields(prev => ({ ...prev, [field]: val }));
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
      dn_real: toNum(editFields.dn_real),
      largura_vala: toNum(editFields.largura_vala),
      largura_vala_real: toNum(editFields.largura_vala_real),
      prof_montante: toNum(editFields.prof_montante),
      prof_montante_real: toNum(editFields.prof_montante_real),
      prof_jusante: toNum(editFields.prof_jusante),
      prof_jusante_real: toNum(editFields.prof_jusante_real),
      pav_previsto: editFields.pav_previsto || null,
      pav_real: editFields.pav_real || null,
      largura_pav_prevista: toNum(editFields.largura_pav_prevista),
      largura_pav_real: toNum(editFields.largura_pav_real),
      pav_m2_previsto: toNum(editFields.pav_m2_previsto),
      pav_m2_real: toNum(editFields.pav_m2_real),
      ligacoes_previstas: toInt(editFields.ligacoes_previstas),
      ligacoes_real: toInt(editFields.ligacoes_real),
      areia: editFields.areia || null,
      areia_real: editFields.areia_real || null,
      brita: editFields.brita || null,
      brita_real: editFields.brita_real || null,
      prazo_previsto: toInt(editFields.prazo_previsto),
      prazo_real: toInt(editFields.prazo_real),
      bms: editFields.bms || null,
      bms_real: editFields.bms_real || null,
      executor: editFields.executor || null,
      executor_real: editFields.executor_real || null,
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

  const handleSaveReal = async () => {
    if (!os) return;
    setSavingReal(true);
    const toNum = (v: string) => v ? Number(v) : null;
    const toInt = (v: string) => v ? parseInt(v) : null;
    const update: any = {
      comprimento_real: toNum(realFields.comprimento_real),
      prof_media_real: toNum(realFields.prof_media_real),
      dn_real: toNum(realFields.dn_real),
      largura_vala_real: toNum(realFields.largura_vala_real),
      prof_montante_real: toNum(realFields.prof_montante_real),
      prof_jusante_real: toNum(realFields.prof_jusante_real),
      pav_real: realFields.pav_real || null,
      largura_pav_real: toNum(realFields.largura_pav_real),
      pav_m2_real: toNum(realFields.pav_m2_real),
      ligacoes_real: toInt(realFields.ligacoes_real),
      areia_real: realFields.areia_real || null,
      brita_real: realFields.brita_real || null,
      prazo_real: toInt(realFields.prazo_real),
      bms_real: realFields.bms_real || null,
      executor_real: realFields.executor_real || null,
    };
    const { error } = await supabase.from('ordens_servico').update(update).eq('id', os.id);
    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
    } else {
      toast.success('Dados reais salvos com sucesso!');
      setEditingReal(false);
      window.location.reload();
    }
    setSavingReal(false);
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
    const encarregadoName = encarregados.find(e => e.user_id === selectedEncarregado)?.name ?? selectedEncarregado;
    const { error } = await supabase
      .from('ordens_servico')
      .update({ liberado: true, liberado_para: encarregadoName, status: 'VERMELHO' } as any)
      .eq('id', os.id);
    if (error) {
      toast.error('Erro ao liberar OS: ' + error.message);
    } else {
      toast.success(`OS liberada para ${encarregadoName}!`);
      window.location.reload();
    }
    setLiberando(false);
  };

  const handleChangeEncarregado = async (newUserId: string) => {
    if (!os) return;
    setSavingEncarregado(true);
    const previousEnc = os.liberado_para ?? 'nenhum';

    if (newUserId === '__remove__') {
      // Remove encarregado → back to CINZA
      const { error } = await supabase
        .from('ordens_servico')
        .update({ liberado: false, liberado_para: null, status: 'CINZA' } as any)
        .eq('id', os.id);
      if (error) {
        toast.error('Erro: ' + error.message);
      } else {
        const now = new Date().toLocaleString('pt-BR');
        toast.success(`Encarregado removido — OS retornada para Não Liberada em ${now}`);
        window.location.reload();
      }
    } else {
      const newName = encarregados.find(e => e.user_id === newUserId)?.name ?? newUserId;
      const { error } = await supabase
        .from('ordens_servico')
        .update({ liberado_para: newName } as any)
        .eq('id', os.id);
      if (error) {
        toast.error('Erro: ' + error.message);
      } else {
        const now = new Date().toLocaleString('pt-BR');
        toast.success(`Encarregado alterado de ${previousEnc} para ${newName} por Sala Técnica em ${now}`);
        window.location.reload();
      }
    }
    setSavingEncarregado(false);
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
      <div className="max-w-[900px] mx-auto">
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

      {/* Status Selector for Sala Técnica / Admin */}
      {isSalaTecnica && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-4 mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">Controle de Status</h3>
          <div className="flex flex-wrap gap-3">
            {STATUS_CONFIG.map(s => (
              <button
                key={s.value}
                onClick={() => handleStatusChange(s.value)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                  os.status === s.value
                    ? `${s.ring} ring-2 border-transparent ${s.color} text-white`
                    : 'border-border text-muted-foreground hover:border-foreground/30'
                }`}
              >
                <span className={`w-3 h-3 rounded-full ${s.color}`} />
                <span>{s.label}</span>
                <span className="text-xs opacity-70">— {s.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Status Change Confirmation Dialog */}
      <AlertDialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar alteração de status</AlertDialogTitle>
            <AlertDialogDescription>
              Confirmar alteração de status para <strong>{pendingStatus}</strong>?
              {asBuiltWarning && (
                <span className="flex items-center gap-2 mt-3 p-3 bg-amber-50 text-amber-800 rounded-lg border border-amber-200">
                  <AlertTriangle size={16} className="shrink-0" />
                  Esta OS não possui coordenadas as-built registradas.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={changingStatus}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusChange} disabled={changingStatus}>
              {changingStatus ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Ações da Sala Técnica */}
      {isSalaTecnica && (
        <div className="flex flex-wrap gap-3 mb-6">
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
          {!editing && (
            <button
              onClick={startEditing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-status-yellow text-white text-sm font-medium"
            >
              <Pencil size={14} />
              ✏ Editar
            </button>
          )}
          {!editing && (
            <button
              onClick={() => setDeleteDialogOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90"
            >
              <Trash2 size={14} />
              Excluir OS
            </button>
          )}
        </div>
      )}

      {/* Confirmação de exclusão da OS */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Ordem de Serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? Esta ação não pode ser desfeita. Todos os dados relacionados
              (estacas, materiais, registros de produção, ligações e histórico) serão
              permanentemente removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingOs}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOs}
              disabled={deletingOs}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingOs ? <Loader2 size={14} className="animate-spin mr-2" /> : <Trash2 size={14} className="mr-2" />}
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {isEncarregado && !editingReal && !editing && (
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={startEditingReal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
          >
            <Pencil size={14} />
            Editar Dados Reais
          </button>
        </div>
      )}

      {/* Encarregado Responsável — Sala Técnica */}
      {isSalaTecnica && !editing && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-4 mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <UserCheck size={16} className="text-primary" />
            Encarregado Responsável
          </h3>
          {!os.liberado ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[240px]">
                <label className="block text-xs text-muted-foreground mb-1">Selecionar Encarregado</label>
                <Select value={selectedEncarregado} onValueChange={setSelectedEncarregado}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um encarregado" />
                  </SelectTrigger>
                  <SelectContent>
                    {encarregados.map(e => (
                      <SelectItem key={e.user_id} value={e.user_id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <button
                onClick={handleLiberar}
                disabled={!selectedEncarregado || liberando}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
              >
                {liberando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Liberar OS
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[240px]">
                <label className="block text-xs text-muted-foreground mb-1">
                  Atribuído a: <span className="font-semibold text-foreground">{os.liberado_para}</span>
                </label>
                <Select onValueChange={handleChangeEncarregado} disabled={savingEncarregado}>
                  <SelectTrigger>
                    <SelectValue placeholder="Trocar encarregado..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__remove__" className="text-destructive">
                      ✕ Remover encarregado
                    </SelectItem>
                    {encarregados.map(e => (
                      <SelectItem key={e.user_id} value={e.user_id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {savingEncarregado && <Loader2 size={16} className="animate-spin text-muted-foreground" />}
            </div>
          )}
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
            {editingReal && (
              <div className="flex gap-2">
                <button
                  onClick={handleSaveReal}
                  disabled={savingReal}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
                >
                  {savingReal ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Salvar
                </button>
                <button
                  onClick={() => setEditingReal(false)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-foreground text-xs"
                >
                  <X size={12} /> Cancelar
                </button>
              </div>
            )}
          </div>

          {editing ? (
            <>
              <div className="grid grid-cols-3 gap-2 pb-2 border-b-2 border-border mb-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Campo</span>
                <span className="text-xs font-semibold text-foreground uppercase">Previsto</span>
                <span className="text-xs font-semibold text-secondary uppercase">Real</span>
              </div>
              <EditableRow label="Comprimento (m)" previstoValue={editFields.comprimento_previsto} realValue={editFields.comprimento_real} previstoField="comprimento_previsto" realField="comprimento_real" onChange={updateEditField} />
              <EditableRow label="Prof. Média (m)" previstoValue={editFields.prof_media_prevista} realValue={editFields.prof_media_real} previstoField="prof_media_prevista" realField="prof_media_real" onChange={updateEditField} />
              <EditableRow label="DN (m)" previstoValue={editFields.dn} realValue={editFields.dn_real} previstoField="dn" realField="dn_real" onChange={updateEditField} />
              <EditableRow label="Largura Vala (m)" previstoValue={editFields.largura_vala} realValue={editFields.largura_vala_real} previstoField="largura_vala" realField="largura_vala_real" onChange={updateEditField} />
              <EditableRow label="Prof. Montante (m)" previstoValue={editFields.prof_montante} realValue={editFields.prof_montante_real} previstoField="prof_montante" realField="prof_montante_real" onChange={updateEditField} />
              <EditableRow label="Prof. Jusante (m)" previstoValue={editFields.prof_jusante} realValue={editFields.prof_jusante_real} previstoField="prof_jusante" realField="prof_jusante_real" onChange={updateEditField} />
              <EditableSelectRow label="Pavimento" previstoValue={editFields.pav_previsto} realValue={editFields.pav_real} previstoField="pav_previsto" realField="pav_real" options={PAV_OPTIONS} onChange={updateEditField} />
              <EditableRow label="Largura PAV (m)" previstoValue={editFields.largura_pav_prevista} realValue={editFields.largura_pav_real} previstoField="largura_pav_prevista" realField="largura_pav_real" onChange={updateEditField} />
              <EditableRow label="PAV (m²)" previstoValue={editFields.pav_m2_previsto} realValue={editFields.pav_m2_real} previstoField="pav_m2_previsto" realField="pav_m2_real" onChange={updateEditField} />
              <EditableRow label="Ligações" previstoValue={editFields.ligacoes_previstas} realValue={editFields.ligacoes_real} previstoField="ligacoes_previstas" realField="ligacoes_real" onChange={updateEditField} />
              <EditableRow label="Areia" previstoValue={editFields.areia} realValue={editFields.areia_real} previstoField="areia" realField="areia_real" onChange={updateEditField} />
              <EditableRow label="Brita" previstoValue={editFields.brita} realValue={editFields.brita_real} previstoField="brita" realField="brita_real" onChange={updateEditField} />
              <EditableRow label="Prazo (dias)" previstoValue={editFields.prazo_previsto} realValue={editFields.prazo_real} previstoField="prazo_previsto" realField="prazo_real" onChange={updateEditField} />
              <EditableRow label="BMs" previstoValue={editFields.bms} realValue={editFields.bms_real} previstoField="bms" realField="bms_real" onChange={updateEditField} />
              <EditableRow label="Executor" previstoValue={editFields.executor} realValue={editFields.executor_real} previstoField="executor" realField="executor_real" onChange={updateEditField} />
            </>
          ) : editingReal ? (
            <>
              <div className="grid grid-cols-3 gap-2 pb-2 border-b-2 border-border mb-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Campo</span>
                <span className="text-xs font-semibold text-foreground uppercase">Previsto</span>
                <span className="text-xs font-semibold text-secondary uppercase">Real (editável)</span>
              </div>
              <RealEditableRow label="Comprimento (m)" previsto={os.comprimento_previsto} realValue={realFields.comprimento_real} realField="comprimento_real" onChange={updateRealField} />
              <RealEditableRow label="Prof. Média (m)" previsto={os.prof_media_prevista} realValue={realFields.prof_media_real} realField="prof_media_real" onChange={updateRealField} />
              <RealEditableRow label="DN (m)" previsto={os.dn} realValue={realFields.dn_real} realField="dn_real" onChange={updateRealField} />
              <RealEditableRow label="Largura Vala (m)" previsto={os.largura_vala} realValue={realFields.largura_vala_real} realField="largura_vala_real" onChange={updateRealField} />
              <RealEditableRow label="Prof. Montante (m)" previsto={os.prof_montante} realValue={realFields.prof_montante_real} realField="prof_montante_real" onChange={updateRealField} />
              <RealEditableRow label="Prof. Jusante (m)" previsto={os.prof_jusante} realValue={realFields.prof_jusante_real} realField="prof_jusante_real" onChange={updateRealField} />
              <RealSelectRow label="Pavimento" previsto={os.pav_previsto} realValue={realFields.pav_real} realField="pav_real" options={PAV_OPTIONS} onChange={updateRealField} />
              <RealEditableRow label="Largura PAV (m)" previsto={os.largura_pav_prevista} realValue={realFields.largura_pav_real} realField="largura_pav_real" onChange={updateRealField} />
              <RealEditableRow label="PAV (m²)" previsto={os.pav_m2_previsto} realValue={realFields.pav_m2_real} realField="pav_m2_real" onChange={updateRealField} />
              <RealEditableRow label="Ligações" previsto={os.ligacoes_previstas} realValue={realFields.ligacoes_real} realField="ligacoes_real" onChange={updateRealField} />
              <RealEditableRow label="Areia" previsto={os.areia} realValue={realFields.areia_real} realField="areia_real" onChange={updateRealField} />
              <RealEditableRow label="Brita" previsto={os.brita} realValue={realFields.brita_real} realField="brita_real" onChange={updateRealField} />
              <DataRow label="Bomba Rebaixo" previsto={os.bomba_rebaixo ? 'SIM' : 'NÃO'} />
              <RealEditableRow label="Prazo (dias)" previsto={os.prazo_previsto} realValue={realFields.prazo_real} realField="prazo_real" onChange={updateRealField} />
              <RealEditableRow label="BMs" previsto={os.bms} realValue={realFields.bms_real} realField="bms_real" onChange={updateRealField} />
              <RealEditableRow label="Executor" previsto={os.executor} realValue={realFields.executor_real} realField="executor_real" onChange={updateRealField} />
            </>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 pb-2 border-b-2 border-border mb-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Campo</span>
                <span className="text-xs font-semibold text-foreground uppercase">Previsto</span>
                <span className="text-xs font-semibold text-secondary uppercase">Real</span>
              </div>
              <DataRow label="Comprimento (m)" previsto={os.comprimento_previsto} real={os.comprimento_real} />
              <DataRow label="Prof. Média (m)" previsto={os.prof_media_prevista} real={os.prof_media_real} />
              <DataRow label="DN (m)" previsto={os.dn} real={os.dn_real} />
              <DataRow label="Largura Vala (m)" previsto={os.largura_vala} real={os.largura_vala_real} />
              <DataRow label="Prof. Montante (m)" previsto={os.prof_montante} real={os.prof_montante_real} />
              <DataRow label="Prof. Jusante (m)" previsto={os.prof_jusante} real={os.prof_jusante_real} />
              <DataRow label="Pavimento" previsto={os.pav_previsto} real={os.pav_real} />
              <DataRow label="Largura PAV (m)" previsto={os.largura_pav_prevista} real={os.largura_pav_real} />
              <DataRow label="PAV (m²)" previsto={os.pav_m2_previsto} real={os.pav_m2_real} />
              <DataRow label="Ligações" previsto={os.ligacoes_previstas} real={os.ligacoes_real} />
              <DataRow label="Areia" previsto={os.areia} real={os.areia_real} />
              <DataRow label="Brita" previsto={os.brita} real={os.brita_real} />
              <DataRow label="Bomba Rebaixo" previsto={os.bomba_rebaixo ? 'SIM' : 'NÃO'} />
              <DataRow label="Prazo (dias)" previsto={os.prazo_previsto} real={os.prazo_real} />
              <DataRow label="BMs" previsto={os.bms} real={os.bms_real} />
              <DataRow label="Executor" previsto={os.executor} real={os.executor_real} />
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

      {/* Materiais Entregues — Sala Técnica/Admin sempre podem editar */}
      <div className="mt-6">
        <MateriaisEntreguesSection
          osId={os.id}
          canEdit={isSalaTecnica || effectiveRole === 'almoxarifado'}
          dnValue={os.dn}
        />
      </div>

      {/* Histórico — visível para Sala Técnica e Admin */}
      {isSalaTecnica && (
        <div className="mt-6">
          <OSHistoricoSection osId={os.id} />
        </div>
      )}

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
      </div>
    </AppLayout>
  );
};

export default OSDetailPage;
