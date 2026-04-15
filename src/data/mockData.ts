import { UserRole } from '@/types/sanegest';

export const MOCK_USERS = [
  { id: '1', nome: 'Carlos Diretor', email: 'gerencia@sanegest.com', role: 'gerencia' as UserRole },
  { id: '2', nome: 'Ana Técnica', email: 'tecnica@sanegest.com', role: 'sala_tecnica' as UserRole },
  { id: '3', nome: 'João Almoxarife', email: 'almox@sanegest.com', role: 'almoxarifado' as UserRole },
  { id: '4', nome: 'Pedro Encarregado', email: 'encarregado@sanegest.com', role: 'encarregado' as UserRole },
  { id: '5', nome: 'Maria Topógrafa', email: 'topografo@sanegest.com', role: 'topografo' as UserRole },
];

export const OBRA_NOME = 'SES Japaratinga';
