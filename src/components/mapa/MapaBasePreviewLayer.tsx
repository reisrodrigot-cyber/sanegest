import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { MapaTrechoPreview, MapaPontoPreview } from '@/hooks/useMapaBasePreview';
import { getStatusMeta, aggregateVinculosStatus, vinculoDisplayStatus, statusHex, statusLabel } from '@/lib/osStatus';


interface Props {
  map: L.Map | null;
  trechos: MapaTrechoPreview[];
  pontos: MapaPontoPreview[];
  visible: boolean;
}

function coordsFromGeom(g: any): Array<[number, number]> {
  if (!g) return [];
  if (g.type === 'LineString') return (g.coordinates as [number, number][]).map(([lon, lat]) => [lat, lon]);
  if (g.type === 'MultiLineString') {
    const out: Array<[number, number]> = [];
    for (const seg of g.coordinates as [number, number][][]) {
      for (const [lon, lat] of seg) out.push([lat, lon]);
    }
    return out;
  }
  return [];
}

function esc(s: any): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)
  );
}

/** Raio visual dos PVs por faixa de zoom. `null` = ocultar pontos individuais. */
function pvRadiusForZoom(zoom: number): number | null {
  if (zoom < 14) return null;   // zoom distante: esconder PVs
  if (zoom < 15) return 2;
  if (zoom < 16) return 2.5;
  if (zoom < 17) return 3;
  if (zoom < 18) return 3.5;
  return 4;                     // zoom próximo: tamanho atual
}

export const MapaBasePreviewLayer = ({ map, trechos, pontos, visible }: Props) => {
  const layerRef = useRef<L.LayerGroup | null>(null);
  const pvLayerRef = useRef<L.LayerGroup | null>(null);
  const pvMarkersRef = useRef<L.CircleMarker[]>([]);


  useEffect(() => {
    if (!map) return;
    const group = L.layerGroup();
    layerRef.current = group;
    return () => {
      try { if (map.hasLayer(group)) map.removeLayer(group); } catch {}
      layerRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const map0 = map; const group = layerRef.current;
    if (!map0 || !group) return;
    group.clearLayers();
    if (!visible) { if (map0.hasLayer(group)) map0.removeLayer(group); return; }
    if (!map0.hasLayer(group)) group.addTo(map0);

    // Trechos
    for (const t of trechos) {
      const latlngs = coordsFromGeom(t.geometry);
      if (latlngs.length < 2) continue;
      // Resolve primeiro o status operacional de CADA N.S. (PV assentado vence
      // o enum legado) e só então agrega pela precedência visual.
      const status = aggregateVinculosStatus(t.vinculos);
      const meta = getStatusMeta(status);
      const cor = meta.hex;
      const pvFinal = t.vinculos.some((v) => v.pv_final_assentado);
      const hasDivergencia = t.divergencias.length > 0 || (t.vinculos.length === 0);

      const vincHtml = t.vinculos.length
        ? t.vinculos.map((v) => {
            const d = vinculoDisplayStatus(v);
            return `
            <li style="margin:2px 0;">
              <b>${esc(v.trecho)}</b> <span style="color:#666">(${esc(v.bacia)})</span>
              — <span style="color:${statusHex(d)};font-weight:600">${esc(statusLabel(d))}</span>
              <span style="font-size:11px;color:#888"> · ${esc(v.origem)}</span>
            </li>`;
          }).join('')

        : '<li style="color:#a16207">Sem N.S. vinculada</li>';

      const divHtml = t.divergencias.map((d) =>
        `<div style="margin-top:4px;padding:4px 6px;background:#fef3c7;color:#92400e;border-radius:4px;font-size:11px;">
          ⚠ ${esc(d.tipo)}${d.detalhes?.motivo ? ` — ${esc(d.detalhes.motivo)}` : ''}
        </div>`).join('');

      const popupHtml = `
        <div style="min-width:220px;font-size:12px;">
          <div style="font-weight:700;font-size:13px;margin-bottom:4px;">${esc(t.rotulo_original)}</div>
          <div style="color:#666">SS-08 · ${t.l_escala != null ? `${Number(t.l_escala).toFixed(2)} m` : '—'} · DN ${t.dn ?? '—'} · ${esc(t.material ?? '—')}</div>
          <div style="color:#666;margin-bottom:6px">Nó: ${esc(t.no_inicial ?? '—')} → ${esc(t.no_final ?? '—')}</div>
          <div style="margin-bottom:2px;font-weight:600">N.S. vinculadas:</div>
          <ul style="margin:0;padding-left:16px;">${vincHtml}</ul>
          <div style="margin-top:6px">Status agregado: <b style="color:${cor}">${esc(meta.label)}</b></div>
          ${pvFinal ? `<div style="margin-top:4px;padding:4px 6px;background:#dbeafe;color:#1e40af;border-radius:4px;font-size:11px;">PV final assentado — pronto para Topografia</div>` : ''}
          ${divHtml}
          ${hasDivergencia ? '<div style="margin-top:4px;font-size:11px;color:#a16207">Requer revisão da Sala Técnica</div>' : ''}
        </div>`;

      const line = L.polyline(latlngs, {
        color: cor, weight: 4, opacity: 0.9,
        dashArray: hasDivergencia ? '6,4' : undefined,
      });
      line.bindPopup(popupHtml);
      line.addTo(group);
    }

    // Pontos
    for (const p of pontos) {
      if (p.lon == null || p.lat == null) continue;
      const cor = p.tipo_no === 'PV' ? '#0C447C' : p.tipo_no === 'TL' ? '#7c3aed' : p.tipo_no === 'TQ' ? '#dc2626' : '#525252';
      const marker = L.circleMarker([p.lat, p.lon], {
        radius: 4, color: '#fff', weight: 1.5,
        fillColor: cor, fillOpacity: 0.95,
      });
      marker.bindPopup(`
        <div style="min-width:160px;font-size:12px;">
          <div style="font-weight:700">${esc(p.rotulo_original)} <span style="color:#888;font-weight:400">(${esc(p.tipo_no)})</span></div>
          ${p.cota_marg != null ? `<div>Cota margem: ${p.cota_marg}</div>` : ''}
          ${p.cota_inv != null ? `<div>Cota inv.: ${p.cota_inv}</div>` : ''}
          ${p.prof != null ? `<div>Profundidade: ${p.prof} m</div>` : ''}
        </div>`);
      marker.addTo(group);
    }
  }, [map, trechos, pontos, visible]);

  return null;
};
