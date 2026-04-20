import { AppLayout } from '@/components/AppLayout';
import { MapaInterativo } from '@/components/mapa/MapaInterativo';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_LABELS } from '@/types/sanegest';

const MapaPage = () => {
  const { effectiveRole } = useAuth();
  // Encarregado e Topógrafo se beneficiam de ver a própria localização no mapa
  const showLocation = effectiveRole === 'encarregado' || effectiveRole === 'topografo';

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Mapa de Campo</h1>
        <p className="text-muted-foreground text-sm">
          Visualização da obra{effectiveRole ? ` • ${ROLE_LABELS[effectiveRole]}` : ''}
        </p>
      </div>
      <MapaInterativo showLocation={showLocation} />
    </AppLayout>
  );
};

export default MapaPage;
