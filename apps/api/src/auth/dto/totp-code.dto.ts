import { IsString, Matches } from 'class-validator';

export class TotpCodeDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code deve ter exatamente 6 dígitos' })
  code!: string;
}
