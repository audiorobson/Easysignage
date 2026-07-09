import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class UpdateScheduleRuleDto {
  @IsOptional()
  @IsString()
  name?: string | null;

  @IsOptional()
  @IsUUID()
  playlistId?: string;

  @IsOptional()
  @IsIn(['device', 'group'])
  scope?: 'device' | 'group';

  @IsOptional()
  @IsUUID()
  deviceId?: string | null;

  @IsOptional()
  @IsUUID()
  groupId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  startMin?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  endMin?: number;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
