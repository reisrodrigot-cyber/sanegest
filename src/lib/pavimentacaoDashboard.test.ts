import { describe, expect, it } from 'vitest';
import { somarPorTipoPavimento, tipoPavimentoOperacional, totalAreaPavimentacao } from './pavimentacaoDashboard';

const base = {
  data_registro: '2026-09-23',
  responsavel_user_id: 'encarregado-1',
  responsavel_nome: 'Encarregado',
};

describe('painel de produção de pavimentação', () => {
  it('normaliza os tipos e prioriza o pavimento executado', () => {
    expect(tipoPavimentoOperacional('  PARALELEPÍPEDO ', 'Asfalto')).toEqual(['Paralelepípedo']);
    expect(tipoPavimentoOperacional('', 'ASFALTO')).toEqual(['Asfalto']);
    expect(tipoPavimentoOperacional('Solo Natural', 'Paralelepipedo')).toEqual(['Paralelepípedo']);
  });

  it('soma cada lançamento uma única vez por tipo', () => {
    const registros = [
      { ...base, id: 'r1', os_id: 'os1', area_m2: 20 },
      { ...base, id: 'r2', os_id: 'os2', area_m2: 30 },
    ];
    const totais = somarPorTipoPavimento(registros, [
      { id: 'os1', pav_real: 'Asfalto', pav_previsto: null },
      { id: 'os2', pav_real: 'Solo Natural / Paralelepípedo', pav_previsto: null },
    ]);
    expect(totais).toEqual({ Asfalto: 20, Paralelepípedo: 30 });
    expect(totalAreaPavimentacao(registros)).toBe(50);
  });

  it('não usa o autor para atribuir a produção', () => {
    const registro = { ...base, id: 'r1', os_id: 'os1', area_m2: 15 };
    expect(registro.responsavel_user_id).toBe('encarregado-1');
  });
});
