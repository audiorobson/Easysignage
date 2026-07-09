'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AssetPreview } from '@/components/AssetPreview';
import { api, getToken } from '@/lib/api';
import { formatDateTimePtBr } from '@/lib/format-date';
import type { SiteDetail } from './site-types';

export default function SitesPage() {
  const router = useRouter();
  const [items, setItems] = useState<SiteDetail[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  async function onDelete(s: SiteDetail) {
    const ok = window.confirm(
      `Eliminar o espaço «${s.name}»? Só é permitido se não houver dispositivos associados.`
    );
    if (!ok) return;
    setError(null);
    try {
      await api(`/sites/${s.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao eliminar');
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Sites</h1>
          <p className="page-header__lead">
            Espaços físicos ou lógicos (lojas, filiais). Veja dispositivos por espaço e
            defina uma imagem de referência.
          </p>
        </div>
        <div className="page-header__actions">
          <Link href="/sites/new" className="btn btn--gradient">
            <i className="fa-solid fa-plus" aria-hidden />
            Novo espaço
          </Link>
        </div>
      </header>

      <section>
        {error && <p className="text-danger">{error}</p>}
        {items === null && !error && <p className="text-muted">Carregando…</p>}
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
                          <i className="fa-solid fa-image" />
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
                        onClick={() => void onDelete(s)}
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
    </>
  );
}
