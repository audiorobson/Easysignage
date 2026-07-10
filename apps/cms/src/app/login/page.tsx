'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MonitorPlay } from 'lucide-react';
import { api, setToken } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [tenantSlug, setTenantSlug] = useState('demo');
  const [email, setEmail] = useState('admin@demo.local');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api<{ accessToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ tenantSlug, email, password }),
      });
      setToken(res.accessToken);
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-screen">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-card__brand">
          <span className="login-card__mark" aria-hidden>
            <MonitorPlay size={22} strokeWidth={2} />
          </span>
          <div>
            <h1 style={{ margin: 0, fontSize: 'var(--text-xl)' }}>EasySignage</h1>
            <p className="text-muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
              CMS — operador de rede
            </p>
          </div>
        </div>
        <label className="field">
          <span>Tenant (slug)</span>
          <input
            className="input"
            value={tenantSlug}
            onChange={(e) => setTenantSlug(e.target.value)}
            autoComplete="username"
          />
        </label>
        <label className="field">
          <span>E-mail</span>
          <input
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label className="field">
          <span>Palavra-passe</span>
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && (
          <p className="text-danger" style={{ marginBottom: 'var(--space-4)' }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="btn btn--brand btn--block"
        >
          {loading ? 'A entrar…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
