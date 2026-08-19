import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, ChevronLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { OrdemServico } from '@/types/sanegest';
import { resolverIdentidadeEncarregado } from '@/lib/encarregados';


interface Props {
  ordens: OrdemServico[];
}

interface EncarregadoRow {
  id: string;
  nome: string;
  nsExecutadas: number;
  totalMetros: number;
  totalLigacoes: number;
  ns: { id: string; trecho: string; bacia: string; metros: number; ligacoes: number; data: string; fonte: 'validado' | 'campo' }[];
}

interface RelatorioRow {
  os_id: string;
  data_producao: string;
  responsavel_user_id: string | null;
  responsavel_nome: string | null;
  comprimento_trecho_executado: number | null;
  quantidade_ligacoes_realizadas: number | null;
}

export function ProducaoPorEncarregado({ ordens }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [registros, setRegistros] = useState<RelatorioRow[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    (async () => {
      // A produção pertence ao encarregado operacional da N.S. (liberado_para).
      // Quem digitou o lançamento permanece apenas como autor de auditoria.
      const { data } = await supabase
        .from('relatorio_producao_diaria' as never)
        .select('os_id, data_producao, responsavel_user_id, responsavel_nome, comprimento_trecho_executado, quantidade_ligacoes_realizadas');
      setRegistros(((data ?? []) as unknown) as RelatorioRow[]);
    })();
  }, []);

  const dados = useMemo(() => {
    const ym = selectedMonth;

    // Soma por encarregado operacional + O.S.
    const sumByEncOs = new Map<string, { encId: string; nome: string; osId: string; comp: number; lig: number; lastDate: string }>();
    for (const r of registros) {
      const data = String(r.data_producao ?? '');
      if (!data.startsWith(ym)) continue;
      const identidade = resolverIdentidadeEncarregado({
        userId: r.responsavel_user_id,
        nome: r.responsavel_nome,
      });
      const key = `${identidade.id}|${r.os_id}`;
      const cur = sumByEncOs.get(key) ?? { encId: identidade.id, nome: identidade.nome, osId: r.os_id, comp: 0, lig: 0, lastDate: data };
      cur.comp += Number(r.comprimento_trecho_executado) || 0;
      cur.lig += Number(r.quantidade_ligacoes_realizadas) || 0;
      if (data > cur.lastDate) cur.lastDate = data;
      sumByEncOs.set(key, cur);
    }

    const map = new Map<string, EncarregadoRow>();
    sumByEncOs.forEach((campo) => {
        const os = ordens.find((item) => item.id === campo.osId);
        if (!os) return;
        const metros = campo.comp;
        const ligs = campo.lig;
        if (metros <= 0 && ligs <= 0) return;

        const cur = map.get(campo.encId) ?? { id: campo.encId, nome: campo.nome, nsExecutadas: 0, totalMetros: 0, totalLigacoes: 0, ns: [] };
        cur.nsExecutadas += 1;
        cur.totalMetros += metros;
        cur.totalLigacoes += ligs;
        const dataRef = new Date(`${campo.lastDate}T00:00:00`);
        cur.ns.push({
          id: os.id,
          trecho: os.trecho,
          bacia: os.bacia,
          metros,
          ligacoes: ligs,
          data: dataRef.toLocaleDateString('pt-BR'),
          fonte: 'campo',
        });
        map.set(campo.encId, cur);
      });
    return Array.from(map.values()).sort((a, b) => b.totalMetros - a.totalMetros);
  }, [ordens, registros, selectedMonth]);

  const monthLabel = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    const s = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }, [selectedMonth]);

  const shiftMonth = (delta: number) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <div className="bg-card rounded-xl p-6 border border-border shadow-sm mb-6">
      <div className="flex items-center justify-between mb-4 gap-2">
        <h2 className="text-lg font-semibold text-foreground">Produção por Encarregado</h2>
        <div className="inline-flex items-center gap-0.5 rounded-md border border-border/60 bg-background/40 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="px-1.5 py-1 hover:text-foreground hover:bg-muted/50 rounded-l-md transition-colors"
            aria-label="Mês anterior"
          >
            <ChevronLeft size={12} />
          </button>
          <span className="px-1.5 py-1 tabular-nums select-none min-w-[68px] text-center">{monthLabel}</span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="px-1.5 py-1 hover:text-foreground hover:bg-muted/50 rounded-r-md transition-colors"
            aria-label="Próximo mês"
          >
            <ChevronRight size={12} />
          </button>
        </div>
      </div>
      {dados.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Sem dados</p>
      ) : (
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
                  key={enc.id}
                  className="border-b border-border/50 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setExpanded(expanded === enc.id ? null : enc.id)}
                >
                  <td className="py-2 text-muted-foreground">
                    {expanded === enc.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </td>
                  <td className="py-2 text-foreground font-medium">{enc.nome}</td>
                  <td className="py-2 text-right text-muted-foreground">{enc.nsExecutadas}</td>
                  <td className="py-2 text-right font-semibold text-foreground">
                    {enc.totalMetros.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                  </td>
                  <td className="py-2 text-right text-muted-foreground">{enc.totalLigacoes}</td>
                </tr>
                {expanded === enc.id && enc.ns.map(ns => (
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
      )}
    </div>
  );
}
