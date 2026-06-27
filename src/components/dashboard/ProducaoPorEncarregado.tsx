import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { OrdemServico } from '@/types/sanegest';

interface Props {
  ordens: OrdemServico[];
}

interface EncarregadoRow {
  nome: string;
  nsExecutadas: number;
  totalMetros: number;
  totalLigacoes: number;
  ns: { id: string; trecho: string; bacia: string; metros: number; ligacoes: number; data: string }[];
}

export function ProducaoPorEncarregado({ ordens }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [apelidoMap, setApelidoMap] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('display_name, apelido, email');
      const map: Record<string, string> = {};
      (data ?? []).forEach((p: any) => {
        const friendly = p.apelido || p.display_name || p.email;
        if (p.display_name && friendly) map[p.display_name] = friendly;
        if (p.email && friendly) map[p.email] = friendly;
      });
      setApelidoMap(map);
    })();
  }, []);

  const dados = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const map = new Map<string, EncarregadoRow>();
    ordens
      .filter(os => os.comprimento_real != null && os.comprimento_real > 0 && os.liberado_para)
      .filter(os => (os.updated_at || '').slice(0, 7) === ym)
      .forEach(os => {
        const raw = os.liberado_para!;
        const nome = apelidoMap[raw] || raw;
        const cur = map.get(nome) ?? { nome, nsExecutadas: 0, totalMetros: 0, totalLigacoes: 0, ns: [] };
        cur.nsExecutadas += 1;
        cur.totalMetros += os.comprimento_real!;
        cur.totalLigacoes += os.ligacoes_real ?? 0;
        cur.ns.push({
          id: os.id,
          trecho: os.trecho,
          bacia: os.bacia,
          metros: os.comprimento_real!,
          ligacoes: os.ligacoes_real ?? 0,
          data: new Date(os.updated_at).toLocaleDateString('pt-BR'),
        });
        map.set(nome, cur);
      });
    return Array.from(map.values()).sort((a, b) => b.totalMetros - a.totalMetros);
  }, [ordens, apelidoMap]);


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
              <th className="pb-2 font-medium text-right">Rede executada (m)</th>
              <th className="pb-2 font-medium text-right">Ligações (qtd)</th>
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
                  <td className="py-2 text-right text-muted-foreground">{enc.totalLigacoes}</td>
                </tr>
                {expanded === enc.nome && enc.ns.map(ns => (
                  <tr key={ns.id} className="bg-muted/30">
                    <td className="py-1.5"></td>
                    <td className="py-1.5 pl-4 text-muted-foreground" colSpan={4}>
                      <Link to={`/ordens/${ns.id}`} className="hover:underline text-secondary">
                        ↳ {ns.trecho}
                      </Link>
                      <span className="text-muted-foreground"> | {ns.bacia} | rede {ns.metros.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}m | {ns.ligacoes} ligações | {ns.data}</span>
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
