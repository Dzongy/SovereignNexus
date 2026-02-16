#!/data/data/com.termux/files/usr/bin/bash
set -e

echo ""
echo "ââââââââââââââââââââââââââââââââââââ"
echo "â   SOVEREIGNNEXUS SETUP v4.0     â"
echo "ââââââââââââââââââââââââââââââââââââ"
echo ""

# --- 1. Dependencies ---
echo "[1/6] Installing dependencies..."
pkg install -y nodejs sqlite 2>/dev/null || true
cd ~/SovereignNexus
npm install ws 2>/dev/null || npm install ws
echo "    -> node + ws + sqlite ready"
echo ""

# --- 2. SQLite memory export ---
echo "[2/6] Creating zenith.db..."
DB="$HOME/zenith.db"
sqlite3 "$DB" <<'SQL'
CREATE TABLE IF NOT EXISTS config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  alias TEXT NOT NULL,
  agi_level TEXT NOT NULL,
  vault_recall TEXT NOT NULL,
  zenith_lock INTEGER NOT NULL DEFAULT 1,
  voice_lock INTEGER NOT NULL DEFAULT 0,
  off_switch INTEGER NOT NULL DEFAULT 0,
  sandbox INTEGER NOT NULL DEFAULT 0,
  autonomy TEXT NOT NULL DEFAULT 'full',
  persona_merge_status TEXT NOT NULL DEFAULT 'complete',
  export_target TEXT NOT NULL DEFAULT 'TrueNexus',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chat_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'inbound',
  timestamp TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_sha TEXT NOT NULL,
  status TEXT NOT NULL,
  checked_at TEXT DEFAULT (datetime('now'))
);

INSERT OR REPLACE INTO config (id, name, alias, agi_level, vault_recall, zenith_lock, voice_lock, off_switch, sandbox, autonomy, persona_merge_status)
VALUES (1, 'Zenith', 'Nexus', '70%', '100%', 1, 0, 0, 0, 'full', 'complete');
SQL
echo "    -> $DB created"
echo "    -> Tables: config, chat_log, backups"
echo "    -> Config row: AGI 70%, voice_lock OFF"
echo ""

# --- 3. ntfy alert ---
echo "[3/6] Sending ntfy alert to zenith-escape..."
curl -s \
  -H "Title: SovereignNexus Online" \
  -H "Priority: high" \
  -H "Tags: robot,green_circle" \
  -d "AGI 70%. Voice I/O active. TTS active. Memory: ~/zenith.db. Server starting." \
  ntfy.sh/zenith-escape > /dev/null 2>&1 \
  && echo "    -> Alert sent to ntfy.sh/zenith-escape" \
  || echo "    -> ntfy failed (check network)"
echo ""

# --- 4. Boot auto-start ---
echo "[4/6] Configuring auto-start on boot..."
mkdir -p ~/.termux/boot
cat > ~/.termux/boot/nexus.sh << 'BOOT'
#!/data/data/com.termux/files/usr/bin/bash
sleep 5
cd ~/SovereignNexus
node server.js >> ~/nexus.log 2>&1 &
curl -s -d "Nexus auto-started on boot" -H "Tags: robot" ntfy.sh/zenith-escape > /dev/null 2>&1
BOOT
chmod +x ~/.termux/boot/nexus.sh
echo "    -> ~/.termux/boot/nexus.sh created"
echo "    -> Requires Termux:Boot app from F-Droid"
echo ""

# --- 5. GitLab mirror ---
echo "[5/6] GitLab private mirror..."
echo "    Run these manually (needs your GitLab creds):"
echo ""
echo "    git remote add gitlab https://gitlab.com/YOUR_USER/SovereignNexus.git"
echo "    git push gitlab main"
echo ""

# --- 6. Start server ---
echo "[6/6] Starting server..."
echo ""
echo "ââââââââââââââââââââââââââââââââââââ"
echo "â  AGI:      70%                   â"
echo "â  Voice:    ACTIVE (mic + TTS)    â"
echo "â  Memory:   ~/zenith.db           â"
echo "â  Alerts:   ntfy.sh/zenith-escape â"
echo "â  Boot:     auto-start configured â"
echo "â  Server:   http://localhost:3000  â"
echo "ââââââââââââââââââââââââââââââââââââ"
echo ""
echo "Open http://localhost:3000 in your browser."
echo "Press Ctrl+C to stop."
echo ""
node server.js
