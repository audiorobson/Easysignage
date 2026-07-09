import { IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class HeartbeatDto {
  @IsOptional()
  @IsString()
  publicationVersion?: string;

  @IsOptional()
  @IsNumber()
  uptimeSec?: number;

  @IsOptional()
  @IsObject()
  metrics?: Record<string, unknown>;
}
