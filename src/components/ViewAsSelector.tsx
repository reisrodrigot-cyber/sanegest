import { useAuth } from '@/contexts/AuthContext';
import { UserRole, ROLE_LABELS } from '@/types/sanegest';
import { Eye, User as UserIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const VIEW_AS_ROLES: UserRole[] = ['sala_tecnica', 'encarregado', 'almoxarifado', 'topografo', 'gerencia'];

interface RoleUser {
  user_id: string;
  display_name: string | null;
  email: string | null;
}

export const ViewAsSelector = () => {
  const { user, viewAsRole, setViewAsRole, viewAsUserId, setViewAsUser } = useAuth();
  const [roleUsers, setRoleUsers] = useState<RoleUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Fetch users of the selected role
  useEffect(() => {
    if (!viewAsRole) {
      setRoleUsers([]);
      return;
    }
    const fetchUsers = async () => {
      setLoadingUsers(true);
      const { data: roleRows } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', viewAsRole);

      const ids = (roleRows ?? []).map((r) => r.user_id);
      if (ids.length === 0) {
        setRoleUsers([]);
        setLoadingUsers(false);
        return;
      }
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, email, apelido')
        .in('user_id', ids);

      const sorted = (profiles ?? []).sort((a, b) =>
        (a.display_name ?? a.email ?? '').localeCompare(b.display_name ?? b.email ?? '')
      );
      setRoleUsers(sorted as RoleUser[]);
      setLoadingUsers(false);
    };
    fetchUsers();
  }, [viewAsRole]);

  if (user?.role !== 'admin') return null;

  return (
    <div className="px-3 py-3 mx-3 mt-3 mb-1 rounded-lg bg-sidebar-accent/60 border border-sidebar-border space-y-2">
      <div className="flex items-center gap-1.5">
        <Eye size={15} className="text-amber-500 shrink-0" />
        <span className="text-xs font-semibold text-sidebar-foreground/80 tracking-wide uppercase">
          Visualizar como
        </span>
      </div>

      <Select
        value={viewAsRole ?? 'admin'}
        onValueChange={(v) => setViewAsRole(v === 'admin' ? null : (v as UserRole))}
      >
        <SelectTrigger className="h-9 text-sm bg-sidebar border-sidebar-border text-sidebar-foreground focus:ring-amber-500/40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="admin">
            <span className="font-medium">Admin (completo)</span>
          </SelectItem>
          {VIEW_AS_ROLES.map((r) => (
            <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {viewAsRole && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 pt-1">
            <UserIcon size={13} className="text-amber-500/80 shrink-0" />
            <span className="text-[10px] font-semibold text-sidebar-foreground/70 tracking-wide uppercase">
              Usuário específico
            </span>
          </div>
          {loadingUsers ? (
            <p className="text-xs text-sidebar-foreground/60 italic">Carregando…</p>
          ) : roleUsers.length === 0 ? (
            <p className="text-xs text-sidebar-foreground/60 italic">
              Nenhum usuário cadastrado neste perfil
            </p>
          ) : (
            <Select
              value={viewAsUserId ?? '__generic__'}
              onValueChange={(v) => {
                if (v === '__generic__') {
                  setViewAsUser(null);
                } else {
                  const u = roleUsers.find((x) => x.user_id === v);
                  if (u) setViewAsUser({ id: u.user_id, nome: u.display_name || u.email || 'Usuário' });
                }
              }}
            >
              <SelectTrigger className="h-9 text-sm bg-sidebar border-sidebar-border text-sidebar-foreground focus:ring-amber-500/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__generic__">
                  <span className="italic">Visão genérica do perfil</span>
                </SelectItem>
                {roleUsers.map((u) => (
                  <SelectItem key={u.user_id} value={u.user_id}>
                    {u.display_name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
    </div>
  );
};
