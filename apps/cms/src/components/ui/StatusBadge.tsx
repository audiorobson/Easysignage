import type { ReactNode } from 'react';

export type StatusBadgeVariant =
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'neutral';

const CLASS: Record<StatusBadgeVariant, string> = {
  success: 'badge badge--success',
  danger: 'badge badge--danger',
  warning: 'badge badge--warning',
  info: 'badge badge--info',
  neutral: 'badge badge--neutral',
};

export function StatusBadge({
  variant,
  children,
  title,
}: {
  variant: StatusBadgeVariant;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span className={CLASS[variant]} title={title}>
      {children}
    </span>
  );
}

/** Online/offline por heartbeat (≤ 5 min). */
export function ConnectionBadge({
  online,
  title,
}: {
  online: boolean;
  title?: string;
}) {
  return (
    <StatusBadge variant={online ? 'success' : 'danger'} title={title}>
      {online ? 'Online' : 'Offline'}
    </StatusBadge>
  );
}
