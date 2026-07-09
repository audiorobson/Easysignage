import { IsOptional, IsString, MinLength } from 'class-validator';

export class PairDeviceDto {
  @IsString()
  @MinLength(4)
  pairingCode!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsString()
  @MinLength(1)
  platform!: string;

  @IsOptional()
  @IsString()
  runtimeVersion?: string;
}
