/**
 * EasySignage — Badges de estado (§14: estados são parte da estética)
 * Novo ficheiro: apps/cms/src/components/ui/StatusPill.tsx
 *
 * <StatusPill> — badge semântico com dot (usa classes .badge de globals.css)
 * <ConnectionPill> — indicador online/offline/sincronizando (não depende só de cor: §19)
 */

import type { BadgeTone } from '@/lib/device-labels';

const TONE_CLASS: Record<BadgeTone, string> = {
  success: 'badge--success',
  danger: 'badge--danger',
  warning: 'badge--warning',
  info: 'badge--info',
  brand: 'badge--brand',
  neutral: 'badge--neutral',
};

export function StatusPill({
  label,
  tone = 'neutral',
  dot = true,
}: {
  label: string;
  tone?: BadgeTone;
  dot?: boolean;
}) {
  return (
    <span className={`badge ${TONE_CLASS[tone]}`}>
      {dot && <span className="dot" aria-hidden />}
      {label}
    </span>
  );
}

type Conn = 'on' | 'off' | 'sync';

const CONN_LABEL: Record<Conn, string> = {
  on: 'Online',
  off: 'Offline',
  sync: 'Sincronizando',
};

export function ConnectionPill({ state }: { state: Conn }) {
  return (
    <span className={`conn conn--${state}`}>
      <span className="dot" aria-hidden />
      {CONN_LABEL[state]}
    </span>
  );
}
