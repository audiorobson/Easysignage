import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class PlaybackSyncDto {
  @IsOptional()
  @IsUUID()
  wallId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  itemIndex?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  positionMs?: number;

  @IsOptional()
  @IsInt()
  driftMs?: number;

  @IsOptional()
  @IsNumber()
  syncEpochMs?: number;
}
