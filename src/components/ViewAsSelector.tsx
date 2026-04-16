import { useAuth } from '@/contexts/AuthContext';
import { UserRole, ROLE_LABELS } from '@/types/sanegest';
import { Eye } from 'lucide-react';

const VIEW_AS_ROLES: UserRole[] = ['sala_tecnica', 'encarregado', 'almoxarifado', 'topografo', 'gerencia'];

export const ViewAsSelector = () => {
  const { user, viewAsRole, setViewAsRole } = useAuth();

  if (user?.role !== 'admin') return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
      <Eye size={16} className="text-amber-600 shrink-0" />
      <span className="text-xs font-medium text-amber-700 whitespace-nowrap">Visualizar como:</span>
      <select
        value={viewAsRole ?? ''}
        onChange={e => setViewAsRole(e.target.value ? (e.target.value as UserRole) : null)}
        className="text-xs bg-transparent border border-amber-500/30 rounded px-2 py-1 text-foreground"
      >
        <option value="">Admin (completo)</option>
        {VIEW_AS_ROLES.map(r => (
          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
        ))}
      </select>
    </div>
  );
};
