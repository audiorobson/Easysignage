import { createHash } from 'node:crypto';

export type ContentRevisionInput = {
  lastSyncAt: Date | null;
  currentPublicationId: string | null;
  currentItemJson: unknown;
};

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
