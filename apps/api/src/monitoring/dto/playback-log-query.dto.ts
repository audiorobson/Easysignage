import { Type } from 'class-transformer';
import { IsIn, IsISO8601, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { PLAYBACK_EVENT_TYPES } from '@easysignage/shared-types';

export class PlaybackLogQueryDto {
  @IsOptional()
  @IsUUID()
  deviceId?: string;

  @IsOptional()
  @IsUUID()
  assetId?: string;

  @IsOptional()
  @IsUUID()
  playlistId?: string;

  @IsOptional()
  @IsIn(PLAYBACK_EVENT_TYPES)
  eventType?: (typeof PLAYBACK_EVENT_TYPES)[number];

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  pageSize?: number;
}
