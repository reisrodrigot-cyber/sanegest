import { describe, it, expect } from 'vitest';
import { permissions } from './permissions';

describe('liberação de pavimentação', () => {
  it('permite somente Sala Técnica', () => {
    expect(permissions.canLiberarPavimentacao('sala_tecnica')).toBe(true);
    for (const role of ['admin', 'encarregado_pavimentacao', 'encarregado', 'gerencia', 'topografo', 'almoxarifado'] as const) {
      expect(permissions.canLiberarPavimentacao(role)).toBe(false);
    }
  });
});