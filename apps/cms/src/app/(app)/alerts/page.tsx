'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageComingSoon } from '@/components/page-coming-soon';
import { getToken } from '@/lib/api';

export default function AlertsPage() {
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) router.replace('/login');
  }, [router]);

  return (
    <PageComingSoon
      title="Alerts"
      lead="Regras de alerta para offline prolongado, falhas de reprodução ou atualizações."
    >
      <p className="text-muted" style={{ margin: 0 }}>
        Notificações por e-mail ou webhook entrarão neste módulo.
      </p>
    </PageComingSoon>
  );
}
