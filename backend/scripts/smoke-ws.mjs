import { WebSocket } from 'ws';

const ws = new WebSocket('ws://127.0.0.1:50090');

ws.on('open', () => {
  console.log('connected');
  ws.send(JSON.stringify({
    kind: 'chat-request',
    tabId: -1,
    text: 'hello',
    modelId: 'anthropic',
    pageContext: { url: 'https://example.com', title: 'Example' },
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('reply:', JSON.stringify(msg).slice(0, 320));
  if (msg.kind === 'error' || (msg.kind === 'chat-response' && msg.done)) {
    ws.close();
    process.exit(0);
  }
});

ws.on('error', (err) => {
  console.log('ws err:', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.log('timeout');
  ws.close();
  process.exit(0);
}, 5000);
