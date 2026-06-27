import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, CheckCircle2, Clock, AlertTriangle, MapPin } from 'lucide-react';

interface RegistroRow {
  id: string;
  os_id: string;
  data_registro: string;
  comprimento_dia: number;
  ligacoes_dia: number;
  observacao: string | null;
  tipo_pavimento: string | null;
  created_at: string;
}

interface OSRow {
  id: string;
  trecho: string;
  comprimento_real: number | null;
  ligacoes_real: number | null;
  real_validado: boolean | null;
}

type Filtro = 'hoje' | 'semana' | 'mes';

const startOf = (filtro: Filtro): string => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (filtro === 'hoje') return now.toISOString().slice(0, 10);
  if (filtro === 'semana') {
    const dow = (now.getDay() + 6) % 7; // segunda = 0
    now.setDate(now.getDate() - dow);
    return now.toISOString().slice(0, 10);
  }
  now.setDate(1);
  return now.toISOString().slice(0, 10);
};

const fmtDataCurta = (key: string) => {
  const today = new Date().toISOString().slice(0, 10);
  const yest = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  })();
  const [y, m, d] = key.split('-');
  const label = `${d}/${m}/${y}`;
  if (key === today) return `Hoje — ${label}`;
  if (key === yest) return `Ontem — ${label}`;
  return label;
};

