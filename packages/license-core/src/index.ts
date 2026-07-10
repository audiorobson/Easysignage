export {
  LICENSE_TIERS,
  LICENSE_TIER_MAX_PLAYERS,
  tierMaxPlayers,
  tierLabelPt,
  isLicenseTier,
  type LicenseTier,
} from './tiers.js';

export {
  LICENSE_FEATURES,
  LICENSE_TIER_FEATURES,
  featureLabelPt,
  tierFeatures,
  tierHasFeature,
  type LicenseFeature,
} from './features.js';

export {
  HWID_PATTERN,
  isValidHardwareId,
  deriveHardwareId,
  normalizeHardwareId,
} from './hwid.js';

export type { LicensePayloadV1, LicenseStatus } from './types.js';

export { DEV_LICENSE_PUBLIC_KEY_PEM, DEFAULT_PRODUCTION_PUBLIC_KEY_FILE } from './keys.js';

export {
  generateLicenseKeyPair,
  buildLicensePayload,
  signLicense,
  verifyLicense,
  formatSerialForDisplay,
  type KeyPairPem,
  type VerifyLicenseResult,
} from './serial.js';
