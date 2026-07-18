import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PLAYBACK_EVENT_TYPES, PLAYBACK_ITEM_TYPES } from '@easysignage/shared-types';

export class PlaybackEventItemDto {
  @IsIn(PLAYBACK_ITEM_TYPES)
  itemType!: (typeof PLAYBACK_ITEM_TYPES)[number];

  @IsOptional()
  @IsUUID()
  assetId?: string;

  @IsOptional()
  @IsUUID()
  playlistId?: string;

  @IsIn(PLAYBACK_EVENT_TYPES)
  eventType!: (typeof PLAYBACK_EVENT_TYPES)[number];

  @IsISO8601()
  startedAt!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationMs?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  errorMessage?: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}

/** Lote enviado pelo player — limitado a 200 eventos/chamada (fila local pode dividir em várias). */
export class PlaybackEventBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PlaybackEventItemDto)
  events!: PlaybackEventItemDto[];
}
