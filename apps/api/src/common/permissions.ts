/**
 * Permissões CMS (JWT). `*` = acesso total (role admin com `all: true` no seed).
 */
export const P = {
  DEVICES_READ: 'devices.read',
  DEVICES_WRITE: 'devices.write',
  SITES_READ: 'sites.read',
  SITES_WRITE: 'sites.write',
  ASSETS_READ: 'assets.read',
  ASSETS_WRITE: 'assets.write',
  PLAYLISTS_READ: 'playlists.read',
  PLAYLISTS_WRITE: 'playlists.write',
  GROUPS_READ: 'groups.read',
  GROUPS_WRITE: 'groups.write',
  SCHEDULING_READ: 'scheduling.read',
  SCHEDULING_WRITE: 'scheduling.write',
  MONITORING_READ: 'monitoring.read',
  MONITORING_WRITE: 'monitoring.write',
} as const;

export type Permission = (typeof P)[keyof typeof P] | '*';

export function mergeRolePermissions(
  roles: { permissionsJson: unknown }[]
): string[] {
  for (const r of roles) {
    const j = r.permissionsJson as Record<string, unknown> | null;
    if (j?.all === true) return ['*'];
  }
  const set = new Set<string>();
  for (const r of roles) {
    const j = r.permissionsJson as Record<string, unknown> | null;
    if (!j) continue;
    const arr = j.permissions;
    if (Array.isArray(arr)) {
      for (const p of arr) {
        if (typeof p === 'string') set.add(p);
      }
    }
  }
  return [...set];
}
