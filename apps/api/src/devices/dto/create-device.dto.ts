import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateDeviceDto {
  @IsUUID()
  siteId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsString()
  platform?: string;
}
