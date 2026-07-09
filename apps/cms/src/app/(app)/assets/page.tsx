'use client';

import { type FormEvent, useCallback, useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AssetPreview } from '@/components/AssetPreview';
import { api, getToken, uploadAssetMultipart } from '@/lib/api';
import { formatDateTimePtBr } from '@/lib/format-date';

type AssetRow = {
  id: string;
  name: string;
  kind: string;
  mimeType: string;
  remoteUrl: string | null;
  thumbnailKey?: string | null;
  fileSize: string;
  status: string;
  createdAt: string;
};

const KIND_FILTERS = [
  { id: '', label: 'Todos' },
  { id: 'image', label: 'Imagens' },
  { id: 'video', label: 'Vídeos' },
  { id: 'pdf', label: 'PDF' },
  { id: 'html', label: 'HTML' },
  { id: 'url', label: 'URLs' },
] as const;

function kindLabel(kind: string): string {
  const m: Record<string, string> = {
    image: 'Imagem',
    video: 'Vídeo',
    pdf: 'PDF',
    html: 'HTML',
    url: 'URL',
    file: 'Ficheiro',
  };
  return m[kind] ?? kind;
}

function formatSize(n: string): string {
  const b = Number(n);
  if (Number.isNaN(b)) return n;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

const ACCEPT_UPLOAD =
  'image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/bmp,image/avif,video/mp4,video/webm,video/ogg,video/quicktime,application/pdf,text/html,application/xhtml+xml,.html,.htm';

type UrlModalMode = 'create' | 'edit-url' | 'edit-file';

export default function AssetsPage() {
  const router = useRouter();
  const uploadInputId = useId();
  const [items, setItems] = useState<AssetRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [kindFilter, setKindFilter] = useState<string>('');

  const [urlModalOpen, setUrlModalOpen] = useState(false);
  const [urlModalMode, setUrlModalMode] = useState<UrlModalMode>('create');
  const [editAssetId, setEditAssetId] = useState<string | null>(null);
  const [urlName, setUrlName] = useState('');
  const [urlValue, setUrlValue] = useState('');
  const [urlModalSaving, setUrlModalSaving] = useState(false);

  const load = useCallback(async () => {
    const q = kindFilter ? `?kind=${encodeURIComponent(kindFilter)}` : '';
    const data = await api<AssetRow[]>(`/assets${q}`);
    setItems(data);
  }, [kindFilter]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        await load();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, load]);

  function openCreateUrlModal() {
    setUrlModalMode('create');
    setEditAssetId(null);
    setUrlName('');
    setUrlValue('');
    setError(null);
    setUrlModalOpen(true);
  }

  function openEditModal(asset: AssetRow) {
    if (asset.kind === 'url') {
      setUrlModalMode('edit-url');
      setEditAssetId(asset.id);
      setUrlName(asset.name);
      setUrlValue(asset.remoteUrl ?? '');
    } else {
      setUrlModalMode('edit-file');
      setEditAssetId(asset.id);
      setUrlName(asset.name);
      setUrlValue('');
    }
    setError(null);
    setUrlModalOpen(true);
  }

  function closeUrlModal() {
    if (urlModalSaving) return;
    setUrlModalOpen(false);
    setEditAssetId(null);
  }

  async function onSubmitUrlModal(ev: FormEvent) {
    ev.preventDefault();
    const name = urlName.trim();
    const remoteUrl = urlValue.trim();
    if (!name) {
      setError('Indique um nome');
      return;
    }
    if (urlModalMode !== 'edit-file' && !remoteUrl) {
      setError('Indique a URL');
      return;
    }
    setUrlModalSaving(true);
    setError(null);
    try {
      if (urlModalMode === 'create') {
        await api('/assets', {
          method: 'POST',
          body: JSON.stringify({ name, remoteUrl }),
        });
      } else if (urlModalMode === 'edit-url' && editAssetId) {
        await api(`/assets/${editAssetId}`, {
          method: 'PATCH',
          body: JSON.stringify({ name, remoteUrl }),
        });
      } else if (urlModalMode === 'edit-file' && editAssetId) {
        await api(`/assets/${editAssetId}`, {
          method: 'PATCH',
          body: JSON.stringify({ name }),
        });
      }
      setUrlModalOpen(false);
      setEditAssetId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setUrlModalSaving(false);
    }
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadAssetMultipart(file, file.name || 'asset');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro no upload');
    } finally {
      setUploading(false);
    }
  }

  async function onDelete(asset: AssetRow) {
    const ok = window.confirm(
      `Remover o asset «${asset.name}»? Não é possível se estiver numa playlist.`
    );
    if (!ok) return;
    setError(null);
    try {
      await api<void>(`/assets/${asset.id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover');
    }
  }

  const urlModalTitle =
    urlModalMode === 'create'
      ? 'Nova URL'
      : urlModalMode === 'edit-url'
        ? 'Editar URL'
        : 'Editar asset';

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Assets</h1>
          <p className="page-header__lead">
            Gira e distribui ficheiros multimédia na rede de sinalização.
            Upload multipart; miniaturas automáticas para imagens. Para URLs
            externas, filtra por «URLs» e adiciona uma ligação.
          </p>
        </div>
        <div className="page-header__actions">
          {kindFilter === 'url' && (
            <button
              type="button"
              className="btn btn--primary"
              title="Adicionar URL"
              aria-label="Adicionar URL"
              onClick={openCreateUrlModal}
            >
              <i className="fa-solid fa-link" aria-hidden />
              Nova URL
            </button>
          )}
          <input
            id={uploadInputId}
            type="file"
            className="sr-only"
            accept={ACCEPT_UPLOAD}
            disabled={uploading}
            aria-label="Enviar ficheiro"
            onChange={(ev) => void onFileChange(ev)}
          />
          <label
            htmlFor={uploadInputId}
            className="btn btn--gradient"
            style={{ cursor: uploading ? 'wait' : 'pointer' }}
          >
            <i className="fa-solid fa-upload" aria-hidden />
            {uploading ? 'A enviar…' : 'Enviar ficheiro'}
          </label>
        </div>
      </header>

      <section style={{ marginBottom: 'var(--space-8)' }}>
        <div className="filter-pills">
          {KIND_FILTERS.map((f) => (
            <button
              key={f.id || 'all'}
              type="button"
              className={`btn ${kindFilter === f.id ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => setKindFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        {error && <p className="text-danger">{error}</p>}
        {!items && !error && <p className="text-muted">Carregando…</p>}
        {items && items.length === 0 && (
          <p className="text-muted">Nenhum asset neste filtro.</p>
        )}
        {items && items.length > 0 && (
          <div className="surface-table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 56 }}>Pré-visualização</th>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Origem</th>
                <th>Tamanho</th>
                <th>Criado</th>
                <th style={{ width: '140px', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  <td>
                    <AssetPreview
                      asset={{
                        id: a.id,
                        kind: a.kind,
                        mimeType: a.mimeType,
                        thumbnailKey: a.thumbnailKey,
                        remoteUrl: a.remoteUrl,
                        fileSize: a.fileSize,
                      }}
                    />
                  </td>
                  <td>{a.name}</td>
                  <td>
                    <code>{kindLabel(a.kind)}</code>
                  </td>
                  <td>
                    {a.remoteUrl ? (
                      <a
                        href={a.remoteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {a.remoteUrl.length > 48
                          ? `${a.remoteUrl.slice(0, 45)}…`
                          : a.remoteUrl}
                      </a>
                    ) : (
                      <code>{a.mimeType}</code>
                    )}
                  </td>
                  <td>{a.kind === 'url' ? '—' : formatSize(a.fileSize)}</td>
                  <td>{formatDateTimePtBr(a.createdAt)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      style={{ marginRight: '0.35rem', fontSize: '0.875rem' }}
                      onClick={() => openEditModal(a)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      style={{ fontSize: '0.875rem', color: 'var(--color-danger, #b91c1c)' }}
                      onClick={() => void onDelete(a)}
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>

      {urlModalOpen && (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={closeUrlModal}
          onKeyDown={(e) => {
            if (e.key === 'Escape') closeUrlModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-modal-title"
            style={{
              width: '100%',
              maxWidth: '420px',
              background: 'var(--color-surface, #fff)',
              borderRadius: 'var(--radius-md, 14px)',
              border: '1px solid var(--color-border, #e2e8f0)',
              boxShadow: 'var(--shadow-lg, 0 16px 40px rgba(15,23,42,0.12))',
              padding: '1.25rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="asset-modal-title"
              style={{
                margin: '0 0 1rem',
                fontSize: '1.125rem',
                fontWeight: 600,
              }}
            >
              {urlModalTitle}
            </h2>
            <form onSubmit={onSubmitUrlModal}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                <label>
                  <span className="text-muted">Nome</span>
                  <input
                    type="text"
                    className="input"
                    value={urlName}
                    onChange={(e) => setUrlName(e.target.value)}
                    placeholder="Nome do asset"
                    style={{ width: '100%', marginTop: '0.25rem' }}
                    autoFocus
                    disabled={urlModalSaving}
                  />
                </label>
                {urlModalMode !== 'edit-file' && (
                  <label>
                    <span className="text-muted">URL (https ou http)</span>
                    <input
                      type="url"
                      className="input"
                      value={urlValue}
                      onChange={(e) => setUrlValue(e.target.value)}
                      placeholder="https://…"
                      style={{ width: '100%', marginTop: '0.25rem' }}
                      disabled={urlModalSaving}
                    />
                  </label>
                )}
                {urlModalMode === 'edit-file' && (
                  <p className="text-muted" style={{ margin: 0, fontSize: '0.875rem' }}>
                    Apenas o nome pode ser alterado. Para substituir o ficheiro,
                    remova este asset e envie um novo.
                  </p>
                )}
                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    justifyContent: 'flex-end',
                    marginTop: '0.5rem',
                  }}
                >
                  <button
                    type="button"
                    className="btn btn--ghost"
                    disabled={urlModalSaving}
                    onClick={closeUrlModal}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn--primary"
                    disabled={urlModalSaving}
                  >
                    {urlModalSaving ? 'A guardar…' : 'Guardar'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
