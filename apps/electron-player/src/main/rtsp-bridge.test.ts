import { describe, expect, it, vi, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import http from 'node:http';
import { RtspBridgeMain } from './rtsp-bridge';
import type { SpawnFn } from './ffmpeg-rtsp';

/** Duplo de teste para o `ChildProcessWithoutNullStreams` retornado pelo ffmpeg. */
function createFakeFfmpeg() {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: PassThrough;
    stderr: PassThrough;
    kill: (signal?: string) => void;
    killed: boolean;
  };
  proc.stdout = new PassThrough();
  proc.stderr = new PassThrough();
  proc.killed = false;
  proc.kill = vi.fn((_signal?: string) => {
    proc.killed = true;
    proc.emit('exit', 0);
  });
  return proc;
}

function httpGet(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', reject);
  });
}

describe('RtspBridgeMain', () => {
  let bridge: RtspBridgeMain;

  afterEach(async () => {
    await bridge?.close();
  });

  it('start() devolve um streamUrl HTTP local que ainda não spawna o ffmpeg', async () => {
    const spawnFn = vi.fn();
    bridge = new RtspBridgeMain(spawnFn as unknown as SpawnFn);

    const { streamId, streamUrl } = await bridge.start('rtsp://cam.local/stream1');

    expect(streamId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(streamUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/rtsp\//);
    expect(spawnFn).not.toHaveBeenCalled();
  });

  it('GET no streamUrl spawna o ffmpeg com o URL RTSP certo e faz stream do stdout no corpo da resposta', async () => {
    const fakeFfmpeg = createFakeFfmpeg();
    const spawnFn = vi.fn().mockReturnValue(fakeFfmpeg);
    bridge = new RtspBridgeMain(spawnFn as unknown as SpawnFn);

    const { streamUrl } = await bridge.start('rtsp://cam.local/stream1');

    const pending = httpGet(streamUrl);
    // Só depois do pedido HTTP chegar é que o ffmpeg é spawnado (on-demand).
    await vi.waitFor(() => expect(spawnFn).toHaveBeenCalledTimes(1));
    expect(spawnFn.mock.calls[0][0]).toBe('ffmpeg');
    expect(spawnFn.mock.calls[0][1]).toContain('rtsp://cam.local/stream1');

    fakeFfmpeg.stdout.write(Buffer.from('fake-fmp4-bytes'));
    fakeFfmpeg.stdout.end();

    const { status, body } = await pending;
    expect(status).toBe(200);
    expect(body).toBe('fake-fmp4-bytes');
  });

  it('devolve 404 para streamId desconhecido', async () => {
    bridge = new RtspBridgeMain(vi.fn() as unknown as SpawnFn);
    const { streamUrl } = await bridge.start('rtsp://cam.local/stream1');
    const port = new URL(streamUrl).port;

    const { status } = await httpGet(`http://127.0.0.1:${port}/rtsp/nao-existe`);
    expect(status).toBe(404);
  });

  it('stopByUrl() mata o processo ffmpeg associado ao URL RTSP', async () => {
    const fakeFfmpeg = createFakeFfmpeg();
    const spawnFn = vi.fn().mockReturnValue(fakeFfmpeg);
    bridge = new RtspBridgeMain(spawnFn as unknown as SpawnFn);

    const { streamUrl } = await bridge.start('rtsp://cam.local/stream1');
    const pending = httpGet(streamUrl);
    await vi.waitFor(() => expect(spawnFn).toHaveBeenCalledTimes(1));

    bridge.stopByUrl('rtsp://cam.local/stream1');

    expect(fakeFfmpeg.kill).toHaveBeenCalledWith('SIGTERM');
    await pending;
  });

  it('close() encerra o servidor HTTP e todos os processos ativos', async () => {
    const fakeFfmpeg = createFakeFfmpeg();
    const spawnFn = vi.fn().mockReturnValue(fakeFfmpeg);
    bridge = new RtspBridgeMain(spawnFn as unknown as SpawnFn);

    const { streamUrl } = await bridge.start('rtsp://cam.local/stream1');
    const port = new URL(streamUrl).port;
    const pending = httpGet(streamUrl).catch(() => null);
    await vi.waitFor(() => expect(spawnFn).toHaveBeenCalledTimes(1));

    await bridge.close();
    await pending;

    await expect(httpGet(`http://127.0.0.1:${port}/rtsp/x`)).rejects.toThrow();
  });
});
