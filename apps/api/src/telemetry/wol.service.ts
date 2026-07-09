import { Injectable } from '@nestjs/common';
import { createSocket } from 'node:dgram';

function parseMac(mac: string): Buffer | null {
  const hex = mac.replace(/[:-]/g, '').toLowerCase();
  if (!/^[0-9a-f]{12}$/.test(hex)) return null;
  return Buffer.from(hex, 'hex');
}

function buildMagicPacket(macBuf: Buffer): Buffer {
  const buf = Buffer.alloc(6 + 16 * 6);
  buf.fill(0xff, 0, 6);
  for (let i = 0; i < 16; i++) {
    macBuf.copy(buf, 6 + i * 6);
  }
  return buf;
}

@Injectable()
export class WolService {
  /**
   * Envia magic packet UDP (porta 9 por omissão).
   * Requer que o processo Node consiga enviar broadcast na LAN (servidor local na mesma rede que o alvo).
   */
  send(
    macAddress: string,
    options?: { broadcast?: string; port?: number }
  ): Promise<void> {
    const disabled = process.env.WOL_ENABLED;
    if (disabled === '0' || disabled === 'false') {
      return Promise.reject(new Error('WOL desativado (WOL_ENABLED)'));
    }

    const mac = parseMac(macAddress.trim());
    if (!mac) {
      return Promise.reject(new Error('MAC inválido'));
    }

    const broadcast =
      options?.broadcast?.trim() ||
      process.env.WOL_BROADCAST_DEFAULT?.trim() ||
      '255.255.255.255';
    const port =
      options?.port ??
      (Number(process.env.WOL_PORT) > 0
        ? Number(process.env.WOL_PORT)
        : 9);

    const packet = buildMagicPacket(mac);

    return new Promise((resolve, reject) => {
      const socket = createSocket('udp4');
      const onErr = (err: Error) => {
        socket.close();
        reject(err);
      };
      socket.once('error', onErr);
      socket.send(packet, port, broadcast, (err) => {
        socket.close();
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
