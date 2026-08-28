import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { fmtM2 } from '@/lib/pavimentacao';

interface LinhaPav {
  os_id: string;
  data_registro: string;
  trecho: string;
  sub_bacia: string;
  responsavel_user_id: string;
  responsavel_nome: string;
  area_m2: number;
  area_prevista_m2: number | null;
  area_realizada_m2: number;
  pavimentacao_finalizada: boolean;
}

const KPI = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="rounded-lg border border-border bg-card p-3">
    <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">{label}</p>
    <p className="text-lg font-bold text-foreground leading-tight mt-0.5">{value}</p>
    {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
  </div>
);

export const PavimentacaoTab = () => {
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');

  const { data: linhas = [], isLoading } = useQuery({
    queryKey: ['pav-relatorio'],
    queryFn: async (): Promise<LinhaPav[]> => {
      const { data, error } = await supabase
        .from('relatorio_pavimentacao_diaria')
        .select('os_id, data_registro, trecho, sub_bacia, responsavel_user_id, responsavel_nome, area_m2, area_prevista_m2, area_realizada_m2, pavimentacao_finalizada')
        .order('data_registro', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as LinhaPav[];
    },
  });

  const filtradas = useMemo(
    () => linhas.filter((l) => (!de || l.data_registro >= de) && (!ate || l.data_registro <= ate)),
    [linhas, de, ate],
  );

  const totais = useMemo(() => {
    // Área prevista deduplicada por N.S. (nunca somar por lançamento)
    const porOs = new Map<string, { prevista: number | null; realizada: number }>();
    linhas.forEach((l) => {
      porOs.set(l.os_id, {
        prevista: l.area_prevista_m2 == null ? null : Number(l.area_prevista_m2),
        realizada: Number(l.area_realizada_m2 ?? 0),
      });
    });
    let prevista = 0;
    let realizada = 0;
    porOs.forEach((v) => {
      prevista += v.prevista ?? 0;
      realizada += v.realizada;
    });
    const saldo = Math.max(prevista - realizada, 0);
    const pct = prevista > 0 ? (realizada / prevista) * 100 : null;
    const excedente = Math.max(realizada - prevista, 0);
    return { prevista, realizada, saldo, pct, excedente };
  }, [linhas]);

  const porEncarregado = useMemo(() => {
    const m = new Map<string, { nome: string; area: number; dias: Set<string>; trechos: Set<string> }>();
    filtradas.forEach((l) => {
      const k = l.responsavel_user_id ?? l.responsavel_nome;
      const e = m.get(k) ?? { nome: l.responsavel_nome, area: 0, dias: new Set<string>(), trechos: new Set<string>() };
      e.area += Number(l.area_m2 ?? 0);
      e.dias.add(l.data_registro);
      e.trechos.add(l.os_id);
      m.set(k, e);
    });
    return Array.from(m.values()).sort((a, b) => b.area - a.area);
  }, [filtradas]);

  if (isLoading) {
    return <div className="flex justify-center py-14"><Loader2 className="animate-spin text-muted-foreground" size={28} /></div>;
  }

  const barPct = totais.pct == null ? 0 : Math.min(totais.pct, 100);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
        <KPI label="Área prevista (m²)" value={fmtM2(totais.prevista)} />
        <KPI label="Área realizada (m²)" value={fmtM2(totais.realizada)} sub={totais.excedente > 0 ? `Excedente: ${fmtM2(totais.excedente)} m²` : undefined} />
        <KPI label="Saldo (m²)" value={fmtM2(totais.saldo)} />
        <KPI label="% Executado" value={totais.pct == null ? '—' : `${totais.pct.toFixed(1)}%`} />
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center justify-between mb-1.5">
          <h3 className="text-sm font-semibold text-foreground">Avanço da Pavimentação</h3>
          <span className="text-xs text-muted-foreground">
            {fmtM2(totais.realizada)} / {fmtM2(totais.prevista)} m²
          </span>
        </div>
        <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${barPct}%` }} />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-end justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold text-foreground">Produção por encarregado</h3>
          <div className="flex items-end gap-1.5">
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="h-8 text-xs w-[135px]" />
            <span className="text-xs text-muted-foreground pb-2">a</span>
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="h-8 text-xs w-[135px]" />
          </div>
        </div>

        {porEncarregado.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-6 text-center">Sem produção de pavimentação no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase text-muted-foreground border-b border-border">
                  <th className="text-left py-1.5 px-2">Encarregado</th>
                  <th className="text-right py-1.5 px-2">Área (m²)</th>
                  <th className="text-right py-1.5 px-2">Dias</th>
                  <th className="text-right py-1.5 px-2">Trechos</th>
                  <th className="text-right py-1.5 px-2">Média (m²/dia)</th>
                </tr>
              </thead>
              <tbody>
                {porEncarregado.map((e) => (
                  <tr key={e.nome} className="border-b border-border/60 last:border-0 odd:bg-muted/30">
                    <td className="py-1.5 px-2 font-medium text-foreground">{e.nome}</td>
                    <td className="py-1.5 px-2 text-right font-semibold">{fmtM2(e.area)}</td>
                    <td className="py-1.5 px-2 text-right">{e.dias.size}</td>
                    <td className="py-1.5 px-2 text-right">{e.trechos.size}</td>
                    <td className="py-1.5 px-2 text-right">{fmtM2(e.dias.size > 0 ? e.area / e.dias.size : 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
