import { MOCK_OS } from '@/data/mockData';
import { AppLayout } from '@/components/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { useState } from 'react';

const TopografiaPage = () => {
  const amarelas = MOCK_OS.filter(os => os.status === 'AMARELO');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-foreground mb-1">Registro Topográfico</h1>
      <p className="text-sm text-muted-foreground mb-6">Registre as coordenadas as-built das OS validadas</p>

      <div className="space-y-3">
        {amarelas.map(os => (
          <div key={os.id} className="bg-card rounded-xl border border-border shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-medium text-foreground">{os.trecho}</p>
                <p className="text-xs text-muted-foreground">{os.bacia} • {os.comprimento_real}m executado</p>
              </div>
              <StatusBadge status={os.status} size="sm" />
            </div>
            <button
              onClick={() => setSelectedId(selectedId === os.id ? null : os.id)}
              className="text-sm text-secondary hover:underline"
            >
              {selectedId === os.id ? 'Fechar' : 'Registrar As-Built'}
            </button>

            {selectedId === os.id && (
              <div className="mt-4 pt-4 border-t border-border grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Latitude / N (UTM)</label>
                  <input className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm" placeholder="-9.0892" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Longitude / E (UTM)</label>
                  <input className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm" placeholder="-35.7174" />
                </div>
                <div className="sm:col-span-2">
                  <button className="px-4 py-2 rounded-lg bg-status-green text-primary-foreground text-sm font-medium">
                    Salvar e Concluir (Status → Verde)
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {amarelas.length === 0 && (
          <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">
            Nenhuma OS com status amarelo disponível.
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default TopografiaPage;
