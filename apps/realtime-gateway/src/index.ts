import { WebSocketServer } from 'ws';

const port = Number(process.env.RT_PORT) || 3020;
const wss = new WebSocketServer({ port });

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'hello', service: 'easysignage-realtime-gateway' }));
  ws.on('message', (data) => {
    console.log('message', data.toString());
  });
});

console.log(`Realtime gateway WebSocket on ws://0.0.0.0:${port}`);
