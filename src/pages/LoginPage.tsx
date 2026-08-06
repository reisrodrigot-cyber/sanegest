import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, X, Mail, ArrowLeft, MailWarning } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
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

  // Forgot password modal state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState('');

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
        const loginResult = await login(email, password);
        if (loginResult.error) {
          setMessage('Cadastro realizado. Faça login para continuar.');
          setIsSignup(false);
        }
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

  const openForgot = () => {
    setForgotEmail(email);
    setForgotSent(false);
    setForgotError('');
    setForgotOpen(true);
  };

  const closeForgot = () => {
    if (forgotLoading) return;
    setForgotOpen(false);
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');

    const trimmed = forgotEmail.trim();
    if (!emailRegex.test(trimmed)) {
      setForgotError('Informe um e-mail válido.');
      return;
    }

    setForgotLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      // Neutral response regardless of whether the email exists
      setForgotSent(true);
    } catch {
      // Show a technical error only for unexpected client-side failures,
      // without disclosing whether the email exists.
      setForgotError('Não foi possível enviar o link agora. Tente novamente em instantes.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center px-5 py-3 rounded-2xl bg-primary-foreground mb-4 shadow-lg">
            <BrandMark variant="full" size={36} />
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
              {!isSignup && (
                <div className="flex justify-end mt-2">
                  <button
                    type="button"
                    onClick={openForgot}
                    className="min-h-[44px] inline-flex items-center px-1 text-sm font-medium text-status-green hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  >
                    Esqueci minha senha
                  </button>
                </div>
              )}
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

      {forgotOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={closeForgot}
        >
          <div
            className="w-full max-w-md bg-card rounded-xl shadow-2xl p-6 relative"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeForgot}
              className="absolute top-3 right-3 p-2 rounded-lg text-muted-foreground hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Fechar"
              disabled={forgotLoading}
            >
              <X size={18} />
            </button>

            <div className="mb-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-3">
                <Mail size={22} className="text-primary" />
              </div>
              <h3 id="forgot-title" className="text-lg font-semibold text-card-foreground">
                Recuperar acesso
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Informe seu e-mail cadastrado. Enviaremos um link seguro para você criar uma nova senha.
              </p>
            </div>

            {forgotSent ? (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-status-green/10 border border-status-green/30 text-sm text-card-foreground">
                  Se houver uma conta vinculada a este e-mail, você receberá em instantes um link para redefinir sua senha.
                </div>
                <div
                  role="note"
                  className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/40 text-sm text-card-foreground"
                >
                  <MailWarning size={18} className="text-amber-500 shrink-0 mt-0.5" aria-hidden />
                  <div className="min-w-0">
                    <p className="font-medium text-card-foreground">Verifique seu e-mail</p>
                    <p className="text-muted-foreground mt-0.5">
                      Confira também a pasta Spam ou Lixo eletrônico. Se encontrar a mensagem lá, marque como “Não é spam” para receber os próximos e-mails corretamente.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => { setForgotSent(false); setForgotError(''); }}
                    className="w-full min-h-[44px] py-2.5 rounded-lg border border-border text-foreground font-medium hover:bg-muted"
                  >
                    Enviar para outro e-mail
                  </button>
                  <button
                    type="button"
                    onClick={closeForgot}
                    className="w-full min-h-[44px] py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 inline-flex items-center justify-center gap-2"
                  >
                    <ArrowLeft size={16} /> Voltar para entrar
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1">E-mail</label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="seu@email.com"
                    autoFocus
                    required
                  />
                </div>

                {forgotError && <p className="text-sm text-destructive">{forgotError}</p>}

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full min-h-[44px] py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {forgotLoading && <Loader2 size={16} className="animate-spin" />}
                  Enviar link de recuperação
                </button>

                <button
                  type="button"
                  onClick={closeForgot}
                  disabled={forgotLoading}
                  className="w-full min-h-[44px] py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={14} /> Voltar para entrar
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
