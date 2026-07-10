import type { ReactNode } from 'react';
import type { BadgeTone } from '@/lib/device-labels';
import { ConnectionPill, StatusPill } from '@/components/ui/StatusPill';

export type StatusBadgeVariant =
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'neutral';

const VARIANT_TONE: Record<StatusBadgeVariant, BadgeTone> = {
  success: 'success',
  danger: 'danger',
  warning: 'warning',
  info: 'info',
  neutral: 'neutral',
};

export function StatusBadge({
  variant,
  children,
  title,
  dot = true,
}: {
  variant: StatusBadgeVariant;
  children: ReactNode;
  title?: string;
  dot?: boolean;
}) {
  return (
    <span title={title}>
      <StatusPill
        label={typeof children === 'string' ? children : String(children)}
        tone={VARIANT_TONE[variant]}
        dot={dot}
      />
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
      <StatusPill
        label="Sem publicação ativa"
        tone="neutral"
        title="Nenhuma publicação ativa no servidor"
      />
    );
  }
  const title = synced
    ? `O player confirmou a versão ${expectedVersion}`
    : `Servidor: v${expectedVersion} — player: v${appliedVersion ?? 'pendente'}`;
  return (
    <StatusPill
      label={
        synced
          ? `Publicação v${expectedVersion} sincronizada`
          : `Publicação pendente (v${expectedVersion})`
      }
      tone={synced ? 'success' : 'warning'}
      title={title}
    />
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
  return <ConnectionPill state={online ? 'on' : 'off'} title={title} />;
}
