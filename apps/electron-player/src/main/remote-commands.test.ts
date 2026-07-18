import { describe, expect, it, vi } from 'vitest';
import {
  buildRebootCommand,
  captureScreenshotJpegBase64,
  clearPlayerCache,
  openUrlInPlayer,
  rebootOs,
  restartPlayer,
  type SpawnFn,
} from './remote-commands';

describe('restartPlayer', () => {
  it('relança o processo e sai com código 0', () => {
    const relaunch = vi.fn();
    const exit = vi.fn();
    restartPlayer({ relaunch, exit });
    expect(relaunch).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });
});

describe('clearPlayerCache', () => {
  it('limpa cache e storage antes de recarregar', async () => {
    const order: string[] = [];
    const clearCache = vi.fn(async () => {
      order.push('clearCache');
    });
    const clearStorageData = vi.fn(async () => {
      order.push('clearStorageData');
    });
    const reload = vi.fn(() => order.push('reload'));

    await clearPlayerCache({ clearCache, clearStorageData, reload });

    expect(order).toEqual(['clearCache', 'clearStorageData', 'reload']);
  });
});

describe('openUrlInPlayer', () => {
  it('navega para URLs http/https válidos', async () => {
    const loadURL = vi.fn(async () => {});
    await openUrlInPlayer({ loadURL }, 'https://example.com/diagnostico');
    expect(loadURL).toHaveBeenCalledWith('https://example.com/diagnostico');
  });

  it('rejeita URLs inválidos ou sem protocolo http(s)', async () => {
    const loadURL = vi.fn(async () => {});
    await expect(
      openUrlInPlayer({ loadURL }, 'javascript:alert(1)')
    ).rejects.toThrow(/URL inválido/);
    await expect(openUrlInPlayer({ loadURL }, '')).rejects.toThrow();
    expect(loadURL).not.toHaveBeenCalled();
  });
});

describe('buildRebootCommand', () => {
  it('usa shutdown /r /t 0 no Windows', () => {
    expect(buildRebootCommand('win32')).toEqual({
      command: 'shutdown',
      args: ['/r', '/t', '0'],
    });
  });

  it('usa shutdown -r now no macOS', () => {
    expect(buildRebootCommand('darwin')).toEqual({
      command: 'shutdown',
      args: ['-r', 'now'],
    });
  });

  it('usa reboot no Linux', () => {
    expect(buildRebootCommand('linux')).toEqual({ command: 'reboot', args: [] });
  });
});

describe('rebootOs', () => {
  it('invoca o spawn com o comando correto para a plataforma', () => {
    const spawnFn = vi.fn().mockReturnValue({});
    rebootOs(spawnFn as unknown as SpawnFn, 'linux');
    expect(spawnFn).toHaveBeenCalledWith('reboot', [], {
      stdio: 'ignore',
      detached: true,
    });
  });
});

describe('captureScreenshotJpegBase64', () => {
  it('converte o NativeImage capturado para base64 JPEG', async () => {
    const buf = Buffer.from('fake-jpeg-bytes');
    const toJPEG = vi.fn().mockReturnValue(buf);
    const capturePage = vi.fn().mockResolvedValue({ toJPEG });

    const result = await captureScreenshotJpegBase64({ capturePage });

    expect(toJPEG).toHaveBeenCalledWith(70);
    expect(result).toBe(buf.toString('base64'));
  });

  it('aceita uma qualidade JPEG customizada', async () => {
    const toJPEG = vi.fn().mockReturnValue(Buffer.from('x'));
    const capturePage = vi.fn().mockResolvedValue({ toJPEG });

    await captureScreenshotJpegBase64({ capturePage }, 40);

    expect(toJPEG).toHaveBeenCalledWith(40);
  });
});
