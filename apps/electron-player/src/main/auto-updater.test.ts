import { describe, expect, it, vi } from 'vitest';
import type { AppUpdater } from 'electron-updater';
import { handleUpdateAvailable } from './auto-updater';

function fakeUpdater(overrides: Partial<AppUpdater> = {}): AppUpdater {
  return {
    setFeedURL: vi.fn(),
    checkForUpdates: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as AppUpdater;
}

describe('handleUpdateAvailable', () => {
  it('não faz nada fora de build empacotada (dev)', async () => {
    const updater = fakeUpdater();
    const result = await handleUpdateAvailable(
      { version: '1.1.0', channel: 'stable', downloadUrl: 'https://cdn.example.com/latest' },
      updater,
      { isPackaged: false }
    );

    expect(result).toEqual({ attempted: false });
    expect(updater.setFeedURL).not.toHaveBeenCalled();
    expect(updater.checkForUpdates).not.toHaveBeenCalled();
  });

  it('não faz nada quando a release não tem downloadUrl', async () => {
    const updater = fakeUpdater();
    const result = await handleUpdateAvailable(
      { version: '1.1.0', channel: 'stable', downloadUrl: null },
      updater,
      { isPackaged: true }
    );

    expect(result).toEqual({ attempted: false });
    expect(updater.setFeedURL).not.toHaveBeenCalled();
  });

  it('configura o feed genérico e verifica updates quando empacotado com downloadUrl', async () => {
    const updater = fakeUpdater();
    const result = await handleUpdateAvailable(
      { version: '1.1.0', channel: 'stable', downloadUrl: 'https://cdn.example.com/latest' },
      updater,
      { isPackaged: true }
    );

    expect(result).toEqual({ attempted: true });
    expect(updater.setFeedURL).toHaveBeenCalledWith({
      provider: 'generic',
      url: 'https://cdn.example.com/latest',
    });
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it('não propaga excepção quando checkForUpdates falha', async () => {
    const updater = fakeUpdater({
      checkForUpdates: vi.fn().mockRejectedValue(new Error('sem rede')),
    });
    const log = vi.fn();

    const result = await handleUpdateAvailable(
      { version: '1.1.0', channel: 'stable', downloadUrl: 'https://cdn.example.com/latest' },
      updater,
      { isPackaged: true, log }
    );

    expect(result).toEqual({ attempted: false });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('falha ao verificar'));
  });
});
