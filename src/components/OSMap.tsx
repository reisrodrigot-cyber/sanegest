import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { supabase } from '@/integrations/supabase/client';
import { MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

interface OSMapMarker {
  os_id: string;
  trecho: string;
  bacia: string;
  comprimento_previsto: number | null;
  status: 'VERMELHO' | 'AMARELO' | 'VERDE';
  latitude: number;
  longitude: number;
}

const STATUS_COLORS: Record<string, string> = {
  VERMELHO: '#dc2626',
  AMARELO: '#ca8a04',
  VERDE: '#16a34a',
};

const DEFAULT_CENTER: [number, number] = [-9.1167, -35.2667];
const DEFAULT_ZOOM = 13;

export const OSMap = () => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const [markers, setMarkers] = useState<OSMapMarker[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMarkers = async () => {
    const { data: asbuiltData } = await supabase
      .from('topografia_asbuilt')
      .select('os_id, latitude, longitude')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (!asbuiltData || asbuiltData.length === 0) {
      setMarkers([]);
      setLoading(false);
      return;
    }

    const osIds = [...new Set(asbuiltData.map(r => r.os_id))];
    const { data: osData } = await supabase
      .from('ordens_servico')
      .select('id, trecho, bacia, comprimento_previsto, status')
      .in('id', osIds);

    if (!osData) {
      setMarkers([]);
      setLoading(false);
      return;
    }

    const osMap = new Map(osData.map(os => [os.id, os]));
    const latestByOs = new Map<string, { latitude: number; longitude: number }>();
    for (const row of asbuiltData) {
      if (row.latitude != null && row.longitude != null) {
        latestByOs.set(row.os_id, { latitude: row.latitude, longitude: row.longitude });
      }
    }

    const result: OSMapMarker[] = [];
    for (const [osId, coords] of latestByOs) {
      const os = osMap.get(osId);
      if (os) {
        result.push({
          os_id: osId,
          trecho: os.trecho,
          bacia: os.bacia,
          comprimento_previsto: os.comprimento_previsto,
          status: os.status,
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
      }
    }

    setMarkers(result);
    setLoading(false);
  };

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = L.map(containerRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Fetch data & subscribe
  useEffect(() => {
    fetchMarkers();
    const channel = supabase
      .channel('map-topografia')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'topografia_asbuilt' }, () => {
        fetchMarkers();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Update markers on map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    if (markers.length === 0) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      return;
    }

    const bounds = L.latLngBounds(markers.map(m => [m.latitude, m.longitude]));

    markers.forEach(m => {
      const color = STATUS_COLORS[m.status];
      const circle = L.circleMarker([m.latitude, m.longitude], {
        radius: 10,
        fillColor: color,
        color: color,
        weight: 2,
        opacity: 1,
        fillOpacity: 0.7,
      }).addTo(map);

      circle.bindPopup(`
        <div style="min-width:160px;font-size:13px;">
          <p style="font-weight:700;margin:0 0 4px">${m.trecho}</p>
          <p style="margin:2px 0">Bacia: ${m.bacia}</p>
          <p style="margin:2px 0">Comprimento: ${m.comprimento_previsto ?? '—'}m</p>
          <p style="margin:2px 0">Status: <span style="color:${color};font-weight:600">${m.status}</span></p>
        </div>
      `);

      markersRef.current.push(circle);
    });

    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }, [markers]);

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-6">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <MapPin size={18} className="text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Mapa das OS</h2>
      </div>
      <div className="relative" style={{ height: 400 }}>
        <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
        {!loading && markers.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]">
            <div className="bg-card/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-border text-sm text-muted-foreground">
              Nenhuma OS com coordenadas registradas ainda.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
