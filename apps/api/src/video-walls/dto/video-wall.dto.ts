import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DISPLAY_ORIENTATIONS } from '@easysignage/shared-types';
import { IsIn } from 'class-validator';

export class CreateVideoWallDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsUUID()
  siteId!: string;

  @IsInt()
  @Min(1)
  @Max(8)
  gridRows!: number;

  @IsInt()
  @Min(1)
  @Max(8)
  gridCols!: number;

  @IsOptional()
  @IsInt()
  @Min(320)
  @Max(15360)
  virtualWidth?: number;

  @IsOptional()
  @IsInt()
  @Min(320)
  @Max(15360)
  virtualHeight?: number;

  @IsOptional()
  @IsIn([...DISPLAY_ORIENTATIONS])
  displayOrientation?: string;

  @IsOptional()
  @IsUUID()
  playlistId?: string;
}

export class UpdateVideoWallDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsUUID()
  playlistId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsIn([...DISPLAY_ORIENTATIONS])
  displayOrientation?: string;
}

export class WallTileAssignmentDto {
  @IsUUID()
  deviceId!: string;

  @IsInt()
  @Min(0)
  @Max(7)
  row!: number;

  @IsInt()
  @Min(0)
  @Max(7)
  col!: number;
}

export class SetWallTilesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WallTileAssignmentDto)
  tiles!: WallTileAssignmentDto[];
}
