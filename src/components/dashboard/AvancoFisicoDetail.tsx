import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { OrdemServico } from '@/types/sanegest';

interface Props {
  ordens: OrdemServico[];
}

export function AvancoFisicoDetail({ ordens }: Props) {
  const [open, setOpen] = useState(false);

  const nsComReal = useMemo(() =>
    ordens
      .filter(os => os.comprimento_real != null && os.comprimento_real > 0)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [ordens]
  );

  if (nsComReal.length === 0) return null;

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-sm text-secondary hover:underline font-medium"
      >
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        Ver detalhamento ({nsComReal.length} NS)
      </button>
      {open && (
        <div className="bg-card rounded-xl border border-border shadow-sm mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-3 font-medium">Trecho</th>
                <th className="p-3 font-medium">Bacia</th>
                <th className="p-3 font-medium text-right">Previsto (m)</th>
                <th className="p-3 font-medium text-right">Executado (m)</th>
                <th className="p-3 font-medium">Encarregado</th>
              </tr>
            </thead>
            <tbody>
              {nsComReal.map(os => (
                <tr key={os.id} className="border-b border-border/50">
                  <td className="p-3">
                    <Link to={`/ordens/${os.id}`} className="text-secondary hover:underline font-medium">
                      {os.trecho}
                    </Link>
                  </td>
                  <td className="p-3 text-muted-foreground">{os.bacia}</td>
                  <td className="p-3 text-right text-muted-foreground">
                    {(os.comprimento_previsto ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                  </td>
                  <td className="p-3 text-right font-semibold text-foreground">
                    {(os.comprimento_real ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                  </td>
                  <td className="p-3 text-muted-foreground">{os.liberado_para || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
