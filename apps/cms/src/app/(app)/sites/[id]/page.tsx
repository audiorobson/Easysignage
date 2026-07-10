'use client';

import Link from 'next/link';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Image, Trash2 } from 'lucide-react';
import { AssetPreview } from '@/components/AssetPreview';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { api, getToken, uploadAssetMultipart } from '@/lib/api';
import { formatDateTimePtBr } from '@/lib/format-date';
import type { SiteDetail } from '../site-types';

const TIMEZONES = [
  'America/Sao_Paulo',
  'America/Fortaleza',
  'America/Manaus',
  'Europe/Lisbon',
  'UTC',
  'America/New_York',
  'Europe/London',
];

export default function SiteDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';

  const [site, setSite] = useState<SiteDetail | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'cover' | 'site' | null>(
    null
  );

  const load = useCallback(async () => {
    if (!id) return;
    const data = await api<SiteDetail>(`/sites/${id}`);
    setSite(data);
    setName(data.name);
    setCode(data.code ?? '');
    setTimezone(data.timezone);
  }, [id]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        setError(null);
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
  }, [router, id, load]);

  async function onSaveMeta(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    const n = name.trim();
    if (!n) {
      setError('Indique o nome');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api(`/sites/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: n,
          code: code.trim() || undefined,
          timezone,
        }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSaving(false);
    }
  }

  async function onApplyCover() {
    if (!id || !coverFile) return;
    setCoverBusy(true);
    setError(null);
    try {
      const uploaded = (await uploadAssetMultipart(
        coverFile,
        `Capa ${name.trim() || 'site'}`
      )) as { id: string };
      await api(`/sites/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ coverAssetId: uploaded.id }),
      });
      setCoverFile(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setCoverBusy(false);
    }
  }

  async function onRemoveCover() {
    if (!id) return;
    setConfirmAction('cover');
  }

  async function onRemoveCoverConfirmed() {
    if (!id) return;
    setCoverBusy(true);
    setError(null);
    try {
      await api(`/sites/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ coverAssetId: null }),
      });
      setConfirmAction(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setCoverBusy(false);
    }
  }

  async function onDeleteSite() {
    if (!site) return;
    setConfirmAction('site');
  }

  async function onDeleteSiteConfirmed() {
    if (!site) return;
    setError(null);
    try {
      await api(`/sites/${site.id}`, { method: 'DELETE' });
      router.push('/sites');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    }
  }

  if (!id) {
    return <p className="text-muted">ID inválido.</p>;
  }

  return (
    <>
      <PageHeader
        title="Editar espaço"
        lead="Dados do local, imagem de referência e lista de dispositivos configurados."
        actions={
          <Link href="/sites" className="btn btn--ghost">
            <ArrowLeft size={17} strokeWidth={1.9} aria-hidden />
            Lista
          </Link>
        }
      />

      {error && <p className="text-danger">{error}</p>}
      {loading && <p className="text-muted">A carregar…</p>}
      {!loading && !site && !error && <p className="text-muted">Não encontrado.</p>}

      {site && (
        <>
          <div
            style={{
              display: 'grid',
              gap: 'var(--space-8)',
              gridTemplateColumns: 'minmax(0, 1fr)',
              maxWidth: 720,
            }}
          >
            <form
              onSubmit={(e) => void onSaveMeta(e)}
              className="surface-form-card"
              style={{ maxWidth: '100%' }}
            >
              <h2
                style={{
                  fontSize: 'var(--text-md)',
                  fontWeight: 600,
                  margin: '0 0 var(--space-4)',
                }}
              >
                Dados
              </h2>
              <label className="field">
                <span>Nome</span>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span>Código (opcional)</span>
                <input
                  className="input"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Fuso horário</span>
                <select
                  className="select"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-muted" style={{ fontSize: 'var(--text-xs)', margin: 0 }}>
                ID: <code>{site.id}</code>
              </p>
              <div className="form-actions">
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'A guardar…' : 'Guardar dados'}
                </button>
              </div>
            </form>

            <section className="surface-form-card" style={{ maxWidth: '100%' }}>
              <h2
                style={{
                  fontSize: 'var(--text-md)',
                  fontWeight: 600,
                  margin: '0 0 var(--space-4)',
                }}
              >
                Imagem do espaço
              </h2>
              <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  {site.coverAsset ? (
                    <AssetPreview
                      asset={{
                        id: site.coverAsset.id,
                        kind: site.coverAsset.kind,
                        mimeType: site.coverAsset.mimeType,
                        thumbnailKey: site.coverAsset.thumbnailKey,
                      }}
                      size={96}
                    />
                  ) : (
                    <span
                      className="text-muted"
                      style={{
                        display: 'inline-flex',
                        width: 96,
                        height: 96,
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--color-bg-soft)',
                        borderRadius: 12,
                        border: '1px dashed var(--color-border)',
                      }}
                    >
                      <Image size={32} strokeWidth={1.5} aria-hidden />
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label className="field" style={{ marginBottom: 'var(--space-3)' }}>
                    <span>Novo ficheiro de imagem</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="input"
                      style={{ padding: 'var(--space-2)' }}
                      disabled={coverBusy}
                      onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn btn--primary"
                      disabled={coverBusy || !coverFile}
                      onClick={() => void onApplyCover()}
                    >
                      {coverBusy ? 'A processar…' : 'Aplicar capa'}
                    </button>
                    {site.coverAsset ? (
                      <button
                        type="button"
                        className="btn btn--ghost"
                        disabled={coverBusy}
                        onClick={() => void onRemoveCover()}
                      >
                        Remover capa
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2
                style={{
                  fontSize: 'var(--text-md)',
                  fontWeight: 600,
                  margin: '0 0 var(--space-3)',
                }}
              >
                Dispositivos neste espaço ({site.devices.length})
              </h2>
              {site.devices.length === 0 ? (
                <p className="text-muted">Nenhum dispositivo. Crie ou mova dispositivos para este site.</p>
              ) : (
                <div className="surface-table-card">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Plataforma</th>
                        <th>Estado</th>
                        <th>Último contacto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {site.devices.map((d) => (
                        <tr key={d.id}>
                          <td>
                            <Link href={`/devices/${d.id}`}>{d.name}</Link>
                          </td>
                          <td>{d.platform}</td>
                          <td>{d.status}</td>
                          <td>
                            {d.lastSeenAt ? formatDateTimePtBr(d.lastSeenAt) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section>
              <button
                type="button"
                className="btn btn--ghost"
                style={{ color: 'var(--color-danger-text)' }}
                onClick={() => void onDeleteSite()}
              >
                <Trash2 size={17} strokeWidth={1.9} aria-hidden />
                Eliminar espaço
              </button>
            </section>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmAction === 'cover'}
        title="Remover imagem"
        message="Remover a imagem de capa deste espaço?"
        confirmLabel="Remover"
        loading={coverBusy}
        onConfirm={() => void onRemoveCoverConfirmed()}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        open={confirmAction === 'site'}
        title="Eliminar espaço"
        message={
          site
            ? `Eliminar «${site.name}»? Só é possível sem dispositivos associados.`
            : ''
        }
        confirmLabel="Eliminar"
        onConfirm={() => void onDeleteSiteConfirmed()}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
}
