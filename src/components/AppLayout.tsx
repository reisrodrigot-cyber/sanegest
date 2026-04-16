import { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_LABELS } from '@/types/sanegest';
import { Eye } from 'lucide-react';

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const { user, viewAsRole, effectiveRole } = useAuth();
  const showBanner = user?.role === 'admin' && viewAsRole;

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto bg-background">
        {showBanner && effectiveRole && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 text-amber-700 text-sm">
            <Eye size={16} className="shrink-0" />
            <span>Visualizando como: <strong>{ROLE_LABELS[effectiveRole]}</strong></span>
            <span className="text-xs text-amber-600/70 ml-1">— Suas ações reais permanecem de Admin</span>
          </div>
        )}
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};
