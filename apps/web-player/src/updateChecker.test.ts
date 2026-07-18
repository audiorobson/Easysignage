import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SoftwareReleaseSummary } from '@easysignage/shared-types';
import { checkForUpdate, fetchLatestRelease, startUpdateCheckLoop } from './updateChecker';

const API = 'http://localhost:3001/api/v1';

function release(overrides: Partial<SoftwareReleaseSummary> = {}): SoftwareReleaseSummary {
  return {
    product: 'electron-player',
    version: '1.1.0',
    channel: 'stable',
    publishedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('updateChecker', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete (window as { easysignage?: unknown }).easysignage;
  });

  describe('fetchLatestRelease', () => {
    it('devolve null sem token (não faz fetch)', async () => {
      fetchMock = vi.fn();
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await fetchLatestRelease({ apiBase: API, getToken: () => null });
      expect(result).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('consulta GET /device/releases/latest com o token do device', async () => {
      fetchMock = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ release: release() }), { status: 200 }));
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await fetchLatestRelease({ apiBase: API, getToken: () => 'dev-token' });

      expect(result).toEqual(release());
      expect(fetchMock).toHaveBeenCalledWith(
        `${API}/device/releases/latest?product=electron-player`,
        { headers: { Authorization: 'Bearer dev-token' } }
      );
    });

    it('devolve null em erro de rede ou resposta não-ok', async () => {
      fetchMock = vi.fn().mockResolvedValue(new Response('erro', { status: 500 }));
      global.fetch = fetchMock as unknown as typeof fetch;
      expect(await fetchLatestRelease({ apiBase: API, getToken: () => 't' })).toBeNull();

      fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
      global.fetch = fetchMock as unknown as typeof fetch;
      expect(await fetchLatestRelease({ apiBase: API, getToken: () => 't' })).toBeNull();
    });
  });

  describe('checkForUpdate', () => {
    it('shouldUpdate=true quando a release remota é mais recente e compatível', async () => {
      fetchMock = vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ release: release({ version: '2.0.0' }) }), { status: 200 })
        );
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await checkForUpdate('1.0.0', 'stable', { apiBase: API, getToken: () => 't' });

      expect(result.shouldUpdate).toBe(true);
      expect(result.release?.version).toBe('2.0.0');
    });

    it('shouldUpdate=false quando a release é beta e o canal é stable', async () => {
      fetchMock = vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ release: release({ version: '2.0.0', channel: 'beta' }) }), {
            status: 200,
          })
        );
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await checkForUpdate('1.0.0', 'stable', { apiBase: API, getToken: () => 't' });

      expect(result.shouldUpdate).toBe(false);
    });
  });

  describe('startUpdateCheckLoop', () => {
    it('chama onUpdateAvailable e o bridge nativo quando há update', async () => {
      fetchMock = vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ release: release({ version: '2.0.0' }) }), { status: 200 })
        );
      global.fetch = fetchMock as unknown as typeof fetch;

      const notifyUpdateAvailable = vi.fn().mockResolvedValue(undefined);
      (window as unknown as { easysignage: unknown }).easysignage = {
        updater: { notifyUpdateAvailable },
      };
      const onUpdateAvailable = vi.fn();

      const stop = startUpdateCheckLoop(
        '1.0.0',
        { apiBase: API, getToken: () => 't', onUpdateAvailable },
        60_000
      );

      await vi.waitFor(() => expect(onUpdateAvailable).toHaveBeenCalledTimes(1));
      expect(onUpdateAvailable).toHaveBeenCalledWith(release({ version: '2.0.0' }));
      await vi.waitFor(() => expect(notifyUpdateAvailable).toHaveBeenCalledTimes(1));

      stop();
    });

    it('não chama onUpdateAvailable quando já está atualizado', async () => {
      fetchMock = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ release: release() }), { status: 200 }));
      global.fetch = fetchMock as unknown as typeof fetch;
      const onUpdateAvailable = vi.fn();

      const stop = startUpdateCheckLoop(
        '1.1.0',
        { apiBase: API, getToken: () => 't', onUpdateAvailable },
        60_000
      );

      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      expect(onUpdateAvailable).not.toHaveBeenCalled();
      stop();
    });

    it('para de verificar depois de chamar a função de cleanup', async () => {
      vi.useFakeTimers();
      fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ release: null }), { status: 200 }));
      global.fetch = fetchMock as unknown as typeof fetch;

      const stop = startUpdateCheckLoop('1.0.0', { apiBase: API, getToken: () => 't' }, 1000);
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

      stop();
      vi.advanceTimersByTime(5000);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
