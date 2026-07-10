'use client';

import Link from 'next/link';
import { featureLabelPt, tierLabelPt, isLicenseTier, type LicenseFeature } from '@easysignage/license-core/browser';
import { useLicenseStatus } from '@/lib/use-license-status';

export function LicenseFeatureBanner({ feature }: { feature: LicenseFeature }) {
  const { status, hasFeature } = useLicenseStatus();

  if (!status || hasFeature(feature)) return null;

  const tierName = isLicenseTier(status.tier) ? tierLabelPt(status.tier) : status.tier;

  return (
    <div
      role="status"
      style={{
        marginBottom: 'var(--space-6)',
        padding: '0.85rem 1rem',
        borderRadius: 8,
        background: 'var(--color-warning-bg, #fffbeb)',
        border: '1px solid var(--color-warning-border, #fcd34d)',
        fontSize: '0.9rem',
      }}
    >
      <strong>{featureLabelPt(feature)}</strong> não está incluído no plano{' '}
      <strong>{tierName}</strong>.{' '}
      <Link href="/settings">Active uma licença Standard ou Elite</Link> em Definições.
    </div>
  );
}
