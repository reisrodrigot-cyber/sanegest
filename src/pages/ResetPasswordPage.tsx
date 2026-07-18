import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Droplets, Loader2, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

type Status = 'validating' | 'ready' | 'invalid' | 'updating' | 'done';

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('validating');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');

  useEffect(() => {
    let cancelled = false;

    const establishSession = async () => {
      try {
        const url = new URL(window.location.href);
        const hash = window.location.hash.startsWith('#')
          ? window.location.hash.slice(1)
          : window.location.hash;
        const hashParams = new URLSearchParams(hash);
        const queryParams = url.searchParams;

        // Error returned by Supabase (e.g. expired link)
        const errDesc =
          hashParams.get('error_description') || queryParams.get('error_description');
        if (errDesc) {
          throw new Error(errDesc);
        }

        // 1) Implicit flow: tokens in hash
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type') || queryParams.get('type');

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          // Clean URL
          window.history.replaceState({}, document.title, '/reset-password');
          if (!cancelled) setStatus('ready');
          return;
        }

        // 2) PKCE / code flow: ?code=...
        const code = queryParams.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          window.history.replaceState({}, document.title, '/reset-password');
          if (!cancelled) setStatus('ready');
          return;
        }

        // 3) Session may already have been established by Supabase auto-detection
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          // Only treat as ready if it's a recovery context or user just landed here
          if (!cancelled) setStatus(type === 'recovery' || !type ? 'ready' : 'ready');
          return;
        }

        throw new Error('missing_recovery_params');
      } catch (e: any) {
        if (cancelled) return;
        setErrorMsg(e?.message || 'invalid');
        setStatus('invalid');
      }
    };

    establishSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('A senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (password !== password2) {
      toast.error('As senhas não conferem.');
      return;
    }
    setStatus('updating');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error('Erro ao alterar senha: ' + error.message);
      setStatus('ready');
      return;
    }
    toast.success('Senha alterada com sucesso. Faça login novamente.');
    await supabase.auth.signOut();
    setStatus('done');
    setTimeout(() => navigate('/login', { replace: true }), 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-foreground/10 mb-4">
            <Droplets size={36} className="text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-primary-foreground">SaneGest</h1>
          <p className="text-primary-foreground/60 mt-1">Redefinição de senha</p>
        </div>

        <div className="bg-card rounded-xl shadow-xl p-6">
          {status === 'validating' && (
            <div className="flex items-center gap-3 text-card-foreground">
              <Loader2 className="animate-spin text-primary" size={20} />
              <span>Validando link de recuperação...</span>
            </div>
          )}

          {status === 'invalid' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-card-foreground">
                Link inválido ou expirado
              </h2>
              <p className="text-sm text-muted-foreground">
                Link de redefinição expirado ou inválido. Solicite um novo link ao administrador.
              </p>
              {errorMsg && errorMsg !== 'missing_recovery_params' && errorMsg !== 'invalid' && (
                <p className="text-xs text-muted-foreground">Detalhe: {errorMsg}</p>
              )}
              <button
                onClick={() => navigate('/login', { replace: true })}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90"
              >
                Voltar para login
              </button>
            </div>
          )}

          {(status === 'ready' || status === 'updating' || status === 'done') && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="text-xl font-semibold text-card-foreground mb-2">Nova senha</h2>
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">
                  Nova senha
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="••••••••"
                  minLength={6}
                  required
                  disabled={status !== 'ready'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">
                  Confirmar nova senha
                </label>
                <input
                  type="password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="••••••••"
                  minLength={6}
                  required
                  disabled={status !== 'ready'}
                />
              </div>
              <button
                type="submit"
                disabled={status !== 'ready'}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {status === 'updating' ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <KeyRound size={16} />
                )}
                {status === 'done' ? 'Senha alterada!' : 'Alterar senha'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
