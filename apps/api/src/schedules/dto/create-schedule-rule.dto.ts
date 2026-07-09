import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateScheduleRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsUUID()
  playlistId!: string;

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
