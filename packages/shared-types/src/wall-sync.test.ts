import {
  classifyWallDrift,
  computeWallDriftMs,
  computeWallPlaybackAt,
  isWallPlaybackSync,
  parseWallSyncFromSnapshot,
} from './wall-sync.js';

const slides = [{ durationMs: 10_000 }, { durationMs: 5_000 }];

describe('computeWallPlaybackAt', () => {
  it('retorna o primeiro slide no início do ciclo', () => {
    const pos = computeWallPlaybackAt(slides, 0, 0);
    expect(pos).toEqual({ itemIndex: 0, positionMs: 0, elapsedMs: 0 });
  });

  it('avança para o segundo slide após a duração do primeiro', () => {
    const pos = computeWallPlaybackAt(slides, 0, 11_000);
    expect(pos.itemIndex).toBe(1);
    expect(pos.positionMs).toBe(1_000);
  });

  it('recomeça o ciclo após a soma das durações (loop)', () => {
    const pos = computeWallPlaybackAt(slides, 0, 15_500);
    expect(pos.itemIndex).toBe(0);
    expect(pos.positionMs).toBe(500);
  });

  it('trata lista vazia sem lançar erro', () => {
    expect(computeWallPlaybackAt([], 0, 5000)).toEqual({
      itemIndex: 0,
      positionMs: 0,
      elapsedMs: 5000,
    });
  });
});

describe('computeWallDriftMs', () => {
  it('é zero quando o player está exatamente na posição esperada', () => {
    const drift = computeWallDriftMs(slides, 0, 3_000, {
      itemIndex: 0,
      positionMs: 3_000,
    });
    expect(drift).toBe(0);
  });

  it('é positivo quando o player está adiantado no mesmo item', () => {
    const drift = computeWallDriftMs(slides, 0, 3_000, {
      itemIndex: 0,
      positionMs: 3_500,
    });
    expect(drift).toBe(500);
  });

  it('penaliza fortemente quando o itemIndex já diverge', () => {
    const drift = computeWallDriftMs(slides, 0, 3_000, {
      itemIndex: 1,
      positionMs: 0,
    });
    // esperado ainda no item 0; player já está no item 1 => 1 item de avanço "fantasma"
    expect(Math.abs(drift)).toBeGreaterThan(1000);
  });
});

describe('classifyWallDrift', () => {
  it('classifica ok dentro da tolerância', () => {
    expect(classifyWallDrift(50, 80, true)).toBe('ok');
  });

  it('classifica warn até 4x a tolerância', () => {
    expect(classifyWallDrift(200, 80, true)).toBe('warn');
  });

  it('classifica critical acima de 4x a tolerância', () => {
    expect(classifyWallDrift(400, 80, true)).toBe('critical');
  });

  it('classifica critical sempre que o itemIndex não corresponde, mesmo com drift baixo', () => {
    expect(classifyWallDrift(10, 80, false)).toBe('critical');
  });
});

describe('isWallPlaybackSync / parseWallSyncFromSnapshot', () => {
  it('valida um objeto de sync bem formado', () => {
    expect(
      isWallPlaybackSync({ wallId: 'w1', itemIndex: 0, positionMs: 0, driftMs: 0 })
    ).toBe(true);
  });

  it('rejeita objetos incompletos', () => {
    expect(isWallPlaybackSync({ wallId: 'w1' })).toBe(false);
    expect(isWallPlaybackSync(null)).toBe(false);
  });

  it('extrai wallSync de um snapshot de telemetria', () => {
    const snapshot = {
      wallSync: { wallId: 'w1', itemIndex: 1, positionMs: 500, driftMs: 10 },
    };
    expect(parseWallSyncFromSnapshot(snapshot)).toEqual(snapshot.wallSync);
  });

  it('retorna null quando o snapshot não tem wallSync/playbackSync', () => {
    expect(parseWallSyncFromSnapshot({ foo: 'bar' })).toBeNull();
    expect(parseWallSyncFromSnapshot(null)).toBeNull();
  });
});
