/**
 * PR 5.13 — auto-update do Electron player. Comparação de versão/canal partilhada
 * entre a API (escolhe a última release compatível) e o player (decide se atualiza).
 */

export type SoftwareReleaseChannel = 'stable' | 'beta';

export const SOFTWARE_RELEASE_CHANNELS: SoftwareReleaseChannel[] = ['stable', 'beta'];

export function isSoftwareReleaseChannel(v: unknown): v is SoftwareReleaseChannel {
  return v === 'stable' || v === 'beta';
}

export interface SoftwareReleaseSummary {
  product: string;
  version: string;
  channel: SoftwareReleaseChannel;
  downloadUrl?: string | null;
  checksum?: string | null;
  notes?: string | null;
  publishedAt: string;
}

/**
 * Compara duas versões `semver`-like (`MAJOR.MINOR.PATCH[-prerelease]`).
 * Devolve -1 se `a < b`, 0 se iguais, 1 se `a > b`. Tolerante a formatos
 * incompletos (`1.2` = `1.2.0`) e a um prefixo `v` opcional.
 */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => {
    const clean = v.trim().replace(/^v/i, '');
    const [core, prerelease = ''] = clean.split('-', 2);
    const parts = core.split('.').map((n) => {
      const parsed = parseInt(n, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    });
    while (parts.length < 3) parts.push(0);
    return { parts, prerelease };
  };

  const pa = parse(a);
  const pb = parse(b);

  for (let i = 0; i < 3; i += 1) {
    if (pa.parts[i]! !== pb.parts[i]!) return pa.parts[i]! > pb.parts[i]! ? 1 : -1;
  }

  // Mesma versão core: sem prerelease > com prerelease (1.0.0 > 1.0.0-beta.1).
  if (pa.prerelease === pb.prerelease) return 0;
  if (!pa.prerelease) return 1;
  if (!pb.prerelease) return -1;
  return pa.prerelease > pb.prerelease ? 1 : -1;
}

/** `stable` só recebe releases `stable`; `beta` recebe `stable` + `beta`. */
export function isChannelCompatible(
  deviceChannel: SoftwareReleaseChannel,
  releaseChannel: SoftwareReleaseChannel
): boolean {
  if (deviceChannel === 'beta') return true;
  return releaseChannel === 'stable';
}

/** Escolhe a release mais recente compatível com o canal do dispositivo (ou `null`). */
export function pickLatestRelease<T extends { version: string; channel: string }>(
  releases: T[],
  deviceChannel: SoftwareReleaseChannel
): T | null {
  let best: T | null = null;
  for (const r of releases) {
    if (!isSoftwareReleaseChannel(r.channel)) continue;
    if (!isChannelCompatible(deviceChannel, r.channel)) continue;
    if (!best || compareVersions(r.version, best.version) > 0) best = r;
  }
  return best;
}

/** Decide se o player deve atualizar: existe candidata compatível e mais recente que a atual. */
export function shouldUpdateTo(
  currentVersion: string,
  deviceChannel: SoftwareReleaseChannel,
  candidate: SoftwareReleaseSummary | null
): boolean {
  if (!candidate) return false;
  if (!isChannelCompatible(deviceChannel, candidate.channel)) return false;
  return compareVersions(candidate.version, currentVersion) > 0;
}
