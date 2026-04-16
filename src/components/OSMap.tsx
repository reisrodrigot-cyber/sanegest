import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
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

const FitBounds = ({ markers }: { markers: OSMapMarker[] }) => {
  const map = useMap();
  useEffect(() => {
    if (markers.length > 0) {
      const bounds = markers.map(m => [m.latitude, m.longitude] as [number, number]);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }, [markers, map]);
  return null;
};

export const OSMap = () => {
  const [markers, setMarkers] = useState<OSMapMarker[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMarkers = async () => {
    // Join topografia_asbuilt with ordens_servico to get OS info + coordinates
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

    // Get unique OS IDs
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

    // Use the latest coordinate per OS
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

  useEffect(() => {
    fetchMarkers();

    // Realtime subscription on topografia_asbuilt
    const channel = supabase
      .channel('map-topografia')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'topografia_asbuilt' },
        () => {
          fetchMarkers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-6">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <MapPin size={18} className="text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Mapa das OS</h2>
      </div>
      <div className="relative" style={{ height: 400 }}>
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {markers.length > 0 && <FitBounds markers={markers} />}
          {markers.map((m) => (
            <CircleMarker
              key={m.os_id}
              center={[m.latitude, m.longitude]}
              radius={10}
              pathOptions={{
                fillColor: STATUS_COLORS[m.status],
                color: STATUS_COLORS[m.status],
                weight: 2,
                opacity: 1,
                fillOpacity: 0.7,
              }}
            >
              <Popup>
                <div className="text-sm space-y-1 min-w-[160px]">
                  <p className="font-bold">{m.trecho}</p>
                  <p>Bacia: {m.bacia}</p>
                  <p>Comprimento: {m.comprimento_previsto ?? '—'}m</p>
                  <p>
                    Status:{' '}
                    <span style={{ color: STATUS_COLORS[m.status], fontWeight: 600 }}>
                      {m.status}
                    </span>
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
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
