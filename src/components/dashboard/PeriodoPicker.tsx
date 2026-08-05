import { useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';

export const toISODate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const fmtDateBR = (iso: string) => iso.split('-').reverse().join('/');

interface PeriodoPickerProps {
  /** Data inicial aplicada (yyyy-mm-dd). */
  inicio: string;
  /** Data final aplicada (yyyy-mm-dd). */
  fim: string;
  /** Chamado apenas ao clicar em "Aplicar" / preset. */
  onChange: (inicio: string, fim: string) => void;
  /** Base do preset "Todo o período". */
  minDate?: string;
  ariaLabel?: string;
}

/**
 * Seletor de período discreto (Popover + calendário + presets).
 * Componente controlado e totalmente isolado: cada card mantém seu próprio
 * estado de período — nenhuma instância interfere na outra.
 */
export const PeriodoPicker = ({ inicio, fim, onChange, minDate, ariaLabel = 'Selecionar período' }: PeriodoPickerProps) => {
  const [open, setOpen] = useState(false);
  const parse = (s: string) => {
    if (!s) return undefined;
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };
  const [draft, setDraft] = useState<DateRange | undefined>(() => ({ from: parse(inicio), to: parse(fim) }));

  const applyRange = (from: Date, to: Date) => {
    onChange(toISODate(from), toISODate(to));
    setDraft({ from, to });
    setOpen(false);
  };

  const hoje = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const days = (n: number) => { const d = hoje(); d.setDate(d.getDate() - n); return d; };
  const startOfMonth = () => { const d = hoje(); d.setDate(1); return d; };
  const startOfLastMonth = () => { const d = startOfMonth(); d.setMonth(d.getMonth() - 1); return d; };
  const endOfLastMonth = () => { const d = startOfMonth(); d.setDate(0); return d; };

  const preset = (label: string, fn: () => { from: Date; to: Date }) => {
    const r = fn();
    return (
      <button
        key={label}
        type="button"
        onClick={() => applyRange(r.from, r.to)}
        className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted transition-colors text-foreground"
      >
        {label}
      </button>
    );
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) setDraft({ from: parse(inicio), to: parse(fim) }); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md border border-border/60 bg-background/60 hover:bg-muted/60 text-[11px] text-foreground transition-colors"
          aria-label={ariaLabel}
        >
          <CalendarRange size={12} className="text-muted-foreground" />
          <span className="tabular-nums">
            {inicio && fim ? `${fmtDateBR(inicio)} — ${fmtDateBR(fim)}` : 'Selecionar período'}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0" sideOffset={4}>
        <div className="flex flex-col sm:flex-row">
          <div className="flex flex-col gap-0.5 p-2 border-b sm:border-b-0 sm:border-r border-border min-w-[140px]">
            {preset('Hoje', () => ({ from: hoje(), to: hoje() }))}
            {preset('Ontem', () => ({ from: days(1), to: days(1) }))}
            {preset('Últimos 7 dias', () => ({ from: days(6), to: hoje() }))}
            {preset('Últimos 30 dias', () => ({ from: days(29), to: hoje() }))}
            {preset('Mês atual', () => ({ from: startOfMonth(), to: hoje() }))}
            {preset('Mês anterior', () => ({ from: startOfLastMonth(), to: endOfLastMonth() }))}
            {preset('Todo o período', () => ({
              from: minDate ? new Date(minDate + 'T00:00:00') : hoje(),
              to: hoje(),
            }))}
          </div>
          <div className="p-2">
            <Calendar
              mode="range"
              selected={draft}
              onSelect={setDraft}
              numberOfMonths={1}
              initialFocus
              className={cn('p-0 pointer-events-auto')}
            />
            <div className="flex items-center justify-end gap-2 mt-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                disabled={!draft?.from}
                onClick={() => { if (draft?.from) applyRange(draft.from, draft.to ?? draft.from); }}
              >
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
