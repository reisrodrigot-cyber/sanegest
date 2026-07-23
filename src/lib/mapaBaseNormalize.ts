// Normalização de rótulos e utilitários da base geográfica (Fase 1 — SS-08)
//
// REGRA CRÍTICA: a normalização NÃO pode ser destrutiva. Nunca remover dígitos.
// TR-8.40 permanece TR-8.40 (não vira TR-8.4). Só uppercase + trim + colapso
// de espaços internos. O rótulo original (rotulo_original) é imutável.

export function normalizarRotulo(raw: unknown): string {
  if (raw == null) return '';
  return String(raw).trim().toUpperCase().replace(/\s+/g, ' ');
}

export type TipoNo = 'PV' | 'TL' | 'TQ' | 'OUTRO';

export function classificarTipoNo(rotulo: string): TipoNo {
  const r = normalizarRotulo(rotulo);
  if (/^PV[\s\-]/.test(r) || /^PV$/.test(r)) return 'PV';
  if (/^TL[\s\-]/.test(r) || /^TL$/.test(r)) return 'TL';
  if (/^TQ[\s\-]/.test(r) || /^TQ$/.test(r)) return 'TQ';
  return 'OUTRO';
}

// Casos conhecidos da SS-08 que devem entrar como pendência (sem vínculo automático).
export const PENDENCIAS_CONHECIDAS_SS08 = [
  { rotulo: 'TR-8.4',        motivo: 'Colisão de rótulo com TR-8.40 — revisar cadastro' },
  { rotulo: 'TR-8.40',       motivo: 'Colisão de rótulo com TR-8.4 — revisar cadastro' },
  { rotulo: 'TR-8.42',       motivo: 'Trecho sem N.S. correspondente' },
  { rotulo: 'TR-8.18 1-A',   motivo: 'N.S. sem geometria própria' },
  { rotulo: 'LINHA DE RECALQUE', motivo: 'Sem geometria — importar separadamente' },
  { rotulo: 'TQ-8.19', motivo: 'TQ sem linha correspondente' },
  { rotulo: 'TQ-8.20', motivo: 'TQ sem linha correspondente' },
  { rotulo: 'TQ-8.23', motivo: 'TQ sem linha correspondente' },
  { rotulo: 'TQ-8.40', motivo: 'TQ sem linha correspondente' },
  { rotulo: 'TQ-8.41', motivo: 'TQ sem linha correspondente' },
];

export const PENDENCIA_CHAVES = new Set(
  PENDENCIAS_CONHECIDAS_SS08.map((p) => normalizarRotulo(p.rotulo))
);

export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function bboxFromCoords(coords: Array<[number, number]>): {
  min_lon: number; min_lat: number; max_lon: number; max_lat: number;
} | null {
  if (!coords.length) return null;
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  for (const [lon, lat] of coords) {
    if (lon < minLon) minLon = lon;
    if (lat < minLat) minLat = lat;
    if (lon > maxLon) maxLon = lon;
    if (lat > maxLat) maxLat = lat;
  }
  return { min_lon: minLon, min_lat: minLat, max_lon: maxLon, max_lat: maxLat };
}
