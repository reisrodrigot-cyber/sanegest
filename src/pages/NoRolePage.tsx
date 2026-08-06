import { useAuth } from '@/contexts/AuthContext';
import { LogOut, Clock } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';

const NoRolePage = () => {
  const { logout, supabaseUser } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary p-4">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-foreground/10 mb-4">
          <Droplets size={36} className="text-primary-foreground" />
        </div>
        <h1 className="text-3xl font-bold text-primary-foreground mb-2">SaneGest</h1>

        <div className="bg-card rounded-xl shadow-xl p-6 mt-6">
          <Clock size={40} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold text-card-foreground mb-2">Aguardando Aprovação</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Sua conta foi criada com sucesso ({supabaseUser?.email}), mas ainda não possui um perfil de acesso atribuído.
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Entre em contato com a Sala Técnica para que seu perfil seja configurado.
          </p>
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-foreground text-sm hover:bg-muted transition-colors"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </div>
    </div>
  );
};

export default NoRolePage;
