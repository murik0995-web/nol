#!/bin/bash
# Устанавливает демон «Завода» как launchd-агент ЭТОГО чекаута. Ничего не запускает —
# печатает команды launchctl, их выполняет владелец сам.
set -euo pipefail

STATE="${NOL_FACTORY_HOME:-$HOME/.nol-factory}"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
NODE="$(command -v node)"
PLIST="$HOME/Library/LaunchAgents/com.nol.factory.plist"
OLD="$HOME/projects/conveyor/state.db"

[ -n "$NODE" ] || { echo "node не найден в PATH / node not found in PATH"; exit 1; }
mkdir -p "$STATE" "$HOME/Library/LaunchAgents"

# Одноразовый переезд состояния со старого места (вместе с WAL, иначе снимок будет неполным).
if [ -f "$OLD" ] && [ ! -f "$STATE/state.db" ]; then
  cp "$OLD" "$STATE/state.db"
  [ -f "$OLD-wal" ] && cp "$OLD-wal" "$STATE/state.db-wal"
  [ -f "$OLD-shm" ] && cp "$OLD-shm" "$STATE/state.db-shm"
  echo "state.db скопирован из $OLD / copied old state.db"
fi

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.nol.factory</string>
  <key>ProgramArguments</key><array>
    <string>$NODE</string>
    <string>$REPO/factory/daemon/conveyor.mjs</string>
    <string>daemon</string>
    <string>3</string>
  </array>
  <key>WorkingDirectory</key><string>$STATE</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$STATE/daemon.log</string>
  <key>StandardErrorPath</key><string>$STATE/daemon.log</string>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>$(dirname "$NODE"):/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>NOL_FACTORY_HOME</key><string>$STATE</string>
  </dict>
</dict></plist>
EOF

echo "plist записан / plist written: $PLIST"
echo "состояние / state: $STATE"
echo
echo "Запусти сам / run yourself:"
echo "  launchctl bootout gui/$(id -u)/com.nol.factory 2>/dev/null || true"
echo "  launchctl bootstrap gui/$(id -u) $PLIST"
