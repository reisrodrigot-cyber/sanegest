import { OrdemServico } from '@/types/sanegest';
import { formatDN } from '@/lib/format';
import { LigacoesComprimentos } from './LigacoesComprimentos';

function fmt(val: unknown): string {
  if (val == null) return '—';
  const n = Number(val);
  if (isNaN(n)) return String(val);
  return n.toFixed(2).replace(/\.?0+$/, '') || '0';
}

const DataRow = ({ label, previsto, real }: { label: string; previsto: unknown; real?: unknown }) => (
  <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-border last:border-0">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-xs font-medium text-foreground">{fmt(previsto)}</span>
    <span className={`text-xs font-medium ${real !== undefined && real !== null ? 'text-secondary' : 'text-muted-foreground'}`}>
      {fmt(real)}
    </span>
  </div>
);

export const OSDetalhesTrecho = ({ os }: { os: OrdemServico }) => (
  <div className="mb-2">
    <div className="grid grid-cols-3 gap-2 pb-1.5 border-b-2 border-border mb-1">
      <span className="text-xs font-semibold text-muted-foreground uppercase">Campo</span>
      <span className="text-xs font-semibold text-foreground uppercase">Previsto</span>
      <span className="text-xs font-semibold text-secondary uppercase">Executado</span>
    </div>
    <DataRow label="Comprimento (m)" previsto={os.comprimento_previsto} real={os.comprimento_real} />
    <DataRow label="Prof. Média (m)" previsto={os.prof_media_prevista} real={os.prof_media_real} />
    <DataRow label="DN" previsto={formatDN(os.dn)} />
    <DataRow label="Largura Vala (m)" previsto={os.largura_vala} />
    <DataRow label="Prof. Montante (m)" previsto={os.prof_montante} />
    <DataRow label="Prof. Jusante (m)" previsto={os.prof_jusante} />
    <DataRow label="Pavimento" previsto={os.pav_previsto} real={os.pav_real} />
    {os.pav_previsto !== 'Solo Natural' && (
      <>
        <DataRow label="Largura PAV (m)" previsto={os.largura_pav_prevista} real={os.largura_pav_real} />
        <DataRow label="PAV (m²)" previsto={os.pav_m2_previsto} real={os.pav_m2_real} />
      </>
    )}
    <DataRow label="Areia" previsto={os.areia} />
    <DataRow label="Brita" previsto={os.brita} />
    <DataRow label="Bomba Rebaixo" previsto={os.bomba_rebaixo ? 'SIM' : 'NÃO'} />
    <DataRow label="Prazo (dias)" previsto={os.prazo_previsto} />
    <DataRow label="BMs" previsto={os.bms} />
    <LigacoesComprimentos osId={os.id} />
  </div>
);
