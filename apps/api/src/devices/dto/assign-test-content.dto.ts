import { Type } from 'class-transformer';
import { IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { ContentDisplayDto } from './content-display.dto';

/** Informe exatamente um de: `assetId`, `playlistId`, `layoutId` ou `videoWallId`. */
export class AssignTestContentDto {
  @IsOptional()
  @IsUUID()
  assetId?: string;

  @IsOptional()
  @IsUUID()
  playlistId?: string;

  @IsOptional()
  @IsUUID()
  layoutId?: string;

  @IsOptional()
  @IsUUID()
  videoWallId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContentDisplayDto)
  display?: ContentDisplayDto;
}
