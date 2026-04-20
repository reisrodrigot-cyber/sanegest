import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserRole } from '@/types/sanegest';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthUser {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
}

interface EffectiveUser {
  id: string;
  nome: string;
  role: UserRole;
}

interface AuthContextType {
  user: AuthUser | null;
  supabaseUser: User | null;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  signup: (email: string, password: string, displayName: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
  /** Admin: role being "viewed as" */
  viewAsRole: UserRole | null;
  setViewAsRole: (role: UserRole | null) => void;
  /** Admin: specific user being "viewed as" (within a role) */
  viewAsUserId: string | null;
  viewAsUserName: string | null;
  setViewAsUser: (params: { id: string; nome: string } | null) => void;
  /** Effective role (viewAs if set, otherwise real role) */
  effectiveRole: UserRole | undefined;
  /** Effective user — used for data filters. When admin simulates a user, returns that user's id+nome+role; otherwise the real user. */
  effectiveUser: EffectiveUser | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

async function fetchUserRole(userId: string): Promise<UserRole | null> {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();
  return (data?.role as UserRole) ?? null;
}

async function fetchProfile(userId: string): Promise<{ display_name: string | null; email: string | null } | null> {
  const { data } = await supabase
    .from('profiles')
    .select('display_name, email')
    .eq('user_id', userId)
    .maybeSingle();
  return data;
}

async function buildAuthUser(supaUser: User): Promise<AuthUser | null> {
  const [role, profile] = await Promise.all([
    fetchUserRole(supaUser.id),
    fetchProfile(supaUser.id),
  ]);

  if (!role) return null;

  return {
    id: supaUser.id,
    nome: profile?.display_name || supaUser.email?.split('@')[0] || 'Usuário',
    email: supaUser.email || '',
    role,
  };
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewAsRole, setViewAsRoleState] = useState<UserRole | null>(null);
  const [viewAsUserId, setViewAsUserId] = useState<string | null>(null);
  const [viewAsUserName, setViewAsUserName] = useState<string | null>(null);

  const setViewAsRole = (role: UserRole | null) => {
    setViewAsRoleState(role);
    // Always reset specific user when role changes
    setViewAsUserId(null);
    setViewAsUserName(null);
  };

  const setViewAsUser = (params: { id: string; nome: string } | null) => {
    if (!params) {
      setViewAsUserId(null);
      setViewAsUserName(null);
    } else {
      setViewAsUserId(params.id);
      setViewAsUserName(params.nome);
    }
  };

  const effectiveRole = user?.role === 'admin' && viewAsRole ? viewAsRole : user?.role;

  const effectiveUser: EffectiveUser | null = (() => {
    if (!user) return null;
    // Admin simulating a specific user
    if (user.role === 'admin' && viewAsRole && viewAsUserId && viewAsUserName) {
      return { id: viewAsUserId, nome: viewAsUserName, role: viewAsRole };
    }
    // Admin simulating only a role (no specific user) — keep admin identity but with simulated role
    if (user.role === 'admin' && viewAsRole) {
      return { id: user.id, nome: user.nome, role: viewAsRole };
    }
    return { id: user.id, nome: user.nome, role: user.role };
  })();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          setSupabaseUser(session.user);
          setTimeout(async () => {
            const authUser = await buildAuthUser(session.user);
            setUser(authUser);
            setLoading(false);
          }, 0);
        } else {
          setSupabaseUser(null);
          setUser(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setSupabaseUser(session.user);
        const authUser = await buildAuthUser(session.user);
        setUser(authUser);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<{ error?: string }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  };

  const signup = async (email: string, password: string, displayName: string): Promise<{ error?: string }> => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) return { error: error.message };
    return {};
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSupabaseUser(null);
    setViewAsRoleState(null);
    setViewAsUserId(null);
    setViewAsUserName(null);
  };

  return (
    <AuthContext.Provider value={{
      user, supabaseUser, login, signup, logout,
      isAuthenticated: !!user, loading,
      viewAsRole, setViewAsRole,
      viewAsUserId, viewAsUserName, setViewAsUser,
      effectiveRole, effectiveUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
