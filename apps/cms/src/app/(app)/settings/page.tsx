'use client';

import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, KeyRound, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { tierLabelPt, type LicenseTier } from '@easysignage/license-core/browser';
import { api, getToken } from '@/lib/api';

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
};

export default function SettingsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const data = await api<LicenseStatus>('/license/status');
    setStatus(data);
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
    </>
  );
}
