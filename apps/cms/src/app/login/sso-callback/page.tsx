'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MonitorPlay } from 'lucide-react';
import { setToken } from '@/lib/api';

export default function SsoCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const errorParam = params.get('error');
    const sessionParam = params.get('session');

    if (errorParam) {
      setError(errorParam);
      return;
    }

    if (!sessionParam) {
      setError('Resposta de login único inválida.');
      return;
    }

    try {
      const session = JSON.parse(decodeURIComponent(sessionParam)) as { accessToken?: string };
      if (!session.accessToken) {
        setError('Resposta de login único sem sessão válida.');
        return;
      }
      setToken(session.accessToken);
      router.replace('/dashboard');
      router.refresh();
    } catch {
      setError('Não foi possível processar a resposta do login único.');
    }
  }, [router]);

  return (
    <main className="login-screen">
      <div className="login-card">
        <div className="login-card__brand">
          <span className="login-card__mark" aria-hidden>
            <MonitorPlay size={22} strokeWidth={2} />
          </span>
          <div>
            <h1 style={{ margin: 0, fontSize: 'var(--text-xl)' }}>EasySignage</h1>
            <p className="text-muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
              Login único
            </p>
          </div>
        </div>
        {error ? (
          <>
            <p className="text-danger">{error}</p>
            <Link href="/login" className="btn btn--ghost btn--block">
              Voltar ao login
            </Link>
          </>
        ) : (
          <p className="text-muted">A concluir o login…</p>
        )}
      </div>
    </main>
  );
}
