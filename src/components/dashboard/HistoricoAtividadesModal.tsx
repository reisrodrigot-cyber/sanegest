import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PeriodoPicker, toISODate, fmtDateBR } from '@/components/dashboard/PeriodoPicker';
import {
  buscarEdicoesProducao,
  SEM_SNAPSHOT,
  type CampoAlterado,
} from '@/lib/auditProducao';
import {
  Loader2,
  Search,
  X,
  ChevronDown,
  Check,
  History,
  PencilLine,
  HardHat,
  FileCheck2,
  Ruler,
  Package,
} from 'lucide-react';


/* ------------------------------------------------------------------ *
 * Tipos
 * ------------------------------------------------------------------ */

export type HistoricoTipo =
  | 'producao'
  | 'producao_edicao'
  | 'ns'
  | 'topografia'
  | 'almoxarifado';

export interface HistoricoEvento {
  id: string;
  tipo: HistoricoTipo;
  /** Momento real do lançamento/alteração. */
  ts: Date;
  /** Data física da produção (yyyy-mm-dd) — apenas eventos de produção. */
  dataProducao: string | null;
  quemId: string | null;
  quem: string;
  trecho: string | null;
  bacia: string | null;
  rede: number | null;
  ligacoes: number | null;
  ligComp: number | null;
  descricao: string;
  /** Campos alterados (apenas eventos de edição de produção). */
  alteracoes?: CampoAlterado[];
  /** Edição histórica sem snapshot anterior utilizável. */
  snapshotIndisponivel?: boolean;
}


export const TIPO_META: Record<
  HistoricoTipo,
  { label: string; color: string; bg: string; Icon: typeof HardHat }
> = {
  producao: { label: 'Produção', color: '#16A34A', bg: 'rgba(22,163,74,0.10)', Icon: HardHat },
  producao_edicao: { label: 'Edição de produção', color: '#7C3AED', bg: 'rgba(124,58,237,0.10)', Icon: PencilLine },
  ns: { label: 'N.S. aplicada', color: '#CA8A04', bg: 'rgba(202,138,4,0.12)', Icon: FileCheck2 },
  topografia: { label: 'Topografia', color: '#185FA5', bg: 'rgba(24,95,165,0.10)', Icon: Ruler },
  almoxarifado: { label: 'Almoxarifado', color: '#EA580C', bg: 'rgba(234,88,12,0.10)', Icon: Package },
};

const TIPOS: HistoricoTipo[] = ['producao', 'producao_edicao', 'ns', 'topografia', 'almoxarifado'];

/* ------------------------------------------------------------------ *
 * Formatação
 * ------------------------------------------------------------------ */

const pad = (n: number) => String(n).padStart(2, '0');

