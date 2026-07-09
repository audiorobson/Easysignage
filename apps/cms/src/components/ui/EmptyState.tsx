import type { ReactNode } from 'react';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state" role="status">
      <p className="empty-state__title">{title}</p>
      {description && (
        <p className="empty-state__desc text-muted">{description}</p>
      )}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}
