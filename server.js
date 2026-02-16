const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { execSync } = require('child_process');

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.HOME + '/zenith.db';
const MIME = {
  '.html': 'text/html',
  '.json': 'application/json',
  '.js': 'text/javascript',
  '.css': 'text/css'
};

const server = http.createServer((req, res) => {
  // API: backup history from local SQLite
  if (req.url === '/api/backups') {
    try {
      const raw = execSync('sqlite3 -json "' + DB_PATH + '" "SELECT * FROM backups ORDER BY id DESC LIMIT 50;"', { timeout: 3000 });
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(raw.toString());
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('[]');
    }
    return;
  }

  // API: current config
  if (req.url === '/api/config') {
    try {
      const raw = execSync('sqlite3 -json "' + DB_PATH + '" "SELECT * FROM config ORDER BY id DESC LIMIT 1;"', { timeout: 3000 });
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(raw.toString());
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('[]');
    }
    return;
  }

  // Static files
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

    // Build response with speak flag for browser TTS
    const replyText = type === 'voice'
      ? 'Nexus: Voice received. ' + content
      : 'Nexus: ' + content;

    const reply = {
      from: 'Nexus',
      type: type === 'voice' ? 'voice_response' : 'text_response',
      message: replyText,
      speak: true,
      timestamp: new Date().toISOString()
    };

    ws.send(JSON.stringify(reply));

    // Broadcast to other clients
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === 1) {
        client.send(JSON.stringify({
          from: 'Nexus',
          type: 'broadcast',
          message: '[' + type + '] ' + content,
          speak: false,
          timestamp: new Date().toISOString()
        }));
      }
    });
  });

  ws.on('close', () => console.log('Client disconnected'));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('SovereignNexus running on http://0.0.0.0:' + PORT);
  console.log('WebSocket: ws://0.0.0.0:' + PORT + '/chat');
  console.log('API: /api/backups, /api/config');
  console.log('Voice I/O: enabled | TTS: browser-side via speak flag');
});
