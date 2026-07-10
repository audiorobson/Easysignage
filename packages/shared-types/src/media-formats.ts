/**
 * Formatos de mídia suportados pelo EasySignage (upload, API, player).
 * Mantenha esta lista como fonte única de verdade.
 */

/** Tipo persistido em `assets.kind` */
export type AssetKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'html'
  | 'text'
  | 'url'
  | 'rtsp';

/** Subconjunto reproduzível no web player (ficheiros locais via API) */
export type PlayerMediaKind = Exclude<AssetKind, 'url' | 'rtsp'>;

/** MIME → extensão de ficheiro em disco */
export const MIME_TO_EXT: Record<string, string> = {
  // Imagens
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/avif': 'avif',
  'image/tiff': 'tiff',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'image/heic': 'heic',
  'image/heif': 'heif',
  // Vídeo (HTML5 — compatibilidade varia por browser/codecs)
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogv',
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
  'video/x-matroska': 'mkv',
  'video/mpeg': 'mpeg',
  'video/3gpp': '3gp',
  'video/3gpp2': '3g2',
  'video/mp2t': 'ts',
  // Áudio
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/aac': 'aac',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/webm': 'weba',
  'audio/flac': 'flac',
  // Documentos e web
  'application/pdf': 'pdf',
  'text/html': 'html',
  'application/xhtml+xml': 'xhtml',
  'text/plain': 'txt',
};

/** Extensão (sem ponto) → MIME quando o browser envia application/octet-stream */
export const EXT_TO_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  avif: 'image/avif',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  ico: 'image/x-icon',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  ogv: 'video/ogg',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  mpeg: 'video/mpeg',
  mpg: 'video/mpeg',
  '3gp': 'video/3gpp',
  '3g2': 'video/3gpp2',
  ts: 'video/mp2t',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  aac: 'audio/aac',
  m4a: 'audio/mp4',
  weba: 'audio/webm',
  flac: 'audio/flac',
  pdf: 'application/pdf',
  html: 'text/html',
  htm: 'text/html',
  xhtml: 'application/xhtml+xml',
  txt: 'text/plain',
};

export const PLAYER_PLAYABLE_KINDS: PlayerMediaKind[] = [
  'image',
  'video',
  'audio',
  'pdf',
  'html',
  'text',
];

/** Valor do atributo `accept` no upload do CMS */
export const CMS_ACCEPT_UPLOAD = [
  ...Object.keys(MIME_TO_EXT),
  ...Object.keys(EXT_TO_MIME).map((e) => `.${e}`),
].join(',');

export function normalizeMime(raw: string): string {
  const lower = raw.toLowerCase().split(';')[0]?.trim() ?? '';
  if (lower === 'image/jpg') return 'image/jpeg';
  return lower;
}

export function extensionFromFilename(filename: string): string | null {
  const m = /\.([a-z0-9]+)$/i.exec(filename.trim());
  return m ? m[1]!.toLowerCase() : null;
}

/**
 * Resolve MIME e extensão aceites para persistência.
 * Retorna null se o formato não for suportado.
 */
export function resolveMimeAndExt(
  rawMime: string,
  filename: string
): { mimeType: string; ext: string } | null {
  let mime = normalizeMime(rawMime);
  if (!MIME_TO_EXT[mime] || mime === 'application/octet-stream') {
    const ext = extensionFromFilename(filename);
    if (ext && EXT_TO_MIME[ext]) {
      mime = EXT_TO_MIME[ext]!;
    }
  }
  const ext = MIME_TO_EXT[mime];
  if (!ext) return null;
  return { mimeType: mime, ext };
}

export function inferKindFromMime(mime: string): AssetKind {
  const m = normalizeMime(mime);
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  if (m === 'application/pdf') return 'pdf';
  if (m === 'text/html' || m === 'application/xhtml+xml') return 'html';
  if (m === 'text/plain') return 'text';
  return 'text';
}

export function isPlayableInPlayer(kind: string): kind is PlayerMediaKind {
  return (PLAYER_PLAYABLE_KINDS as string[]).includes(kind);
}

/** Resolve kind para o player (meta da API + MIME). */
export function resolvePlayerKind(
  kind: string,
  mimeType?: string | null
): PlayerMediaKind {
  if (isPlayableInPlayer(kind)) return kind;
  if (mimeType) {
    const inferred = inferKindFromMime(mimeType);
    if (isPlayableInPlayer(inferred)) return inferred;
  }
  return 'image';
}

export function kindLabelPt(kind: string): string {
  const labels: Record<string, string> = {
    image: 'Imagem',
    video: 'Vídeo',
    audio: 'Áudio',
    pdf: 'PDF',
    html: 'HTML',
    text: 'Texto',
    url: 'URL',
    rtsp: 'Stream RTSP',
  };
  return labels[kind] ?? kind;
}
