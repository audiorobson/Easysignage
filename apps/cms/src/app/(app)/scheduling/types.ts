export type ScheduleContentType = 'playlist' | 'layout' | 'video_wall';

export type ScheduleRuleRow = {
  id: string;
  name: string | null;
  playlistId: string | null;
  layoutId: string | null;
  videoWallId: string | null;
  contentType: ScheduleContentType;
  contentLabel: string;
  playlist: { id: string; name: string } | null;
  layout: {
    id: string;
    name: string | null;
    template: { slug: string; name: string };
  } | null;
  videoWall: { id: string; name: string } | null;
  scope: 'device' | 'group';
  deviceId: string | null;
  groupId: string | null;
  device: { id: string; name: string } | null;
  group: { id: string; name: string } | null;
  targetLabel: string;
  dayOfWeek: number;
  startMin: number;
  endMin: number;
  priority: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DeviceLayoutOption = {
  id: string;
  name: string | null;
  template: { slug: string; name: string };
};
