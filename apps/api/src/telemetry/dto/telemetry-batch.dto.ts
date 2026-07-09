import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class TelemetryEventItemDto {
  @IsString()
  @MaxLength(64)
  category!: string;

  @IsString()
  @IsIn(['info', 'warning', 'error', 'critical'])
  severity!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

export class TelemetryBatchDto {
  /** Snapshot agregado (playback, rede, uptime, métricas livres). */
  @IsOptional()
  @IsObject()
  snapshot?: Record<string, unknown>;

  /** Eventos pontuais (falhas, avisos). */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TelemetryEventItemDto)
  events?: TelemetryEventItemDto[];
}

export class DeviceCommandAckDto {
  @IsOptional()
  @IsObject()
  result?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @IsIn(['acked', 'failed'])
  status?: 'acked' | 'failed';
}
