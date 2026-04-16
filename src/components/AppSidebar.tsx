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
  { label: 'Relatórios', path: '/relatorios', icon: <BarChart3 size={20} />, roles: ['admin', 'gerencia', 'sala_tecnica'] },
  { label: 'Gestão de Usuários', path: '/usuarios', icon: <Users size={20} />, roles: ['admin'] },
];

export const AppSidebar = () => {
  const { user, effectiveRole, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return null;

  // Admin with viewAs: show items for viewed role + admin-only items
  const filteredItems = NAV_ITEMS.filter(i => {
    if (user.role === 'admin') {
      // Always show admin-only items (Gestão de Usuários)
      if (i.roles.length === 1 && i.roles[0] === 'admin') return true;
      // If viewing as another role, filter by that role
      if (effectiveRole && effectiveRole !== 'admin') {
        return i.roles.includes(effectiveRole) || i.roles.includes('admin');
      }
      return true;
    }
    return i.roles.includes(user.role);
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

      {user.role === 'admin' && (
        <div className="px-3 pt-3">
          <ViewAsSelector />
        </div>
      )}

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

      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 transform transition-transform lg:translate-x-0 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {sidebarContent}
      </aside>
    </>
  );
};
