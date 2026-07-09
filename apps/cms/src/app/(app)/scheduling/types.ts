export type ScheduleRuleRow = {
  id: string;
  name: string | null;
  playlistId: string;
  playlist: { id: string; name: string };
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
