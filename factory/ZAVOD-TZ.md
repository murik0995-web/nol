# ТЗ «Завод внутри NOL» (эпика ZAVOD)

Документ для агентов конвейера. Каждая карточка на доске ссылается на раздел здесь. Читай весь документ перед первой правкой, потом только свой раздел 6.x. Если код расходится с этим текстом, побеждает код; расхождение опиши в журнале событием `build`.

## 0. Зачем

NOL продаётся как продукт. Покупатель получает репозиторий и запускает у себя «Завод»: демон конвейера на своей машине со своей подпиской Claude, а приложение `apps/factory.html` показывает всё живьём: агентов, ленту их работы, эпики с волнами, квоту подписки, чат с агентом. Образец поведения снят с чужой панели (ролик 15.09): лента агента человеческим языком с командами и временем; поле ввода к работающему агенту с выбором модели; эпики, разбитые на волны W1, W2, W3, с кнопкой «Принять W1» и слиянием в мастер только после сборки всей эпики; карточки задач с текущей командой агента; счётчики квоты «5ч 9% · 7д 51% · 7д fable 50%»; бейдж «автоматика: ревью · мерж · конфликты».

## 1. Инварианты. Нарушение любого = задача не принята

1. Демон и приложение общаются только через HTTP API демона (раздел 4). Приложение не читает файлы демона и его SQLite.
2. Состояние демона живёт вне репозитория, в `~/.nol-factory/` (state.db, runs/, логи). В git ничего из этого не попадает. `.gitignore` это закрепляет.
3. Токен подписки Claude никогда не покидает демон: не пишется в лог, не отдаётся в API, не попадает в ответ ошибки. В API уходят только проценты и даты сброса.
4. Все правила `factory/CONVENTIONS.md` действуют: `NOL.h`, `NOL.val` для пользовательских строк, русский словарь `assets/lang/ru/factory.js` для каждой новой строки интерфейса, никаких зависимостей и сборки, `nol.css` без своих дизайн-систем.
5. Существующее поведение демона не ломать: `node factory/daemon/selftest.mjs` зелёный после каждой правки демона. Существующие эндпоинты `/api/state`, `/api/add`, `/api/plan`, `/api/pause`, `/api/repos`, `/api/task/:id/live`, `/api/task/:id/say|urgent|revert|recheck|diff`, `/api/task/:KEY` не меняют форму ответа, только расширяются новыми полями.
6. Приложение работает в трёх режимах и не падает ни в одном: демон доступен (same-origin с `http://localhost:7777/nol/…` или CORS с github.io на этом Mac), демон недоступен (публичный сайт), пространство пустое (нет доски). Каждый блок имеет пустое состояние с текстом на двух языках.
7. Одна карточка = один агент = один коммит. Не объединяй карточки, не делай «заодно».
8. Ничего не спрашивай у владельца про этот документ. Спрашивать можно только о поведении продукта, которого здесь нет, или об удалении данных.

## 2. Архитектура

```
apps/factory.html  ──HTTP──▶  factory/daemon/conveyor.mjs  (порт 7777)
     │                              │ spawn claude -p … (подписка владельца)
     │ доска (tasks/notes)          │ SQLite ~/.nol-factory/state.db
     ▼                              ▼
рабочее пространство GitHub    worktrees, merge в main или в ветку эпики, push
```

- `factory/daemon/` — демон целиком: `conveyor.mjs`, `selftest.mjs`, `agent.sb`, `dashboard.html` (старая отладочная панель, остаётся), `install.sh`, `README.md`.
- Работающий экземпляр у владельца запущен launchd из его чекаута; агенты правят копию в воркспейсе. Правка вступает в силу после мерджа и `install.sh` у владельца. Агент никогда не перезапускает демон владельца.
- Приложение «Завод» определяет адрес демона так: если `location.origin === 'http://localhost:7777'`, запросы same-origin; иначе `http://localhost:7777`; если недоступен, режим «без демона».

## 3. Модель данных демона (SQLite)

Существующие таблицы: `tasks`, `events`, `runs`, `repos`, `settings`, `lessons`, `decisions`, `schedules`. Добавляется:

