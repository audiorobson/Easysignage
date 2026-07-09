import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class UpdateDeviceDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsUUID()
  siteId?: string;

  /** MAC para Wake-on-LAN (ex.: aa:bb:cc:dd:ee:ff). Vazio para limpar. */
  @IsOptional()
  @IsString()
  wakeMac?: string;
}
