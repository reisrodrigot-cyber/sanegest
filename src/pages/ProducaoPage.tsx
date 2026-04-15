import { AppLayout } from '@/components/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrdensServico } from '@/hooks/useOrdensServico';
import { Loader2 } from 'lucide-react';

const ProducaoPage = () => {
  const { user } = useAuth();
  const { ordens, loading } = useOrdensServico();
  const minhasOS = ordens.filter(os => os.status === 'VERMELHO');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-foreground mb-1">Registro de Produção</h1>
      <p className="text-sm text-muted-foreground mb-6">Preencha os dados reais das OS atribuídas a você</p>

      {minhasOS.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">
          Nenhuma OS vermelha disponível no momento.
        </div>
      ) : (
        <div className="space-y-3">
          {minhasOS.map(os => (
            <div key={os.id} className="bg-card rounded-xl border border-border shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-medium text-foreground">{os.trecho}</p>
                  <p className="text-xs text-muted-foreground">{os.bacia} • {os.comprimento_previsto}m previsto</p>
                </div>
                <StatusBadge status={os.status} size="sm" />
              </div>
              <button
                onClick={() => setSelectedId(selectedId === os.id ? null : os.id)}
                className="text-sm text-secondary hover:underline"
              >
                {selectedId === os.id ? 'Fechar' : 'Registrar Produção'}
              </button>

              {selectedId === os.id && (
                <div className="mt-4 pt-4 border-t border-border grid sm:grid-cols-2 gap-4">
                  {[
                    { label: 'Comprimento Real (m)', field: 'comprimento_real' },
                    { label: 'Prof. Média Real (m)', field: 'prof_media_real' },
                    { label: 'PAV Real', field: 'pav_real' },
                    { label: 'Largura PAV Real (m)', field: 'largura_pav_real' },
                    { label: 'PAV Real (m²)', field: 'pav_m2_real' },
                    { label: 'Ligações Real', field: 'ligacoes_real' },
                  ].map(f => (
                    <div key={f.field}>
                      <label className="block text-sm font-medium text-foreground mb-1">{f.label}</label>
                      <input className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm" />
                    </div>
                  ))}
                  <div className="sm:col-span-2 flex gap-3">
                    <button className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Salvar</button>
                    <button className="px-4 py-2 rounded-lg border border-destructive text-destructive text-sm font-medium">Sinalizar Divergência</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
};

export default ProducaoPage;
