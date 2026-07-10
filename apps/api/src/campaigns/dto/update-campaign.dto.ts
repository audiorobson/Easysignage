import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CAMPAIGN_SCOPES, CAMPAIGN_STATUSES } from '@easysignage/shared-types';

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsUUID()
  playlistId?: string;

  @IsOptional()
  @IsInt()
  @Min(-100)
  @Max(1000)
  priority?: number;

  @IsOptional()
  @IsIn([...CAMPAIGN_STATUSES])
  status?: string;

  @IsOptional()
  @IsIn([...CAMPAIGN_SCOPES])
  scope?: string;

  @IsOptional()
  @IsUUID()
  deviceId?: string | null;

  @IsOptional()
  @IsUUID()
  groupId?: string | null;

  @IsOptional()
  @IsUUID()
  siteId?: string | null;

  @IsOptional()
  @IsDateString()
  startAt?: string | null;

  @IsOptional()
  @IsDateString()
  endAt?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  startMin?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  endMin?: number | null;
}
