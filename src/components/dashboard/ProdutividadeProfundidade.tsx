import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Layers } from 'lucide-react';
import { aplicarRealValidadoEmRegistros, type OSRealInput } from '@/lib/realEfetivo';

interface RegistroRow {
  os_id: string;
  data_registro: string;
  comprimento_dia: number;
  user_id?: string | null;
}

interface OSRow {
  id: string;
  prof_media_prevista: number | null;
  comprimento_real: number | null;
  ligacoes_real: number | null;
  real_validado: boolean | null;
  liberado_para: string | null;
}

const FAIXAS = [
  { label: 'Até 1,25m', max: 1.25 },
  { label: '1,25m a 2,00m', max: 2.0 },
  { label: '2,00m a 3,00m', max: 3.0 },
  { label: 'Acima de 3,00m', max: Infinity },
];

const faixaIndex = (prof: number | null) => {
  if (prof == null) return -1;
  if (prof <= 1.25) return 0;
  if (prof <= 2.0) return 1;
  if (prof <= 3.0) return 2;
  return 3;
};

export const ProdutividadeProfundidade = () => {
  const [registros, setRegistros] = useState<RegistroRow[]>([]);
  const [ordens, setOrdens] = useState<OSRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('registros_producao').select('user_id, os_id, data_registro, comprimento_dia, comprimento_ajustado, ligacoes_dia, ligacoes_ajustadas, status').eq('excluido', false).eq('status', 'ativo'),
      supabase.from('ordens_servico').select('id, prof_media_prevista, comprimento_real, ligacoes_real, real_validado'),
    ]).then(([r, o]) => {
      setRegistros((r.data ?? []) as RegistroRow[]);
      setOrdens((o.data ?? []) as OSRow[]);
      setLoading(false);
    });
  }, []);

  // Produtividade por Profundidade (conceito APO):
  //   produtividade_faixa = metros_rede_da_faixa / dias_proporcionais_da_faixa
  //   Para cada par (encarregado, data), 1 dia é rateado entre as faixas em
  //   que ele produziu rede, proporcionalmente aos metros de cada faixa.
  const stats = useMemo(() => {
    const osProf = new Map<string, number | null>();
    ordens.forEach((o) => osProf.set(o.id, o.prof_media_prevista != null ? Number(o.prof_media_prevista) : null));

    const ajustados = aplicarRealValidadoEmRegistros(registros, ordens as OSRealInput[]);

    const porPar = new Map<string, number[]>();
    ajustados.forEach((r) => {
      const metros = Number(r.comprimento_dia) || 0;
      if (metros <= 0) return;
      const idx = faixaIndex(osProf.get(r.os_id) ?? null);
      if (idx < 0) return;
      const key = `${(r as any).user_id ?? 'sem-user'}|${r.data_registro}`;
      let arr = porPar.get(key);
      if (!arr) { arr = FAIXAS.map(() => 0); porPar.set(key, arr); }
      arr[idx] += metros;
    });
    const totais = FAIXAS.map(() => 0);
    const diasProp = FAIXAS.map(() => 0);
    porPar.forEach((arr) => {
      const totalDia = arr.reduce((s, v) => s + v, 0);
      if (totalDia <= 0) return;
      arr.forEach((m, i) => {
        if (m <= 0) return;
        totais[i] += m;
        diasProp[i] += m / totalDia;
      });
    });
    return FAIXAS.map((f, i) => ({
      label: f.label,
      media: diasProp[i] > 0 ? Math.round((totais[i] / diasProp[i]) * 10) / 10 : 0,
      total: Math.round(totais[i] * 10) / 10,
    }));
  }, [registros, ordens]);


  if (loading) {
    return (
      <div className="bg-card rounded-xl p-6 border border-border shadow-sm mb-6">
        <Loader2 className="animate-spin text-muted-foreground mx-auto" size={18} />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl p-6 border border-border shadow-sm mb-6">
      <h2 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
        <Layers size={18} className="text-muted-foreground" />
        Produtividade por Profundidade
      </h2>
      <p className="text-sm text-muted-foreground mb-4">Média diária de produção por faixa</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-xl font-bold text-foreground mt-1">
              {s.media.toLocaleString('pt-BR')} <span className="text-xs font-normal text-muted-foreground">m/dia</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Total: {s.total.toLocaleString('pt-BR')} m</p>
          </div>
        ))}
      </div>
    </div>
  );
};
