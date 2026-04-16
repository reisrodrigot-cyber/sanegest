import { useAuth } from '@/contexts/AuthContext';
import { UserRole, ROLE_LABELS } from '@/types/sanegest';
import { Eye } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const VIEW_AS_ROLES: UserRole[] = ['sala_tecnica', 'encarregado', 'almoxarifado', 'topografo', 'gerencia'];

export const ViewAsSelector = () => {
  const { user, viewAsRole, setViewAsRole } = useAuth();

  if (user?.role !== 'admin') return null;

  return (
    <div className="px-3 py-3 mx-3 mt-3 mb-1 rounded-lg bg-sidebar-accent/60 border border-sidebar-border">
      <div className="flex items-center gap-1.5 mb-2">
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
          {VIEW_AS_ROLES.map(r => (
            <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
