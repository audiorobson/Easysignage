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

/** Publicação versionada: servidor vs ack do player. */
export function PublicationSyncBadge({
  synced,
  expectedVersion,
  appliedVersion,
}: {
  synced: boolean;
  expectedVersion: number | null;
  appliedVersion: number | null;
}) {
  if (expectedVersion == null) {
    return (
      <StatusBadge variant="neutral" title="Nenhuma publicação ativa no servidor">
        Sem publicação ativa
      </StatusBadge>
    );
  }
  const title = synced
    ? `O player confirmou a versão ${expectedVersion}`
    : `Servidor: v${expectedVersion} — player: v${appliedVersion ?? 'pendente'}`;
  return (
    <StatusBadge variant={synced ? 'success' : 'warning'} title={title}>
      {synced
        ? `Publicação v${expectedVersion} sincronizada`
        : `Publicação pendente (v${expectedVersion})`}
    </StatusBadge>
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