const fmtHora = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const fmtMetros = (n: number) =>
  `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;

interface Props {
  /** Limita a quantidade exibida. Usado em resumos no dashboard. */
  limit?: number;
  /** Esconde a barra de filtros (usado em resumos compactos). */
  hideFilters?: boolean;
  /** Filtro inicial. */
  filtroInicial?: Filtro;
}

export function MeusRegistrosEnviados({ limit, hideFilters, filtroInicial = 'hoje' }: Props) {
  const { user, effectiveUser } = useAuth();
  const userId = effectiveUser?.id ?? user?.id ?? '';
  const [registros, setRegistros] = useState<RegistroRow[]>([]);
  const [ordens, setOrdens] = useState<Record<string, OSRow>>({});
  const [filtro, setFiltro] = useState<Filtro>(filtroInicial);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      const since = startOf(filtro);
      const { data: regs } = await supabase
        .from('registros_producao')
        .select('id, os_id, data_registro, comprimento_dia, ligacoes_dia, observacao, tipo_pavimento, created_at')
        .eq('user_id', userId)
        .gte('data_registro', since)
        .order('data_registro', { ascending: false })
        .order('created_at', { ascending: false });
      if (cancel) return;
      const rs = (regs ?? []) as RegistroRow[];
      const osIds = Array.from(new Set(rs.map((r) => r.os_id)));
      let osMap: Record<string, OSRow> = {};
      if (osIds.length > 0) {
        const { data: os } = await supabase
          .from('ordens_servico')
          .select('id, trecho, comprimento_real, ligacoes_real, real_validado')
          .in('id', osIds);
        (os ?? []).forEach((o: any) => { osMap[o.id] = o as OSRow; });
      }
      if (cancel) return;
      setOrdens(osMap);
      setRegistros(rs);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [userId, filtro, reloadKey]);

  // Realtime: atualiza se este encarregado inserir novo registro em outra aba
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel('meus-registros-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registros_producao', filter: `user_id=eq.${userId}` },
        () => setReloadKey((k) => k + 1))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  const itens = useMemo(() => (limit ? registros.slice(0, limit) : registros), [registros, limit]);

  // Soma de envios brutos por OS (para detectar quando o validado difere)
  const somaPorOs = useMemo(() => {
    const m = new Map<string, { comp: number; lig: number }>();
    registros.forEach((r) => {
      const c = m.get(r.os_id) ?? { comp: 0, lig: 0 };
      c.comp += Number(r.comprimento_dia) || 0;
      c.lig += Number(r.ligacoes_dia) || 0;
      m.set(r.os_id, c);
    });
    return m;
  }, [registros]);

  const FilterBtn = ({ id, label }: { id: Filtro; label: string }) => (
    <button
      type="button"
      onClick={() => setFiltro(id)}
      className={`min-h-[44px] px-4 rounded-lg text-sm font-semibold transition-colors border ${
        filtro === id
          ? 'bg-secondary text-secondary-foreground border-secondary'
          : 'bg-card text-foreground border-border hover:bg-muted/60'
      }`}
    >
      {label}
    </button>
  );

  return (
    <section id="meus-registros" className="bg-card rounded-xl border border-border shadow-sm p-4 sm:p-5">
      <div className="mb-3">
        <h2 className="text-lg font-bold text-foreground">Meus registros enviados</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Confira aqui o que você já lançou para evitar envio duplicado.
        </p>
      </div>

      {!hideFilters && (
        <div className="flex flex-wrap gap-2 mb-4">
          <FilterBtn id="hoje" label="Hoje" />
          <FilterBtn id="semana" label="Semana" />
          <FilterBtn id="mes" label="Mês" />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-muted-foreground" size={20} />
        </div>
      ) : itens.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Nenhum envio neste período.
        </p>
      ) : (
        <ul className="space-y-3">
          {itens.map((r) => {
            const os = ordens[r.os_id];
            const trecho = os?.trecho ?? 'Trecho —';
            const validado = !!os?.real_validado;
            const soma = somaPorOs.get(r.os_id) ?? { comp: 0, lig: 0 };
            const compValid = Number(os?.comprimento_real) || 0;
            const ligValid = Number(os?.ligacoes_real) || 0;
            const diferente =
              validado &&
              soma.comp > 0 &&
              Math.abs(compValid - soma.comp) > 0.01;

            const statusLabel = !validado
              ? 'Enviado — aguardando validação'
              : diferente
                ? 'Ajustado pela sala técnica'
                : 'Validado pela sala técnica';
            const StatusIcon = !validado ? Clock : diferente ? AlertTriangle : CheckCircle2;
            const statusColor = !validado
              ? 'text-amber-600 dark:text-amber-400'
              : diferente
                ? 'text-orange-600 dark:text-orange-400'
                : 'text-emerald-600 dark:text-emerald-400';

            return (
              <li
                key={r.id}
                className="rounded-lg border border-border bg-background p-3 sm:p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {fmtDataCurta(r.data_registro)}
                    </p>
                    <p className="text-base font-bold text-foreground mt-0.5 flex items-center gap-1.5">
                      <MapPin size={14} className="text-muted-foreground shrink-0" />
                      <span className="truncate">{trecho}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Enviado às {fmtHora(r.created_at)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="text-[11px] text-muted-foreground">Comprimento informado</p>
                    <p className="text-base font-bold text-foreground">
                      {fmtMetros(Number(r.comprimento_dia) || 0)}
                    </p>
                  </div>
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="text-[11px] text-muted-foreground">Ligações informadas</p>
                    <p className="text-base font-bold text-foreground">
                      {r.ligacoes_dia ?? 0}
                    </p>
                  </div>
                </div>

                {diferente && (
                  <div className="mt-3 rounded-md border border-orange-500/30 bg-orange-500/10 p-2 text-xs space-y-0.5">
                    <p className="text-foreground">
                      <span className="text-muted-foreground">Informado em campo (total da OS):</span>{' '}
                      <span className="font-semibold">{fmtMetros(soma.comp)}</span>
                      {soma.lig > 0 && <> · {soma.lig} ligação(ões)</>}
                    </p>
                    <p className="text-foreground">
                      <span className="text-muted-foreground">REAL validado pela sala técnica:</span>{' '}
                      <span className="font-semibold">{fmtMetros(compValid)}</span>
                      {ligValid > 0 && <> · {ligValid} ligação(ões)</>}
                    </p>
                  </div>
                )}

                {r.observacao && (
                  <p className="mt-2 text-xs text-muted-foreground italic">
                    Obs.: {r.observacao}
                  </p>
                )}

                <div className={`mt-3 flex items-center gap-1.5 text-xs font-semibold ${statusColor}`}>
                  <StatusIcon size={14} />
                  <span>{statusLabel}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
