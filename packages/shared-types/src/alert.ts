export const ALERT_STATUSES = ['open', 'acknowledged', 'resolved'] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const ALERT_SEVERITIES = ['info', 'warning', 'critical'] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const ALERT_TYPES = [
  'device_offline',
  'device_offline_long',
  'playback_fault',
  'publication_sync_pending',
] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export function alertStatusLabelPt(status: string): string {
  switch (status) {
    case 'open':
      return 'Aberto';
    case 'acknowledged':
      return 'Reconhecido';
    case 'resolved':
      return 'Resolvido';
    default:
      return status;
  }
}

export function alertSeverityLabelPt(severity: string): string {
  switch (severity) {
    case 'info':
      return 'Info';
    case 'warning':
      return 'Aviso';
    case 'critical':
      return 'Crítico';
    default:
      return severity;
  }
}

export function alertTypeLabelPt(type: string): string {
  switch (type) {
    case 'device_offline':
      return 'Device offline';
    case 'device_offline_long':
      return 'Offline prolongado';
    case 'playback_fault':
      return 'Falha de reprodução';
    case 'publication_sync_pending':
      return 'Sync de publicação pendente';
    default:
      return type;
  }
}
