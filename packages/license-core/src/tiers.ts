export const LICENSE_TIERS = ['TRIAL', 'LITE', 'STD', 'ELITE'] as const;

export type LicenseTier = (typeof LICENSE_TIERS)[number];

export const LICENSE_TIER_MAX_PLAYERS: Record<LicenseTier, number> = {
  TRIAL: 1,
  LITE: 2,
  STD: 20,
  ELITE: 999,
};

export function tierMaxPlayers(tier: LicenseTier): number {
  return LICENSE_TIER_MAX_PLAYERS[tier];
}

export function tierLabelPt(tier: LicenseTier): string {
  switch (tier) {
    case 'TRIAL':
      return 'Trial (não licenciado)';
    case 'LITE':
      return 'Lite';
    case 'STD':
      return 'Standard';
    case 'ELITE':
      return 'Elite';
    default:
      return tier;
  }
}

export function isLicenseTier(value: string): value is LicenseTier {
  return (LICENSE_TIERS as readonly string[]).includes(value);
}
