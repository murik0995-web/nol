# Завод / The Factory daemon

Демон конвейера: очередь задач → git worktree на задачу → агент `claude -p` → гейты → автомердж. Приложение `apps/factory.html` показывает его живьём.

The conveyor daemon: task queue → a git worktree per task → a `claude -p` agent → gates → auto-merge. The `apps/factory.html` app shows it live.

## Требования / Requirements

- Node 24+ (`node:sqlite`), git
- `claude` CLI, залогиненный в подписку Claude / logged into a Claude subscription

## Запуск / Run

```bash
bash factory/daemon/install.sh
```

Скрипт пишет launchd-plist для этого чекаута и печатает две команды `launchctl` — выполни их сам. Демон поднимется на `http://localhost:7777` (старая отладочная панель — там же, приложение — `http://localhost:7777/nol/apps/factory.html`).

The script writes a launchd plist for this checkout and prints two `launchctl` commands — run them yourself. The daemon comes up on `http://localhost:7777` (the old debug dashboard lives there; the app is at `http://localhost:7777/nol/apps/factory.html`).

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
