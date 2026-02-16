#!/data/data/com.termux/files/usr/bin/bash
set -e

# SovereignNexus Deploy Script for Termux (Android)
# No systemd. No pm2. No VPS. Just Termux.

# Install dependencies
pkg update -y
pkg install nodejs git -y

# Clone repo
cd ~
if [ -d "SovereignNexus" ]; then
  echo "SovereignNexus already exists. Pulling latest..."
  cd SovereignNexus
  git pull
else
  git clone https://github.com/Dzongy/SovereignNexus.git
  cd SovereignNexus
fi

# Create server
cat > server.js << 'EOF'
const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = process.env.PORT || 3000;
const MIME = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript' };
const server = http.createServer((req, res) => {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, filePath);
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
});
server.listen(PORT, () => { process.stdout.write('SovereignNexus running on port ' + PORT + '\n'); });
EOF

# Start server
node server.js &
SERVER_PID=$!

# Test
sleep 2
echo ""
echo "Testing..."
curl -s http://localhost:3000 | head -5
echo ""
echo "SovereignNexus is live on http://localhost:3000"
echo "Server PID: $SERVER_PID"
echo "To stop: kill $SERVER_PID"
echo "To restart: cd ~/SovereignNexus && node server.js &"
