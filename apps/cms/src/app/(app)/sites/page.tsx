'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Image, Plus } from 'lucide-react';
import { AssetPreview } from '@/components/AssetPreview';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { api, getToken } from '@/lib/api';
import { formatDateTimePtBr } from '@/lib/format-date';
import type { SiteDetail } from './site-types';

export default function SitesPage() {
  const router = useRouter();
  const [items, setItems] = useState<SiteDetail[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteSite, setDeleteSite] = useState<SiteDetail | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const data = await api<SiteDetail[]>('/sites');
    setItems(data);
  }, []);

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

  async function onDeleteConfirmed() {
    const s = deleteSite;
    if (!s) return;
    setDeleting(true);
    setError(null);
    try {
      await api(`/sites/${s.id}`, { method: 'DELETE' });
      setDeleteSite(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao eliminar');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Sites"
        lead="Espaços físicos ou lógicos (lojas, filiais). Veja dispositivos por espaço e defina uma imagem de referência."
        actions={
          <Link href="/sites/new" className="btn btn--primary">
            <Plus strokeWidth={2.1} aria-hidden />
            Novo espaço
          </Link>
        }
      />

      <section>
        {error && <p className="text-danger">{error}</p>}
        {items === null && !error && <p className="text-muted">A carregar…</p>}
        {items && items.length === 0 && (
          <p className="text-muted">Nenhum espaço. Crie o primeiro para associar dispositivos.</p>
        )}
        {items && items.length > 0 && (
          <div className="surface-table-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 64 }}>Capa</th>
                  <th>Nome</th>
                  <th>Código</th>
                  <th>Fuso</th>
                  <th>Dispositivos</th>
                  <th>Atualizado</th>
                  <th style={{ width: 180, textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {s.coverAsset ? (
                        <AssetPreview
                          asset={{
                            id: s.coverAsset.id,
                            kind: s.coverAsset.kind,
                            mimeType: s.coverAsset.mimeType,
                            thumbnailKey: s.coverAsset.thumbnailKey,
                          }}
                        />
                      ) : (
                        <span
                          className="text-muted"
                          style={{
                            display: 'inline-flex',
                            width: 48,
                            height: 48,
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'var(--color-bg-soft)',
                            borderRadius: 8,
                            border: '1px solid var(--color-border)',
                          }}
                          aria-hidden
                        >
                          <Image size={18} strokeWidth={1.9} aria-hidden />
                        </span>
                      )}
                    </td>
                    <td>
                      <strong>{s.name}</strong>
                    </td>
                    <td>{s.code ?? '—'}</td>
                    <td>
                      <code style={{ fontSize: 'var(--text-xs)' }}>{s.timezone}</code>
                    </td>
                    <td>
                      {s.devices.length === 0 ? (
                        <span className="text-muted">Nenhum</span>
                      ) : (
                        <ul
                          style={{
                            margin: 0,
                            paddingLeft: '1.1rem',
                            maxWidth: 280,
                            fontSize: 'var(--text-sm)',
                          }}
                        >
                          {s.devices.map((d) => (
                            <li key={d.id}>
                              <Link href={`/devices/${d.id}`}>{d.name}</Link>
                              <span className="text-muted"> — {d.platform}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td>{formatDateTimePtBr(s.updatedAt)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <Link
                        href={`/sites/${s.id}`}
                        className="btn btn--ghost"
                        style={{ fontSize: '0.875rem', marginRight: 6 }}
                      >
                        Editar
                      </Link>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        style={{ fontSize: '0.875rem', color: 'var(--color-danger-text)' }}
                        onClick={() => setDeleteSite(s)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={deleteSite !== null}
        title="Eliminar espaço"
        message={
          deleteSite
            ? `Eliminar «${deleteSite.name}»? Só é permitido se não houver dispositivos associados.`
            : ''
        }
        confirmLabel="Eliminar"
        loading={deleting}
        onConfirm={() => void onDeleteConfirmed()}
        onCancel={() => setDeleteSite(null)}
      />
    </>
  );
}
