import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { ROLE_LABELS } from '@/types/sanegest';
import { useOrdensServico } from '@/hooks/useOrdensServico';
import { Loader2 } from 'lucide-react';
import DashboardEncarregadoPage from './DashboardEncarregadoPage';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { DashboardCompact } from '@/components/dashboard/DashboardCompact';

const OBRA_NOME = 'SES Japaratinga';

const DashboardPage = () => {
  const { effectiveRole } = useAuth();
  const { ordens, loading } = useOrdensServico();

  const { data: divergencias = [] } = useQuery({
    queryKey: ['divergencias-abertas'],
    queryFn: async () => {
      const { data } = await supabase
        .from('materiais_entrega')
        .select('id, os_id')
        .eq('divergencia', true);
      return data ?? [];
    },
  });

  if (effectiveRole === 'encarregado') {
    return <DashboardEncarregadoPage />;
  }
  if (effectiveRole === 'almoxarifado') {
    return <Navigate to="/materiais" replace />;
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-muted-foreground" size={32} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground leading-tight">Dashboard</h1>
          <p className="text-muted-foreground text-xs">{OBRA_NOME} • {effectiveRole && ROLE_LABELS[effectiveRole]}</p>
        </div>
      </div>

      <DashboardCompact ordens={ordens} divergenciasCount={divergencias.length} />
    </AppLayout>
  );
};

export default DashboardPage;
