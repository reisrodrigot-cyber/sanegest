import { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_LABELS } from '@/types/sanegest';
import { Eye, X } from 'lucide-react';

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const { user, viewAsRole, setViewAsRole, effectiveRole } = useAuth();
  const showBanner = user?.role === 'admin' && viewAsRole;

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto bg-background">
        {showBanner && effectiveRole && (
          <div className="flex items-center justify-between px-4 py-2 bg-amber-500/15 border-b border-amber-500/30">
            <div className="flex items-center gap-2 text-sm text-amber-700">
              <Eye size={16} className="shrink-0" />
              <span>
                Modo visualização: <strong>{ROLE_LABELS[effectiveRole]}</strong>
                <span className="text-amber-600/70 ml-1">— você está simulando este perfil</span>
              </span>
            </div>
            <button
              onClick={() => setViewAsRole(null)}
              className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 transition-colors"
            >
              <X size={14} />
              Sair da simulação
            </button>
          </div>
        )}
        <div className="p-4 pl-16 lg:p-8 lg:pl-8">
          {children}
        </div>
      </main>
    </div>
  );
};
