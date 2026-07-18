import { spawn, type ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';

/**
 * Bridge RTSP nativo (Fase 5.C, PR 5.10): resolve o binário `ffmpeg` e monta os
 * argumentos para remuxar um stream RTSP em fragmented MP4, adequado para ser
 * consumido progressivamente por um `<video>` HTML (sem MSE explícito no renderer).
 *
 * Segue o mesmo padrão de configuração usado em `apps/api/src/assets/assets.service.ts`
 * (`FFMPEG_PATH` opcional, default `ffmpeg` do PATH).
 */

export type SpawnFn = typeof spawn;

/** stdio: ['ignore', 'pipe', 'pipe'] → sem stdin, stdout/stderr como stream de leitura. */
export type FfmpegProcess = ChildProcessByStdio<null, Readable, Readable>;

/** Caminho do binário ffmpeg — `FFMPEG_PATH` (opcional) ou `ffmpeg` do PATH. */
export function resolveFfmpegPath(): string {
  return process.env.FFMPEG_PATH?.trim() || 'ffmpeg';
}

/**
 * Args para remux RTSP → fMP4 em stdout (pipe:1).
 * `-c:v copy`: evita re-encode (funciona quando a câmara já envia H.264/H.265
 * suportado pelo browser). `-an`: descarta áudio — o player exibe o vídeo em
 * `<video muted>` (mesmo padrão dos outros itens de playlist), simplificando o
 * remux e evitando custo de transcode de áudio.
 * `frag_keyframe+empty_moov+default_base_moof`: torna o MP4 "streamable" — o
 * `moov` inicial fica vazio e cada fragmento carrega o seu próprio `moof`,
 * permitindo que o `<video>` comece a tocar antes do stream terminar (é live,
 * nunca termina) e sem precisar de `Content-Length`.
 */
export function buildRtspToFmp4Args(rtspUrl: string): string[] {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-rtsp_transport',
    'tcp',
    '-i',
    rtspUrl,
    '-an',
    '-c:v',
    'copy',
    '-f',
    'mp4',
    '-movflags',
    'frag_keyframe+empty_moov+default_base_moof',
    '-reset_timestamps',
    '1',
    'pipe:1',
  ];
}

/** Spawna o processo ffmpeg que remuxa RTSP → fMP4 (stdout = fragmentos MP4). */
export function spawnRtspToFmp4(rtspUrl: string, spawnFn: SpawnFn = spawn): FfmpegProcess {
  const ffmpeg = resolveFfmpegPath();
  const args = buildRtspToFmp4Args(rtspUrl);
  return spawnFn(ffmpeg, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  }) as FfmpegProcess;
}
