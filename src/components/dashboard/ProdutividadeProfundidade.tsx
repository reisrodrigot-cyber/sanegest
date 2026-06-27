import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Layers } from 'lucide-react';
import { aplicarRealValidadoEmRegistros, type OSRealInput } from '@/lib/realEfetivo';

interface RegistroRow {
  os_id: string;
  data_registro: string;
  comprimento_dia: number;
}

interface OSRow {
  id: string;
  prof_media_prevista: number | null;
  comprimento_real: number | null;
  ligacoes_real: number | null;
  real_validado: boolean | null;
}

const FAIXAS = [
  { label: 'Até 1,15m', max: 1.15 },
  { label: '1,15m a 2,00m', max: 2.0 },
  { label: '2,00m a 3,00m', max: 3.0 },
  { label: 'Acima de 3,00m', max: Infinity },
];

const faixaIndex = (prof: number | null) => {
  if (prof == null) return -1;
  if (prof <= 1.15) return 0;
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
      supabase.from('registros_producao').select('os_id, data_registro, comprimento_dia'),
      supabase.from('ordens_servico').select('id, prof_media_prevista, comprimento_real, ligacoes_real, real_validado'),
    ]).then(([r, o]) => {
      setRegistros((r.data ?? []) as RegistroRow[]);
      setOrdens((o.data ?? []) as OSRow[]);
      setLoading(false);
    });
  }, []);

  const stats = useMemo(() => {
    const osProf = new Map<string, number | null>();
    ordens.forEach((o) => osProf.set(o.id, o.prof_media_prevista != null ? Number(o.prof_media_prevista) : null));

    const ajustados = aplicarRealValidadoEmRegistros(registros, ordens as OSRealInput[]);

    // Por faixa: total metros + dias únicos
    const faixaData = FAIXAS.map(() => ({ total: 0, days: new Set<string>() }));
    ajustados.forEach((r) => {
      const prof = osProf.get(r.os_id) ?? null;
      const idx = faixaIndex(prof);
      if (idx < 0) return;
      faixaData[idx].total += Number(r.comprimento_dia) || 0;
      faixaData[idx].days.add(r.data_registro);
    });
    return FAIXAS.map((f, i) => ({
      label: f.label,
      media: faixaData[i].days.size > 0 ? Math.round((faixaData[i].total / faixaData[i].days.size) * 10) / 10 : 0,
      total: Math.round(faixaData[i].total * 10) / 10,
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
