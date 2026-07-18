import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { spawnRtspToFmp4, type SpawnFn, type FfmpegProcess } from './ffmpeg-rtsp';

/**
 * Bridge RTSP nativo (Fase 5.C, PR 5.10).
 *
 * Mantém um pequeno servidor HTTP local (127.0.0.1, porta efémera) que, a cada
 * pedido GET `/rtsp/<streamId>`, spawna um processo `ffmpeg` a remuxar o RTSP
 * de origem em fragmented MP4 e liga o `stdout` diretamente à resposta HTTP
 * (chunked). O renderer aponta `<video src>` para esse URL local — sem MSE
 * explícito, sem passar handles nativos por IPC.
 *
 * `start(url)` regista o mapeamento streamId → URL RTSP e devolve o URL local;
 * o ffmpeg só arranca quando o `<video>` faz o pedido HTTP (evita processos
 * órfãos se o `play()` falhar antes do elemento carregar).
 */
export class RtspBridgeMain {
  private server: Server | null = null;
  private port = 0;
  private readonly streamsByI = new Map<string, string>(); // streamId -> rtspUrl
  private readonly processesByI = new Map<string, FfmpegProcess>();

  constructor(private readonly spawnFn: SpawnFn | undefined = undefined) {}

  async listen(): Promise<number> {
    if (this.server) return this.port;
    this.server = createServer((req, res) => this.handleRequest(req, res));
    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(0, '127.0.0.1', () => resolve());
    });
    const address = this.server.address();
    this.port = typeof address === 'object' && address ? address.port : 0;
    return this.port;
  }

  /** Regista um novo stream e devolve o URL local a usar em `<video src>`. */
  async start(rtspUrl: string): Promise<{ streamId: string; streamUrl: string }> {
    const port = await this.listen();
    const streamId = randomUUID();
    this.streamsByI.set(streamId, rtspUrl);
    return { streamId, streamUrl: `http://127.0.0.1:${port}/rtsp/${streamId}` };
  }

  /** Para todos os processos ffmpeg associados a este URL RTSP (idempotente). */
  stopByUrl(rtspUrl: string): void {
    for (const [id, url] of this.streamsByI.entries()) {
      if (url === rtspUrl) {
        this.stopStream(id);
        this.streamsByI.delete(id);
      }
    }
  }

  private stopStream(streamId: string): void {
    const proc = this.processesByI.get(streamId);
    if (proc && !proc.killed) {
      proc.kill('SIGTERM');
    }
    this.processesByI.delete(streamId);
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const match = /^\/rtsp\/([a-f0-9-]+)$/i.exec(req.url ?? '');
    const streamId = match?.[1];
    const rtspUrl = streamId ? this.streamsByI.get(streamId) : undefined;
    if (!streamId || !rtspUrl) {
      res.writeHead(404).end('stream não encontrado');
      return;
    }

    const ffmpeg = spawnRtspToFmp4(rtspUrl, this.spawnFn);
    this.processesByI.set(streamId, ffmpeg);

    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Cache-Control': 'no-store',
    });

    ffmpeg.stdout.pipe(res);
    ffmpeg.stderr.on('data', () => {
      /* erros já filtrados por -loglevel error; não fazer log ruidoso por frame */
    });

    const cleanup = () => {
      if (this.processesByI.get(streamId) === ffmpeg) {
        this.processesByI.delete(streamId);
      }
      if (!ffmpeg.killed) ffmpeg.kill('SIGTERM');
    };
    req.on('close', cleanup);
    res.on('close', cleanup);
    ffmpeg.on('exit', () => {
      if (!res.writableEnded) res.end();
    });
  }

  /** Encerra todos os processos ffmpeg e o servidor HTTP local (usar no `before-quit`). */
  async close(): Promise<void> {
    for (const id of this.processesByI.keys()) this.stopStream(id);
    this.streamsByI.clear();
    if (this.server) {
      await new Promise<void>((resolve) => this.server!.close(() => resolve()));
      this.server = null;
      this.port = 0;
    }
  }
}
