#!/bin/zsh
# One factory shift: pick a target, let the agent build it, verify, push. Runs daily from launchd (com.nol.factory).
set -u
cd "$HOME/projects/nol" || exit 1
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
mkdir -p factory/logs
LOG="factory/logs/$(date +%F).log"
DAY=$(( ( $(date +%s) - $(date -j -f %Y-%m-%d 2026-09-04 +%s) ) / 86400 + 1 ))
echo "=== shift start $(date -u +%FT%TZ), day $DAY ===" >> "$LOG"
[ "$DAY" -gt 100 ] && { echo "100 days complete, nothing to do" >> "$LOG"; exit 0; }
if [ -n "$(git status --porcelain | grep -v '^?? factory/logs')" ]; then echo "working tree has uncommitted changes, skipping the shift so nothing is lost" >> "$LOG"; exit 0; fi
git fetch -q origin main && git reset -q --hard origin/main && git clean -fdq -e factory/logs >> "$LOG" 2>&1
export GITHUB_TOKEN="$(printf 'protocol=https\nhost=github.com\n' | git credential fill | sed -n 's/^password=//p')"
CLAUDE_BIN="${CLAUDE_BIN:-/Users/muratmacbook/.nvm/versions/node/v24.18.0/bin/claude}"
caffeinate -dimsu "$CLAUDE_BIN" -p "$(cat factory/PROMPT.md)" --permission-mode bypassPermissions --output-format text >> "$LOG" 2>&1
if node --test >> "$LOG" 2>&1 && node scripts/build.mjs >> "$LOG" 2>&1 && node scripts/smoke.mjs >> "$LOG" 2>&1 && python3 -c "import json;json.load(open('journal/events.json'));json.load(open('factory/queue.json'))" >> "$LOG" 2>&1; then
  git add -A
  if git -c user.name="NOL factory" -c user.email="murik.09.95@gmail.com" commit -q -m "factory day $DAY" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"; then
    git push -q origin main >> "$LOG" 2>&1 && echo "day $DAY shipped" >> "$LOG" || echo "day $DAY: push failed" >> "$LOG"
  else echo "day $DAY: nothing to commit" >> "$LOG"; fi
else
  echo "day $DAY: checks failed, work discarded (see above)" >> "$LOG"
  git reset -q --hard origin/main && git clean -fdq -e factory/logs
fi
echo "=== shift end $(date -u +%FT%TZ) ===" >> "$LOG"
