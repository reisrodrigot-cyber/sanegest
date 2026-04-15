import { MOCK_OS } from '@/data/mockData';
import { AppLayout } from '@/components/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { useState } from 'react';

const MateriaisPage = () => {
  const pendentes = MOCK_OS.filter(os => os.status === 'VERMELHO');

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-foreground mb-1">Entrega de Materiais</h1>
      <p className="text-sm text-muted-foreground mb-6">Registre os materiais entregues para cada OS</p>

      <div className="space-y-3">
        {pendentes.map(os => (
          <div key={os.id} className="bg-card rounded-xl border border-border shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">{os.trecho}</p>
                <p className="text-xs text-muted-foreground">{os.bacia} • Areia: {os.areia} • Brita: {os.brita}</p>
              </div>
              <StatusBadge status={os.status} size="sm" />
            </div>
            <div className="mt-3 flex gap-2">
              <button className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Registrar Entrega</button>
            </div>
          </div>
        ))}
        {pendentes.length === 0 && (
          <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">
            Nenhuma OS pendente de entrega de materiais.
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default MateriaisPage;
