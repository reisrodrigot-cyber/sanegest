import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
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
import ProducaoPage from "./pages/ProducaoPage";
import MateriaisPage from "./pages/MateriaisPage";
import TopografiaPage from "./pages/TopografiaPage";
import RelatoriosPage from "./pages/RelatoriosPage";
import UsuariosPage from "./pages/UsuariosPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, supabaseUser, loading } = useAuth();
  if (loading) return null;
  if (!supabaseUser) return <Navigate to="/login" replace />;
  if (supabaseUser && !isAuthenticated) return <NoRolePage />;
  return <>{children}</>;
};

const AppRoutes = () => {
  const { isAuthenticated, supabaseUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={supabaseUser ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/" element={<Navigate to={supabaseUser ? "/dashboard" : "/login"} replace />} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/ordens" element={<ProtectedRoute><OrdensPage /></ProtectedRoute>} />
      <Route path="/ordens/:id" element={<ProtectedRoute><OSDetailPage /></ProtectedRoute>} />
      <Route path="/importar" element={<ProtectedRoute><ImportarPage /></ProtectedRoute>} />
      <Route path="/producao" element={<ProtectedRoute><ProducaoPage /></ProtectedRoute>} />
      <Route path="/materiais" element={<ProtectedRoute><MateriaisPage /></ProtectedRoute>} />
      <Route path="/topografia" element={<ProtectedRoute><TopografiaPage /></ProtectedRoute>} />
      <Route path="/relatorios" element={<ProtectedRoute><RelatoriosPage /></ProtectedRoute>} />
      <Route path="/usuarios" element={<ProtectedRoute><UsuariosPage /></ProtectedRoute>} />
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
