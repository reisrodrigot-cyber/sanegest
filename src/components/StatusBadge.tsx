import { OSStatus } from '@/types/sanegest';
import { getStatusMeta, type OSDisplayStatus } from '@/lib/osStatus';

export const StatusBadge = ({
  status,
  size = 'md',
}: {
  status: OSStatus | OSDisplayStatus | string | null | undefined;
  size?: 'sm' | 'md';
}) => {
  const c = getStatusMeta(status);
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${c.badgeClass} ${sizeClasses}`}
      title={c.description}
    >
      <span className={`w-2 h-2 rounded-full ${c.dotClass}`} />
      {c.label}
    </span>
  );
};
