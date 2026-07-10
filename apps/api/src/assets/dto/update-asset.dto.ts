import { IsOptional, IsString, MinLength } from 'class-validator';

/** Atualizar nome (todos) e/ou URL (apenas kind=url ou kind=rtsp). */
export class UpdateAssetDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  remoteUrl?: string;
}
