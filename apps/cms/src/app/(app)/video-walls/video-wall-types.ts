export type VideoWallListItem = {
  id: string;
  name: string;
  siteId: string;
  gridRows: number;
  gridCols: number;
  virtualWidth: number;
  virtualHeight: number;
  displayOrientation: string;
  status: string;
  playlistId: string | null;
  syncEpochMs: string | null;
  syncToleranceMs: number;
  revision: string;
  createdAt: string;
  updatedAt: string;
  site: { id: string; name: string };
  _count: { tiles: number };
};

export type VideoWallTileRow = {
  id: string;
  wallId: string;
  deviceId: string;
  row: number;
  col: number;
  device: {
    id: string;
    name: string;
    platform: string;
    status: string;
  };
};

export type VideoWallDetail = Omit<VideoWallListItem, '_count'> & {
  tiles: VideoWallTileRow[];
};

export type WallTileSyncStatus = 'ok' | 'warn' | 'critical' | 'offline' | 'no_data';

export type WallTileHealthRow = {
  row: number;
  col: number;
  deviceId: string;
  deviceName: string;
  online: boolean;
  status: WallTileSyncStatus;
  itemIndex: number | null;
  positionMs: number | null;
  driftMs: number | null;
  reportedAt: string | null;
  telemetryUpdatedAt: string | null;
};

export type WallSyncHealth = {
  wallId: string;
  status: string;
  syncEpochMs: string | null;
  syncToleranceMs: number;
  expectedItemIndex: number | null;
  expectedPositionMs: number | null;
  maxDriftMs: number | null;
  groupStatus: WallTileSyncStatus;
  tiles: WallTileHealthRow[];
  checkedAt: string;
};
