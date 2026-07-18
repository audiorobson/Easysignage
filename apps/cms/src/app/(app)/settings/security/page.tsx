'use client';

import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Lock, ShieldCheck, ShieldOff } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { api, getToken } from '@/lib/api';

type TotpStatus = { totpEnabled: boolean };

type TotpSetup = {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
};

export default function SecuritySettingsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<TotpStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [settingUp, setSettingUp] = useState(false);

  const [confirmCode, setConfirmCode] = useState('');
  const [confirming, setConfirming] = useState(false);

  const [disableCode, setDisableCode] = useState('');
  const [disabling, setDisabling] = useState(false);

  const load = useCallback(async () => {
    const data = await api<TotpStatus>('/auth/2fa/status');
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

  async function onStartSetup() {
    setError(null);
    setSettingUp(true);
    try {
      const data = await api<TotpSetup>('/auth/2fa/setup', { method: 'POST' });
      setSetup(data);
      setConfirmCode('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao iniciar configuração');
    } finally {
      setSettingUp(false);
    }
  }

  async function onConfirmSetup(ev: FormEvent) {
    ev.preventDefault();
    setError(null);
    setConfirming(true);
    try {
      await api('/auth/2fa/verify', {
        method: 'POST',
        body: JSON.stringify({ code: confirmCode }),
      });
      setSetup(null);
      setConfirmCode('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Código inválido');
    } finally {
      setConfirming(false);
    }
  }

  async function onDisable(ev: FormEvent) {
    ev.preventDefault();
    setError(null);
    setDisabling(true);
    try {
      await api('/auth/2fa/disable', {
        method: 'POST',
        body: JSON.stringify({ code: disableCode }),
      });
      setDisableCode('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Código inválido');
    } finally {
      setDisabling(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Segurança — 2FA"
        lead="Proteja a sua conta com um código de verificação gerado por uma app de autenticação (Google Authenticator, Authy, 1Password…)."
        actions={
          <Link href="/settings" className="btn btn--ghost">
            <ArrowLeft size={16} aria-hidden />
            Voltar
          </Link>
        }
      />

      {error && <p className="text-danger">{error}</p>}
      {loading && <p className="text-muted">A carregar…</p>}

      {!loading && status && !status.totpEnabled && !setup && (
        <section className="surface-table-card" style={{ padding: '1.25rem' }}>
          <h3 className="panel__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldOff size={17} strokeWidth={1.9} aria-hidden />
            2FA desativado
          </h3>
          <p className="text-muted" style={{ margin: '0.5rem 0 1rem' }}>
            A sua conta ainda não tem verificação em duas etapas ativada.
          </p>
          <button type="button" className="btn btn--primary" onClick={() => void onStartSetup()} disabled={settingUp}>
            {settingUp ? 'A gerar…' : 'Ativar 2FA'}
          </button>
        </section>
      )}

      {setup && (
        <section className="surface-table-card" style={{ padding: '1.25rem' }}>
          <h3 className="panel__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock size={17} strokeWidth={1.9} aria-hidden />
            Digitalize o QR code
          </h3>
          <p className="text-muted" style={{ margin: '0.5rem 0 1rem' }}>
            Use a app de autenticação para digitalizar o código abaixo ou introduza a chave manualmente.
          </p>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={setup.qrDataUrl}
              alt="QR code para configurar a verificação em duas etapas"
              width={200}
              height={200}
              style={{ borderRadius: 8, border: '1px solid var(--color-border)' }}
            />
            <div style={{ minWidth: 220 }}>
              <span className="text-muted">Chave manual</span>
              <code
                style={{
                  display: 'block',
                  padding: '0.5rem',
                  marginTop: 6,
                  background: 'var(--color-surface-muted)',
                  fontSize: '0.9rem',
                  wordBreak: 'break-all',
                }}
              >
                {setup.secret}
              </code>

              <form onSubmit={onConfirmSetup} style={{ marginTop: '1.25rem' }}>
                <label>
                  <span className="text-muted">Código de verificação (6 dígitos)</span>
                  <input
                    className="input"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    value={confirmCode}
                    onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    style={{ width: '100%', marginTop: 6 }}
                    disabled={confirming}
                  />
                </label>
                <div style={{ display: 'flex', gap: 8, marginTop: '0.85rem' }}>
                  <button
                    type="submit"
                    className="btn btn--primary"
                    disabled={confirming || confirmCode.length !== 6}
                  >
                    {confirming ? 'A confirmar…' : 'Confirmar e ativar'}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => {
                      setSetup(null);
                      setConfirmCode('');
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
      )}

      {!loading && status && status.totpEnabled && !setup && (
        <section className="surface-table-card" style={{ padding: '1.25rem' }}>
          <h3 className="panel__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={17} strokeWidth={1.9} aria-hidden />
            2FA ativado
          </h3>
          <p className="text-muted" style={{ margin: '0.5rem 0 1rem' }}>
            A sua conta está protegida por verificação em duas etapas. Para desativar, confirme com um
            código atual da sua app de autenticação.
          </p>
          <form onSubmit={onDisable} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label>
              <span className="text-muted">Código de verificação</span>
              <input
                className="input"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={{ marginTop: 6 }}
                disabled={disabling}
              />
            </label>
            <button
              type="submit"
              className="btn btn--danger"
              disabled={disabling || disableCode.length !== 6}
            >
              {disabling ? 'A desativar…' : 'Desativar 2FA'}
            </button>
          </form>
        </section>
      )}
    </>
  );
}
