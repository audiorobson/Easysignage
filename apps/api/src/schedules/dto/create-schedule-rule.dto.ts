import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export type ScheduleContentKind = 'playlist' | 'layout' | 'video_wall';

export class CreateScheduleRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  playlistId?: string;

  @IsOptional()
  @IsUUID()
  layoutId?: string;

  @IsOptional()
  @IsUUID()
  videoWallId?: string;

  @IsIn(['device', 'group'])
  scope!: 'device' | 'group';

  @IsOptional()
  @IsUUID()
  deviceId?: string;

  @IsOptional()
  @IsUUID()
  groupId?: string;

  /** 1 = segunda … 7 = domingo (ISO) */
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek!: number;

  @IsInt()
  @Min(0)
  @Max(1439)
  startMin!: number;

  @IsInt()
  @Min(1)
  @Max(1440)
  endMin!: number;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
