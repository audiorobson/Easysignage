import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateBrandingDto {
  /**
   * Nome exibido no CMS/login em vez de "EasySignage" (ex.: nome do parceiro white-label).
   * `null`/vazio repõe o nome por defeito.
   */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  brandName?: string | null;

  /**
   * URL pública (https recomendado) do logótipo — SVG/PNG com fundo transparente.
   * `null`/vazio remove o logótipo customizado. Validado como string simples (não `@IsUrl`)
   * para permitir limpar o campo com uma string vazia — a validação de formato acontece no
   * browser (`<img>` simplesmente não carrega se o valor for inválido).
   */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  brandLogoUrl?: string | null;

  /**
   * Cor primária em hex (ex.: `#2563eb`). `null`/vazio repõe a cor por defeito do produto.
   * Validado como string simples — `applyBrandingCssVars` no CMS ignora silenciosamente
   * valores que não sejam hex de 6 dígitos.
   */
  @IsOptional()
  @IsString()
  @MaxLength(9)
  brandPrimaryColor?: string | null;
}
