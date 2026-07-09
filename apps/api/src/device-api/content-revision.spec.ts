import { computeContentRevision } from './content-revision';

describe('computeContentRevision', () => {
  const base = {
    lastSyncAt: new Date('2026-07-09T12:00:00.000Z'),
    currentPublicationId: 'pub-uuid',
    currentItemJson: { type: 'playlist', playlistId: 'pl-1' },
  };

  it('returns a 32-char hex string', () => {
    const rev = computeContentRevision(base, '2026-07-09T10:00:00.000Z');
    expect(rev).toMatch(/^[a-f0-9]{32}$/);
  });

  it('changes when playlist stamp changes', () => {
    const a = computeContentRevision(base, 'stamp-a');
    const b = computeContentRevision(base, 'stamp-b');
    expect(a).not.toBe(b);
  });

  it('changes when currentItemJson changes', () => {
    const a = computeContentRevision(base, '');
    const b = computeContentRevision(
      { ...base, currentItemJson: { type: 'asset', assetId: 'x' } },
      ''
    );
    expect(a).not.toBe(b);
  });

  it('is stable for the same inputs', () => {
    expect(computeContentRevision(base, 'x')).toBe(
      computeContentRevision(base, 'x')
    );
  });
});
