import { IsString, Matches, MinLength } from 'class-validator';

export class TwoFactorLoginDto {
  @IsString()
  @MinLength(1)
  challengeToken!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'code deve ter exatamente 6 dígitos' })
  code!: string;
}
