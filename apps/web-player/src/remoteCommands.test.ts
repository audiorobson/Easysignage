import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingDeviceCommand } from '@easysignage/device-protocol';
import {
  ackCommand,
  executeRemoteCommand,
  fetchPendingCommands,
  pollAndExecuteCommands,
} from './remoteCommands';

const API = 'http://localhost:3001/api/v1';
const TOKEN = 'dev-token';

function cmd(overrides: Partial<PendingDeviceCommand> = {}): PendingDeviceCommand {
  return {
    id: 'cmd-1',
    channel: 'restart_player',
    payloadJson: {},
    createdAt: new Date('2026-07-18T10:00:00.000Z').toISOString(),
    ...overrides,
  };
}

describe('remoteCommands', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    delete (window as { easysignage?: unknown }).easysignage;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('fetchPendingCommands', () => {
    it('devolve a lista de comandos quando a resposta é ok', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ commands: [cmd()] }), { status: 200 })
      );
      const commands = await fetchPendingCommands(API, TOKEN);
      expect(commands).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledWith(
        `${API}/device/commands/pending`,
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
        })
      );
    });

    it('devolve [] quando a resposta falha ou a rede está fora', async () => {
      fetchMock.mockResolvedValueOnce(new Response('erro', { status: 500 }));
      expect(await fetchPendingCommands(API, TOKEN)).toEqual([]);

      fetchMock.mockRejectedValueOnce(new Error('offline'));
      expect(await fetchPendingCommands(API, TOKEN)).toEqual([]);
    });
  });

  describe('ackCommand', () => {
    it('faz POST para /device/commands/:id/ack com o payload', async () => {
      fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));
      await ackCommand(API, TOKEN, 'cmd-1', { status: 'acked' });

      expect(fetchMock).toHaveBeenCalledWith(
        `${API}/device/commands/cmd-1/ack`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
          body: JSON.stringify({ status: 'acked' }),
        })
      );
    });
  });

  describe('executeRemoteCommand', () => {
    it('restart_player: usa o bridge nativo quando disponível', async () => {
      const restartPlayer = vi.fn().mockResolvedValue(undefined);
      (window as unknown as { easysignage: unknown }).easysignage = {
        commands: { restartPlayer },
      };

      const result = await executeRemoteCommand(cmd({ channel: 'restart_player' }), {
        apiBase: API,
        getToken: () => TOKEN,
      });

      expect(restartPlayer).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ status: 'acked' });
    });

    it('restart_player: sem bridge, agenda reload sem falhar de imediato', async () => {
      vi.useFakeTimers();
      const result = await executeRemoteCommand(cmd({ channel: 'restart_player' }), {
        apiBase: API,
        getToken: () => TOKEN,
      });
      expect(result).toEqual({ status: 'acked' });
    });

    it('clear_cache: delega ao bridge nativo quando disponível', async () => {
      const clearCache = vi.fn().mockResolvedValue(undefined);
      (window as unknown as { easysignage: unknown }).easysignage = {
        commands: { clearCache },
      };

      const result = await executeRemoteCommand(cmd({ channel: 'clear_cache' }), {
        apiBase: API,
        getToken: () => TOKEN,
      });

      expect(clearCache).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ status: 'acked' });
    });

    it('open_url: falha sem payload.url', async () => {
      const result = await executeRemoteCommand(
        cmd({ channel: 'open_url', payloadJson: {} }),
        { apiBase: API, getToken: () => TOKEN }
      );
      expect(result.status).toBe('failed');
    });

    it('open_url: usa o bridge nativo com a url do payload', async () => {
      const openUrl = vi.fn().mockResolvedValue(undefined);
      (window as unknown as { easysignage: unknown }).easysignage = {
        commands: { openUrl },
      };

      const result = await executeRemoteCommand(
        cmd({ channel: 'open_url', payloadJson: { url: 'https://example.com' } }),
        { apiBase: API, getToken: () => TOKEN }
      );

      expect(openUrl).toHaveBeenCalledWith('https://example.com');
      expect(result).toEqual({ status: 'acked' });
    });

    it('reboot_os: falha em browser puro (sem bridge nativo)', async () => {
      const result = await executeRemoteCommand(cmd({ channel: 'reboot_os' }), {
        apiBase: API,
        getToken: () => TOKEN,
      });
      expect(result.status).toBe('failed');
      expect(result.result?.error).toMatch(/player nativo/);
    });

    it('reboot_os: acked quando o bridge nativo confirma', async () => {
      const rebootOs = vi.fn().mockResolvedValue(undefined);
      (window as unknown as { easysignage: unknown }).easysignage = {
        commands: { rebootOs },
      };
      const result = await executeRemoteCommand(cmd({ channel: 'reboot_os' }), {
        apiBase: API,
        getToken: () => TOKEN,
      });
      expect(rebootOs).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ status: 'acked' });
    });

    it('take_screenshot: usa o bridge nativo e envia a pré-visualização', async () => {
      const takeScreenshot = vi
        .fn()
        .mockResolvedValue({ base64: btoa('fake-jpeg'), mime: 'image/jpeg' });
      (window as unknown as { easysignage: unknown }).easysignage = {
        commands: { takeScreenshot },
      };
      fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));

      const result = await executeRemoteCommand(cmd({ channel: 'take_screenshot' }), {
        apiBase: API,
        getToken: () => TOKEN,
      });

      expect(takeScreenshot).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        `${API}/device/preview`,
        expect.objectContaining({ method: 'POST' })
      );
      expect(result).toEqual({ status: 'acked', result: { previewUploaded: true } });
    });

    it('take_screenshot: usa o fallback de captura DOM quando não há bridge', async () => {
      fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));
      const blob = new Blob(['fake'], { type: 'image/jpeg' });

      const result = await executeRemoteCommand(cmd({ channel: 'take_screenshot' }), {
        apiBase: API,
        getToken: () => TOKEN,
        captureFallback: async () => blob,
      });

      expect(result).toEqual({ status: 'acked', result: { previewUploaded: true } });
    });

    it('take_screenshot: falha quando não há bridge nem fallback', async () => {
      const result = await executeRemoteCommand(cmd({ channel: 'take_screenshot' }), {
        apiBase: API,
        getToken: () => TOKEN,
      });
      expect(result.status).toBe('failed');
    });

    it('canal desconhecido devolve failed', async () => {
      const result = await executeRemoteCommand(cmd({ channel: 'unknown_channel' }), {
        apiBase: API,
        getToken: () => TOKEN,
      });
      expect(result.status).toBe('failed');
    });
  });

  describe('pollAndExecuteCommands', () => {
    it('processa cada comando pendente e confirma via ack', async () => {
      const restartPlayer = vi.fn().mockResolvedValue(undefined);
      (window as unknown as { easysignage: unknown }).easysignage = {
        commands: { restartPlayer },
      };

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ commands: [cmd()] }), { status: 200 })
      );
      fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));

      const processed = await pollAndExecuteCommands({
        apiBase: API,
        getToken: () => TOKEN,
      });

      expect(processed).toBe(1);
      expect(restartPlayer).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        `${API}/device/commands/cmd-1/ack`,
        expect.objectContaining({ body: JSON.stringify({ status: 'acked' }) })
      );
    });

    it('não faz nada sem token', async () => {
      const processed = await pollAndExecuteCommands({
        apiBase: API,
        getToken: () => null,
      });
      expect(processed).toBe(0);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
