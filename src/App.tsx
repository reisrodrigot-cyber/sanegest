import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { UserRole } from "@/types/sanegest";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import LoginPage from "./pages/LoginPage";
import NoRolePage from "./pages/NoRolePage";
import DashboardPage from "./pages/DashboardPage";
import OrdensPage from "./pages/OrdensPage";
import OSDetailPage from "./pages/OSDetailPage";
import ImportarPage from "./pages/ImportarPage";
import ImportHistoricoPage from "./pages/ImportHistoricoPage";
import ProducaoPage from "./pages/ProducaoPage";
import MateriaisPage from "./pages/MateriaisPage";
import TopografiaPage from "./pages/TopografiaPage";
import MeuPerfilPage from "./pages/MeuPerfilPage";
import MapaPage from "./pages/MapaPage";

import UsuariosPage from "./pages/UsuariosPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

/** Maps each route prefix to the roles allowed to access it */
const ROUTE_ROLES: Record<string, UserRole[]> = {
  '/dashboard': ['admin', 'gerencia', 'sala_tecnica', 'encarregado', 'topografo'],
  '/importar': ['admin', 'sala_tecnica'],
  '/ordens': ['admin', 'gerencia', 'sala_tecnica'],
  '/producao': ['admin', 'encarregado'],
  '/materiais': ['admin', 'almoxarifado'],
  '/topografia': ['admin', 'topografo'],
  '/mapa': ['admin', 'encarregado', 'topografo', 'almoxarifado'],
  '/usuarios': ['admin'],
  '/perfil': ['admin', 'gerencia', 'sala_tecnica', 'almoxarifado', 'encarregado', 'topografo'],
};

/** Home page por perfil — onde o usuário deve cair ao logar ou ao tentar acessar rota sem permissão */
const homeForRole = (role?: UserRole | null): string => {
  if (!role) return '/dashboard';
  if (role === 'almoxarifado') return '/materiais';
  return '/dashboard';
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, supabaseUser, loading, effectiveRole } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!supabaseUser) return <Navigate to="/login" replace />;
  if (supabaseUser && !isAuthenticated) return <NoRolePage />;

  // Check route permissions using effectiveRole (respects "view as")
  if (effectiveRole) {
    const matchedPrefix = Object.keys(ROUTE_ROLES).find(prefix => location.pathname.startsWith(prefix));
    if (matchedPrefix) {
      const allowed = ROUTE_ROLES[matchedPrefix];
      // Admin always allowed to /usuarios; for others check effectiveRole
      const isAdminOnlyRoute = allowed.length === 1 && allowed[0] === 'admin';
      if (isAdminOnlyRoute) {
        // real role must be admin
        // effectiveRole doesn't matter for admin-only routes
      } else if (!allowed.includes(effectiveRole)) {
        return <Navigate to={homeForRole(effectiveRole)} replace />;
      }
    }
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  const { isAuthenticated, supabaseUser, loading, effectiveRole } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  const home = homeForRole(effectiveRole);

  return (
    <Routes>
      <Route path="/login" element={supabaseUser ? <Navigate to={home} replace /> : <LoginPage />} />
      <Route path="/" element={<Navigate to={supabaseUser ? home : "/login"} replace />} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/ordens" element={<ProtectedRoute><OrdensPage /></ProtectedRoute>} />
      <Route path="/ordens/:id" element={<ProtectedRoute><OSDetailPage /></ProtectedRoute>} />
      <Route path="/importar" element={<ProtectedRoute><ImportarPage /></ProtectedRoute>} />
      <Route path="/importar/historico" element={<ProtectedRoute><ImportHistoricoPage /></ProtectedRoute>} />
      <Route path="/producao" element={<ProtectedRoute><ProducaoPage /></ProtectedRoute>} />
      <Route path="/materiais" element={<ProtectedRoute><MateriaisPage /></ProtectedRoute>} />
      <Route path="/topografia" element={<ProtectedRoute><TopografiaPage /></ProtectedRoute>} />
      <Route path="/mapa" element={<ProtectedRoute><MapaPage /></ProtectedRoute>} />
      <Route path="/usuarios" element={<ProtectedRoute><UsuariosPage /></ProtectedRoute>} />
      <Route path="/perfil" element={<ProtectedRoute><MeuPerfilPage /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
