import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSsoConfigDto {
  /** Ativa/desativa o login único (OIDC) para o tenant. Requer issuer/clientId/clientSecret configurados. */
  @IsOptional()
  @IsBoolean()
  ssoEnabled?: boolean;

  /** Issuer do provedor OIDC (ex.: `https://login.microsoftonline.com/<tenant>/v2.0`). */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  ssoIssuerUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  ssoClientId?: string | null;

  /** Deixe em branco para manter o valor atual. */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  ssoClientSecret?: string | null;
}
