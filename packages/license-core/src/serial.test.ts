import { describe, expect, it } from '@jest/globals';
import {
  buildLicensePayload,
  formatSerialForDisplay,
  generateLicenseKeyPair,
  signLicense,
  verifyLicense,
} from './serial.js';

const TEST_HWID = 'ES-0123456789ABCDEFGHJKMNPQRS';

describe('license serial', () => {
  it('sign and verify round-trip', () => {
    const { publicKeyPem, privateKeyPem } = generateLicenseKeyPair();
    const payload = buildLicensePayload({
      hwid: TEST_HWID,
      tier: 'STD',
      customer: 'Cliente Teste',
    });
    const serial = signLicense(payload, privateKeyPem);
    const result = verifyLicense(serial, publicKeyPem);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.tier).toBe('STD');
      expect(result.payload.maxPlayers).toBe(20);
      expect(result.payload.hwid).toBe(TEST_HWID);
    }
  });

  it('display format round-trips for apply', () => {
    const { publicKeyPem, privateKeyPem } = generateLicenseKeyPair();
    const serial = signLicense(
      buildLicensePayload({ hwid: TEST_HWID, tier: 'STD' }),
      privateKeyPem
    );
    const display = formatSerialForDisplay(serial);
    const restored = display.replace(/\s+/g, '');
    expect(restored).toBe(serial);
    expect(verifyLicense(restored, publicKeyPem).ok).toBe(true);
  });

  it('rejects tampered serial', () => {
    const { publicKeyPem, privateKeyPem } = generateLicenseKeyPair();
    const payload = buildLicensePayload({
      hwid: TEST_HWID,
      tier: 'LITE',
    });
    const serial = signLicense(payload, privateKeyPem);
    const tampered = serial.slice(0, -4) + 'XXXX';
    const result = verifyLicense(tampered, publicKeyPem);
    expect(result.ok).toBe(false);
  });
});
