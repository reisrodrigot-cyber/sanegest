import { STATUS_ORDER, STATUS_META } from '@/lib/osStatus';

interface Props {
  /** contagem de ocorrências por status (opcional) */
  counts?: Partial<Record<string, number>>;
  className?: string;
}

/** Legenda oficial de status de N.S./trechos. Azul aparece sempre, hoje sem ocorrências. */
export const StatusLegenda = ({ counts, className = '' }: Props) => (
  <div className={`bg-card/90 backdrop-blur border border-border rounded-md shadow-md p-2 text-[11px] space-y-1 ${className}`}>
    <div className="font-semibold text-foreground mb-1">Legenda de status</div>
    {STATUS_ORDER.map((k) => {
      const m = STATUS_META[k];
      const n = counts?.[k];
      const semOcorrencias = k === 'AZUL' || n === 0;
      return (
        <div key={k} className="flex items-center gap-1.5 text-muted-foreground">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: m.hex }} />
          <span className="text-foreground">{m.label}</span>
          {semOcorrencias && <span className="italic">— sem ocorrências</span>}
          {!semOcorrencias && n != null && <span className="tabular-nums">({n})</span>}
        </div>
      );
    })}
  </div>
);
