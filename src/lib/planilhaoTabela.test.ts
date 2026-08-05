import { describe, expect, it } from 'vitest';
import {
  aplicarFiltros,
  calcularTotais,
  cellText,
  consolidarLinhas,
  COLUMN_BY_ID,
  ordenar,
  type OrdemRaw,
  type ProducaoRaw,
} from '@/lib/planilhaoTabela';

const os = (o: Partial<OrdemRaw> & { id: string }): OrdemRaw => ({
  trecho: 'T1', bacia: 'SEDE SS-01', pv_montante: null, pv_jusante: null,
  status: 'VERMELHO', comprimento_previsto: 100, dn: null, prof_media_prevista: null,
  largura_vala: null, pav_previsto: null, ligacoes_previstas: null, prazo_previsto: null,
  liberado: true, liberado_para: null, executor_real: null, executor: null, ...o,
});

const prod = (p: Partial<ProducaoRaw> & { os_id: string }): ProducaoRaw => ({
  data_producao: '2026-08-01', responsavel_nome: 'João', comprimento_trecho_executado: 10,
  quantidade_ligacoes_realizadas: 0, comprimento_total_ligacoes: 0, pv_final_assentado: false, ...p,
});

describe('consolidarLinhas', () => {
  it('gera uma única linha por Bacia + Trecho mesmo com vários lançamentos e O.S.', () => {
    const rows = consolidarLinhas(
      [os({ id: 'a' }), os({ id: 'b' })],
      [prod({ os_id: 'a' }), prod({ os_id: 'a', data_producao: '2026-08-02' }), prod({ os_id: 'b' })],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].osIds).toEqual(['a', 'b']);
    expect(rows[0].real_m).toBe(30);
    expect(rows[0].previsto_m).toBe(200);
    expect(rows[0].saldo_m).toBe(170);
  });

  it('trecho sem execução: Real nulo (— na grade) e saldo igual ao previsto', () => {
    const rows = consolidarLinhas([os({ id: 'a' })], []);
    expect(rows[0].real_m).toBeNull();
    expect(cellText(rows[0], COLUMN_BY_ID.real_m)).toBe('—');
    expect(rows[0].saldo_m).toBe(100);
    expect(calcularTotais(rows, ['real_m']).real_m).toBe(0);
  });

  it('lista vários encarregados sem repetição e período completo', () => {
    const rows = consolidarLinhas(
      [os({ id: 'a' })],
      [
        prod({ os_id: 'a', responsavel_nome: 'João', data_producao: '2026-07-10' }),
        prod({ os_id: 'a', responsavel_nome: 'Maria', data_producao: '2026-08-02' }),
        prod({ os_id: 'a', responsavel_nome: 'João', data_producao: '2026-07-20' }),
      ],
    );
    expect(rows[0].encarregados).toBe('João, Maria');
    expect(rows[0].periodo).toBe('10/07/2026 – 02/08/2026');
    expect(rows[0].dias_producao).toBe(3);
  });

  it('saldo é sempre previsto − executado, mesmo com PV final assentado', () => {
    const rows = consolidarLinhas(
      [os({ id: 'a', comprimento_previsto: 100 })],
      [
        prod({ os_id: 'a', comprimento_trecho_executado: 40, comprimento_total_ligacoes: 12 }),
        prod({ os_id: 'a', comprimento_trecho_executado: 20, comprimento_total_ligacoes: 30, pv_final_assentado: true }),
      ],
    );
    expect(rows[0].real_m).toBe(60);
    expect(rows[0].saldo_m).toBe(40);
    expect(rows[0].ligacoes_comprimento_m).toBe(30);
  });

  it('saldo negativo é preservado e o total bate com previsto − real', () => {
    const rows = consolidarLinhas(
      [os({ id: 'a', comprimento_previsto: 100 }), os({ id: 'b', bacia: 'POV. SS-08', comprimento_previsto: 50 })],
      [prod({ os_id: 'a', comprimento_trecho_executado: 142.36 })],
    );
    const excedido = rows.find(r => r.bacia === 'SEDE SS-01')!;
    expect(excedido.saldo_m).toBeCloseTo(-42.36, 6);
    const t = calcularTotais(rows, ['previsto_m', 'real_m', 'saldo_m']);
    expect(t.saldo_m).toBeCloseTo(t.previsto_m - t.real_m, 6);
  });

  it('ordena por bacia e depois trecho', () => {
    const rows = consolidarLinhas(
      [os({ id: 'a', bacia: 'SEDE SS-02', trecho: '1.10' }), os({ id: 'b', bacia: 'SEDE SS-01', trecho: '1.2' }), os({ id: 'c', bacia: 'SEDE SS-02', trecho: '1.2' })],
      [],
    );
    expect(rows.map(r => `${r.bacia}/${r.trecho}`)).toEqual(['SEDE SS-01/1.2', 'SEDE SS-02/1.2', 'SEDE SS-02/1.10']);
  });
});

describe('filtros e ordenação', () => {
  const rows = consolidarLinhas(
    [os({ id: 'a', trecho: '1.1' }), os({ id: 'b', trecho: '2.1', bacia: 'POV. SS-08', comprimento_previsto: 50 })],
    [prod({ os_id: 'a' })],
  );

  it('filtra por coluna e por busca global nas colunas visíveis', () => {
    expect(aplicarFiltros(rows, { bacia: 'pov' }, '', ['bacia']).map(r => r.trecho)).toEqual(['2.1']);
    expect(aplicarFiltros(rows, {}, '1.1', ['trecho']).map(r => r.trecho)).toEqual(['1.1']);
  });

  it('ordena numericamente e recalcula totais só do que está filtrado', () => {
    const desc = ordenar(rows, { id: 'previsto_m', dir: 'desc' });
    expect(desc[0].previsto_m).toBe(100);
    const filtrado = aplicarFiltros(rows, { bacia: 'pov' }, '', ['bacia']);
    expect(calcularTotais(filtrado, ['previsto_m']).previsto_m).toBe(50);
  });
});