```sql
CREATE TABLE IF NOT EXISTS epics (
  id INTEGER PRIMARY KEY, key TEXT UNIQUE,            -- 'ZAVOD-E1'
  repo TEXT NOT NULL, title TEXT NOT NULL, goal TEXT NOT NULL,
  branch TEXT NOT NULL,                               -- 'epic/zavod-e1'
  status TEXT NOT NULL DEFAULT 'open',                -- open | finalizing | done | failed
  waves INTEGER NOT NULL, wave INTEGER NOT NULL DEFAULT 1,  -- всего волн, текущая волна
  auto_accept INTEGER NOT NULL DEFAULT 0,             -- 1 = волна принимается сама, когда все её задачи done
  base_sha TEXT, created_at INTEGER, updated_at INTEGER);
ALTER TABLE tasks ADD COLUMN epic_id INTEGER;         -- NULL = обычная задача
ALTER TABLE tasks ADD COLUMN wave INTEGER;            -- номер волны внутри эпики
```

Правила:
- Задача с `epic_id` берётся диспетчером (`nextTask`) только если `tasks.wave = epics.wave` её эпики и эпика `open`. Остальные условия прежние (deps, priority).
- `mergeTask` для задачи с `epic_id` вливает в `epics.branch`, не в `repo.base`; push ветки эпики в origin. Пост-мердж шаг (`after_merge`, тестировщик) для таких задач не запускается: тестировщик проверяет прод, а эпика ещё не на проде. Гейты `validation` и критик работают как обычно.
- Волна закрыта, когда все её задачи `done`. Если `auto_accept = 1`, демон сам делает `wave = wave + 1`; иначе ждёт `POST /api/epic/:id/accept`. Если задача волны `failed` или `needs_review`, волна не закрывается, эпика остаётся `open`, владелец видит это в приложении.
- После принятия последней волны эпика переходит в `finalizing`: демон создаёт служебную задачу `<KEY>-FINAL` без агента: `git merge --no-ff epic/… в base` в клоне, потом `validation`, потом критик на полном диффе эпики, потом push и `after_merge`. Успех = эпика `done`, задача `done` с `merge_sha`. Провал = эпика `failed`, ветка остаётся, владелец решает.
- Провал любой задачи эпики не роняет другие задачи той же волны.

## 4. Контракт API (все ответы JSON, кодировка UTF-8, CORS как у `/api/state`)

Существующее, не менять форму:
- `GET /api/state` → `{tasks[], slots, busy, cost, today, budget, paused, paused_until, events[]}`. Добавить поля: `version` (строка, из `factory/daemon/package.json`-подобной константы `VERSION` в коде), `automation: {review: bool, merge: bool, conflicts: true, tester: bool}` (review = `cfg.critic`, merge = `cfg.push`, tester = `cfg.after_merge` содержит `tester`), `epics: [краткие записи epics с полями id,key,title,status,waves,wave,done_tasks,total_tasks]`.
- `GET /api/task/:id/live` → `{feed: [{kind: 'say'|'do'|'ok'|'bad', text, ts}], runs[], decisions[]}`. Поле `ts` добавляется (раздел 6.2); для старых строк без времени `ts: null`.
- `POST /api/task/:id/say` тело: смотри существующий обработчик в `conveyor.mjs` (ветка `nm[2]` после `urgent|recheck|revert`); формат тела не выдумывать, использовать тот, что там читается.

Новое:
- `GET /api/usage` → `{limits: [{kind, group, percent, resets_at, scope: {model: {display_name}} | null, is_active}], breakdown: [{key, display_name, percent}], as_of, error?: string}`. Источник: `GET https://api.anthropic.com/api/oauth/usage` с заголовками `Authorization: Bearer <accessToken>` и `anthropic-beta: oauth-2025-04-20`. Токен: macOS — `security find-generic-password -s "Claude Code-credentials" -w` → JSON → `.claudeAiOauth.accessToken`; иначе файл `~/.claude/.credentials.json`, тот же путь в JSON. Кэш ответа 60 секунд. Любая ошибка → `{limits: [], breakdown: [], error: 'короткая причина без токена'}` со статусом 200. Проверено 15.09: ответ Anthropic содержит `limits[]` с `kind` ∈ `session | weekly_all | weekly_scoped`, `percent` целое, `resets_at` ISO, у `weekly_scoped` в `scope.model.display_name` имя модели; и `seven_day_breakdown.rows[]`. Отдавать наружу только перечисленные поля.
- `GET /api/epics` → `{epics: [{id,key,title,goal,status,waves,wave,auto_accept,branch,created_at, tasks: [{id,key,title,status,wave,cost,model}]}]}`.
- `POST /api/epic` тело `{repo, title, goal, auto_accept}` → планирует волны (раздел 6.7), создаёт эпику, задачи и карточки доски → `{ok, key, waves, keys[]}`. Ошибка планирования → 500 `{error}`.
- `POST /api/epic/:id/accept` → принимает текущую волну, если все её задачи `done`; иначе 409 `{error: 'волна не закрыта: <ключи незакрытых>'}`.
- `POST /api/epic/:id/finalize` → то же, что принятие последней волны; 409, если волна не последняя или не закрыта.
- `POST /api/epic/:id/cancel` → эпика `failed`, её `queued`-задачи `cancelled`, ветка остаётся.

