'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MonitorPlay } from 'lucide-react';
import { api, setToken } from '@/lib/api';

type SsoSessionPayload =
  | { accessToken: string; requires2fa?: undefined }
  | { requires2fa: true; challengeToken: string; tenant?: string };

export default function SsoCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

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
      const session = JSON.parse(decodeURIComponent(sessionParam)) as SsoSessionPayload;
      if ('requires2fa' in session && session.requires2fa) {
        setChallengeToken(session.challengeToken);
        return;
      }
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

  async function onSubmitTwoFactor(e: FormEvent) {
    e.preventDefault();
    if (!challengeToken) return;
    setError(null);
    setLoading(true);
    try {
      const res = await api<{ accessToken: string }>('/auth/login/2fa', {
        method: 'POST',
        body: JSON.stringify({ challengeToken, code }),
      });
      setToken(res.accessToken);
      router.replace('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido');
    } finally {
      setLoading(false);
    }
  }

  if (challengeToken) {
    return (
      <main className="login-screen">
        <form className="login-card" onSubmit={onSubmitTwoFactor}>
          <div className="login-card__brand">
            <span className="login-card__mark" aria-hidden>
              <MonitorPlay size={22} strokeWidth={2} />
            </span>
            <div>
              <h1 style={{ margin: 0, fontSize: 'var(--text-xl)' }}>Verificação em duas etapas</h1>
              <p className="text-muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
                Login único concluído — introduza o código da app de autenticação
              </p>
            </div>
          </div>
          <label className="field">
            <span>Código de verificação</span>
            <input
              className="input"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoComplete="one-time-code"
            />
          </label>
          {error ? <p className="text-danger">{error}</p> : null}
          <button className="btn btn--primary btn--block" type="submit" disabled={loading || code.length < 6}>
            {loading ? 'A verificar…' : 'Confirmar'}
          </button>
          <Link href="/login" className="btn btn--ghost btn--block">
            Voltar ao login
          </Link>
        </form>
      </main>
    );
  }

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
