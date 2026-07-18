'use client';

import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bell, Copy, KeyRound, Lock, RefreshCw, ShieldCheck, Building2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { tierLabelPt, featureLabelPt, type LicenseTier, type LicenseFeature } from '@easysignage/license-core/browser';
import { api, getToken } from '@/lib/api';

type AlertNotificationsSettings = {
  alertWebhookUrl: string | null;
  alertWebhookSecretMasked: string | null;
  hasWebhookSecret: boolean;
  alertNotifyEmails: string | null;
};

type LicenseStatus = {
  hardwareId: string;
  tier: LicenseTier;
  maxPlayers: number;
  usedPlayers: number;
  valid: boolean;
  licensed: boolean;
  issuedAt: string | null;
  expiresAt: string | null;
  customer: string | null;
  message: string | null;
  features: string[];
};

export default function SettingsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  const [notifSettings, setNotifSettings] = useState<AlertNotificationsSettings | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [notifyEmails, setNotifyEmails] = useState('');
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [notifSaved, setNotifSaved] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const data = await api<LicenseStatus>('/license/status');
    setStatus(data);
  }, []);

  const loadNotifications = useCallback(async () => {
    const data = await api<AlertNotificationsSettings>('/settings/notifications');
    setNotifSettings(data);
    setWebhookUrl(data.alertWebhookUrl ?? '');
    setNotifyEmails(data.alertNotifyEmails ?? '');
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
      try {
        await loadNotifications();
      } catch {
        /** Sem permissão settings.read ou endpoint indisponível — secção fica oculta. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, load, loadNotifications]);

  async function onSaveNotifications(ev: FormEvent) {
    ev.preventDefault();
    setNotifSaving(true);
    setNotifError(null);
    setNotifSaved(false);
    try {
      const data = await api<AlertNotificationsSettings>('/settings/notifications', {
        method: 'PATCH',
        body: JSON.stringify({
          alertWebhookUrl: webhookUrl,
          ...(webhookSecret.trim() ? { alertWebhookSecret: webhookSecret } : {}),
          alertNotifyEmails: notifyEmails,
        }),
      });
      setNotifSettings(data);
      setWebhookSecret('');
      setNotifSaved(true);
    } catch (e) {
      setNotifError(e instanceof Error ? e.message : 'Erro ao guardar');
    } finally {
      setNotifSaving(false);
    }
  }

  async function onApply(ev: FormEvent) {
    ev.preventDefault();
    const key = licenseKey.trim();
    if (!key) return;
    setApplying(true);
    setError(null);
    try {
      const data = await api<LicenseStatus>('/license/apply', {
        method: 'POST',
        body: JSON.stringify({ licenseKey: key }),
      });
      setStatus(data);
      setLicenseKey('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao aplicar licença');
    } finally {
      setApplying(false);
    }
  }

  async function copyHwid() {
    if (!status?.hardwareId) return;
    await navigator.clipboard.writeText(status.hardwareId);
  }

  return (
    <>
      <PageHeader
        title="Definições"
        lead="Licenciamento da instalação, limites de players e activação por serial."
        actions={
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={16} aria-hidden />
            Actualizar
          </button>
        }
      />

      <section
        className="surface-table-card"
        style={{
          padding: '1.1rem 1.25rem',
          marginBottom: 'var(--space-5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h3 className="panel__title" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <ShieldCheck size={17} strokeWidth={1.9} aria-hidden />
            Auditoria
          </h3>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>
            Quem criou, editou ou removeu o quê, e quando — no CMS.
          </p>
        </div>
        <Link href="/settings/audit" className="btn btn--ghost">
          Ver trilha de auditoria
        </Link>
      </section>

      <section
        className="surface-table-card"
        style={{
          padding: '1.1rem 1.25rem',
          marginBottom: 'var(--space-5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h3 className="panel__title" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <Lock size={17} strokeWidth={1.9} aria-hidden />
            Segurança
          </h3>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>
            Verificação em duas etapas (2FA) para a sua conta.
          </p>
        </div>
        <Link href="/settings/security" className="btn btn--ghost">
          Configurar 2FA
        </Link>
      </section>

      <section
        className="surface-table-card"
        style={{
          padding: '1.1rem 1.25rem',
          marginBottom: 'var(--space-5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h3 className="panel__title" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <Building2 size={17} strokeWidth={1.9} aria-hidden />
            Login único (SSO)
          </h3>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>
            Autenticação via OpenID Connect (Azure AD, Okta, Google Workspace…) para esta organização.
          </p>
        </div>
        <Link href="/settings/sso" className="btn btn--ghost">
          Configurar SSO
        </Link>
      </section>

      {error && <p className="text-danger">{error}</p>}
      {loading && !status && <p className="text-muted">A carregar…</p>}

      {status && (
        <section className="surface-table-card" style={{ padding: '1.25rem' }}>
          {!status.licensed && (
            <div
              role="status"
              style={{
                marginBottom: '1rem',
                padding: '0.85rem 1rem',
                borderRadius: 8,
                background: 'var(--color-warning-bg, #fffbeb)',
                border: '1px solid var(--color-warning-border, #fcd34d)',
                fontSize: '0.9rem',
              }}
            >
              <strong>Modo trial.</strong>{' '}
              {status.message ?? 'Active uma licença para aumentar o limite de players.'}
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gap: '1rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            }}
          >
            <div>
              <span className="text-muted">Plano</span>
              <p style={{ margin: '0.25rem 0 0', fontWeight: 600 }}>
                {tierLabelPt(status.tier)}
              </p>
            </div>
            <div>
              <span className="text-muted">Players</span>
              <p style={{ margin: '0.25rem 0 0', fontWeight: 600 }}>
                {status.usedPlayers} / {status.maxPlayers}
              </p>
            </div>
            <div>
              <span className="text-muted">Cliente</span>
              <p style={{ margin: '0.25rem 0 0' }}>{status.customer ?? '—'}</p>
            </div>
            <div>
              <span className="text-muted">Validade</span>
              <p style={{ margin: '0.25rem 0 0' }}>
                {status.expiresAt
                  ? new Date(status.expiresAt).toLocaleDateString('pt-PT')
                  : status.licensed
                    ? 'Perpétua'
                    : '—'}
              </p>
            </div>
          </div>

          <div style={{ marginTop: '1.25rem' }}>
            <span className="text-muted">Funcionalidades do plano</span>
            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
              {(['campaigns', 'video_walls', 'rtsp', 'alerts'] as LicenseFeature[]).map(
                (f) => {
                  const on = status.features.includes(f);
                  return (
                    <li key={f} style={{ color: on ? 'inherit' : 'var(--color-text-muted)' }}>
                      {featureLabelPt(f)}
                      {on ? '' : ' — indisponível neste plano'}
                    </li>
                  );
                }
              )}
            </ul>
          </div>

          <div style={{ marginTop: '1.25rem' }}>
            <span className="text-muted">Hardware ID (envie ao fornecedor)</span>
            <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
              <code style={{ flex: 1, padding: '0.5rem', background: 'var(--color-surface-muted)' }}>
                {status.hardwareId}
              </code>
              <button type="button" className="btn btn--ghost" onClick={() => void copyHwid()}>
                <Copy size={16} aria-hidden />
                Copiar
              </button>
            </div>
          </div>

          <form onSubmit={onApply} style={{ marginTop: '1.5rem' }}>
            <label>
              <span className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <KeyRound size={15} aria-hidden />
                Serial de licença
              </span>
              <textarea
                className="input"
                rows={3}
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="ESGN1.…"
                style={{ width: '100%', marginTop: 6, fontFamily: 'monospace', fontSize: '0.8rem' }}
                disabled={applying}
              />
            </label>
            <button type="submit" className="btn btn--primary" disabled={applying || !licenseKey.trim()}>
              {applying ? 'A aplicar…' : 'Activar licença'}
            </button>
          </form>
        </section>
      )}

      {notifSettings && (
        <section className="surface-table-card" style={{ padding: '1.25rem', marginTop: 'var(--space-5)' }}>
          <h3
            className="panel__title"
            style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.5rem' }}
          >
            <Bell size={17} strokeWidth={1.9} aria-hidden />
            Notificações de alerta
          </h3>
          <p className="text-muted" style={{ margin: '0 0 1rem' }}>
            Recebe um webhook e/ou e-mail sempre que um alerta for aberto ou resolvido
            (dispositivo offline, falha de reprodução, publicação pendente…).
          </p>

          {notifError && <p className="text-danger">{notifError}</p>}
          {notifSaved && !notifError && (
            <p style={{ color: 'var(--color-success)', margin: '0 0 0.75rem' }}>Definições guardadas.</p>
          )}

          <form onSubmit={onSaveNotifications}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <label>
                <span className="text-muted">URL do webhook (POST, JSON)</span>
                <input
                  type="text"
                  className="input"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://hooks.exemplo.com/easysignage-alerts"
                  style={{ width: '100%', marginTop: 6 }}
                  disabled={notifSaving}
                />
              </label>
              <label>
                <span className="text-muted">
                  Segredo do webhook (assina o corpo em HMAC-SHA256, header{' '}
                  <code>X-EasySignage-Signature</code>)
                  {notifSettings.hasWebhookSecret ? ' — já definido' : ''}
                </span>
                <input
                  type="password"
                  className="input"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder={
                    notifSettings.hasWebhookSecret
                      ? `Definido (${notifSettings.alertWebhookSecretMasked}) — deixe em branco para manter`
                      : 'Opcional'
                  }
                  style={{ width: '100%', marginTop: 6, fontFamily: 'monospace' }}
                  disabled={notifSaving}
                />
              </label>
              <label>
                <span className="text-muted">E-mails para notificar (separados por vírgula)</span>
                <input
                  type="text"
                  className="input"
                  value={notifyEmails}
                  onChange={(e) => setNotifyEmails(e.target.value)}
                  placeholder="ops@empresa.com, gestor@empresa.com"
                  style={{ width: '100%', marginTop: 6 }}
                  disabled={notifSaving}
                />
              </label>
              <div>
                <button type="submit" className="btn btn--primary" disabled={notifSaving}>
                  {notifSaving ? 'A guardar…' : 'Guardar notificações'}
                </button>
              </div>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
