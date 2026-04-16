import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Droplets, Loader2 } from 'lucide-react';
import { lovable } from '@/integrations/lovable/index';

const LoginPage = () => {
  const { login, signup } = useAuth();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (isSignup) {
      const result = await signup(email, password, displayName);
      if (result.error) {
        setError(result.error);
      } else {
        setMessage('Verifique seu e-mail para confirmar o cadastro.');
        setIsSignup(false);
      }
    } else {
      const result = await login(email, password);
      if (result.error) {
        setError(result.error);
      }
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setError('');
    const result = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError('Erro ao conectar com Google.');
    }
    if (result.redirected) return;
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
          <h2 className="text-xl font-semibold text-card-foreground mb-6">
            {isSignup ? 'Criar Conta' : 'Entrar'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">Nome</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Seu nome completo"
                  required
                />
              </div>
            )}
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
                minLength={6}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {message && <p className="text-sm text-status-green">{message}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {isSignup ? 'Cadastrar' : 'Entrar'}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center"><span className="bg-card px-3 text-xs text-muted-foreground">ou</span></div>
          </div>

          <button
            onClick={handleGoogle}
            className="w-full py-2.5 rounded-lg border border-border text-foreground font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Entrar com Google
          </button>

          <p className="text-center text-sm text-muted-foreground mt-4">
            {isSignup ? 'Já tem uma conta?' : 'Não tem conta?'}{' '}
            <button
              onClick={() => { setIsSignup(!isSignup); setError(''); setMessage(''); }}
              className="text-primary font-medium hover:underline"
            >
              {isSignup ? 'Entrar' : 'Cadastrar'}
            </button>
          </p>
        </div>

        <p className="text-center text-xs text-primary-foreground/40 mt-4">
          Após o cadastro, um administrador precisa atribuir seu perfil de acesso.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
