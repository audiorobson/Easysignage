import type { LicenseTier } from './tiers.js';

export type LicensePayloadV1 = {
  v: 1;
  hwid: string;
  tier: Exclude<LicenseTier, 'TRIAL'>;
  maxPlayers: number;
  issuedAt: string;
  expiresAt: string | null;
  customer?: string;
};

export type LicenseStatus = {
  hardwareId: string;
  tier: LicenseTier;
  maxPlayers: number;
  usedPlayers: number;
  valid: boolean;
  licensed: boolean;
  issuedAt: string | null;
  expiresAt: string | null;
  customer: string | null;
  message: string | null;
};
