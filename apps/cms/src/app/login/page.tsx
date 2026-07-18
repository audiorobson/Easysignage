'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MonitorPlay } from 'lucide-react';
import { api, API_BASE, setToken } from '@/lib/api';
import { applyBrandingCssVars, type TenantBranding } from '@/lib/branding';

type LoginResponse =
  | { accessToken: string; requires2fa?: undefined }
  | { requires2fa: true; challengeToken: string };

export default function LoginPage() {
  const router = useRouter();
  const [tenantSlug, setTenantSlug] = useState('demo');
  const [email, setEmail] = useState('admin@demo.local');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [branding, setBranding] = useState<TenantBranding | null>(null);

  useEffect(() => {
    const slug = tenantSlug.trim();
    if (!slug) {
      setBranding(null);
      applyBrandingCssVars(null);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      try {
        const data = await api<TenantBranding>(`/public/tenants/${encodeURIComponent(slug)}/branding`);
        if (!cancelled) {
          setBranding(data);
          applyBrandingCssVars(data);
        }
      } catch {
        if (!cancelled) {
          setBranding(null);
          applyBrandingCssVars(null);
        }
      }
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [tenantSlug]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ tenantSlug, email, password }),
      });
      if ('requires2fa' in res && res.requires2fa) {
        setChallengeToken(res.challengeToken);
        return;
      }
      setToken(res.accessToken);
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no login');
    } finally {
      setLoading(false);
    }
  }

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
      router.push('/dashboard');
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
                Introduza o código de 6 dígitos da sua app de autenticação
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
          {error && (
            <p className="text-danger" style={{ marginBottom: 'var(--space-4)' }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="btn btn--brand btn--block"
          >
            {loading ? 'A verificar…' : 'Confirmar'}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--block"
            style={{ marginTop: 'var(--space-2)' }}
            onClick={() => {
              setChallengeToken(null);
              setCode('');
              setError(null);
            }}
          >
            Voltar
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="login-screen">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-card__brand">
          {branding?.brandLogoUrl ? (
            <img
              src={branding.brandLogoUrl}
              alt=""
              data-testid="brand-logo"
              className="login-card__mark login-card__mark--logo"
            />
          ) : (
            <span className="login-card__mark" aria-hidden>
              <MonitorPlay size={22} strokeWidth={2} />
            </span>
          )}
          <div>
            <h1 style={{ margin: 0, fontSize: 'var(--text-xl)' }}>{branding?.brandName || 'EasySignage'}</h1>
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
        <button
          type="button"
          className="btn btn--ghost btn--block"
          style={{ marginTop: 'var(--space-2)' }}
          disabled={!tenantSlug.trim()}
          onClick={() => {
            window.location.href = `${API_BASE}/auth/sso/${encodeURIComponent(tenantSlug.trim())}/login`;
          }}
        >
          Continuar com SSO (OIDC)
        </button>
      </form>
    </main>
  );
}
