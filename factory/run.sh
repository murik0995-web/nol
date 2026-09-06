#!/bin/zsh
# One factory shift: pick a target, let the agent build it, verify, push.
# Exit codes: 0 shipped · 2 checks failed (work discarded) · 3 skipped (owner has uncommitted work) · 4 agent hit a usage limit · 5 nothing to build
set -u
cd "$HOME/projects/nol" || exit 1
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
mkdir -p factory/logs
LOG="factory/logs/$(date +%F).log"
DAY=$(( ( $(date +%s) - $(date -j -f %Y-%m-%d 2026-09-04 +%s) ) / 86400 + 1 ))
echo "=== shift start $(date -u +%FT%TZ), day $DAY ===" >> "$LOG"
if [ -n "$(git status --porcelain | grep -v '^?? factory/logs')" ]; then echo "working tree has uncommitted changes, skipping the shift so nothing is lost" >> "$LOG"; exit 3; fi
git fetch -q origin main && git reset -q --hard origin/main && git clean -fdq -e factory/logs -e factory/attempts.json >> "$LOG" 2>&1
export GITHUB_TOKEN="$(printf 'protocol=https\nhost=github.com\n' | git credential fill | sed -n 's/^password=//p')"
TARGET=$(node factory/backlog.mjs next 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).id)}catch(e){console.log('')}})")
[ -z "$TARGET" ] && { echo "backlog empty, nothing to build" >> "$LOG"; exit 5; }
echo "target: $TARGET" >> "$LOG"
CLAUDE_BIN="${CLAUDE_BIN:-/Users/muratmacbook/.nvm/versions/node/v24.18.0/bin/claude}"
AGENT_OUT=$(mktemp)
caffeinate -dimsu "$CLAUDE_BIN" -p "Today is factory day $DAY (calendar days since 2026-09-04; use this number in journal titles like \"Day $DAY: …\").

$(cat factory/PROMPT.md)" --permission-mode bypassPermissions --output-format text > "$AGENT_OUT" 2>&1
AGENT_RC=$?
cat "$AGENT_OUT" >> "$LOG"
if grep -qiE "usage limit|rate limit|limit reached|too many requests|overloaded|status 429|hit your limit" "$AGENT_OUT" && [ -z "$(git status --porcelain | grep -v '^?? factory/logs')" ]; then rm -f "$AGENT_OUT"; echo "agent hit a usage limit, cooling down" >> "$LOG"; exit 4; fi
rm -f "$AGENT_OUT"
TEXT_OK=1; for f in apps/*.html assets/*.js assets/lang/*.js index.html; do file "$f" | grep -qiE "text|json|script" || { echo "not a text file: $f" >> "$LOG"; TEXT_OK=0; }; done
if [ $TEXT_OK = 1 ] && node --test >> "$LOG" 2>&1 && node scripts/build.mjs >> "$LOG" 2>&1 && node scripts/smoke.mjs >> "$LOG" 2>&1 && python3 -c "import json;json.load(open('journal/events.json'))" >> "$LOG" 2>&1; then
  git add -A
  if git -c user.name="NOL factory" -c user.email="murik.09.95@gmail.com" commit -q -m "factory day $DAY: $TARGET" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"; then
    if git push -q origin main >> "$LOG" 2>&1; then echo "day $DAY shipped: $TARGET" >> "$LOG"; node -e "const fs=require('fs');const p='factory/attempts.json';const a=fs.existsSync(p)?JSON.parse(fs.readFileSync(p)):{};delete a['$TARGET'];fs.writeFileSync(p,JSON.stringify(a))"; echo "=== shift end $(date -u +%FT%TZ) ===" >> "$LOG"; exit 0
    else echo "day $DAY: push failed" >> "$LOG"; git reset -q --hard origin/main; exit 2; fi
  else echo "day $DAY: nothing to commit (agent rc=$AGENT_RC)" >> "$LOG"; fi
else
  echo "day $DAY: checks failed, work discarded" >> "$LOG"
  git reset -q --hard origin/main && git clean -fdq -e factory/logs -e factory/attempts.json
fi
# failed or empty shift: count attempts, block the task after the second miss so the loop moves on
N=$(node -e "const fs=require('fs');const p='factory/attempts.json';const a=fs.existsSync(p)?JSON.parse(fs.readFileSync(p)):{};a['$TARGET']=(a['$TARGET']||0)+1;fs.writeFileSync(p,JSON.stringify(a));console.log(a['$TARGET'])")
if [ "$N" -ge 2 ]; then node factory/backlog.mjs block "$TARGET" "two shifts could not ship it (checks failed or nothing produced); needs a human look" >> "$LOG" 2>&1; echo "blocked $TARGET after $N attempts" >> "$LOG"; fi
echo "=== shift end $(date -u +%FT%TZ) ===" >> "$LOG"
exit 2
