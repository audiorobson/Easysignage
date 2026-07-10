import type { LicenseTier } from './tiers.js';

/** Funcionalidades controladas pelo plano de licença. */
export const LICENSE_FEATURES = [
  'campaigns',
  'video_walls',
  'rtsp',
  'alerts',
] as const;

export type LicenseFeature = (typeof LICENSE_FEATURES)[number];

const STD_ELITE: readonly LicenseFeature[] = [
  'campaigns',
  'video_walls',
  'rtsp',
  'alerts',
];

/** Funcionalidades incluídas por tier (TRIAL/Lite = só núcleo). */
export const LICENSE_TIER_FEATURES: Record<LicenseTier, readonly LicenseFeature[]> =
  {
    TRIAL: [],
    LITE: [],
    STD: STD_ELITE,
    ELITE: STD_ELITE,
  };

export function tierFeatures(tier: LicenseTier): readonly LicenseFeature[] {
  return LICENSE_TIER_FEATURES[tier];
}

export function tierHasFeature(
  tier: LicenseTier,
  feature: LicenseFeature
): boolean {
  return tierFeatures(tier).includes(feature);
}

export function featureLabelPt(feature: LicenseFeature): string {
  switch (feature) {
    case 'campaigns':
      return 'Campanhas';
    case 'video_walls':
      return 'Video walls';
    case 'rtsp':
      return 'Streams RTSP';
    case 'alerts':
      return 'Alertas automáticos';
    default:
      return feature;
  }
}
