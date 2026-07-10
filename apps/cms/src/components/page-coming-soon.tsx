import type { ReactNode } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';

type Props = {
  title: string;
  lead: string;
  children?: ReactNode;
};

export function PageComingSoon({ title, lead, children }: Props) {
  return (
    <>
      <PageHeader title={title} lead={lead} />
      <div className="empty-placeholder">{children}</div>
    </>
  );
}
