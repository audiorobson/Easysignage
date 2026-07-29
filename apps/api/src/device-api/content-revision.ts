import { createHash } from 'node:crypto';
import type { PrismaService } from '../prisma/prisma.service';

export type ContentRevisionInput = {
  lastSyncAt: Date | null;
  currentPublicationId: string | null;
  currentItemJson: unknown;
};

type PrismaLike = Pick<PrismaService, 'playlist'>;

/** Hash estável que o player usa para invalidar cache e confirmar ack. */
export function computeContentRevision(
  row: ContentRevisionInput | null,
  playlistUpdatedStamp: string
): string {
  const payload = JSON.stringify({
    sync: row?.lastSyncAt?.toISOString() ?? '',
    pub: row?.currentPublicationId ?? '',
    playlist: playlistUpdatedStamp,
    item: row?.currentItemJson ?? null,
  });
  return createHash('sha256').update(payload).digest('hex').slice(0, 32);
}

/** Stamp de playlists referenciadas pelo `currentItemJson`. */
export async function resolvePlaylistStamp(
  prisma: PrismaLike,
  tenantId: string,
  item: Record<string, unknown> | null
): Promise<string> {
  if (!item) return '';
  if (item['type'] === 'playlist' && typeof item['playlistId'] === 'string') {
    const pl = await prisma.playlist.findFirst({
      where: { id: item['playlistId'], tenantId },
      select: { updatedAt: true },
    });
    return pl?.updatedAt.toISOString() ?? '';
  }
  if (item['type'] === 'layout' && Array.isArray(item['zones'])) {
    const ids = new Set<string>();
    for (const raw of item['zones']) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
      const src = (raw as Record<string, unknown>)['source'];
      if (!src || typeof src !== 'object' || Array.isArray(src)) continue;
      const s = src as Record<string, unknown>;
      if (s['type'] === 'playlist' && typeof s['playlistId'] === 'string') {
        ids.add(s['playlistId']);
      }
    }
    if (!ids.size) {
      return typeof item['revision'] === 'string' ? item['revision'] : '';
    }
    const rows = await prisma.playlist.findMany({
      where: { tenantId, id: { in: [...ids] } },
      select: { id: true, updatedAt: true },
      orderBy: { id: 'asc' },
    });
    return rows.map((r) => `${r.id}:${r.updatedAt.toISOString()}`).join('|');
  }
  if (item['type'] === 'wall_tile') {
    const wallId = typeof item['wallId'] === 'string' ? item['wallId'] : '';
    const revision =
      typeof item['wallRevision'] === 'string' ? item['wallRevision'] : '';
    const sync = item['sync'];
    let epoch = '';
    if (sync && typeof sync === 'object' && !Array.isArray(sync)) {
      const e = (sync as Record<string, unknown>)['epochMs'];
      if (typeof e === 'number') epoch = String(e);
    }
    const src = item['source'];
    if (src && typeof src === 'object' && !Array.isArray(src)) {
      const s = src as Record<string, unknown>;
      if (s['type'] === 'playlist' && typeof s['playlistId'] === 'string') {
        const pl = await prisma.playlist.findFirst({
          where: { id: s['playlistId'], tenantId },
          select: { updatedAt: true },
        });
        return `${wallId}:${revision}:${epoch}:${pl?.updatedAt.toISOString() ?? ''}`;
      }
    }
    return `${wallId}:${revision}:${epoch}`;
  }
  return '';
}

export async function computeExpectedContentRevision(
  prisma: PrismaLike,
  tenantId: string,
  row: ContentRevisionInput | null
): Promise<string> {
  const item = row?.currentItemJson as Record<string, unknown> | null;
  const playlistStamp = await resolvePlaylistStamp(prisma, tenantId, item);
  return computeContentRevision(row, playlistStamp);
}
