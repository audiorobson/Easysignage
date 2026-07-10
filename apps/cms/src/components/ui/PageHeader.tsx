import type { ReactNode } from 'react';

type Props = {
  title: string;
  lead?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, lead, actions }: Props) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {lead ? <p className="page-header__lead">{lead}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}
