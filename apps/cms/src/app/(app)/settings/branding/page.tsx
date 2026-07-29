'use client';

import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Paintbrush } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { api, getToken } from '@/lib/api';
import { applyBrandingCssVars, type TenantBranding } from '@/lib/branding';

const DEFAULT_COLOR = '#2563eb';

export default function BrandingSettingsPage() {
  const router = useRouter();
  const [config, setConfig] = useState<TenantBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [brandName, setBrandName] = useState('');
  const [brandLogoUrl, setBrandLogoUrl] = useState('');
  const [brandPrimaryColor, setBrandPrimaryColor] = useState('');

  const load = useCallback(async () => {
    const data = await api<TenantBranding>('/settings/branding');
    setConfig(data);
    setBrandName(data.brandName ?? '');
    setBrandLogoUrl(data.brandLogoUrl ?? '');
    setBrandPrimaryColor(data.brandPrimaryColor ?? '');
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

  // Pré-visualização em tempo real — não afeta a base de dados até guardar.
  useEffect(() => {
    applyBrandingCssVars({ brandPrimaryColor: brandPrimaryColor || null });
    return () => {
      applyBrandingCssVars(config);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandPrimaryColor]);

  async function onSave(ev: FormEvent) {
    ev.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const data = await api<TenantBranding>('/settings/branding', {
        method: 'PATCH',
        body: JSON.stringify({
          brandName,
          brandLogoUrl,
          brandPrimaryColor,
        }),
      });
      setConfig(data);
      applyBrandingCssVars(data);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao guardar');
    } finally {
      setSaving(false);
    }
  }

  function onReset() {
    setBrandName('');
    setBrandLogoUrl('');
    setBrandPrimaryColor('');
  }

  return (
    <>
      <PageHeader
        title="Branding"
        lead="Personalize o logótipo, nome e cor de destaque exibidos no CMS, na tela de login e no preview de playlists — ideal para operações white-label."
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
            <Paintbrush size={17} strokeWidth={1.9} aria-hidden />
            Identidade visual
          </h3>

          {saved && !error && (
            <p style={{ color: 'var(--color-success)', margin: '0.75rem 0' }}>Definições guardadas.</p>
          )}

          <form onSubmit={onSave} style={{ marginTop: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxWidth: 460 }}>
              <label>
                <span className="text-muted">Nome exibido</span>
                <input
                  type="text"
                  className="input"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="EasySignage"
                  style={{ width: '100%', marginTop: 6 }}
                  disabled={saving}
                />
              </label>
              <label>
                <span className="text-muted">URL do logótipo (https, PNG/SVG)</span>
                <input
                  type="text"
                  className="input"
                  value={brandLogoUrl}
                  onChange={(e) => setBrandLogoUrl(e.target.value)}
                  placeholder="https://cdn.suaempresa.com/logo.png"
                  style={{ width: '100%', marginTop: 6, fontFamily: 'monospace', fontSize: '0.85rem' }}
                  disabled={saving}
                />
              </label>
              <label>
                <span className="text-muted">Cor primária</span>
                <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                  <input
                    type="color"
                    value={brandPrimaryColor || DEFAULT_COLOR}
                    onChange={(e) => setBrandPrimaryColor(e.target.value)}
                    disabled={saving}
                    aria-label="Selecionar cor primária"
                    style={{ width: 44, height: 36, padding: 2, border: '1px solid var(--color-border)', borderRadius: 8 }}
                  />
                  <input
                    type="text"
                    className="input"
                    value={brandPrimaryColor}
                    onChange={(e) => setBrandPrimaryColor(e.target.value)}
                    placeholder="#2563eb"
                    style={{ flex: 1, fontFamily: 'monospace' }}
                    disabled={saving}
                  />
                </div>
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'A guardar…' : 'Guardar branding'}
                </button>
                <button type="button" className="btn btn--ghost" onClick={onReset} disabled={saving}>
                  Repor para EasySignage
                </button>
              </div>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
