'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/api';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    if (getToken()) router.replace('/dashboard');
    else router.replace('/login');
  }, [router]);

  return (
    <main style={{ padding: 'var(--space-8)', textAlign: 'center' }} className="text-muted">
      Redirecionando…
    </main>
  );
}
