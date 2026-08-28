import { UserRole } from '@/types/sanegest';

/**
 * Regras de permissão por perfil:
 * 
 * - admin: Acesso total sem restrições.
 * - sala_tecnica: Edita/exclui tudo. Único que exclui OS inteira.
 * - encarregado: Edita/exclui apenas campos REAL que ele preencheu.
 * - almoxarifado: Edita/exclui apenas registros de entrega que ele cadastrou.
 * - topografo: Edita/exclui apenas estacas que ele registrou.
 * - gerencia: Somente leitura.
 */

export const permissions = {
  /** Pode editar qualquer campo da OS */
  canEditOS(role: UserRole | undefined): boolean {
    return role === 'admin' || role === 'sala_tecnica';
  },

  /** Pode excluir a OS inteira */
  canDeleteOS(role: UserRole | undefined): boolean {
    return role === 'admin' || role === 'sala_tecnica';
  },

  /** Pode editar campos REAL de produção */
  canEditProducao(role: UserRole | undefined): boolean {
    return role === 'admin' || role === 'encarregado' || role === 'sala_tecnica';
  },

  /** Pode registrar/editar entregas de material */
  canEditMateriais(role: UserRole | undefined): boolean {
    return role === 'admin' || role === 'almoxarifado' || role === 'sala_tecnica';
  },

  /** Pode registrar/editar estacas topográficas */
  canEditTopografia(role: UserRole | undefined): boolean {
    return role === 'admin' || role === 'topografo' || role === 'sala_tecnica';
  },

  /** Pode liberar OS (mudar status) */
  canLiberarOS(role: UserRole | undefined): boolean {
    return role === 'admin' || role === 'sala_tecnica';
  },

  /** Pode importar planilhão */
  canImportar(role: UserRole | undefined): boolean {
    return role === 'admin' || role === 'sala_tecnica';
  },

  /** Pode gerenciar usuários */
  canManageUsers(role: UserRole | undefined): boolean {
    return role === 'admin';
  },

  /** Somente leitura */
  isReadOnly(role: UserRole | undefined): boolean {
    return role === 'gerencia';
  },

  /** É admin */
  isAdmin(role: UserRole | undefined): boolean {
    return role === 'admin';
  },

  /** Pode lançar produção de pavimentação */
  canEditPavimentacao(role: UserRole | undefined): boolean {
    return role === 'admin' || role === 'sala_tecnica' || role === 'encarregado_pavimentacao';
  },

  /** Pode liberar/retirar liberação de pavimentação */
  canLiberarPavimentacao(role: UserRole | undefined): boolean {
    return role === 'admin' || role === 'sala_tecnica';
  },
};
