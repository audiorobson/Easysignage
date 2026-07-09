'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
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
        <h1>EasySignage CMS</h1>
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
          <span>Senha</span>
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && <p className="text-danger" style={{ marginBottom: 'var(--space-4)' }}>{error}</p>}
        <button type="submit" disabled={loading} className="btn btn--primary btn--block">
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
