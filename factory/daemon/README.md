# Завод / The Factory daemon

Демон конвейера: очередь задач → git worktree на задачу → агент `claude -p` → гейты → автомердж. Приложение `apps/factory.html` показывает его живьём.

The conveyor daemon: task queue → a git worktree per task → a `claude -p` agent → gates → auto-merge. The `apps/factory.html` app shows it live.

## Требования / Requirements

- Node 24+ (`node:sqlite`), git
- `claude` CLI, залогиненный в подписку Claude / logged into a Claude subscription

## Быстрый старт (10 минут) / Quick start (10 minutes)

1. Установи и запусти демон / install and start the daemon:

   ```bash
   bash factory/daemon/install.sh
   ```

   Скрипт пишет launchd-plist для этого чекаута и печатает две команды `launchctl` — выполни их сам.

   The script writes a launchd plist for this checkout and prints two `launchctl` commands — run them yourself.

2. Подключи этот чекаут как репозиторий. Имя обязано получиться ровно `nol` — так его ищет приложение; обычный `git clone` уже называет папку так / register this checkout as a repo. The name must come out as exactly `nol` — that's what the app looks for; a plain `git clone` already names the folder that way:

   ```bash
   node factory/daemon/conveyor.mjs repo add /путь/до/твоего/чекаута/nol
   ```

3. Собери приложение один раз в собственном клоне демона (`~/conveyor-repos/nol`) — до первой влитой демоном задачи там нет `dist/`, и `/nol/…` отвечает 404 / build the app once inside the daemon's own clone (`~/conveyor-repos/nol`) — before its first merged task there is no `dist/` yet, and `/nol/…` answers 404:

   ```bash
   cd ~/conveyor-repos/nol && node scripts/build.mjs
   ```

4. Открой / open: `http://localhost:7777/nol/apps/factory.html` (старая отладочная панель — на `http://localhost:7777` / the old debug dashboard lives at `http://localhost:7777`).

Разово, без launchd / one-off, without launchd:

```bash
node factory/daemon/conveyor.mjs daemon 3
```

## Состояние / State

Всё состояние (`state.db`, `runs/`, `shots/`, `daemon.log`) живёт вне репозитория: в `$NOL_FACTORY_HOME`, по умолчанию `~/.nol-factory/`. Каталог создаётся при старте. В git ничего из этого не попадает.

All state (`state.db`, `runs/`, `shots/`, `daemon.log`) lives outside the repository: in `$NOL_FACTORY_HOME`, `~/.nol-factory/` by default. The directory is created on start. None of it ever enters git.

## Остановить / Stop

```bash
launchctl bootout gui/$(id -u)/com.nol.factory
```
