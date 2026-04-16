import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { OrdemServico } from '@/types/sanegest';

interface Props {
  ordens: OrdemServico[];
}

interface EncarregadoRow {
  nome: string;
  nsExecutadas: number;
  totalMetros: number;
  ns: { id: string; trecho: string; bacia: string; metros: number; data: string }[];
}

export function ProducaoPorEncarregado({ ordens }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const dados = useMemo(() => {
    const map = new Map<string, EncarregadoRow>();
    ordens
      .filter(os => os.comprimento_real != null && os.comprimento_real > 0 && os.liberado_para)
      .forEach(os => {
        const nome = os.liberado_para!;
        const cur = map.get(nome) ?? { nome, nsExecutadas: 0, totalMetros: 0, ns: [] };
        cur.nsExecutadas += 1;
        cur.totalMetros += os.comprimento_real!;
        cur.ns.push({
          id: os.id,
          trecho: os.trecho,
          bacia: os.bacia,
          metros: os.comprimento_real!,
          data: new Date(os.updated_at).toLocaleDateString('pt-BR'),
        });
        map.set(nome, cur);
      });
    return Array.from(map.values()).sort((a, b) => b.totalMetros - a.totalMetros);
  }, [ordens]);

  if (dados.length === 0) return null;

  return (
    <div className="bg-card rounded-xl p-6 border border-border shadow-sm mb-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Produção por Encarregado</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="pb-2 font-medium w-8"></th>
              <th className="pb-2 font-medium">Encarregado</th>
              <th className="pb-2 font-medium text-right">NS executadas</th>
              <th className="pb-2 font-medium text-right">Total executado (m)</th>
            </tr>
          </thead>
          <tbody>
            {dados.map(enc => (
              <>
                <tr
                  key={enc.nome}
                  className="border-b border-border/50 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setExpanded(expanded === enc.nome ? null : enc.nome)}
                >
                  <td className="py-2 text-muted-foreground">
                    {expanded === enc.nome ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </td>
                  <td className="py-2 text-foreground font-medium">{enc.nome}</td>
                  <td className="py-2 text-right text-muted-foreground">{enc.nsExecutadas}</td>
                  <td className="py-2 text-right font-semibold text-foreground">
                    {enc.totalMetros.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                  </td>
                </tr>
                {expanded === enc.nome && enc.ns.map(ns => (
                  <tr key={ns.id} className="bg-muted/30">
                    <td className="py-1.5"></td>
                    <td className="py-1.5 pl-4 text-muted-foreground" colSpan={3}>
                      <Link to={`/ordens/${ns.id}`} className="hover:underline text-secondary">
                        ↳ {ns.trecho}
                      </Link>
                      <span className="text-muted-foreground"> | {ns.bacia} | {ns.metros.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}m | {ns.data}</span>
                    </td>
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
