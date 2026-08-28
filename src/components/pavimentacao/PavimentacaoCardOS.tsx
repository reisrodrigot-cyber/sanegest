import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { permissions } from '@/lib/permissions';
import { useConclusoesPav, useLiberacoesPav } from '@/hooks/usePavimentacao';
import { areaPrevistaPav, fmtM2, pavElegivel } from '@/lib/pavimentacao';
import { Button } from '@/components/ui/button';
import { Layers } from 'lucide-react';
import { LiberarPavimentacaoModal } from './LiberarPavimentacaoModal';

interface OSLite {
  id: string;
  trecho: string;
  bacia: string;
  pav_previsto: string | null;
  comprimento_previsto: number | null;
  largura_vala: number | null;
}

export const PavimentacaoCardOS = ({ os }: { os: OSLite }) => {
  const { user, effectiveRole } = useAuth();
  const role = effectiveRole || user?.role;
  const canPav = permissions.canLiberarPavimentacao(role);
  const { data: liberacoes } = useLiberacoesPav();
  const { data: conclusoes } = useConclusoesPav();
  const [modal, setModal] = useState<'liberar' | 'revogar' | null>(null);

  const lib = liberacoes?.get(os.id);
  const conc = conclusoes?.get(os.id);
  const elegivel = pavElegivel(os.pav_previsto);
  const areaPrevista = areaPrevistaPav(os.comprimento_previsto, os.largura_vala, os.pav_previsto);

  return (
    <div className="mt-6 bg-card rounded-xl border border-border shadow-sm p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
          <Layers size={18} className="text-primary" /> Pavimentação
        </h2>
        <div className="flex items-center gap-2">
          <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
            conc?.concluido
              ? 'bg-emerald-500/15 text-emerald-700'
              : lib?.liberado
                ? 'bg-sky-500/15 text-sky-700'
                : 'bg-muted text-muted-foreground'
          }`}>
            {conc?.concluido ? 'Pavimentação finalizada' : lib?.liberado ? 'Pavimentação em execução' : 'Sem liberação'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <Item label="Pavimento previsto" value={os.pav_previsto ?? '—'} />
        <Item label="Elegível" value={elegivel ? 'Sim' : 'Não'} />
        <Item label="Área prevista" value={areaPrevista == null ? 'sem previsão' : `${fmtM2(areaPrevista)} m²`} />
        <Item label="Liberada em" value={lib?.liberado && lib.liberado_em ? new Date(lib.liberado_em).toLocaleDateString('pt-BR') : '—'} />
      </div>

      {canPav && (
        <div className="flex flex-wrap gap-2 mt-4">
          <Button size="sm" variant="outline" disabled={!elegivel} onClick={() => setModal('liberar')}>
            {lib?.liberado ? 'Alterar liberação' : 'Liberar Pavimentação'}
          </Button>
          {lib?.liberado && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setModal('revogar')}>
              Retirar liberação
            </Button>
          )}
          {!elegivel && (
            <p className="text-[11px] text-muted-foreground self-center">
              Pavimento previsto sem Asfalto ou Paralelepípedo — não pode ser liberado.
            </p>
          )}
        </div>
      )}

      <LiberarPavimentacaoModal
        open={!!modal}
        modo={modal ?? 'liberar'}
        selectedOS={[{ id: os.id, trecho: os.trecho, bacia: os.bacia, pav_previsto: os.pav_previsto }]}
        onClose={() => setModal(null)}
      />
    </div>
  );
};

const Item = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border border-border bg-muted/30 p-2">
    <p className="text-[10px] uppercase font-semibold text-muted-foreground">{label}</p>
    <p className="text-foreground font-medium truncate">{value}</p>
  </div>
);
