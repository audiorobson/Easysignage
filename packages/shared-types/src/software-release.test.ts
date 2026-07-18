import {
  compareVersions,
  isChannelCompatible,
  isSoftwareReleaseChannel,
  pickLatestRelease,
  shouldUpdateTo,
  type SoftwareReleaseSummary,
} from './software-release.js';

describe('compareVersions', () => {
  it('compara MAJOR.MINOR.PATCH numericamente (não como string)', () => {
    expect(compareVersions('1.9.0', '1.10.0')).toBe(-1);
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
    expect(compareVersions('2.0.0', '1.99.99')).toBe(1);
  });

  it('devolve 0 para versões iguais', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
  });

  it('tolera versões incompletas e prefixo v', () => {
    expect(compareVersions('v1.2', '1.2.0')).toBe(0);
    expect(compareVersions('1.3', '1.2.9')).toBe(1);
  });

  it('release final é maior que pré-release da mesma versão core', () => {
    expect(compareVersions('1.0.0', '1.0.0-beta.1')).toBe(1);
    expect(compareVersions('1.0.0-beta.1', '1.0.0')).toBe(-1);
  });
});

describe('isChannelCompatible', () => {
  it('dispositivo stable só aceita releases stable', () => {
    expect(isChannelCompatible('stable', 'stable')).toBe(true);
    expect(isChannelCompatible('stable', 'beta')).toBe(false);
  });

  it('dispositivo beta aceita stable e beta', () => {
    expect(isChannelCompatible('beta', 'stable')).toBe(true);
    expect(isChannelCompatible('beta', 'beta')).toBe(true);
  });
});

function release(overrides: Partial<SoftwareReleaseSummary> = {}): SoftwareReleaseSummary {
  return {
    product: 'electron-player',
    version: '1.0.0',
    channel: 'stable',
    publishedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('pickLatestRelease', () => {
  it('escolhe a maior versão compatível com o canal', () => {
    const releases = [
      release({ version: '1.0.0' }),
      release({ version: '1.2.0' }),
      release({ version: '1.1.0' }),
    ];
    expect(pickLatestRelease(releases, 'stable')?.version).toBe('1.2.0');
  });

  it('ignora releases beta para dispositivos no canal stable', () => {
    const releases = [
      release({ version: '1.0.0', channel: 'stable' }),
      release({ version: '2.0.0', channel: 'beta' }),
    ];
    expect(pickLatestRelease(releases, 'stable')?.version).toBe('1.0.0');
  });

  it('considera stable + beta para dispositivos no canal beta', () => {
    const releases = [
      release({ version: '1.0.0', channel: 'stable' }),
      release({ version: '2.0.0', channel: 'beta' }),
    ];
    expect(pickLatestRelease(releases, 'beta')?.version).toBe('2.0.0');
  });

  it('devolve null quando não há nenhuma release compatível', () => {
    expect(pickLatestRelease([], 'stable')).toBeNull();
  });
});

describe('shouldUpdateTo', () => {
  it('true quando a candidata é mais recente e compatível', () => {
    expect(shouldUpdateTo('1.0.0', 'stable', release({ version: '1.1.0' }))).toBe(true);
  });

  it('false quando a candidata não é mais recente', () => {
    expect(shouldUpdateTo('1.1.0', 'stable', release({ version: '1.0.0' }))).toBe(false);
    expect(shouldUpdateTo('1.0.0', 'stable', release({ version: '1.0.0' }))).toBe(false);
  });

  it('false quando não há candidata', () => {
    expect(shouldUpdateTo('1.0.0', 'stable', null)).toBe(false);
  });

  it('false quando a candidata é beta e o dispositivo é stable', () => {
    expect(
      shouldUpdateTo('1.0.0', 'stable', release({ version: '2.0.0', channel: 'beta' }))
    ).toBe(false);
  });
});

describe('isSoftwareReleaseChannel', () => {
  it('valida apenas stable/beta', () => {
    expect(isSoftwareReleaseChannel('stable')).toBe(true);
    expect(isSoftwareReleaseChannel('beta')).toBe(true);
    expect(isSoftwareReleaseChannel('nightly')).toBe(false);
    expect(isSoftwareReleaseChannel(42)).toBe(false);
  });
});
