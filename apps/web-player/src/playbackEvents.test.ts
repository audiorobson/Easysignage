import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __clearPlaybackQueueForTests,
  enqueuePlaybackEvent,
  flushPlaybackQueue,
} from './playbackEvents';

const API = 'http://localhost:3001/api/v1';
const TOKEN = 'dev-token';

function baseEvent(overrides: Partial<Parameters<typeof enqueuePlaybackEvent>[0]> = {}) {
  return {
    itemType: 'asset' as const,
    assetId: 'asset-1',
    eventType: 'started' as const,
    startedAt: new Date('2026-07-18T10:00:00.000Z').toISOString(),
    ...overrides,
  };
}

describe('playbackEvents queue', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    await __clearPlaybackQueueForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mantém eventos na fila quando o envio falha (offline)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    await enqueuePlaybackEvent(baseEvent());
    const result = await flushPlaybackQueue(API, TOKEN);

    expect(result.sent).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reenvia e esvazia a fila quando a rede volta (online)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    await enqueuePlaybackEvent(baseEvent());
    await flushPlaybackQueue(API, TOKEN);

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ accepted: 1 }), { status: 200 }));
    const result = await flushPlaybackQueue(API, TOKEN);

    expect(result.sent).toBe(1);
    expect(result.remaining).toBe(0);

    // Nada mais para enviar — não deve chamar fetch de novo.
    fetchMock.mockClear();
    const secondFlush = await flushPlaybackQueue(API, TOKEN);
    expect(secondFlush).toEqual({ sent: 0, remaining: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envia o corpo esperado (POST /device/playback-events com Authorization)', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ accepted: 1 }), { status: 200 }));
    await enqueuePlaybackEvent(baseEvent({ eventType: 'completed', durationMs: 8000 }));

    await flushPlaybackQueue(API, TOKEN);

    expect(fetchMock).toHaveBeenCalledWith(
      `${API}/device/playback-events`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toMatchObject({ eventType: 'completed', durationMs: 8000 });
    // Campos internos da fila (id/enqueuedAt) não devem ser enviados ao servidor.
    expect(body.events[0].id).toBeUndefined();
    expect(body.events[0].enqueuedAt).toBeUndefined();
  });

  it('não chama fetch quando a fila está vazia', async () => {
    const result = await flushPlaybackQueue(API, TOKEN);
    expect(result).toEqual({ sent: 0, remaining: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
