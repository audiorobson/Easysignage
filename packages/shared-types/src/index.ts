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
  ALERT_SEVERITIES,
  ALERT_STATUSES,
  ALERT_TYPES,
  alertSeverityLabelPt,
  alertStatusLabelPt,
  alertTypeLabelPt,
  type AlertSeverity,
  type AlertStatus,
  type AlertType,
} from './alert.js';

export {
  CAMPAIGN_CONTENT_SOURCE,
  CAMPAIGN_SCOPES,
  CAMPAIGN_STATUSES,
  campaignScopeLabelPt,
  campaignStatusLabelPt,
} from './campaign.js';
export type { CampaignScope, CampaignStatus } from './campaign.js';

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

export {
  REMOTE_STREAM_KINDS,
  RTSP_PROTOCOLS,
  inferRemoteStreamKindFromUrl,
  isRemoteStreamKind,
  maskStreamUrl,
  validateRemoteStreamUrl,
  type RemoteStreamKind,
} from './stream-sources.js';

export {
  type DeviceViewport,
  type DisplayOrientation,
  DISPLAY_ORIENTATIONS,
  DEFAULT_DEVICE_VIEWPORT,
  VIEWPORT_PRESETS,
  computeViewportFitScale,
  isDisplayOrientation,
  normalizeDeviceViewport,
  orientationRotateDeg,
} from './display-viewport.js';

export {
  type ContentDisplay,
  type ContentFitMode,
  CONTENT_FIT_MODES,
  DEFAULT_CONTENT_FIT,
  contentDisplayHasTargetBox,
  contentDisplayLayerStyle,
  contentFitCssClass,
  contentFitLabelPt,
  isContentFitMode,
  normalizeContentDisplay,
} from './content-fit.js';

export {
  type LayoutCurrentItem,
  type LayoutCurrentZone,
  type LayoutFrameUnit,
  type LayoutSource,
  type LayoutTemplateZone,
  type LayoutZoneBinding,
  type LayoutZoneDisplay,
  type LayoutZoneFrame,
  SYSTEM_LAYOUT_TEMPLATES,
  MAX_LAYOUT_TEMPLATE_ZONES,
  isLayoutCurrentItem,
  isReservedLayoutTemplateSlug,
  layoutZoneStyle,
  validateLayoutTemplateZones,
  type LayoutTemplateZonesValidation,
} from './display-layout.js';

export {
  type VirtualCanvas,
  type WallSync,
  type WallTileCrop,
  type WallTileCurrentItem,
  type WallTilePosition,
  type WallTileSource,
  computeTileCrop,
  isWallTileCurrentItem,
  wallTileMediaTransform,
} from './display-video-wall.js';

export {
  type WallPlaybackSync,
  type WallPlaybackPosition,
  type WallSlideTiming,
  type WallTileSyncStatus,
  classifyWallDrift,
  computeWallDriftMs,
  computeWallPlaybackAt,
  isWallPlaybackSync,
  parseWallSyncFromSnapshot,
  wallSyncStatusLabelPt,
} from './wall-sync.js';

export {
  PLAYBACK_EVENT_TYPES,
  PLAYBACK_ITEM_TYPES,
  type PlaybackEventBatchInput,
  type PlaybackEventInput,
  type PlaybackEventType,
  type PlaybackItemType,
  type PlaybackLogFilters,
  type PlaybackLogPage,
  type PlaybackLogRow,
  isPlaybackEventInput,
  isPlaybackEventType,
  isPlaybackItemType,
  playbackEventTypeLabelPt,
  playbackItemTypeLabelPt,
} from './playback-log.js';

export {
  SOFTWARE_RELEASE_CHANNELS,
  type SoftwareReleaseChannel,
  type SoftwareReleaseSummary,
  compareVersions,
  isChannelCompatible,
  isSoftwareReleaseChannel,
  pickLatestRelease,
  shouldUpdateTo,
} from './software-release.js';
