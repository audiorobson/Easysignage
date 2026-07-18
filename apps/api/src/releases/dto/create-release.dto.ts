import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateReleaseDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  product?: string;

  @IsString()
  @MaxLength(32)
  version!: string;

  @IsOptional()
  @IsIn(['stable', 'beta'])
  channel?: 'stable' | 'beta';

  @IsOptional()
  @IsString()
  @MaxLength(256)
  checksum?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  downloadUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}
