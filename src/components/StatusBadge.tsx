import { OSStatus } from '@/types/sanegest';

const config: Record<OSStatus, { label: string; dotClass: string; badgeClass: string }> = {
  VERMELHO: { label: 'Vermelho', dotClass: 'status-dot-vermelho', badgeClass: 'status-vermelho' },
  AMARELO: { label: 'Amarelo', dotClass: 'status-dot-amarelo', badgeClass: 'status-amarelo' },
  VERDE: { label: 'Verde', dotClass: 'status-dot-verde', badgeClass: 'status-verde' },
};

export const StatusBadge = ({ status, size = 'md' }: { status: OSStatus; size?: 'sm' | 'md' }) => {
  const c = config[status];
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${c.badgeClass} ${sizeClasses}`}>
      <span className={`w-2 h-2 rounded-full ${c.dotClass}`} />
      {c.label}
    </span>
  );
};
