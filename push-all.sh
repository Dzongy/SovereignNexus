#!/data/data/com.termux/files/usr/bin/bash
# push-all.sh — Sync zenith-nexus.json + index.html to all 3 repos
# Usage: cd ~/SovereignNexus && bash push-all.sh

SRC="$HOME/SovereignNexus"
REPOS=("SovereignNexus" "TrueNexus" "Dzongy.github.io")
TIMESTAMP=$(date +"%Y-%m-%d %H:%M")

echo ""
echo "Syncing config to all repos..."
echo ""

for REPO in "${REPOS[@]}"; do
  DIR="$HOME/$REPO"
  if [ ! -d "$DIR" ]; then
    echo "  [$REPO] NOT FOUND at $DIR — skipping"
    echo "  Clone it: cd ~ && git clone https://github.com/Dzongy/$REPO.git"
    echo ""
    continue
  fi

  echo "  [$REPO] Copying files..."
  cp "$SRC/zenith-nexus.json" "$DIR/zenith-nexus.json"
  cp "$SRC/index.html" "$DIR/index.html"

  cd "$DIR"
  if git diff --quiet 2>/dev/null; then
    echo "  [$REPO] No changes — skipping push"
  else
    git add -A
    git commit -m "config sync $TIMESTAMP" --quiet
    git push origin main --quiet 2>/dev/null
    if [ $? -eq 0 ]; then
      echo "  [$REPO] Pushed to GitHub"
    else
      echo "  [$REPO] Push FAILED — check credentials"
    fi
  fi
  echo ""
done

echo "Done. Live site will update at https://Dzongy.github.io in ~60s."
