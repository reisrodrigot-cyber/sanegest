import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { MapaTrechoPreview, MapaPontoPreview } from '@/hooks/useMapaBasePreview';
import { corProfundidadePV } from '@/lib/pvProfundidade';
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

/** Um mapa removido (`map.remove()`) perde `_container`/panes: adicionar layers nele quebra. */
function isMapAlive(map: L.Map | null): map is L.Map {
  if (!map) return false;
  try {
    return !!(map as any)._container && !!(map as any)._panes?.overlayPane && !!map.getPane('overlayPane');
  } catch {
    return false;
  }
}

/** Largura da área clicável invisível (não altera o traço visível). */
function hitWeight(): number {
  const coarse = typeof window !== 'undefined'
    && (window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < 768);
  return coarse ? 18 : 12;
}

/** Raio visual dos PVs por faixa de zoom. `null` = ocultar pontos individuais. */
function pvRadiusForZoom(zoom: number): number | null {
  if (zoom < 13) return null;   // zoom muito distante: esconder PVs
  if (zoom < 14) return 1.5;
  if (zoom < 15) return 2.5;
  if (zoom < 16) return 3.5;
  if (zoom < 17) return 4.5;
  if (zoom < 18) return 5.5;
  return 6.5;                   // zoom próximo: boa leitura
}

/** Raio de toque/clique: nunca menor que o mínimo confortável no celular. */
function pvHitRadius(r: number): number {
  const coarse = typeof window !== 'undefined'
    && (window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < 768);
  return Math.max(r, coarse ? 10 : 7);
}



export const MapaBasePreviewLayer = ({ map, trechos, pontos, visible }: Props) => {
  const layerRef = useRef<L.LayerGroup | null>(null);
  const pvLayerRef = useRef<L.LayerGroup | null>(null);
  const pvMarkersRef = useRef<L.CircleMarker[]>([]);
  const pvHitsRef = useRef<L.CircleMarker[]>([]);


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
    if (!isMapAlive(map0) || !group) return;

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

      const popupOpts: L.PopupOptions = { className: `sg-label-${meta.key.toLowerCase()}`, maxWidth: 280 };

      // Área clicável invisível (não altera cor, espessura ou geometria visível)
      const hit = L.polyline(latlngs, {
        color: cor, weight: hitWeight(), opacity: 0, fillOpacity: 0, interactive: true,
      });
      hit.bindPopup(popupHtml, popupOpts);
      hit.addTo(group);

      const line = L.polyline(latlngs, {
        color: cor, weight: 4, opacity: 0.9,
        dashArray: hasDivergencia ? '6,4' : undefined,
      });
      line.bindPopup(popupHtml, popupOpts);
      line.addTo(group);

    }

    // Pontos (em subgrupo próprio, controlado por zoom)
    const pvGroup = L.layerGroup();
    pvLayerRef.current = pvGroup;
    const markers: L.CircleMarker[] = [];
    const hitMarkers: L.CircleMarker[] = [];
    const zoom = map0.getZoom();
    const r = pvRadiusForZoom(zoom);

    for (const p of pontos) {
      if (p.lon == null || p.lat == null) continue;
      // Cor exclusivamente pela profundidade própria do PV
      const cor = corProfundidadePV(p.prof);
      const raio = r ?? 4;
      const hit = L.circleMarker([p.lat, p.lon], {
        radius: pvHitRadius(raio), opacity: 0, fillOpacity: 0, interactive: true,
      });
      const marker = L.circleMarker([p.lat, p.lon], {
        radius: raio, color: '#fff', weight: 1.5,
        fillColor: cor, fillOpacity: 0.95,
      });
      const popupPv = `
        <div style="min-width:160px;font-size:12px;">
          <div style="font-weight:700">${esc(p.rotulo_original)} <span style="color:#888;font-weight:400">(${esc(p.tipo_no)})</span></div>
          ${p.cota_marg != null ? `<div>Cota margem: ${p.cota_marg}</div>` : ''}
          ${p.cota_inv != null ? `<div>Cota inv.: ${p.cota_inv}</div>` : ''}
          <div>Profundidade: ${p.prof != null ? `${p.prof} m` : 'não cadastrada'}</div>
        </div>`;
      marker.bindPopup(popupPv);
      hit.bindPopup(popupPv);
      hit.addTo(pvGroup);
      marker.addTo(pvGroup);
      markers.push(marker);
      hitMarkers.push(hit);
    }
    pvMarkersRef.current = markers;
    pvHitsRef.current = hitMarkers;
    if (r != null) pvGroup.addTo(group);
  }, [map, trechos, pontos, visible]);

  // Ajuste visual dos PVs conforme o zoom (sem recarregar camadas/dados)
  useEffect(() => {
    const map0 = map;
    if (!isMapAlive(map0)) return;
    const apply = () => {
      const group = layerRef.current;
      const pvGroup = pvLayerRef.current;
      if (!group || !pvGroup || !isMapAlive(map0)) return;
      const r = pvRadiusForZoom(map0.getZoom());

      if (r == null) {
        if (group.hasLayer(pvGroup)) group.removeLayer(pvGroup);
        return;
      }
      for (const m of pvMarkersRef.current) m.setRadius(r);
      for (const h of pvHitsRef.current) h.setRadius(pvHitRadius(r));
      if (!group.hasLayer(pvGroup)) pvGroup.addTo(group);
    };
    map0.on('zoomend', apply);
    apply();
    return () => { map0.off('zoomend', apply); };
  }, [map, pontos, visible]);

  return null;
};

