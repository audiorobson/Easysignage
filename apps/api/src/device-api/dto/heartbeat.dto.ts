import { IsInt, IsNumber, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PlaybackSyncDto } from './playback-sync.dto';

export class HeartbeatDto {
  /** Versão da app do player (ex.: 0.0.1). */
  @IsOptional()
  @IsString()
  appVersion?: string;

  /** @deprecated Use appVersion. Mantido para players antigos. */
  @IsOptional()
  @IsString()
  publicationVersion?: string;

  /** Versão de publicação que o player confirmou ter aplicado. */
  @IsOptional()
  @IsInt()
  appliedPublicationVersion?: number;

  /** Hash `contentRevision` confirmado após carregar o conteúdo. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  appliedContentRevision?: string;

  @IsOptional()
  @IsNumber()
  uptimeSec?: number;

  @IsOptional()
  @IsObject()
  metrics?: Record<string, unknown>;

  /** Sync de video wall ou zona — drift reportado pelo player. */
  @IsOptional()
  @ValidateNested()
  @Type(() => PlaybackSyncDto)
  playbackSync?: PlaybackSyncDto;
}
