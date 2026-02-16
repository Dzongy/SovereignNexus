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

  ws.on('message', (message) => {
    const text = message.toString();
    console.log('Received:', text);
    // Echo back with Nexus prefix
    ws.send(JSON.stringify({
      from: 'Nexus',
      message: text,
      timestamp: new Date().toISOString()
    }));
  });

  ws.on('close', () => {
    console.log('Client disconnected from /chat');
  });

  // Welcome message
  ws.send(JSON.stringify({
    from: 'Nexus',
    message: 'Connected to SovereignNexus chat. AGI 60%.',
    timestamp: new Date().toISOString()
  }));
});

server.listen(PORT, () => {
  console.log('SovereignNexus running on port ' + PORT);
  console.log('HTTP: http://localhost:' + PORT);
  console.log('WebSocket: ws://localhost:' + PORT + '/chat');
});
