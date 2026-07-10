/** Mensagens e envelopes do protocolo device ↔ backend (heartbeat, sync, comandos). */



export interface HeartbeatPayload {

  deviceId: string;

  publicationVersion?: string;

  platform: string;

  uptimeSec?: number;

}



export interface CommandEnvelope {

  id: string;

  type: string;

  payload?: Record<string, unknown>;

  createdAt: string;

}



/** Severidades para `POST /api/v1/device/telemetry` → `events[]`. */

export type TelemetrySeverity = 'info' | 'warning' | 'error' | 'critical';



/**

 * Evento pontual (falha de rede, porta, buffer, etc.).

 * `category` livre: network | playback | connectivity | port | storage | system | analytics | …

 */

export interface TelemetryEventOut {

  category: string;

  severity: TelemetrySeverity;

  code?: string;

  message?: string;

  payload?: Record<string, unknown>;

}



/**

 * Snapshot agregado (substitui o anterior no servidor).

 * Estrutura evolutiva — campos comuns sugeridos:

 * - `connected`, `uptimeSec`

 * - `playback`: playlistId, assetId, itemIndex, bufferHealth, estimatedBitrateKbps, …

 * - `network`: linkSpeedMbps, rttMs, interfaceName, …

 */

export type TelemetrySnapshot = Record<string, unknown>;



/** Corpo de `POST /api/v1/device/telemetry` */

export interface TelemetryBatchPayload {

  snapshot?: TelemetrySnapshot;

  events?: TelemetryEventOut[];

}



/** Comando na fila (`GET /api/v1/device/commands/pending`). */

export interface PendingDeviceCommand {

  id: string;

  channel: string;

  payloadJson: Record<string, unknown>;

  createdAt: string;

}



/**

 * Canais reservados para `POST /monitoring/devices/:id/commands` (extensível):

 * `wol` | `gpio` | `serial` | `http` | `automation` | `custom` | …

 */

export type DeviceCommandChannel = string;



/** Corpo de `POST /api/v1/device/commands/:id/ack` */

export interface DeviceCommandAckPayload {

  status?: 'acked' | 'failed';

  result?: Record<string, unknown>;

}

export {
  type RealtimeAuthCms,
  type RealtimeAuthDevice,
  type RealtimeAuthError,
  type RealtimeAuthOk,
  type RealtimeClientMessage,
  type RealtimeHello,
  type RealtimeInternalBroadcast,
  type RealtimePing,
  type RealtimePong,
  type RealtimeServerMessage,
  type RealtimeSubscribeWall,
  type RealtimeSubscribed,
  type RealtimeUnsubscribeWall,
  type RealtimeWallSync,
  type RealtimeWallTick,
  isRealtimeServerMessage,
  parseRealtimeClientMessage,
} from './realtime.js';

