import React, { createContext, useContext, useState, ReactNode } from 'react';
import { UserRole, ROLE_LABELS } from '@/types/sanegest';
import { MOCK_USERS } from '@/data/mockData';

interface AuthUser {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);

  const login = async (email: string, _password: string): Promise<boolean> => {
    const found = MOCK_USERS.find(u => u.email === email);
    if (found) {
      setUser(found);
      return true;
    }
    return false;
  };

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};