## 5. Экраны приложения `apps/factory.html`

Порядок блоков сверху вниз: Шапка → Эпики → Живой конвейер → Доска → Тестирование → Журнал. Существующие блоки Live, Board, QA, Journal сохраняют функции `paintLive`, `paintBoard`, `paintQA`, `paintLog`; новые блоки добавляются рядом, тем же стилем (`.card`, `.list`, `.it`, `.badge`, `tile`, `.kanban`, `.kcard`).

### 5.1 Шапка
Слева заголовок «Factory» и подзаголовок как сейчас. Справа в `toolbar`:
- Чипы квоты из `/api/usage`, по одному на элемент `limits[]`: текст `5h 13%` для `kind=session`, `7d 13%` для `weekly_all`, `7d Fable 4%` для `weekly_scoped` (имя модели из `scope.model.display_name`, не переводить, `data-notranslate`). Класс `badge`; при `percent ≥ 70` класс `amber`, при `≥ 90` класс `red`. `title` чипа: «resets <локальное время>». Русский: `5ч`, `7д`. Если `error` или демон недоступен: один серый чип `Quota unavailable` / «Квота недоступна». Опрос каждые 60 секунд.
- Бейдж автоматики из `state.automation`: `Automation: review · merge · conflicts · tester`, перечисляются только включённые; русский «Автоматика: ревью · мерж · конфликты · тестировщик».
- Кнопки как сейчас: «Public log», «Open the daemon».

### 5.2 Эпики
Заголовок «Epics» и кнопка «New epic». Нет демона → блок показывает эпики из карточек доски (карточки с полем `epic`), без кнопок действий, и строку «Actions need the daemon on this Mac» / «Действия доступны там, где работает демон».
Форма «New epic» (открывается на месте, не диалогом): поле «Goal» (textarea), поле «Title» (input, по умолчанию первые 60 символов цели), переключатель «Accept waves automatically» (checkbox), кнопка «Plan and start». Отправка → `POST /api/epic` → toast «Epic ZAVOD-E1: 3 waves, 9 tasks» и перерисовка.
Карточка эпики:
- Первая строка: `badge` с ключом, заголовок (`NOL.val`), справа статус `In progress | Finalizing | Done | Failed` (русский: «В работе», «Финализация», «Готово», «Провал»).
- Строка прогресса: «`done` of `total` tasks closed · `pct`%» и полоса `bars`.
- Строка волн: чипы `W1 ●●●●`, `W2 ○○○`, `W3 ○○` где ● = задача done, ◐ = в работе, ○ = в очереди, ✕ = провал; текущая волна выделена классом `acid`. Под ней текст: «Merged waves: 1 of 3 · wave W2 running (1 of 3). Merge to main opens when the whole epic is assembled.» Русский: «Слито волн: 1 из 3 · идёт волна W2 (1 из 3). Мерж в мастер откроется, когда эпика будет собрана».
- Кнопка «Accept W2» активна только когда все задачи текущей волны `done` (иначе disabled с `title` «wave is not closed yet»). На последней волне кнопка называется «Finalize». Кнопка «Cancel epic» серая, с подтверждением `confirm`.
- Ниже сетка задач текущей волны, по две в ряд: ключ, заголовок, статус, модель, стоимость, и строка «последняя команда агента» (раздел 5.4), ссылка «Agent console» (раздел 5.3).

### 5.3 Живая лента агента (пульт)
Открывается по ссылке «Agent console» на любой карточке задачи, которая сейчас `running|critic|merging|asking` (live-статусы демона) — разворачивается под карточкой, вторая ссылка сворачивает. Данные: `GET /api/task/:id/live` каждые 5 секунд пока открыто.
Отрисовка `feed[]` сверху вниз, старые выше:
- `kind='say'` → абзац обычным шрифтом, `data-notranslate`.
- `kind='do'` → строка `mono` с префиксом `$ `, обрезка до 200 символов, `data-notranslate`.
- `kind='ok'` → зелёная строка «работа закончена», `kind='bad'` → красная.
- Слева каждой строки время `HH:MM:SS` из `ts`, если `ts` есть; иначе пусто.
Под лентой: заголовок строки «`key` · `status` · `model` · round `round`» из последнего `runs[]`, кнопка «Stop» → `POST /api/task/:id/urgent` не подходит; «Stop» = `conveyor kill` нет в API → кнопку не делать. Делать только то, что есть в API.
Внизу форма чата (раздел 5.5).

