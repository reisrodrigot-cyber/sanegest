/**
 * Fonte única de cálculo do Avanço Físico (rede e ramais) por sub-bacia.
 *
 * Regras preservadas do DashboardCompact:
 *  - Rede executada: soma direta de `comprimento_trecho_executado` da view
 *    `relatorio_producao_diaria` (sem cap e sem dedup por O.S., pois a mesma
 *    N.S. produz em dias diferentes).
 *  - Ligações em metros: dedup por O.S. — para cada grupo (os_id, fallback
 *    trecho normalizado) considera-se apenas o MAIOR `comprimento_total_ligacoes`.
 *  - Ramais (unidades): soma direta de `quantidade_ligacoes_realizadas`.
 *  - Sub-bacia: `obra_nome` da view; fallback para a bacia da O.S.; caso
 *    contrário "Sem sub-bacia" (nunca atribuída a outra sub-bacia).
 *  - PV final assentado: marca a O.S. como concluída (não gera pendência).
 *  - Previsto: soma das N.S. vigentes da sub-bacia (ordens.comprimento_previsto
 *    e ordens.ligacoes_previstas). Nenhuma fonte manual/contratual.
 */

export const SEM_SUB_BACIA = 'Sem sub-bacia';

/**
 * Normalização pura da bacia. Remove acentos, uniformiza espaços/pontos e
 * caixa alta. NÃO remove sufixos: SS-13, SS-13A e SS-13B continuam distintos.
 */
export const normalizarBaciaChave = (bacia: string | null | undefined): string =>
  String(bacia ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[.\s]+/g, ' ')
    .trim();

/** Classificação POV / SEDE pelo prefixo normalizado da bacia. */
export const classificarPovSede = (bacia: string | null | undefined): 'POV' | 'SEDE' | null => {
  const n = normalizarBaciaChave(bacia);
  if (n.startsWith('POV')) return 'POV';
  if (n.startsWith('SEDE')) return 'SEDE';
  return null;
};

