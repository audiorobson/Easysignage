'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Grid2x2, Plus } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { api, getToken } from '@/lib/api';
import { formatDateTimePtBr } from '@/lib/format-date';
import type { VideoWallListItem } from './video-wall-types';
import { LicenseFeatureBanner } from '@/components/LicenseFeatureBanner';
import { useLicenseStatus } from '@/lib/use-license-status';

export default function VideoWallsPage() {
  const router = useRouter();
  const { hasFeature } = useLicenseStatus();
  const canManage = hasFeature('video_walls');
  const [items, setItems] = useState<VideoWallListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await api<VideoWallListItem[]>('/video-walls');
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

  return (
    <>
      <PageHeader
        title="Video walls"
        lead="Paredes de ecrãs sincronizadas — mapeie devices numa grelha e publique uma playlist partida em tiles."
        actions={
          canManage ? (
            <Link href="/video-walls/new" className="btn btn--primary">
              <Plus strokeWidth={2.1} aria-hidden />
              Nova parede
            </Link>
          ) : (
            <span className="btn btn--primary" style={{ opacity: 0.5, pointerEvents: 'none' }}>
              <Plus strokeWidth={2.1} aria-hidden />
              Nova parede
            </span>
          )
        }
      />

      <LicenseFeatureBanner feature="video_walls" />

      <section>
        {error && <p className="text-danger">{error}</p>}
        {items === null && !error && <p className="text-muted">A carregar…</p>}
        {items && items.length === 0 && (
          <p className="text-muted">
            Nenhuma video wall. Crie uma para alinhar vários dispositivos num canvas virtual.
          </p>
        )}
        {items && items.length > 0 && (
          <div className="card-grid">
            {items.map((w) => (
              <Link key={w.id} href={`/video-walls/${w.id}`} className="card card--link">
                <div className="card__header">
                  <span className="card__icon" aria-hidden>
                    <Grid2x2 size={18} strokeWidth={2} />
                  </span>
                  <div>
                    <h2 className="card__title">{w.name}</h2>
                    <p className="card__meta">{w.site.name}</p>
                  </div>
                  <span className={`badge ${w.status === 'active' ? 'badge--success' : 'badge--neutral'}`}>
                    {w.status}
                  </span>
                </div>
                <dl className="card__stats">
                  <div>
                    <dt>Grelha</dt>
                    <dd>
                      {w.gridRows}×{w.gridCols}
                    </dd>
                  </div>
                  <div>
                    <dt>Tiles</dt>
                    <dd>{w._count.tiles}</dd>
                  </div>
                  <div>
                    <dt>Canvas</dt>
                    <dd>
                      {w.virtualWidth}×{w.virtualHeight}
                    </dd>
                  </div>
                </dl>
                <p className="card__foot text-muted">
                  Atualizado {formatDateTimePtBr(w.updatedAt)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
