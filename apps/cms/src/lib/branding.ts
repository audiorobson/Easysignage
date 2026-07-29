export type TenantBranding = {
  brandName?: string | null;
  brandLogoUrl?: string | null;
  brandPrimaryColor?: string | null;
};

const HEX_RE = /^#([0-9a-f]{6})$/i;

function darken(hex: string, amount: number): string {
  const match = HEX_RE.exec(hex);
  if (!match) return hex;
  const num = parseInt(match[1], 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) - amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) - amount));
  const b = Math.max(0, Math.min(255, (num & 0xff) - amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Aplica a cor primária do tenant como variáveis CSS no `<html>` — reflete-se em botões,
 * links e no gradiente de marca (`--gradient-brand`) sem precisar de recompilar o CSS.
 * Chamar com `null`/valor vazio remove o override e volta à cor por defeito do produto.
 */
export function applyBrandingCssVars(branding: TenantBranding | null | undefined): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const color = branding?.brandPrimaryColor && HEX_RE.test(branding.brandPrimaryColor) ? branding.brandPrimaryColor : null;

  if (!color) {
    root.style.removeProperty('--color-primary-500');
    root.style.removeProperty('--color-primary-600');
    root.style.removeProperty('--color-primary-700');
    root.style.removeProperty('--gradient-brand');
    return;
  }

  root.style.setProperty('--color-primary-500', color);
  root.style.setProperty('--color-primary-600', darken(color, 16));
  root.style.setProperty('--color-primary-700', darken(color, 32));
  root.style.setProperty('--gradient-brand', `linear-gradient(135deg, ${color} 0%, ${darken(color, 40)} 100%)`);
}
