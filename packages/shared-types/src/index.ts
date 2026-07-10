/** Contratos compartilhados entre API, players e CMS (evoluir conforme OpenAPI v1). */

export type TenantStatus = 'active' | 'suspended';

export type UserStatus = 'invited' | 'active' | 'disabled';

export type DevicePlatform = 'electron' | 'web' | 'android' | 'tv' | 'unknown';

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export {
  type AssetKind,
  type PlayerMediaKind,
  CMS_ACCEPT_UPLOAD,
  EXT_TO_MIME,
  MIME_TO_EXT,
  PLAYER_PLAYABLE_KINDS,
  extensionFromFilename,
  inferKindFromMime,
  isPlayableInPlayer,
  kindLabelPt,
  normalizeMime,
  resolveMimeAndExt,
  resolvePlayerKind,
} from './media-formats.js';
