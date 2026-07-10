import type { CampaignScope, CampaignStatus } from '@easysignage/shared-types';

export type CampaignRow = {
  id: string;
  name: string;
  description: string | null;
  playlistId: string;
  playlist: { id: string; name: string };
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
