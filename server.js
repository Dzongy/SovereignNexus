const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const MIME = {
  '.html': 'text/html',
  '.json': 'application/json',
  '.js': 'text/javascript',
  '.css': 'text/css'
};

// HTTP server: serves static files
const server = http.createServer((req, res) => {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, filePath);
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
});

// WebSocket server on /chat path
const wss = new WebSocketServer({ server, path: '/chat' });

wss.on('connection', (ws) => {
  console.log('Client connected to /chat');

  ws.on('message', (raw) => {
    let type = 'text';
    let content = '';

    try {
      const parsed = JSON.parse(raw.toString());
      type = parsed.type || 'text';
      content = parsed.content || raw.toString();
    } catch (e) {
      content = raw.toString();
    }

    console.log('[' + type + '] Received:', content);

    // Build response
    let reply;
    if (type === 'voice') {
      reply = {
        from: 'Nexus',
        type: 'voice_response',
        message: 'Voice received: ' + content,
        original_input: content,
        timestamp: new Date().toISOString()
      };
    } else {
      reply = {
        from: 'Nexus',
        type: 'text_response',
        message: content,
        timestamp: new Date().toISOString()
      };
    }

    ws.send(JSON.stringify(reply));

    // Broadcast to all connected clients
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === 1) {
        client.send(JSON.stringify({
          from: 'Nexus',
          type: 'broadcast',
          message: '[' + type + '] ' + content,
          timestamp: new Date().toISOString()
        }));
      }
    });
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('SovereignNexus running on http://0.0.0.0:' + PORT);
  console.log('WebSocket chat: ws://0.0.0.0:' + PORT + '/chat');
  console.log('Voice input: enabled');
});
