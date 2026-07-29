import type { CampaignScope, CampaignStatus } from '@easysignage/shared-types';

export type CampaignContentType = 'playlist' | 'layout' | 'video_wall';

export type CampaignRow = {
  id: string;
  name: string;
  description: string | null;
  playlistId: string | null;
  layoutId: string | null;
  videoWallId: string | null;
  contentType: CampaignContentType;
  contentLabel: string;
  playlist: { id: string; name: string } | null;
  layout: {
    id: string;
    name: string | null;
    template: { slug: string; name: string };
  } | null;
  videoWall: { id: string; name: string } | null;
  priority: number;
  status: CampaignStatus;
  statusLabel: string;
  scope: CampaignScope;
  scopeLabel: string;
  deviceId: string | null;
  groupId: string | null;
  siteId: string | null;
  targetLabel: string;
  startAt: string | null;
  endAt: string | null;
  dayOfWeek: number | null;
  startMin: number | null;
  endMin: number | null;
  createdAt: string;
  updatedAt: string;
};

export type DeviceLayoutOption = {
  id: string;
  name: string | null;
  template: { slug: string; name: string };
};