### 5.4 Последняя команда на карточке
Для карточек доски в колонке `Building` и для задач волны: найти задачу демона по `state.tasks[].source_ref === 'nol:' + <workspace> + ':' + card.id` (формат см. `nolParse` в демоне). Показать последнюю запись `feed` с `kind='do'` или `'say'` в одну строку `mono`, серую, обрезка 120 символов. Опрос вместе с `/api/state` (каждые 10 с), но `live` запрашивать только для карточек на экране, не для всех задач.

### 5.5 Чат с агентом
Под лентой (5.3): textarea с подсказкой «Write to the agent. Enter sends, Shift+Enter adds a line» / «Написать агенту. Enter отправит, Shift+Enter добавит строку», кнопка «Send». Отправка → `POST /api/task/:id/say` → toast «Sent. The agent gets it at its next step» / «Отправлено. Агент получит на следующем шаге». Пустое не отправлять.
Выбор модели: на карточках доски в колонке `Queued` (ещё не взяты) селектор `haiku | sonnet | opus` (список `MODELS` демона) сохраняется в поле карточки `model`; `nolSync` при взятии передаёт его в `taskAdd(..., {model})`. Уровень усилия: показывать селектор только если `claude --help` содержит флаг усилия; проверить в задаче 6.5 и записать результат в журнал; если флага нет, селектор не делать. Права: только бейдж «permissions: as task agents» / «права: как у агентов задач», без выбора.

### 5.6 Кнопка «В работу»
На карточках доски в колонке `Queued`: кнопка «Build now» / «В работу». Действие: карточке ставится `priority: 'urgent'` и `rank` меньше минимального среди Queued (наверх). Toast «The conveyor picks it up within a minute» / «Конвейер возьмёт в течение минуты». Демона для этого не нужно: `nolSync` берёт Queued по `rank`.

### 5.7 Пустые состояния
- Нет демона и нет карточек: текущий `empty(...)` доски остаётся, плюс в блоке Эпики: «Run your own factory on this machine: see factory/daemon/README.md» / «Запустите свой завод на этой машине: см. factory/daemon/README.md».
- Демон есть, эпик нет: «No epics yet. An epic is a goal split into waves of tasks; main receives it only when it is whole.» / «Эпик пока нет. Эпика это цель, разбитая на волны задач; в мастер она попадает только целиком».

## 6. Карточки работ. Порядок строгий, по одной

### 6.1 Z1 · Демон переезжает в NOL
Файлы: новые `factory/daemon/conveyor.mjs`, `factory/daemon/selftest.mjs`, `factory/daemon/agent.sb`, `factory/daemon/dashboard.html`, `factory/daemon/install.sh`, `factory/daemon/README.md`; правка `.gitignore`, `scripts/build.mjs` (каталог `factory/` уже не копируется в dist, проверить), `conveyor.json` не трогать (защищён).
Источник: скопировать текущие файлы из `/Users/muratmacbook/projects/conveyor/` (`conveyor.mjs`, `selftest.mjs`, `agent.sb`, `dashboard.html`) без изменений логики. Затем в копии: все пути состояния (`state.db`, `runs/`, `daemon.log`, `nightly.log`, `shots/`) вести от `process.env.NOL_FACTORY_HOME || path.join(os.homedir(), '.nol-factory')`, каталог создавать при старте. Константа `VERSION = '1.0.0'` рядом с `PORT`.
`install.sh`: создаёт `~/.nol-factory`, копирует `state.db` из старого места, если есть и нового нет; пишет launchd plist `~/Library/LaunchAgents/com.nol.factory.plist` с `ProgramArguments [node, <абсолютный путь этого чекаута>/factory/daemon/conveyor.mjs, daemon, 3]`, `WorkingDirectory ~/.nol-factory`, `KeepAlive true`, PATH с node; печатает команды `launchctl bootout/bootstrap`, сам их не выполняет.
`README.md` (по-русски и по-английски, коротко): требования (Node 24, `claude` CLI с подпиской), `bash factory/daemon/install.sh`, адрес `http://localhost:7777`, где состояние, как остановить.
`scripts/daemon-check.mjs`: `node --check` на каждый `factory/daemon/*.mjs`; если `git diff --name-only $(git merge-base HEAD origin/main)..HEAD` содержит `factory/daemon/conveyor.mjs`, запускает `node factory/daemon/selftest.mjs` и падает при его провале. Владелец добавит его в `validation` сам.
Приёмка: `node scripts/daemon-check.mjs` зелёный; `NOL_FACTORY_HOME=$(mktemp -d) node factory/daemon/conveyor.mjs --help` печатает справку и создаёт каталог; `git status` не показывает `.db`/`.log`; `node --test`, `node scripts/build.mjs`, `node scripts/smoke.mjs` зелёные.
Не делать: не менять поведение демона, не трогать `~/projects/conveyor`, не перезапускать демон владельца.

