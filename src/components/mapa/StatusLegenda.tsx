import { useEffect, useRef, useState } from 'react';
import { Layers } from 'lucide-react';
import { STATUS_ORDER, STATUS_META, type OSDisplayStatus } from '@/lib/osStatus';
import { useIsMobile } from '@/hooks/use-mobile';

interface Props {
  /** contagem de ocorrências por status (opcional) */
  counts?: Partial<Record<string, number>>;
  className?: string;
}

/** Rótulos curtos para a legenda. Nome completo permanece em `title`. */
const SHORT_LABEL: Record<OSDisplayStatus, string> = {
  CINZA: 'Não liberada',
  VERMELHO: 'Sem execução',
  AMARELO: 'Em execução',
  VERDE: 'PV assentado',
  AZUL: 'As Built',
};

const Linhas = ({ counts }: { counts?: Partial<Record<string, number>> }) => (
  <>
    {STATUS_ORDER.map((k) => {
      const m = STATUS_META[k];
      const n = k === 'AZUL' ? (counts?.[k] ?? 0) : counts?.[k];
      return (
        <div
          key={k}
          className="flex items-center gap-1.5 leading-tight"
          title={`${m.label} — ${m.description}`}
          aria-label={m.label}
        >
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: m.hex }} />
          <span className="text-foreground truncate">{SHORT_LABEL[k]}</span>
          {n != null && <span className="text-muted-foreground tabular-nums">({n})</span>}
        </div>
      );
    })}
  </>
);

/** Legenda oficial de status de N.S./trechos. Compacta no desktop, colapsável no mobile. */
export const StatusLegenda = ({ counts, className = '' }: Props) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMobile || !open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [isMobile, open]);

  const card =
    'bg-card/90 backdrop-blur border border-border rounded-md shadow-md px-2 py-1.5 text-[10px] space-y-0.5 w-max';

  if (!isMobile) {
    return (
      <div className={`${card} ${className}`}>
        <div className="font-semibold text-foreground mb-0.5">Status</div>
        <Linhas counts={counts} />
      </div>
    );
  }

  return (
    <div ref={ref} className={`flex flex-col items-start gap-1 ${className}`}>
      {open && (
        <div className={`${card} max-w-[190px] max-h-[35%] overflow-hidden`}>
          <Linhas counts={counts} />
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Legenda de status"
        className="flex items-center gap-1 bg-card/90 backdrop-blur border border-border rounded-md shadow-md px-2 py-1 text-[11px] text-foreground"
      >
        <Layers className="w-3.5 h-3.5" />
        Status
      </button>
    </div>
  );
};