export const fmtLancamento = (d: Date) =>
  `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;

const fmtRelativo = (d: Date) => {
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
};

const num = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Dia local (yyyy-mm-dd) de um timestamp de lançamento. */
const diaLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/* ------------------------------------------------------------------ *
 * Busca de dados (somente leitura)
 * ------------------------------------------------------------------ */

const LIMITE = 800;

export const useHistoricoAtividades = (inicio: string, fim: string, ativo: boolean) => {
  const [eventos, setEventos] = useState<HistoricoEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const recarregar = () => setTentativa((n) => n + 1);

  useEffect(() => {
    if (!ativo) return;
    let cancelled = false;
    const startIso = `${inicio}T00:00:00.000-03:00`;
    const endIso = `${fim}T23:59:59.999-03:00`;
    const startMs = new Date(startIso).getTime();
    const endMs = new Date(endIso).getTime();
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [prod, topo, mat, status, edicoes] = await Promise.all([
          supabase
            .from('registros_producao')
            .select(
              'id, data_registro, comprimento_dia, ligacoes_dia, comprimento_ajustado, ligacoes_ajustadas, user_id, os_id, created_at, updated_at, status',
            )
            .eq('excluido', false)
            .lte('created_at', endIso)
            .gte('updated_at', startIso)
            .order('updated_at', { ascending: false })
            .limit(LIMITE),
          supabase
            .from('topografia_asbuilt')
            .select('id, nome_estaca, registrado_por, os_id, created_at')
            .gte('created_at', startIso)
            .lte('created_at', endIso)
            .order('created_at', { ascending: false })
            .limit(LIMITE),
          supabase
            .from('materiais_entrega')
            .select('id, descricao, quantidade, unidade, registrado_por, os_id, created_at')
            .gte('created_at', startIso)
            .lte('created_at', endIso)
            .order('created_at', { ascending: false })
            .limit(LIMITE),
          supabase
            .from('os_status_historico')
            .select('id, status_anterior, status_novo, user_id, os_id, created_at')
            .eq('status_novo', 'VERMELHO')
            .gte('created_at', startIso)
            .lte('created_at', endIso)
            .order('created_at', { ascending: false })
            .limit(LIMITE),
          buscarEdicoesProducao(startIso, endIso, LIMITE),
        ]);


        const qErr = prod.error || topo.error || mat.error || status.error;
        if (qErr) throw qErr;

        const userIds = new Set<string>();
        const osIds = new Set<string>();
        const regIds: string[] = [];
        (prod.data || []).forEach((r: any) => {
          r.user_id && userIds.add(r.user_id);
          r.os_id && osIds.add(r.os_id);
          regIds.push(r.id);
        });
        (topo.data || []).forEach((r: any) => {
          r.registrado_por && userIds.add(r.registrado_por);
          r.os_id && osIds.add(r.os_id);
        });
        (mat.data || []).forEach((r: any) => {
          r.registrado_por && userIds.add(r.registrado_por);
          r.os_id && osIds.add(r.os_id);
        });
        (status.data || []).forEach((r: any) => {
          r.user_id && userIds.add(r.user_id);
          r.os_id && osIds.add(r.os_id);
        });

        // Edições de produção vêm da auditoria (snapshot antes/depois), não de heurística de updated_at.
        edicoes.forEach((e) => {
          if (e.usuarioId) userIds.add(e.usuarioId);
        });
        const edicaoRegIds = Array.from(new Set(edicoes.map((e) => e.registroId).filter(Boolean)));
        const regsEdicao = edicaoRegIds.length
          ? (
              await supabase
                .from('registros_producao')
                .select('id, os_id, user_id, data_registro')
                .in('id', edicaoRegIds)
            ).data || []
          : [];
        const regMap: Record<string, any> = {};
        (regsEdicao as any[]).forEach((r: any) => {
          regMap[r.id] = r;
          if (r.os_id) osIds.add(r.os_id);
        });


        const [profs, oss, ligs] = await Promise.all([
          userIds.size
            ? supabase.from('profiles').select('user_id, display_name, email, apelido').in('user_id', Array.from(userIds))
            : Promise.resolve({ data: [] as any[] }),
          osIds.size
            ? supabase.from('ordens_servico').select('id, trecho, bacia, liberado_para').in('id', Array.from(osIds))
            : Promise.resolve({ data: [] as any[] }),
          regIds.length
            ? supabase.from('ligacoes').select('registro_producao_id, comprimento').in('registro_producao_id', regIds)
            : Promise.resolve({ data: [] as any[] }),
        ]);

        const uMap: Record<string, string> = {};
        (profs.data || []).forEach((p: any) => {
          uMap[p.user_id] = p.apelido || p.display_name || p.email || '';
        });
        const oMap: Record<string, { trecho: string; bacia: string | null; liberado_para: string | null }> = {};
        (oss.data || []).forEach((o: any) => {
          oMap[o.id] = { trecho: o.trecho, bacia: o.bacia ?? null, liberado_para: o.liberado_para };
        });
        const ligMap: Record<string, number> = {};
        (ligs.data || []).forEach((l: any) => {
          if (!l.registro_producao_id) return;
          ligMap[l.registro_producao_id] = (ligMap[l.registro_producao_id] || 0) + (Number(l.comprimento) || 0);
        });

        const all: HistoricoEvento[] = [];

        (prod.data || []).forEach((r: any) => {
          const rede = Number(r.comprimento_ajustado ?? r.comprimento_dia) || 0;
          const lig = Number(r.ligacoes_ajustadas ?? r.ligacoes_dia) || 0;
          const ligComp = ligMap[r.id] ?? null;
          const os = oMap[r.os_id];
          const partes: string[] = [];
          if (rede) partes.push(`${num(rede)} m de rede`);
          if (lig) partes.push(`${lig} ${lig === 1 ? 'ligação' : 'ligações'}`);
          if (ligComp) partes.push(`${num(ligComp)} m de ligações`);
          const resumo = partes.join(' • ') || 'sem quantitativo';

          const createdMs = r.created_at ? new Date(r.created_at).getTime() : 0;

          const base = {
            dataProducao: (r.data_registro as string) || null,
            quemId: r.user_id ?? null,
            quem: uMap[r.user_id] || 'Usuário',
            trecho: os?.trecho ?? null,
            bacia: os?.bacia ?? null,
            rede,
            ligacoes: lig,
            ligComp,
          };

          all.push({
            ...base,
            id: `p-${r.id}`,
            tipo: 'producao',
            ts: new Date(createdMs),
            descricao: `registrou produção${os?.trecho ? ` — ${os.trecho}` : ''} — ${resumo}`,
          });
        });

        // Eventos de auditoria — edição de produção (nunca contabilizam produção nova).
        edicoes.forEach((ed) => {
          const reg = regMap[ed.registroId];
          const os = reg ? oMap[reg.os_id] : undefined;
          const resumoAlt = ed.alteracoes.length
            ? ed.alteracoes.map((a) => a.campo).join(', ')
            : 'sem detalhe disponível';
          all.push({
            id: ed.id,
            tipo: 'producao_edicao',
            ts: ed.ts,
            dataProducao: ed.dataProducao ?? reg?.data_registro ?? null,
            quemId: ed.usuarioId,
            quem: (ed.usuarioId && uMap[ed.usuarioId]) || 'Usuário',
            trecho: os?.trecho ?? null,
            bacia: os?.bacia ?? null,
            rede: null,
            ligacoes: null,
            ligComp: null,
            descricao: `editou produção${os?.trecho ? ` — ${os.trecho}` : ''} — ${resumoAlt}`,
            alteracoes: ed.alteracoes,
            snapshotIndisponivel: ed.snapshotIndisponivel,
          });
        });


        (topo.data || []).forEach((r: any) => {
          const os = oMap[r.os_id];
          all.push({
            id: `t-${r.id}`,
            tipo: 'topografia',
            ts: new Date(r.created_at),
            dataProducao: null,
            quemId: r.registrado_por ?? null,
            quem: uMap[r.registrado_por] || 'Topógrafo',
            trecho: os?.trecho ?? null,
            bacia: os?.bacia ?? null,
            rede: null,
            ligacoes: null,
            ligComp: null,
            descricao: `registrou estaca ${r.nome_estaca || ''}${os?.trecho ? ` em ${os.trecho}` : ''}`.trim(),
          });
        });

        (mat.data || []).forEach((r: any) => {
          const os = oMap[r.os_id];
          all.push({
            id: `m-${r.id}`,
            tipo: 'almoxarifado',
            ts: new Date(r.created_at),
            dataProducao: null,
            quemId: r.registrado_por ?? null,
            quem: uMap[r.registrado_por] || 'Almoxarifado',
            trecho: os?.trecho ?? null,
            bacia: os?.bacia ?? null,
            rede: null,
            ligacoes: null,
            ligComp: null,
            descricao: `Entrega: ${r.quantidade} ${r.unidade} de ${r.descricao}${os?.trecho ? ` para ${os.trecho}` : ''}`,
          });
        });

        (status.data || []).forEach((r: any) => {
          const os = oMap[r.os_id];
          all.push({
            id: `s-${r.id}`,
            tipo: 'ns',
            ts: new Date(r.created_at),
            dataProducao: null,
            quemId: r.user_id ?? null,
            quem: uMap[r.user_id] || 'Sala Técnica',
            trecho: os?.trecho ?? null,
            bacia: os?.bacia ?? null,
            rede: null,
            ligacoes: null,
            ligComp: null,
            descricao: `N.S. ${os?.trecho || ''} liberada${os?.liberado_para ? ` para ${os.liberado_para}` : ''}`,
          });
        });

        const dentro = all.filter((e) => {
          const t = e.ts.getTime();
          return Number.isFinite(t) && t >= startMs && t <= endMs;
        });
        dentro.sort((a, b) => b.ts.getTime() - a.ts.getTime());

        if (!cancelled) {
          setEventos(dentro);
          setLoading(false);
        }
      } catch (err) {
        console.error('[HistoricoAtividades] falha ao buscar atividades', err);
        if (!cancelled) {
          setEventos([]);
          setError('Não foi possível carregar o histórico.');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [inicio, fim, ativo, tentativa]);

  return { eventos, loading, error, recarregar };
};

/* ------------------------------------------------------------------ *
 * Multisseleção com busca
 * ------------------------------------------------------------------ */

const MultiSelect = ({
  label,
  options,
  selected,
  onChange,
  buscavel = true,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
  buscavel?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const filtradas = useMemo(
    () => options.filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase())),
    [options, q],
  );
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-between gap-2 h-8 px-2.5 rounded-md border border-border bg-background hover:bg-muted/50 text-xs text-foreground transition-colors min-w-[150px]"
        >
          <span className="truncate">
            {label}
            {selected.length > 0 && <span className="ml-1 text-secondary font-semibold">({selected.length})</span>}
          </span>
          <ChevronDown size={13} className="text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[240px] p-0">
        {buscavel && (
          <div className="p-2 border-b border-border">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar…"
              className="h-8 text-xs"
            />
          </div>
        )}
        <div className="max-h-[220px] overflow-y-auto p-1">
          {filtradas.length === 0 ? (
            <p className="text-xs text-muted-foreground px-2 py-3 text-center">Nenhum resultado.</p>
          ) : (
            filtradas.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => toggle(o.value)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-muted text-left text-foreground"
              >
                <span
                  className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                    selected.includes(o.value) ? 'bg-secondary border-secondary' : 'border-border'
                  }`}
                >
                  {selected.includes(o.value) && <Check size={10} className="text-secondary-foreground" />}
                </span>
                <span className="truncate">{o.label}</span>
              </button>
            ))
          )}
        </div>
        {selected.length > 0 && (
          <div className="p-1 border-t border-border">
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full text-xs px-2 py-1.5 rounded hover:bg-muted text-muted-foreground"
            >
              Limpar seleção
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

const Chip = ({ texto, onRemove }: { texto: string; onRemove: () => void }) => (
  <span className="inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-full bg-secondary/10 border border-secondary/25 text-[11px] text-foreground">
    {texto}
    <button type="button" onClick={onRemove} className="p-0.5 rounded-full hover:bg-secondary/20" aria-label={`Remover filtro ${texto}`}>
      <X size={11} />
    </button>
  </span>
);

/* ------------------------------------------------------------------ *
 * Item de evento
 * ------------------------------------------------------------------ */

const EventoItem = ({ e }: { e: HistoricoEvento }) => {
  const meta = TIPO_META[e.tipo];
  const Icon = meta.Icon;
  const retroativa = !!e.dataProducao && e.dataProducao !== diaLocal(e.ts);

  return (
    <li
      className="rounded-md border border-border bg-card hover:bg-muted/30 transition-colors p-2.5"
      style={{ borderLeft: `3px solid ${meta.color}` }}
    >
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <span
          className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide"
          style={{ color: meta.color, backgroundColor: meta.bg }}
        >
          <Icon size={11} />
          {meta.label}
        </span>
        <span className="text-[11px] text-foreground font-medium">Lançado em: {fmtLancamento(e.ts)}</span>
        <span className="text-[10px] text-muted-foreground">({fmtRelativo(e.ts)})</span>
        {retroativa && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide bg-amber-100 text-amber-800 border border-amber-300">
            Produção retroativa
          </span>
        )}
      </div>

      {e.dataProducao && (
        <div className={`text-[11px] mb-1 ${retroativa ? 'font-semibold text-amber-700' : 'text-muted-foreground'}`}>
          Produção referente a: {fmtDateBR(e.dataProducao)}
        </div>
      )}

      <div className="text-xs text-foreground">
        <span className="font-semibold">{e.quem}</span>{' '}
        <span className="text-muted-foreground">— {e.descricao}</span>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10.5px] text-muted-foreground">
        {e.trecho && <span>Trecho/N.S.: <span className="text-foreground">{e.trecho}</span></span>}
        {e.bacia && <span>Bacia: <span className="text-foreground">{e.bacia}</span></span>}
        {e.rede != null && e.rede > 0 && <span>Rede: <span className="text-foreground">{num(e.rede)} m</span></span>}
        {e.ligacoes != null && e.ligacoes > 0 && <span>Ligações: <span className="text-foreground">{e.ligacoes} un.</span></span>}
        {e.ligComp != null && e.ligComp > 0 && <span>Ext. ligações: <span className="text-foreground">{num(e.ligComp)} m</span></span>}
      </div>
    </li>
  );
};

