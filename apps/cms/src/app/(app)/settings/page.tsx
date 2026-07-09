'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageComingSoon } from '@/components/page-coming-soon';
import { getToken } from '@/lib/api';

export default function SettingsPage() {
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) router.replace('/login');
  }, [router]);

  return (
    <PageComingSoon
      title="Settings"
      lead="Preferências do tenant, identidade visual, integrações e permissões."
    >
      <p className="text-muted" style={{ margin: 0 }}>
        Configurações avançadas serão centralizadas aqui (API keys, temas, idioma).
      </p>
    </PageComingSoon>
  );
}
