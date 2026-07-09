# EasySignage — Automation Core (Wake-on-LAN, RS-232, Sensores, Câmeras)

## 0. Núcleo da plataforma (fora do âmbito deste documento)

Este ficheiro descreve a **camada de automação física** (WoL, serial, sensores, câmeras). **Antes** dessa camada, no estado atual do repositório, o fluxo seguinte já está **funcional em desenvolvimento**:

1. **Iniciar o web player** — `apps/web-player` (em dev, tipicamente porta **3010**).
2. **Conectar o player ao servidor** — pareamento com código no CMS, token do device, heartbeat e leitura periódica de estado; o device aparece online no painel.
3. **Enviar conteúdo** — no CMS, no detalhe do dispositivo, associar **um asset (imagem)** ou **uma playlist** como conteúdo de teste; o player exibe **imagem única** ou **lista em sequência** (loop).

Detalhe e limitações (modo teste vs. publicação versionada): **`digital_signage_arquitetura_roadmap.md`**, secção **19.0** (*Capacidade funcional comprovada*).

---

## 1. Objetivo

Definir a arquitetura, APIs, módulos Node.js e plano de implementação para a camada de automação do EasySignage, incluindo:

- Wake-on-LAN (WoL)
- RS-232 (serial local e over IP)
- Integração com sensores
- Integração com câmeras (USB/IP)
- Engine de comandos, regras e agendamento

---

## 2. Arquitetura Geral

```
[ CMS ]
   |
   v
[ Automation API (Node.js) ]
   |
   v
[ Automation Engine ]
   |        |         |         |
   v        v         v         v
 [WoL]   [RS-232]  [Sensors] [Cameras]
   |        |         |         |
   v        v         v         v
[ Player Agent / Edge Agent ]
   |
   v
[ Hardware / Rede local ]
```

---

## 3. Stack Técnica Recomendada

### Backend
- Node.js + TypeScript
- Framework: NestJS ou Fastify

### Mensageria / Execução
- BullMQ (jobs)
- Redis (queue + pub/sub)

### Banco
- PostgreSQL

---

## 4. Módulos Node.js Recomendados

### Wake-on-LAN
- `wake_on_lan`
- `wol`

### RS-232 / Serial
- `serialport`

### Sensores
- `onoff` (GPIO)
- `node-hid`
- `mqtt` (futuro)

### Câmeras
- `node-webcam`
- `ffmpeg` (via wrapper)
- `rtsp-ffmpeg`

### Utilitários
- `p-retry`
- `p-timeout`
- `eventemitter3`

---

## 5. Automation API

### Base
`/api/v1/automation`

---

### Commands

POST `/commands`

```
{
  "targetId": "device-id",
  "command": "display.power_on",
  "payload": {}
}
```

---

### Wake-on-LAN

POST `/wol/send`

```
{
  "mac": "AA:BB:CC:DD:EE:FF",
  "broadcast": "192.168.0.255"
}
```

---

### RS-232

POST `/serial/send`

```
{
  "port": "COM3",
  "baudRate": 9600,
  "command": "POWER ON"
}
```

---

### Sensors

GET `/sensors/read`

POST `/sensors/event`

---

### Cameras

POST `/camera/capture`

```
{
  "source": "usb0"
}
```

---

## 6. Automation Engine

Responsável por:

- resolver driver
- executar comando
- retry/timeout
- logging

---

## 7. Player Agent (Electron)

Responsável por:

- executar serial
- capturar câmera
- enviar WoL local
- ler sensores

---

## 8. Modelos de Dados

### automation_commands
- id
- target_id
- command
- payload
- status
- result

### automation_events
- id
- source
- type
- payload

### sensor_sources
- id
- type
- config

### camera_sources
- id
- type
- config

---

## 9. Fases de Implementação

### Fase 1
- API base
- WoL

### Fase 2
- RS-232 local

### Fase 3
- agendamento

### Fase 4
- sensores

### Fase 5
- câmeras

---

## 10. Segurança

- RBAC
- logs completos
- confirmação para comandos críticos

---

## 11. Conclusão

Automation Core transforma o EasySignage em plataforma de controle físico.

Prioridade:
1. WoL
2. RS-232
3. Scheduling
4. Sensores
5. Câmeras
