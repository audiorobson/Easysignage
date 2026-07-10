'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

export type LicenseStatus = {
  tier: string;
  licensed: boolean;
  features: string[];
  maxPlayers: number;
  usedPlayers: number;
};

let cache: LicenseStatus | null = null;
let inflight: Promise<LicenseStatus> | null = null;

export function useLicenseStatus() {
  const [status, setStatus] = useState<LicenseStatus | null>(cache);

  const refresh = useCallback(async () => {
    const p =
      inflight ??
      (inflight = api<LicenseStatus>('/license/status').then((s) => {
        cache = s;
        inflight = null;
        return s;
      }));
    const s = await p;
    setStatus(s);
    return s;
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function hasFeature(feature: string): boolean {
    return status?.features.includes(feature) ?? false;
  }

  return { status, refresh, hasFeature };
}
