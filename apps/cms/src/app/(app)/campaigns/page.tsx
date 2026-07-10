'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageComingSoon } from '@/components/page-coming-soon';
import { getToken } from '@/lib/api';

export default function CampaignsPage() {
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) router.replace('/login');
  }, [router]);

  return (
    <PageComingSoon
      title="Campanhas"
      lead="Campanhas promocionais e janelas de publicação por audiência ou local."
    >
      <p className="text-muted" style={{ margin: 0 }}>
        Módulo em planeamento: integração com playlists, sites e métricas de entrega.
      </p>
    </PageComingSoon>
  );
}
