import type { ReactNode } from 'react';

type Props = {
  title: string;
  lead: string;
  children?: ReactNode;
};

export function PageComingSoon({ title, lead, children }: Props) {
  return (
    <>
      <header className="page-header">
        <div>
          <h1>{title}</h1>
          <p className="page-header__lead">{lead}</p>
        </div>
      </header>
      <div className="empty-placeholder">{children}</div>
    </>
  );
}
