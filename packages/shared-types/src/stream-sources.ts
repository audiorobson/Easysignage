/**
 * Fontes remotas configuradas no servidor e reproduzidas diretamente pelo player
 * (sem proxy de mídia na API).
 */

export const REMOTE_STREAM_KINDS = ['url', 'rtsp'] as const;

export type RemoteStreamKind = (typeof REMOTE_STREAM_KINDS)[number];

export const RTSP_PROTOCOLS = ['rtsp:', 'rtsps:'] as const;

export function isRemoteStreamKind(kind: string): kind is RemoteStreamKind {
  return (REMOTE_STREAM_KINDS as readonly string[]).includes(kind);
}

export function inferRemoteStreamKindFromUrl(rawUrl: string): RemoteStreamKind {
  const parsed = new URL(rawUrl.trim());
  if ((RTSP_PROTOCOLS as readonly string[]).includes(parsed.protocol)) {
    return 'rtsp';
  }
  return 'url';
}

/** Valida e normaliza URL remota conforme o tipo de fonte. */
export function validateRemoteStreamUrl(
  rawUrl: string,
  kind: RemoteStreamKind
): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error('URL inválida');
  }

  if (kind === 'rtsp') {
    if (!(RTSP_PROTOCOLS as readonly string[]).includes(parsed.protocol)) {
      throw new Error('Use rtsp:// ou rtsps://');
    }
  } else if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Use http ou https');
  }

  return parsed.toString();
}

/** Oculta credenciais em URLs RTSP para logs/UI. */
export function maskStreamUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = '****';
    if (parsed.username) parsed.username = '****';
    return parsed.toString();
  } catch {
    return url.replace(/\/\/([^@/]+)@/u, '//****@');
  }
}
