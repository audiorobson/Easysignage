'use client';

import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Building2, Copy } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { api, getToken } from '@/lib/api';

type SsoConfig = {
  ssoEnabled: boolean;
  ssoIssuerUrl: string | null;
  ssoClientId: string | null;
  hasClientSecret: boolean;
  redirectUri: string;
};

export default function SsoSettingsPage() {
  const router = useRouter();
  const [config, setConfig] = useState<SsoConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [issuerUrl, setIssuerUrl] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  const load = useCallback(async () => {
    const data = await api<SsoConfig>('/settings/sso');
    setConfig(data);
    setEnabled(data.ssoEnabled);
    setIssuerUrl(data.ssoIssuerUrl ?? '');
    setClientId(data.ssoClientId ?? '');
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await load();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, load]);

  async function onSave(ev: FormEvent) {
    ev.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const data = await api<SsoConfig>('/settings/sso', {
        method: 'PATCH',
        body: JSON.stringify({
          ssoEnabled: enabled,
          ssoIssuerUrl: issuerUrl,
          ssoClientId: clientId,
          ...(clientSecret.trim() ? { ssoClientSecret: clientSecret } : {}),
        }),
      });
      setConfig(data);
      setClientSecret('');
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao guardar');
    } finally {
      setSaving(false);
    }
  }

  async function copyRedirectUri() {
    if (!config?.redirectUri) return;
    await navigator.clipboard.writeText(config.redirectUri);
  }

  return (
    <>
      <PageHeader
        title="Login único (SSO)"
        lead="Configure um provedor OpenID Connect (Azure AD, Okta, Google Workspace, Auth0…) para esta organização. Os utilizadores continuam a precisar de existir no EasySignage — o SSO substitui apenas a verificação da palavra-passe."
        actions={
          <Link href="/settings" className="btn btn--ghost">
            <ArrowLeft size={16} aria-hidden />
            Voltar
          </Link>
        }
      />

      {error && <p className="text-danger">{error}</p>}
      {loading && <p className="text-muted">A carregar…</p>}

      {!loading && config && (
        <section className="surface-table-card" style={{ padding: '1.25rem' }}>
          <h3 className="panel__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={17} strokeWidth={1.9} aria-hidden />
            Configuração do provedor OIDC
          </h3>

          <div style={{ margin: '0.75rem 0 1.25rem' }}>
            <span className="text-muted">
              URL de callback (registe-a como <em>redirect URI</em> na app do provedor)
            </span>
            <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
              <code style={{ flex: 1, padding: '0.5rem', background: 'var(--color-surface-muted)' }}>
                {config.redirectUri}
              </code>
              <button type="button" className="btn btn--ghost" onClick={() => void copyRedirectUri()}>
                <Copy size={16} aria-hidden />
                Copiar
              </button>
            </div>
          </div>

          {saved && !error && (
            <p style={{ color: 'var(--color-success)', margin: '0 0 0.75rem' }}>Definições guardadas.</p>
          )}

          <form onSubmit={onSave}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  disabled={saving}
                />
                <span>Ativar login único para esta organização</span>
              </label>
              <label>
                <span className="text-muted">Issuer URL</span>
                <input
                  type="text"
                  className="input"
                  value={issuerUrl}
                  onChange={(e) => setIssuerUrl(e.target.value)}
                  placeholder="https://login.microsoftonline.com/<tenant-id>/v2.0"
                  style={{ width: '100%', marginTop: 6, fontFamily: 'monospace', fontSize: '0.85rem' }}
                  disabled={saving}
                />
              </label>
              <label>
                <span className="text-muted">Client ID</span>
                <input
                  type="text"
                  className="input"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  style={{ width: '100%', marginTop: 6, fontFamily: 'monospace', fontSize: '0.85rem' }}
                  disabled={saving}
                />
              </label>
              <label>
                <span className="text-muted">
                  Client secret{config.hasClientSecret ? ' — já definido, deixe em branco para manter' : ''}
                </span>
                <input
                  type="password"
                  className="input"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder={config.hasClientSecret ? 'Definido' : 'Obrigatório para ativar'}
                  style={{ width: '100%', marginTop: 6, fontFamily: 'monospace' }}
                  disabled={saving}
                />
              </label>
              <div>
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'A guardar…' : 'Guardar configuração de SSO'}
                </button>
              </div>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
