/** URL base do web player (Vite). */
export function webPlayerBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_WEB_PLAYER_URL?.replace(/\/$/, '') ??
    'http://localhost:3010'
  );
}

/** Abre o player com código de pareamento pré-preenchido. */
export function webPlayerPairingUrl(pairingCode: string): string {
  const url = new URL(webPlayerBaseUrl());
  url.searchParams.set('pair', pairingCode.trim().toUpperCase());
  return url.toString();
}
