import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ContentDisplayDto } from './content-display.dto';
import { LayoutZoneFrameDto } from './layout-zone-frame.dto';

export class LayoutZoneBindingDto {
  @IsString()
  @MaxLength(64)
  zoneId!: string;

  @IsOptional()
  @IsUUID()
  playlistId?: string;

  @IsOptional()
  @IsUUID()
  assetId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContentDisplayDto)
  display?: ContentDisplayDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LayoutZoneFrameDto)
  frame?: LayoutZoneFrameDto;
}

export class UpsertDeviceLayoutDto {
  @IsUUID()
  templateId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LayoutZoneBindingDto)
  bindings!: LayoutZoneBindingDto[];
}
