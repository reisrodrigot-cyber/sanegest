import { normalizarPav } from '@/lib/pavimentacao';

export interface PavimentoOS {
  id: string;
  pav_real: string | null;
  pav_previsto: string | null;
}

export interface ProducaoPavimento {
  id: string;
  os_id: string;
  data_registro: string;
  responsavel_user_id: string | null;
  responsavel_nome: string;
  area_m2: number;
}

export const tipoPavimentoOperacional = (
  pavReal: string | null | undefined,
  pavPrevisto: string | null | undefined,
): Array<'Asfalto' | 'Paralelepípedo'> => {
  const real = normalizarPav(pavReal);
  const previsto = normalizarPav(pavPrevisto);
  const realElegivel = real.includes('asfalto') || real.includes('paralelepipedo');
  const valor = realElegivel ? real : previsto;
  const tipos: Array<'Asfalto' | 'Paralelepípedo'> = [];
  if (valor.includes('asfalto')) tipos.push('Asfalto');
  if (valor.includes('paralelepipedo')) tipos.push('Paralelepípedo');
  return tipos;
};

export const somarPorTipoPavimento = (
  registros: ProducaoPavimento[],
  ordens: PavimentoOS[],
) => {
  const osPorId = new Map(ordens.map((os) => [os.id, os]));
  const totais = { Asfalto: 0, Paralelepípedo: 0 };

  registros.forEach((registro) => {
    const os = osPorId.get(registro.os_id);
    const tipos = tipoPavimentoOperacional(os?.pav_real, os?.pav_previsto);
    if (tipos.length === 0) return;
    const parcela = Number(registro.area_m2 || 0) / tipos.length;
    tipos.forEach((tipo) => { totais[tipo] += parcela; });
  });

  return totais;
};

export const totalAreaPavimentacao = (registros: ProducaoPavimento[]) =>
  registros.reduce((total, registro) => total + Number(registro.area_m2 || 0), 0);
