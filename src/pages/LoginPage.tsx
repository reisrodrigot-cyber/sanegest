import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Droplets } from 'lucide-react';
import { MOCK_USERS } from '@/data/mockData';
import { ROLE_LABELS } from '@/types/sanegest';

const LoginPage = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const ok = await login(email, password);
    if (!ok) setError('E-mail não encontrado. Tente um dos e-mails de demonstração.');
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-foreground/10 mb-4">
            <Droplets size={36} className="text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-primary-foreground">SaneGest</h1>
          <p className="text-primary-foreground/60 mt-1">Gestão de Obras de Saneamento</p>
        </div>

        <div className="bg-card rounded-xl shadow-xl p-6">
          <h2 className="text-xl font-semibold text-card-foreground mb-6">Entrar</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-1">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="seu@email.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-1">Senha</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="••••••••"
                required
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Contas de demonstração (use qualquer senha):</p>
            <div className="space-y-1">
              {MOCK_USERS.map(u => (
                <button
                  key={u.id}
                  onClick={() => { setEmail(u.email); setPassword('demo'); }}
                  className="block w-full text-left text-xs py-1 px-2 rounded hover:bg-muted transition-colors text-muted-foreground"
                >
                  <span className="font-medium text-foreground">{u.email}</span> — {ROLE_LABELS[u.role]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
