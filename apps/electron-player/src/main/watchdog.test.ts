import { describe, expect, it, vi } from 'vitest';
import { RendererWatchdog, isKioskModeEnabled } from './watchdog';

describe('RendererWatchdog', () => {
  describe('handleRendererGone', () => {
    it('recria a janela em cada crash', () => {
      const recreateWindow = vi.fn();
      const watchdog = new RendererWatchdog({
        reload: vi.fn(),
        recreateWindow,
      });

      watchdog.handleRendererGone('crashed');

      expect(recreateWindow).toHaveBeenCalledTimes(1);
    });

    it('regista aviso de crash loop ao ultrapassar o limiar dentro da janela', () => {
      const log = vi.fn();
      let clock = 0;
      const watchdog = new RendererWatchdog(
        { reload: vi.fn(), recreateWindow: vi.fn(), log, now: () => clock },
        { crashLoopThreshold: 3, crashWindowMs: 10_000 }
      );

      watchdog.handleRendererGone('crashed');
      clock += 1000;
      watchdog.handleRendererGone('crashed');
      clock += 1000;
      watchdog.handleRendererGone('crashed');

      expect(log).toHaveBeenLastCalledWith(expect.stringContaining('crash loop'));
      expect(watchdog.crashesInWindow()).toBe(3);
    });

    it('esquece crashes fora da janela deslizante', () => {
      let clock = 0;
      const watchdog = new RendererWatchdog(
        { reload: vi.fn(), recreateWindow: vi.fn(), now: () => clock },
        { crashWindowMs: 5_000 }
      );

      watchdog.handleRendererGone('crashed');
      clock += 10_000;
      watchdog.handleRendererGone('crashed');

      expect(watchdog.crashesInWindow()).toBe(1);
    });
  });

  describe('handleUnresponsive', () => {
    it('recarrega a página sem recriar a janela', () => {
      const reload = vi.fn();
      const recreateWindow = vi.fn();
      const watchdog = new RendererWatchdog({ reload, recreateWindow });

      watchdog.handleUnresponsive();

      expect(reload).toHaveBeenCalledTimes(1);
      expect(recreateWindow).not.toHaveBeenCalled();
    });
  });

  describe('handleLoadFailed', () => {
    it('agenda uma nova tentativa após o delay configurado', () => {
      vi.useFakeTimers();
      const retry = vi.fn();
      const watchdog = new RendererWatchdog({ reload: vi.fn(), recreateWindow: vi.fn() });

      watchdog.handleLoadFailed('ERR_CONNECTION_REFUSED', retry, 3000);
      expect(retry).not.toHaveBeenCalled();

      vi.advanceTimersByTime(3000);
      expect(retry).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });
});

describe('isKioskModeEnabled', () => {
  it('é true por padrão (sem variável definida)', () => {
    expect(isKioskModeEnabled({})).toBe(true);
  });

  it.each(['0', 'false', 'off', 'FALSE', 'Off'])(
    'é false quando EASYSIGNAGE_KIOSK=%s',
    (value) => {
      expect(isKioskModeEnabled({ EASYSIGNAGE_KIOSK: value })).toBe(false);
    }
  );

  it.each(['1', 'true', 'on'])('é true quando EASYSIGNAGE_KIOSK=%s', (value) => {
    expect(isKioskModeEnabled({ EASYSIGNAGE_KIOSK: value })).toBe(true);
  });
});
