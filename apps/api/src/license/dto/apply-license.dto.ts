import { IsOptional, IsString, MinLength } from 'class-validator';

export class ApplyLicenseDto {
  @IsString()
  @MinLength(10)
  licenseKey!: string;
}
