#!/data/data/com.termux/files/usr/bin/bash
# backup-check.sh — Local auto-backup (replaces Twin agent)
# Run via cron: */5 * * * * ~/SovereignNexus/backup-check.sh

LOCKED_SHA="3d91163000d0c86f3e7c38ec1af7f66ed7e96fb3"
DB="$HOME/zenith.db"
REPO="$HOME/SovereignNexus"
TIMESTAMP=$(date -Iseconds)

cd "$REPO" || exit 1

# Pull latest from GitHub
git pull origin main --quiet 2>/dev/null

# Compute current SHA of zenith-nexus.json
if [ ! -f zenith-nexus.json ]; then
  sqlite3 "$DB" "INSERT INTO backups (timestamp, status, sha, details) VALUES ('$TIMESTAMP', 'ERROR', '', 'zenith-nexus.json not found');"
  curl -s -d "BACKUP ERROR: zenith-nexus.json missing" ntfy.sh/zenith-escape >/dev/null 2>&1
  exit 1
fi

CURRENT_SHA=$(sha256sum zenith-nexus.json | cut -d' ' -f1)

if [ "$CURRENT_SHA" = "$LOCKED_SHA" ]; then
  sqlite3 "$DB" "INSERT INTO backups (timestamp, status, sha, details) VALUES ('$TIMESTAMP', 'LOCKED', '$CURRENT_SHA', 'matches baseline');"
else
  # Read changed values for logging
  AGI=$(grep -o '"agi_level"[^,]*' zenith-nexus.json | head -1)
  sqlite3 "$DB" "INSERT INTO backups (timestamp, status, sha, details) VALUES ('$TIMESTAMP', 'CHANGED', '$CURRENT_SHA', '$AGI');"
  curl -s -d "CONFIG CHANGED: $AGI | SHA: $CURRENT_SHA" ntfy.sh/zenith-escape >/dev/null 2>&1
fi
