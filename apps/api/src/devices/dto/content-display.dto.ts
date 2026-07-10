import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CONTENT_FIT_MODES } from '@easysignage/shared-types';

export class ContentDisplayDto {
  @IsOptional()
  @IsIn([...CONTENT_FIT_MODES])
  fit?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7680)
  targetWidth?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7680)
  targetHeight?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  background?: string;
}