export const normalizarTrecho = (t: string | null | undefined): string =>
  String(t ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

export interface RelatorioLike {
  os_id: string | null;
  obra_nome: string | null;
  trecho: string | null;
  data_producao: string;
  comprimento_trecho_executado: number | null;
  quantidade_ligacoes_realizadas: number | null;
  comprimento_total_ligacoes: number | null;
  pv_final_assentado: boolean | null;
}

export interface OrdemLike {
  id: string;
  bacia: string | null;
  comprimento_previsto?: number | null;
  ligacoes_previstas?: number | null;
}

export interface Periodo {
  inicio?: string;
  fim?: string;
}

export interface RealizadoSubBacia {
  chave: string;
  exibicao: string;
  redeM: number;
  ligacoesM: number;
  ramaisUn: number;
}

/** Realizado por sub-bacia — rede (m), ligações (m) e ramais (un). */
export function calcularRealizadoPorSubBacia(
  relatorio: RelatorioLike[],
  ordens: OrdemLike[],
  periodo: Periodo = {},
): Map<string, RealizadoSubBacia> {
  const baciaPorOs = new Map<string, string>();
  ordens.forEach((o) => baciaPorOs.set(o.id, o.bacia || ''));

  const out = new Map<string, RealizadoSubBacia>();
  // Dedup de ligações em metros: chave grupo -> { chaveBacia, max }
  const ligGroups = new Map<string, { chave: string; exibicao: string; max: number }>();

  const dentroPeriodo = (d: string) => {
    if (!d) return false;
    if (periodo.inicio && d < periodo.inicio) return false;
    if (periodo.fim && d > periodo.fim) return false;
    return true;
  };

  const bucket = (exibicao: string) => {
    const chave = normalizarBaciaChave(exibicao) || normalizarBaciaChave(SEM_SUB_BACIA);
    let b = out.get(chave);
    if (!b) {
      b = { chave, exibicao, redeM: 0, ligacoesM: 0, ramaisUn: 0 };
      out.set(chave, b);
    }
    return b;
  };

  for (const row of relatorio) {
    const d = String(row.data_producao ?? '');
    if (!dentroPeriodo(d)) continue;

    const exibicao =
      String(row.obra_nome ?? '').trim() ||
      (row.os_id ? String(baciaPorOs.get(row.os_id) ?? '').trim() : '') ||
      SEM_SUB_BACIA;
    const chave = normalizarBaciaChave(exibicao);

    const rede = Number(row.comprimento_trecho_executado) || 0;
    const ramais = Number(row.quantidade_ligacoes_realizadas) || 0;
    if (rede !== 0) bucket(exibicao).redeM += rede;
    if (ramais !== 0) bucket(exibicao).ramaisUn += ramais;

    const nt = normalizarTrecho(row.trecho);
    const grupo = row.os_id ? `os:${row.os_id}` : nt ? `tr:${nt}` : null;
    const ligTot = Number(row.comprimento_total_ligacoes) || 0;
    if (grupo && ligTot > 0) {
      const g = ligGroups.get(grupo);
      if (!g || ligTot > g.max) ligGroups.set(grupo, { chave, exibicao, max: ligTot });
    }
  }

  ligGroups.forEach((g) => {
    bucket(g.exibicao).ligacoesM += g.max;
  });

  return out;
}

/** Percentual seguro: null quando previsto é zero/ausente. */
export const percentualSeguro = (realizado: number, previsto: number): number | null =>
  previsto > 0 ? Math.round((realizado / previsto) * 1000) / 10 : null;

export const saldo = (previsto: number, realizado: number): number =>
  Math.round((previsto - realizado) * 100) / 100;

export interface PrevistoSubBacia {
  chave: string;
  exibicao: string;
  redeM: number;
  ramaisUn: number;
  ns: number;
}

/** Previsto por sub-bacia — soma das N.S. vigentes (plano operacional). */
export function calcularPrevistoPorSubBacia(ordens: OrdemLike[]): Map<string, PrevistoSubBacia> {
  const out = new Map<string, PrevistoSubBacia>();
  ordens.forEach((o) => {
    const exibicao = String(o.bacia ?? '').trim() || SEM_SUB_BACIA;
    const chave = normalizarBaciaChave(exibicao);
    let b = out.get(chave);
    if (!b) {
      b = { chave, exibicao, redeM: 0, ramaisUn: 0, ns: 0 };
      out.set(chave, b);
    }
    b.redeM += Number(o.comprimento_previsto) || 0;
    b.ramaisUn += Number(o.ligacoes_previstas) || 0;
    b.ns += 1;
  });
  return out;
}

export interface LinhaAvanco {
  chave: string;
  exibicao: string;
  previsto: number;
  realizado: number;
  saldo: number;
  pct: number | null;
  /** Existe N.S. vigente com previsto > 0 nesta sub-bacia. */
  temPrevisto: boolean;
}

export interface AvancoConsolidado {
  rede: LinhaAvanco[];
  ramais: LinhaAvanco[];
  totais: {
    rede: { previsto: number; realizado: number; saldo: number; pct: number | null };
    ramais: { previsto: number; realizado: number; saldo: number; pct: number | null };
  };
  porClasse: Record<'POV' | 'SEDE', {
    redePrevisto: number; redeRealizado: number; redePct: number | null;
    ramaisPrevisto: number; ramaisRealizado: number; ramaisPct: number | null;
  }>;
}

/** Junta realizado (produção registrada) com previsto (N.S. vigentes). */
export function consolidarAvanco(
  realizado: Map<string, RealizadoSubBacia>,
  previstoMap: Map<string, PrevistoSubBacia>,
): AvancoConsolidado {
  const chaves = new Map<string, string>(); // chave -> exibição
  realizado.forEach((r, k) => chaves.set(k, r.exibicao));
  previstoMap.forEach((p, k) => {
    if (!chaves.has(k)) chaves.set(k, p.exibicao);
  });

  const rede: LinhaAvanco[] = [];
  const ramais: LinhaAvanco[] = [];
  const porClasse = {
    POV: { redePrevisto: 0, redeRealizado: 0, redePct: null as number | null, ramaisPrevisto: 0, ramaisRealizado: 0, ramaisPct: null as number | null },
    SEDE: { redePrevisto: 0, redeRealizado: 0, redePct: null as number | null, ramaisPrevisto: 0, ramaisRealizado: 0, ramaisPct: null as number | null },
  };

  Array.from(chaves.entries())
    .sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
    .forEach(([chave, exibicao]) => {
      const real = realizado.get(chave);
      const prev = previstoMap.get(chave);
      const redeReal = Math.round((real?.redeM ?? 0) * 100) / 100;
      const ramaisReal = real?.ramaisUn ?? 0;
      const redePrev = Math.round((prev?.redeM ?? 0) * 100) / 100;
      const ramaisPrev = Math.round(prev?.ramaisUn ?? 0);

      rede.push({
        chave, exibicao,
        previsto: redePrev,
        realizado: redeReal,
        saldo: saldo(redePrev, redeReal),
        pct: percentualSeguro(redeReal, redePrev),
        temPrevisto: redePrev > 0,
      });
      ramais.push({
        chave, exibicao,
        previsto: ramaisPrev,
        realizado: ramaisReal,
        saldo: ramaisPrev - ramaisReal,
        pct: percentualSeguro(ramaisReal, ramaisPrev),
        temPrevisto: ramaisPrev > 0,
      });

      const cls = classificarPovSede(exibicao);
      if (cls) {
        porClasse[cls].redePrevisto += redePrev;
        porClasse[cls].redeRealizado += redeReal;
        porClasse[cls].ramaisPrevisto += ramaisPrev;
        porClasse[cls].ramaisRealizado += ramaisReal;
      }
    });

  (['POV', 'SEDE'] as const).forEach((c) => {
    porClasse[c].redePct = percentualSeguro(porClasse[c].redeRealizado, porClasse[c].redePrevisto);
    porClasse[c].ramaisPct = percentualSeguro(porClasse[c].ramaisRealizado, porClasse[c].ramaisPrevisto);
  });

  const somar = (arr: LinhaAvanco[]) => {
    const previsto = arr.reduce((s, l) => s + l.previsto, 0);
    const realizadoT = arr.reduce((s, l) => s + l.realizado, 0);
    return {
      previsto: Math.round(previsto * 100) / 100,
      realizado: Math.round(realizadoT * 100) / 100,
      saldo: saldo(previsto, realizadoT),
      pct: percentualSeguro(realizadoT, previsto),
    };
  };

  return { rede, ramais, totais: { rede: somar(rede), ramais: somar(ramais) }, porClasse };
}
