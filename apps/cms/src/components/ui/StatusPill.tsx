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
  title,
}: {
  label: string;
  tone?: BadgeTone;
  dot?: boolean;
  title?: string;
}) {
  return (
    <span className={`badge ${TONE_CLASS[tone]}`} title={title}>
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

export function ConnectionPill({
  state,
  title,
}: {
  state: Conn;
  title?: string;
}) {
  return (
    <span className={`conn conn--${state}`} title={title}>
      <span className="dot" aria-hidden />
      {CONN_LABEL[state]}
    </span>
  );
}
