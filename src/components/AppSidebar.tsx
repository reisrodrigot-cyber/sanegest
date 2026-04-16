import { useAuth } from '@/contexts/AuthContext';
import { ROLE_LABELS, UserRole } from '@/types/sanegest';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileSpreadsheet, ClipboardList, HardHat, Package, Map, BarChart3, LogOut, Menu, X, Droplets, Users
} from 'lucide-react';
import { useState } from 'react';
import { ViewAsSelector } from './ViewAsSelector';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} />, roles: ['admin', 'gerencia', 'sala_tecnica', 'almoxarifado', 'encarregado', 'topografo'] },
  { label: 'Importar Planilhão', path: '/importar', icon: <FileSpreadsheet size={20} />, roles: ['admin', 'sala_tecnica'] },
  { label: 'Ordens de Serviço', path: '/ordens', icon: <ClipboardList size={20} />, roles: ['admin', 'gerencia', 'sala_tecnica'] },
  { label: 'Produção', path: '/producao', icon: <HardHat size={20} />, roles: ['admin', 'encarregado'] },
  { label: 'Materiais', path: '/materiais', icon: <Package size={20} />, roles: ['admin', 'almoxarifado'] },
  { label: 'Topografia', path: '/topografia', icon: <Map size={20} />, roles: ['admin', 'topografo'] },
  
  { label: 'Gestão de Usuários', path: '/usuarios', icon: <Users size={20} />, roles: ['admin'] },
];

export const AppSidebar = () => {
  const { user, effectiveRole, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return null;

  // Explicit role → allowed paths mapping
  const ROLE_MENU: Record<UserRole, string[]> = {
    admin: ['/dashboard', '/importar', '/ordens', '/producao', '/materiais', '/topografia', '/usuarios'],
    sala_tecnica: ['/dashboard', '/importar', '/ordens'],
    encarregado: ['/dashboard', '/producao'],
    almoxarifado: ['/dashboard', '/materiais'],
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
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="mb-3">
          <p className="text-sm font-medium text-sidebar-foreground">{user.nome}</p>
          <p className="text-xs text-sidebar-foreground/50">{ROLE_LABELS[user.role]}</p>
        </div>
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
