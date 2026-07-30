import { OSStatus } from '@/types/sanegest';
import { getStatusMeta, type OSDisplayStatus } from '@/lib/osStatus';

export const StatusBadge = ({
  status,
  size = 'md',
  shortLabel = false,
}: {
  status: OSStatus | OSDisplayStatus | string | null | undefined;
  size?: 'sm' | 'md';
  /** Exibe rótulo curto (apenas apresentação; regra e status técnico inalterados) */
  shortLabel?: boolean;
}) => {
  const c = getStatusMeta(status);
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';
  const SHORT: Partial<Record<string, string>> = { VERMELHO: 'Sem execução' };
  const label = (shortLabel && SHORT[c.key]) || c.label;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${c.badgeClass} ${sizeClasses}`}
      title={c.label}
      aria-label={c.label}
    >
      <span className={`w-2 h-2 rounded-full ${c.dotClass}`} />
      {label}
    </span>
  );
};