### 6.2 Z2 · API квоты, автоматики, времени ленты
Файл: `factory/daemon/conveyor.mjs`.
1. `GET /api/usage` по разделу 4. Функция `usageToken()` читает токен (macOS keychain, затем файл), функция `usage()` с кэшем 60 с. Токен в переменной, не в логах.
2. `/api/state` дополняется `version`, `automation`, `epics: []` (пока пустой массив; заполнится в Z7).
3. Время в ленте: при запуске агента (`spawn(box.cmd, box.args, {stdio: [promptFd, out, err]})`) stdout агента больше не пишется в файл напрямую: `stdio: [promptFd, 'pipe', err]`, поток разбивается по строкам, каждая строка пишется в тот же `stdout.log` как `<Date.now()>\t<строка>`. `liveFeed` разбирает обе формы: если строка начинается с цифр и табуляции, `ts = Number(до табуляции)`, JSON после; иначе `ts = null`. Никакие другие читатели `stdout.log` (`agentSaid`, `limitHit`, детекторы вопросов) не должны сломаться: проверить их все через grep `stdout.log` и провести через один общий парсер строки.
Приёмка: `curl localhost:7777/api/usage` в селфтесте с подменой `usageToken` возвращает форму раздела 4 и `error` при отсутствии токена; селфтест проверяет, что `liveFeed` читает старый и новый формат; `scripts/daemon-check.mjs` зелёный.

### 6.3 Z3 · Шапка «Завода»: квота и автоматика
Файлы: `apps/factory.html`, `assets/lang/ru/factory.js`.
По разделу 5.1. Функция `loadUsage()` каждые 60 с, `paintHead()`. При ошибке сети ни одного исключения в консоли (smoke это проверяет).
Приёмка: на `http://localhost:7777/nol/apps/factory.html` видны чипы с процентами и бейдж автоматики; на github.io без демона виден серый чип «Квота недоступна»; всё по-русски при `nol.lang=ru`; 390px не переполняется по ширине.

### 6.4 Z4 · Живая лента и последняя команда
Файлы: `apps/factory.html`, `assets/lang/ru/factory.js`.
По разделам 5.3 и 5.4 для задач из `state.tasks` (блок Живой конвейер) и для карточек доски `Building`. Опрос `live` только для раскрытых пультов и видимых `Building`-карточек.
Приёмка: у работающей задачи пульт показывает абзацы и команды с временем; у завершённой пульт показывает последние строки и «работа закончена»; без демона ссылок «Agent console» нет.

### 6.5 Z5 · Чат с агентом и выбор модели
Файлы: `apps/factory.html`, `assets/lang/ru/factory.js`, `factory/daemon/conveyor.mjs` (только `nolSync`: читать `card.model`, если он в `MODELS`, передавать в `taskAdd`).
По разделу 5.5. Проверить `claude --help` на флаг усилия и записать факт в журнал `build`.
Приёмка: сообщение из формы появляется в событиях задачи как `владелец` (проверить через `GET /api/task/:KEY`); выбранная на карточке модель попадает в `tasks.model` при взятии.

### 6.6 Z6 · Кнопка «В работу»
Файлы: `apps/factory.html`, `assets/lang/ru/factory.js`. По разделу 5.6.
Приёмка: карточка поднимается наверх колонки и получает бейдж `urgent`; в Задачах порядок совпадает.

