import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';

const PAV_OPTIONS = [
  'Solo Natural',
  'Asfalto',
  'Paralelo',
  'Concreto',
  'Misto',
];

interface PavimentoRealSelectProps {
  selectedTypes: string[];
  onTypesChange: (types: string[]) => void;
  extensions: Record<string, string>;
  onExtensionChange: (type: string, value: string) => void;
}

export function PavimentoRealSelect({ selectedTypes, onTypesChange, extensions, onExtensionChange }: PavimentoRealSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (type: string) => {
    if (selectedTypes.includes(type)) {
      onTypesChange(selectedTypes.filter(t => t !== type));
    } else {
      onTypesChange([...selectedTypes, type]);
    }
  };

  const remove = (type: string) => {
    onTypesChange(selectedTypes.filter(t => t !== type));
  };

  return (
    <div className="space-y-1">
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center justify-between w-full px-2 py-1 rounded border border-input bg-background text-foreground text-sm min-h-[32px] text-left"
        >
          <span className="flex flex-wrap gap-1 flex-1">
            {selectedTypes.length === 0 && <span className="text-muted-foreground">Selecionar...</span>}
            {selectedTypes.map(t => (
              <span key={t} className="inline-flex items-center gap-0.5 bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded">
                {t}
                <X size={10} className="cursor-pointer" onClick={e => { e.stopPropagation(); remove(t); }} />
              </span>
            ))}
          </span>
          <ChevronDown size={14} className="opacity-50 shrink-0" />
        </button>
        {open && (
          <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-md py-1">
            {PAV_OPTIONS.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent ${selectedTypes.includes(opt) ? 'bg-accent/50 font-medium' : ''}`}
              >
                {selectedTypes.includes(opt) ? '✓ ' : ''}{opt}
              </button>
            ))}
          </div>
        )}
      </div>
      {selectedTypes.map(t => (
        <div key={t} className="grid grid-cols-3 gap-2 py-1 items-center pl-4">
          <span className="text-xs text-muted-foreground">↳ {t} (m)</span>
          <span className="text-xs text-muted-foreground">—</span>
          <input
            value={extensions[t] || ''}
            onChange={e => onExtensionChange(t, e.target.value)}
            className="px-2 py-1 rounded border border-input bg-background text-foreground text-sm w-full"
            placeholder="0"
          />
        </div>
      ))}
    </div>
  );
}

/** Parse a pav_real string like "Solo Natural / Asfalto" into array */
export function parsePavRealToTypes(pav: string | null | undefined): string[] {
  if (!pav) return [];
  return pav.split('/').map(s => s.trim()).filter(Boolean);
}

/** Join selected types back to string for storage */
export function typesToPavReal(types: string[]): string | null {
  return types.length > 0 ? types.join(' / ') : null;
}
