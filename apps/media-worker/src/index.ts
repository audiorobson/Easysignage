import { createPool } from './db.js';
import { createMediaWorker } from './worker.js';

const pool = createPool();
const worker = createMediaWorker(pool);

console.log('media-worker: a ouvir a fila "media" (job asset.uploaded)');

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`media-worker: a encerrar (${signal})...`);
  await worker.close();
  await pool.end();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
