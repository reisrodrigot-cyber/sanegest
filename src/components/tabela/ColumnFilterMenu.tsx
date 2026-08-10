import { useMemo, useState } from 'react';
import { ArrowDownAZ, ArrowUpAZ, Check, Filter, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import {
  emptyFilter,
  isFilterActive,
  opsForType,
  type ColFilterType,
  type ColumnFilterValue,
} from '@/lib/columnFilter';

interface Props {
  label: string;
  type: ColFilterType;
  /** Valores exibidos distintos da coluna (base para seleção). */
  values: string[];
  filter: ColumnFilterValue | undefined;
  onChange: (f: ColumnFilterValue) => void;
  sortDir?: 'asc' | 'desc' | null;
  onSort?: (dir: 'asc' | 'desc' | null) => void;
}

/** Menu de filtro padrão Excel para cabeçalho de coluna. */
export const ColumnFilterMenu = ({ label, type, values, filter, onChange, sortDir, onSort }: Props) => {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState('');
  const f = filter ?? emptyFilter();
  const ativo = isFilterActive(filter);
  const ops = opsForType(type);
  const opDef = ops.find(o => o.value === f.op) as { two?: boolean } | undefined;
  const dois = !!opDef?.two;
  const inputType = type === 'date' ? 'date' : type === 'number' ? 'number' : 'text';

  const listados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return values.filter(v => !q || v.toLowerCase().includes(q));
  }, [values, busca]);

  const excluded = new Set(f.excluded);
  const set = (patch: Partial<ColumnFilterValue>) => onChange({ ...f, ...patch });

  const toggleValor = (v: string) => {
    const next = new Set(excluded);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    set({ excluded: [...next] });
  };

  const marcarTodos = (marcar: boolean) => {
    const next = new Set(excluded);
    listados.forEach(v => (marcar ? next.delete(v) : next.add(v)));
    set({ excluded: [...next] });
  };

  const todosMarcados = listados.length > 0 && listados.every(v => !excluded.has(v));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Filtrar ${label}`}
          title={`Filtrar ${label}`}
          onClick={e => e.stopPropagation()}
          className={`inline-flex items-center justify-center w-5 h-5 rounded transition-colors flex-shrink-0 ${
            ativo ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Filter size={12} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0 z-[1200]" onClick={e => e.stopPropagation()}>
        <div className="px-3 py-2 border-b border-border text-sm font-semibold truncate">{label}</div>

        {onSort && (
          <div className="p-2 border-b border-border grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => onSort(sortDir === 'asc' ? null : 'asc')}
              className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                sortDir === 'asc' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
              }`}
            >
              <ArrowUpAZ size={13} /> Crescente
            </button>
            <button
              type="button"
              onClick={() => onSort(sortDir === 'desc' ? null : 'desc')}
              className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                sortDir === 'desc' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
              }`}
            >
              <ArrowDownAZ size={13} /> Decrescente
            </button>
          </div>
        )}

        <div className="p-2 border-b border-border space-y-1.5">
          <select
            value={f.op}
            onChange={e => set({ op: e.target.value })}
            className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-xs"
          >
            <option value="">Sem condição</option>
            {ops.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {f.op && (
            <div className={`grid gap-1.5 ${dois ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <input
                type={inputType}
                value={f.v1}
                onChange={e => set({ v1: e.target.value })}
                placeholder={dois ? 'De' : 'Valor'}
                className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-xs"
              />
              {dois && (
                <input
                  type={inputType}
                  value={f.v2}
                  onChange={e => set({ v2: e.target.value })}
                  placeholder="Até"
                  className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-xs"
                />
              )}
            </div>
          )}
        </div>

        <div className="p-2 border-b border-border">
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Pesquisar valores..."
            className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-xs"
          />
        </div>

        <div className="max-h-52 overflow-y-auto p-2 space-y-0.5">
          {listados.length > 0 && (
            <label className="flex items-center gap-2 px-1.5 py-1 rounded-md hover:bg-muted cursor-pointer text-xs font-medium">
              <Checkbox checked={todosMarcados} onCheckedChange={c => marcarTodos(c === true)} />
              <span>(Selecionar tudo)</span>
            </label>
          )}
          {listados.map(v => (
            <label key={v} className="flex items-center gap-2 px-1.5 py-1 rounded-md hover:bg-muted cursor-pointer text-xs">
              <Checkbox checked={!excluded.has(v)} onCheckedChange={() => toggleValor(v)} />
              <span className="truncate" title={v}>{v}</span>
            </label>
          ))}
          {listados.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-3">Nenhum valor encontrado.</p>
          )}
        </div>

        <div className="p-2 border-t border-border flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => { onChange(emptyFilter()); setBusca(''); }}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium border border-border hover:bg-muted"
          >
            <X size={13} /> Limpar
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:opacity-90"
          >
            <Check size={13} /> Aplicar
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ColumnFilterMenu;
