import { describe, it, expect } from 'vitest';
import { osIdsComPvAssentado, isPendenteTopografia, podeConcluirAsBuilt, statusVisualTopografia } from './topografiaFluxo';

describe('fluxo topográfico', () => {
  const rows = [
    { os_id: 'A', pv_final_assentado: false, excluido: false, status: 'ativo' }, // amarela sem PV
    { os_id: 'B', pv_final_assentado: true, excluido: false, status: 'ativo' },
    { os_id: 'B', pv_final_assentado: false, excluido: false, status: 'ativo' }, // posterior false não desfaz
    { os_id: 'C', pv_final_assentado: true, excluido: true, status: 'ativo' }, // excluído não conta
    { os_id: 'D', pv_final_assentado: true, excluido: false, status: 'cancelado' },
  ];
  const pv = osIdsComPvAssentado(rows);

  it('reconhece PV assentado apenas por registro ativo não excluído', () => {
    expect([...pv]).toEqual(['B']);
  });

  it('N.S. amarela sem PV final não é pendente; com PV final é, mesmo com legado amarelo', () => {
    expect(isPendenteTopografia({ id: 'A' }, pv, new Set())).toBe(false);
    expect(isPendenteTopografia({ id: 'B' }, pv, new Set())).toBe(true);
  });

  it('As Built concluído sai de Pendentes e fica azul', () => {
    const concl = new Set(['B']);
    expect(isPendenteTopografia({ id: 'B' }, pv, concl)).toBe(false);
    expect(statusVisualTopografia('B', 'AMARELO', pv, concl)).toBe('AZUL');
    expect(statusVisualTopografia('B', 'AMARELO', pv, new Set())).toBe('VERDE');
  });

  it('coordenada parcial não permite concluir', () => {
    expect(podeConcluirAsBuilt({ montanteComCoord: true, jusanteComCoord: false, ligacoesPendentes: 0 })).toBe(false);
    expect(podeConcluirAsBuilt({ montanteComCoord: true, jusanteComCoord: true, ligacoesPendentes: 1 })).toBe(false);
    expect(podeConcluirAsBuilt({ montanteComCoord: true, jusanteComCoord: true, ligacoesPendentes: 0 })).toBe(true);
  });
});