### 6.7 Z7 · Эпики в демоне
Файл: `factory/daemon/conveyor.mjs`, `factory/daemon/selftest.mjs`.
1. Таблица `epics`, колонки `tasks.epic_id`, `tasks.wave` (раздел 3), миграция через существующий список `ALTER TABLE` с игнорированием ошибки «duplicate column».
2. `planEpic(repoName, goal)`: как `planGoal`, но ответ модели `[{wave: 1, title, deps: []}, …]`; промпт требует от 2 до 4 волн, внутри волны задачи независимы по файлам, между волнами зависимость по смыслу; 2–6 задач в волне. Парсинг строгий, при мусоре одна повторная попытка, потом ошибка.
3. `epicAdd(repo, {title, goal, auto_accept})`: создаёт ветку `epic/<key в нижнем регистре>` от `repo.base` в клоне и пушит её; создаёт задачи через `taskAdd` с `epic_id`, `wave`, `source: 'epic'`, `deps` внутри волны как вернул план; создаёт карточки доски через `nolEdit(ws,'tasks',…)` с полями `{id: 'epic-<key>-<n>', title, status: 'Queued', project: cfg.nol_project, epic: <key>, wave, assignee: 'Factory agent', description: goal-контекст + задача}` и связывает `source_ref` как у обычных карточек; карточка самой эпики: `{id: 'epic-<key>', title, status: 'Building', project, epic: <key>, kind: 'epic', description: goal}`.
4. `nextTask`: условие `AND (t.epic_id IS NULL OR EXISTS (SELECT 1 FROM epics e WHERE e.id=t.epic_id AND e.status='open' AND e.wave=t.wave))`.
5. `mergeTask`: для задачи с `epic_id` целевая ветка `epics.branch`; `after_merge` не запускать; в событии `merge` писать «влито в epic/…».
6. Закрытие волны: после каждого `done` задачи эпики проверять волну; `auto_accept` → следующая волна и событие `эпика`; иначе событие «волна W2 закрыта, ждёт принятия». Последняя волна принята → `finalizeEpic` (раздел 3), карточка эпики → `Done` или `Blocked` с заметкой.
7. API из раздела 4: `/api/epics`, `/api/epic`, `/api/epic/:id/accept|finalize|cancel`; `epics` в `/api/state`.
8. Селфтест: сценарий «эпика из 2 волн по 1 задаче»: задачи первой волны стартуют, второй нет; после `done` первой и `accept` вторая стартует; после `done` второй `finalize` вливает в base; проверка, что до финализации base не менялся.
Приёмка: селфтест зелёный; `scripts/daemon-check.mjs` зелёный; существующие сценарии селфтеста не изменены.

### 6.8 Z8 · Экран эпик
Файлы: `apps/factory.html`, `assets/lang/ru/factory.js`, при необходимости `apps/tasks.html` только чтобы карточки с `kind: 'epic'` показывали бейдж «Epic» (без другой логики).
По разделу 5.2 целиком, включая форму, чипы волн, кнопки, режим без демона по карточкам с полем `epic`.
Приёмка: создание эпики из формы на localhost даёт карточку с волнами; «Accept» disabled, пока волна не закрыта; на github.io эпики видны из доски без кнопок; русский полный; 390px без горизонтального скролла.

### 6.9 Z9 · Для покупателя
Файлы: `factory/daemon/README.md` (дополнить), `index.html` (текст карточки Factory: «Your own factory: agents build your NOL, you watch live»), `apps/factory.html` пустые состояния из 5.7, `factory/CONVENTIONS.md` абзац про эпики (что задачи эпики вливаются в её ветку).
Приёмка: человек без контекста по README запускает демон и открывает `http://localhost:7777/nol/apps/factory.html` за 10 минут; все тексты на двух языках.

## 7. Проверка

Гейты конвейера как всегда: `node --test`, `node scripts/build.mjs`, `node scripts/smoke.mjs`, плюс `node scripts/daemon-check.mjs` после Z1. Критик смотрит дифф. Тестировщик проверяет прод после каждого мерджа обычной задачи; для правок только демона он пропускает проверку («изменений в продукте нет»), это нормально. Для Z3–Z8 тестировщик проверяет `apps/factory.html` на github.io в режиме без демона, а владелец смотрит режим с демоном на localhost сам.

## 8. Словарь
- Эпика: цель, разбитая на волны задач; попадает в main только целиком через свою ветку.
- Волна: набор задач эпики, идущих параллельно; следующая волна ждёт принятия предыдущей.
- Слот: место для одного агента; `slots` в `/api/state`.
- Лента (пульт): поток `say|do|ok|bad` из stream-json агента с временем.
- Квота: проценты окон подписки Claude: сессия (5 часов), неделя, неделя по модели.
