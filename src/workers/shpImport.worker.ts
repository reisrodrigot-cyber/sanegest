/// <reference lib="webworker" />
// Web Worker: recebe um ArrayBuffer de um ZIP shapefile e devolve
// FeatureCollections normalizadas (GeoJSON WGS84 [lon,lat]).
//
// Fase 1 SS-08: reconhece a camada LINESTRING da REDE e a camada POINT dos PVs.
// shpjs faz reprojeção automática usando o `.prj` do arquivo. Como fallback,
// registramos EPSG:31985 (SIRGAS 2000 UTM 25S) para checagem posterior.

import shp from 'shpjs';
import proj4 from 'proj4';

proj4.defs(
  'EPSG:31985',
  '+proj=utm +zone=25 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'
);

export type ImportPayloadCamada = {
  nome_camada: string;
  tipo: 'LINESTRING' | 'POINT';
  campos: string[];
  features: GeoJSON.Feature[];
};

export type ImportPayload = {
  ok: true;
  camadas: ImportPayloadCamada[];
  bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  total: number;
};

export type ImportError = { ok: false; error: string };

function detectTipo(features: GeoJSON.Feature[]): 'LINESTRING' | 'POINT' | 'OUTRO' {
  const first = features.find((f) => f.geometry);
  const t = first?.geometry?.type;
  if (t === 'LineString' || t === 'MultiLineString') return 'LINESTRING';
  if (t === 'Point' || t === 'MultiPoint') return 'POINT';
  return 'OUTRO';
}

function extractCoords(geom: GeoJSON.Geometry): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const push = (c: any) => {
    if (Array.isArray(c) && typeof c[0] === 'number') out.push([c[0], c[1]]);
  };
  const walk = (arr: any) => {
    if (!Array.isArray(arr)) return;
    if (typeof arr[0] === 'number') push(arr);
    else arr.forEach(walk);
  };
  walk((geom as any).coordinates);
  return out;
}

self.onmessage = async (evt: MessageEvent<{ buffer: ArrayBuffer }>) => {
  try {
    const { buffer } = evt.data;
    // shpjs aceita ArrayBuffer de um ZIP; retorna FC ou FC[]
    const parsed = await (shp as any)(buffer);
    const fcs: GeoJSON.FeatureCollection[] = Array.isArray(parsed) ? parsed : [parsed];

    const camadas: ImportPayloadCamada[] = [];
    let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;

    for (const fc of fcs) {
      const features = (fc.features ?? []).filter((f) => f && f.geometry);
      const tipo = detectTipo(features);
      if (tipo === 'OUTRO') continue;
      const nome_camada = (fc as any).fileName || (fc as any).name || 'camada';
      const campos = new Set<string>();
      for (const f of features) {
        for (const k of Object.keys(f.properties || {})) campos.add(k);
        for (const [lon, lat] of extractCoords(f.geometry!)) {
          if (Number.isFinite(lon) && Number.isFinite(lat)) {
            if (lon < minLon) minLon = lon;
            if (lat < minLat) minLat = lat;
            if (lon > maxLon) maxLon = lon;
            if (lat > maxLat) maxLat = lat;
          }
        }
      }
      camadas.push({ nome_camada, tipo, campos: [...campos], features });
    }

    // Sanity check: coordenadas devem estar em WGS84 após shpjs.
    if (
      !Number.isFinite(minLon) ||
      Math.abs(minLon) > 180 || Math.abs(maxLon) > 180 ||
      Math.abs(minLat) > 90  || Math.abs(maxLat) > 90
    ) {
      const err: ImportError = {
        ok: false,
        error: 'Coordenadas fora de WGS84 após parse. Verifique se o shapefile inclui o arquivo .prj.',
      };
      (self as any).postMessage(err);
      return;
    }

    const payload: ImportPayload = {
      ok: true,
      camadas,
      bbox: [minLon, minLat, maxLon, maxLat],
      total: camadas.reduce((s, c) => s + c.features.length, 0),
    };
    (self as any).postMessage(payload);
  } catch (err: any) {
    const out: ImportError = { ok: false, error: err?.message ?? String(err) };
    (self as any).postMessage(out);
  }
};

export {};
