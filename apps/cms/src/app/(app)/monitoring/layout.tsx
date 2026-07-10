import type { ReactNode } from 'react';

export default function MonitoringLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="monitoring-page theme-noc">{children}</div>;
}
