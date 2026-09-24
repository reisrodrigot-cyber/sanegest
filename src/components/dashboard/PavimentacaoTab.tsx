import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtM2, formatBR, hojeMaceio } from '@/lib/pavimentacao';
import { PeriodoPicker } from '@/components/dashboard/PeriodoPicker';
import {
  somarPorTipoPavimento,
  totalAreaPavimentacao,
  type PavimentoOS,
  type ProducaoPavimento,
} from '@/lib/pavimentacaoDashboard';

interface LinhaPav {
  id: string;
  os_id: string;
  data_registro: string;
  trecho: string;
  sub_bacia: string;
  responsavel_user_id: string | null;
  responsavel_nome: string;
  area_m2: number;
}

interface ConclusaoPav {
  os_id: string;
  concluido: boolean;
  concluido_em: string | null;
}

const KPI = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="rounded-lg border border-border bg-card p-3">
    <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">{label}</p>
    <p className="text-lg font-bold text-foreground leading-tight mt-0.5">{value}</p>
    {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
  </div>
);

export const PavimentacaoTab = () => {
  const hoje = hojeMaceio();
  const inicioPadrao = useMemo(() => {
    const data = new Date(`${hoje}T12:00:00`);
    data.setDate(data.getDate() - 29);
    return data.toISOString().slice(0, 10);
  }, [hoje]);
  const [de, setDe] = useState(inicioPadrao);
  const [ate, setAte] = useState(hoje);

  const { data, isLoading } = useQuery({
    queryKey: ['pav-relatorio'],
    queryFn: async () => {
      const [producao, conclusoes, ordens] = await Promise.all([
        supabase
          .from('relatorio_pavimentacao_diaria')
          .select('id, os_id, data_registro, trecho, sub_bacia, responsavel_user_id, responsavel_nome, area_m2')
          .order('data_registro', { ascending: false }),
        supabase
          .from('os_pavimentacao_conclusao')
          .select('os_id, concluido, concluido_em'),
        supabase
          .from('ordens_servico')
          .select('id, pav_real, pav_previsto'),
      ]);
      if (producao.error) throw producao.error;
      if (conclusoes.error) throw conclusoes.error;
      if (ordens.error) throw ordens.error;
      return {
        linhas: (producao.data ?? []) as unknown as LinhaPav[],
        conclusoes: (conclusoes.data ?? []) as ConclusaoPav[],
        ordens: (ordens.data ?? []) as PavimentoOS[],
      };
    },
  });

  const linhas = data?.linhas ?? [];
  const conclusoes = data?.conclusoes ?? [];
  const ordens = data?.ordens ?? [];

  const filtradas = useMemo(
    () => linhas.filter((l) => (!de || l.data_registro >= de) && (!ate || l.data_registro <= ate)),
    [linhas, de, ate],
  );

  const ontem = useMemo(() => {
    const dataOntem = new Date(`${hoje}T12:00:00`);
    dataOntem.setDate(dataOntem.getDate() - 1);
    return dataOntem.toISOString().slice(0, 10);
  }, [hoje]);

  const areaPeriodo = useMemo(() => totalAreaPavimentacao(filtradas as ProducaoPavimento[]), [filtradas]);
  const producaoOntem = useMemo(() => {
    const registros = filtradas.filter((l) => l.data_registro === ontem);
    return { area: totalAreaPavimentacao(registros as ProducaoPavimento[]), trechos: new Set(registros.map((l) => l.os_id)).size };
  }, [filtradas, ontem]);

  const diasProdutivos = useMemo(() => new Set(filtradas.filter((l) => Number(l.area_m2) > 0).map((l) => l.data_registro)).size, [filtradas]);
  const mediaDiaria = diasProdutivos > 0 ? areaPeriodo / diasProdutivos : 0;
  const trechosFinalizados = useMemo(() => conclusoes.filter((c) => {
    const dataConclusao = c.concluido_em?.slice(0, 10);
    return c.concluido && !!dataConclusao && dataConclusao >= de && dataConclusao <= ate;
  }).length, [conclusoes, de, ate]);

  const porEncarregado = useMemo(() => {
    const m = new Map<string, { nome: string; area: number; dias: Set<string>; trechos: Set<string>; ultima: string }>();
    filtradas.forEach((l) => {
      const k = l.responsavel_user_id ?? l.responsavel_nome;
      const e = m.get(k) ?? { nome: l.responsavel_nome, area: 0, dias: new Set<string>(), trechos: new Set<string>(), ultima: l.data_registro };
      e.area += Number(l.area_m2 ?? 0);
      e.dias.add(l.data_registro);
      e.trechos.add(l.os_id);
      if (l.data_registro > e.ultima) e.ultima = l.data_registro;
      m.set(k, e);
    });
    return Array.from(m.values()).sort((a, b) => b.area - a.area);
  }, [filtradas]);

  const diasNoPeriodo = useMemo(() => {
    const inicio = new Date(`${de}T12:00:00`);
    const fim = new Date(`${ate}T12:00:00`);
    return Math.max(1, Math.round((fim.getTime() - inicio.getTime()) / 86400000) + 1);
  }, [de, ate]);

  const diario = useMemo(() => {
    const porDia = new Map<string, number>();
    filtradas.forEach((l) => porDia.set(l.data_registro, (porDia.get(l.data_registro) ?? 0) + Number(l.area_m2 ?? 0)));
    const resultado: Array<{ data: string; label: string; area: number }> = [];
    const cursor = new Date(`${de}T12:00:00`);
    const fim = new Date(`${ate}T12:00:00`);
    while (cursor <= fim) {
      const data = cursor.toISOString().slice(0, 10);
      resultado.push({ data, label: formatBR(data).slice(0, 5), area: porDia.get(data) ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    return resultado;
  }, [filtradas, de, ate]);

  const mensal = useMemo(() => {
    const inicioLimite = new Date(`${ate}T12:00:00`);
    inicioLimite.setDate(1);
    inicioLimite.setMonth(inicioLimite.getMonth() - 3);
    const limite = inicioLimite.toISOString().slice(0, 10);
    const inicio = de > limite ? de : limite;
    const meses = new Map<string, number>();
    const cursor = new Date(`${inicio}T12:00:00`);
    cursor.setDate(1);
    const fim = new Date(`${ate}T12:00:00`);
    while (cursor <= fim) {
      meses.set(cursor.toISOString().slice(0, 7), 0);
      cursor.setMonth(cursor.getMonth() + 1);
    }
    filtradas.forEach((l) => {
      if (l.data_registro < inicio) return;
      const mes = l.data_registro.slice(0, 7);
      if (meses.has(mes)) meses.set(mes, (meses.get(mes) ?? 0) + Number(l.area_m2 ?? 0));
    });
    return Array.from(meses, ([mes, area]) => ({
      mes,
      label: new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(`${mes}-01T12:00:00Z`)).replace('.', ''),
      area,
    }));
  }, [filtradas, de, ate]);

  const porTipo = useMemo(() => {
    const totais = somarPorTipoPavimento(filtradas as ProducaoPavimento[], ordens);
    return [
      { tipo: 'Asfalto', area: totais.Asfalto },
      { tipo: 'Paralelepípedo', area: totais.Paralelepípedo },
    ];
  }, [filtradas, ordens]);

  if (isLoading) {
    return <div className="flex justify-center py-14"><Loader2 className="animate-spin text-muted-foreground" size={28} /></div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Indicadores de produção real</p>
        <PeriodoPicker inicio={de} fim={ate} onChange={(inicio, fim) => { setDe(inicio); setAte(fim); }} ariaLabel="Filtrar produção de pavimentação" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
        <KPI label="Produção ontem" value={`${fmtM2(producaoOntem.area)} m²`} sub={producaoOntem.area > 0 ? `${producaoOntem.trechos} ${producaoOntem.trechos === 1 ? 'trecho movimentado' : 'trechos movimentados'}` : 'Sem produção registrada ontem'} />
        <KPI label="Área executada no período" value={`${fmtM2(areaPeriodo)} m²`} />
        <KPI label="Produção diária média" value={`${fmtM2(mediaDiaria)} m²/dia`} sub="Média por dia com produção" />
        <KPI label="Trechos finalizados" value={String(trechosFinalizados)} sub="Conclusões registradas no período" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-card p-3 min-w-0">
          <h3 className="text-sm font-semibold text-foreground mb-3">Produção Diária ({diasNoPeriodo} dias)</h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={diario} margin={{ top: 4, right: 6, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(diario.length / 7))} />
                <YAxis tick={{ fontSize: 10 }} unit="m²" width={58} />
                <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.data ? formatBR(payload[0].payload.data) : ''} formatter={(value: number) => [`${fmtM2(value)} m²`, 'Produção']} />
                <Bar dataKey="area" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3 min-w-0">
          <h3 className="text-sm font-semibold text-foreground mb-3">Produção Mensal</h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mensal} margin={{ top: 4, right: 6, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} unit="m²" width={58} />
                <Tooltip formatter={(value: number) => [`${fmtM2(value)} m²`, 'Produção']} />
                <Bar dataKey="area" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <h3 className="text-sm font-semibold text-foreground mb-2">Produção por encarregado</h3>

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
                   <th className="text-right py-1.5 px-2">Última produção</th>
                </tr>
              </thead>
              <tbody>
                {porEncarregado.map((e) => (
                  <tr key={`${e.nome}-${e.ultima}`} className="border-b border-border/60 last:border-0 odd:bg-muted/30">
                    <td className="py-1.5 px-2 font-medium text-foreground">{e.nome}</td>
                    <td className="py-1.5 px-2 text-right font-semibold">{fmtM2(e.area)}</td>
                    <td className="py-1.5 px-2 text-right">{e.dias.size}</td>
                    <td className="py-1.5 px-2 text-right">{e.trechos.size}</td>
                    <td className="py-1.5 px-2 text-right">{fmtM2(e.dias.size > 0 ? e.area / e.dias.size : 0)}</td>
                    <td className="py-1.5 px-2 text-right whitespace-nowrap">{formatBR(e.ultima)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-3 min-w-0">
        <h3 className="text-sm font-semibold text-foreground mb-3">Produção por tipo de pavimento</h3>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={porTipo} layout="vertical" margin={{ top: 4, right: 18, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 10 }} unit="m²" />
              <YAxis type="category" dataKey="tipo" tick={{ fontSize: 11 }} width={108} />
              <Tooltip formatter={(value: number) => [`${fmtM2(value)} m²`, 'Área executada']} />
              <Bar dataKey="area" fill="hsl(var(--chart-3))" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
