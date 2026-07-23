import { useAuth } from '@/contexts/AuthContext';
import { ROLE_LABELS, UserRole } from '@/types/sanegest';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, HardHat, Package, Map, MapPin, BarChart3, LogOut, Menu, X, Droplets, Users, UserCircle
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { ViewAsSelector } from './ViewAsSelector';
import { usePendingMateriaisCount } from '@/hooks/usePendingMateriais';
import { supabase } from '@/integrations/supabase/client';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} />, roles: ['admin', 'gerencia', 'sala_tecnica', 'encarregado', 'topografo'] },
  { label: 'Ordens de Serviço', path: '/ordens', icon: <ClipboardList size={20} />, roles: ['admin', 'gerencia', 'sala_tecnica'] },
  { label: 'Produção', path: '/producao', icon: <HardHat size={20} />, roles: ['admin', 'encarregado'] },
  { label: 'Entrega de Materiais', path: '/materiais', icon: <Package size={20} />, roles: ['admin', 'almoxarifado'] },
  { label: 'Topografia', path: '/topografia', icon: <Map size={20} />, roles: ['admin', 'topografo'] },
  { label: 'Bases geográficas', path: '/mapa/bases', icon: <MapPin size={20} />, roles: ['admin', 'sala_tecnica'] },
  { label: 'Gestão de Usuários', path: '/usuarios', icon: <Users size={20} />, roles: ['admin'] },

];

export const AppSidebar = () => {
  const { user, effectiveRole, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const pendingCount = usePendingMateriaisCount();

  // Load avatar
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();
      const path = (data as any)?.avatar_url;
      if (!path) { setAvatarUrl(null); return; }
      const { data: signed } = await supabase.storage.from('avatars').createSignedUrl(path, 60 * 60);
      setAvatarUrl(signed?.signedUrl ?? null);
    };
    load();
  }, [user, location.pathname]);

  if (!user) return null;

  // Explicit role → allowed paths mapping
  const ROLE_MENU: Record<UserRole, string[]> = {
    admin: ['/dashboard', '/ordens', '/producao', '/materiais', '/topografia', '/mapa/bases', '/usuarios'],
    sala_tecnica: ['/dashboard', '/ordens', '/mapa/bases'],

    encarregado: ['/dashboard', '/producao'],
    almoxarifado: ['/materiais'],
    topografo: ['/dashboard', '/topografia'],
    gerencia: ['/dashboard'],
  };

  const filteredItems = NAV_ITEMS.filter(item => {
    if (user.role === 'admin') {
      // Admin-only items always visible for real admins
      if (item.path === '/usuarios') return true;
      // Use effectiveRole to determine which menu items to show
      const role = effectiveRole || 'admin';
      return ROLE_MENU[role]?.includes(item.path) ?? false;
    }
    return ROLE_MENU[user.role]?.includes(item.path) ?? false;
  });

  const sidebarContent = (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <Droplets size={28} className="text-sidebar-primary" />
          <div>
            <h1 className="text-lg font-bold text-sidebar-primary">SaneGest</h1>
            <p className="text-xs text-sidebar-foreground/60">Gestão de Obras</p>
          </div>
        </div>
      </div>

      {user.role === 'admin' && <ViewAsSelector />}

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {filteredItems.map(item => {
          const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border-l-[3px] ${
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-primary'
                  : 'border-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              }`}
            >
              {item.icon}
              {item.label}
              {item.path === '/materiais' && pendingCount > 0 && (
                <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border space-y-3">
        <Link
          to="/perfil"
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 p-2 -mx-1 rounded-lg transition-colors ${
            location.pathname === '/perfil'
              ? 'bg-sidebar-accent'
              : 'hover:bg-sidebar-accent/50'
          }`}
        >
          <div className="w-9 h-9 rounded-full bg-sidebar-accent overflow-hidden flex items-center justify-center shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <UserCircle size={22} className="text-sidebar-foreground/60" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{user.nome}</p>
            <p className="text-xs text-sidebar-foreground/50 truncate">{ROLE_LABELS[user.role]}</p>
          </div>
        </Link>
        <button
          onClick={logout}
          className="flex items-center gap-2 text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-lg bg-primary text-primary-foreground shadow-lg"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-foreground/50 z-40" onClick={() => setMobileOpen(false)} />
      )}
      

      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 transform transition-transform lg:translate-x-0 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {sidebarContent}
      </aside>
    </>
  );
};
