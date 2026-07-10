import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { DISPLAY_ORIENTATIONS } from '@easysignage/shared-types';

export class UpdateDeviceViewportDto {
  @IsOptional()
  @IsInt()
  @Min(320)
  @Max(7680)
  viewportWidth?: number;

  @IsOptional()
  @IsInt()
  @Min(320)
  @Max(7680)
  viewportHeight?: number;

  @IsOptional()
  @IsIn([...DISPLAY_ORIENTATIONS])
  displayOrientation?: string;
}