/* ------------------------------------------------------------------ *
 * Modal
 * ------------------------------------------------------------------ */

const PAGINA = 40;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Período vindo do card, usado como estado inicial. */
  inicioInicial: string;
  fimInicial: string;
  minDate?: string;
}

export const HistoricoAtividadesModal = ({ open, onOpenChange, inicioInicial, fimInicial, minDate }: Props) => {
  const [inicio, setInicio] = useState(inicioInicial);
  const [fim, setFim] = useState(fimInicial);
  const [tipos, setTipos] = useState<HistoricoTipo[]>([]);
  const [usuarios, setUsuarios] = useState<string[]>([]);
  const [busca, setBusca] = useState('');
  const [visiveis, setVisiveis] = useState(PAGINA);

  // Ao abrir, herda o período atual do card.
  useEffect(() => {
    if (open) {
      setInicio(inicioInicial);
      setFim(fimInicial);
      setVisiveis(PAGINA);
    }
  }, [open, inicioInicial, fimInicial]);

  const { eventos, loading, error, recarregar } = useHistoricoAtividades(inicio, fim, open);

  const opcoesUsuarios = useMemo(() => {
    const map = new Map<string, string>();
    eventos.forEach((e) => {
      if (e.quemId) map.set(e.quemId, e.quem);
    });
    return Array.from(map, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [eventos]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return eventos.filter((e) => {
      if (tipos.length && !tipos.includes(e.tipo)) return false;
      if (usuarios.length && (!e.quemId || !usuarios.includes(e.quemId))) return false;
      if (q) {
        const alvo = `${e.trecho ?? ''} ${e.bacia ?? ''} ${e.descricao}`.toLowerCase();
        if (!alvo.includes(q)) return false;
      }
      return true;
    });
  }, [eventos, tipos, usuarios, busca]);

  useEffect(() => setVisiveis(PAGINA), [tipos, usuarios, busca, inicio, fim]);

  const hoje = () => toISODate(new Date());
  const shift = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return toISODate(d);
  };
  const inicioMes = () => {
    const d = new Date();
    d.setDate(1);
    return toISODate(d);
  };

  const atalho = (label: string, i: string, f: string) => (
    <Button
      key={label}
      variant="outline"
      size="sm"
      className="h-7 px-2 text-[11px]"
      onClick={() => {
        setInicio(i);
        setFim(f);
      }}
    >
      {label}
    </Button>
  );

  const limparTudo = () => {
    setTipos([]);
    setUsuarios([]);
    setBusca('');
    setInicio(minDate || inicioInicial);
    setFim(hoje());
  };

  const temFiltro = tipos.length > 0 || usuarios.length > 0 || busca.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(1100px,96vw)] w-[96vw] sm:w-auto h-[90vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="text-base flex items-center gap-2">
            <History size={16} className="text-secondary" />
            Histórico de atividades
          </DialogTitle>
        </DialogHeader>

        {/* Filtros */}
        <div className="px-4 py-3 border-b border-border space-y-2 bg-muted/20">
          <div className="flex flex-wrap items-center gap-2">
            <PeriodoPicker
              inicio={inicio}
              fim={fim}
              minDate={minDate}
              ariaLabel="Selecionar período do histórico"
              onChange={(i, f) => {
                setInicio(i);
                setFim(f);
              }}
            />
            {atalho('Hoje', hoje(), hoje())}
            {atalho('Ontem', shift(1), shift(1))}
            {atalho('Últimos 7 dias', shift(6), hoje())}
            {atalho('Este mês', inicioMes(), hoje())}
            {atalho('Limpar período', minDate || inicioInicial, hoje())}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <MultiSelect
              label="Encarregado/usuário"
              options={opcoesUsuarios}
              selected={usuarios}
              onChange={setUsuarios}
            />
            <MultiSelect
              label="Tipo de evento"
              buscavel={false}
              options={TIPOS.map((t) => ({ value: t, label: TIPO_META[t].label }))}
              selected={tipos}
              onChange={(v) => setTipos(v as HistoricoTipo[])}
            />
            <div className="relative flex-1 min-w-[180px]">
              <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar trecho ou N.S. (ex.: TR-11.37)"
                className="h-8 pl-7 text-xs"
              />
            </div>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={limparTudo}>
              Limpar filtros
            </Button>
          </div>

          {temFiltro && (
            <div className="flex flex-wrap items-center gap-1.5">
              {usuarios.map((u) => (
                <Chip
                  key={u}
                  texto={opcoesUsuarios.find((o) => o.value === u)?.label || 'Usuário'}
                  onRemove={() => setUsuarios(usuarios.filter((x) => x !== u))}
                />
              ))}
              {tipos.map((t) => (
                <Chip key={t} texto={TIPO_META[t].label} onRemove={() => setTipos(tipos.filter((x) => x !== t))} />
              ))}
              {busca.trim() && <Chip texto={`"${busca.trim()}"`} onRemove={() => setBusca('')} />}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            {loading
              ? 'Carregando…'
              : `${filtrados.length} ${filtrados.length === 1 ? 'evento encontrado' : 'eventos encontrados'} • período ${fmtDateBR(inicio)} — ${fmtDateBR(fim)}`}
            {!loading && filtrados.length !== eventos.length && ` (de ${eventos.length} no período)`}
          </p>
        </div>

        {/* Lista */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
              <Loader2 className="animate-spin mr-2" size={14} /> Carregando…
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-xs text-muted-foreground">
              <span>{error}</span>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={recarregar}>
                Tentar novamente
              </Button>
            </div>
          ) : filtrados.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground text-center px-6">
              Nenhum evento encontrado com os filtros aplicados neste período.
            </div>
          ) : (
            <>
              <ul className="space-y-2">
                {filtrados.slice(0, visiveis).map((e) => (
                  <EventoItem key={e.id} e={e} />
                ))}
              </ul>
              {visiveis < filtrados.length && (
                <div className="flex justify-center py-3">
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setVisiveis((v) => v + PAGINA)}>
                    Carregar mais ({filtrados.length - visiveis} restantes)
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
