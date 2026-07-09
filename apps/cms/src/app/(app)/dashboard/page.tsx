'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/api';

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) router.replace('/login');
  }, [router]);

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="page-header__lead">
            Visão geral da rede: dispositivos, publicações e alertas (em evolução).
          </p>
        </div>
      </header>
      <div className="empty-placeholder">
        <p className="text-muted" style={{ margin: '0 0 var(--space-4)' }}>
          Resumo operacional (métricas, alertas e publicações) virá nas próximas entregas.
        </p>
        <Link href="/devices" className="btn btn--gradient" style={{ display: 'inline-flex' }}>
          <i className="fa-solid fa-network-wired" aria-hidden />
          Ir para dispositivos
        </Link>
      </div>
    </>
  );
}
