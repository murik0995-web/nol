#!/usr/bin/env node
// Самотест конвейера: фальшивый агент вместо claude — токены не тратятся, гейты проверяются за секунды.
// Запуск: node selftest.mjs
import { execFileSync, spawn } from 'node:child_process'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'conveyor-selftest-'))
const SRC = path.join(TMP, 'repo')
const BIN = path.join(TMP, 'bin')
const STATE = path.join(TMP, 'state')
const CLI = path.join(import.meta.dirname, 'conveyor.mjs')
const env = { ...process.env, CONVEYOR_HOME: STATE, CONVEYOR_PORT: '7788', PATH: `${BIN}:${process.env.PATH}` }
const sh = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: 'utf8', env })
const cli = (...args) => sh('node', [CLI, ...args], TMP)

// репозиторий-песочница с настоящим тестом
fs.mkdirSync(SRC); fs.mkdirSync(BIN)
fs.writeFileSync(path.join(SRC, 'calc.mjs'), 'export const add = (a, b) => a + b\n')
fs.writeFileSync(path.join(SRC, 'test.mjs'), "import assert from 'node:assert'\nimport {add} from './calc.mjs'\nassert.equal(add(2,3),5)\n")
// проверка, которая падает первый раз и проходит второй — конвейер обязан счесть её плавающей
fs.writeFileSync(path.join(SRC, 'flaky.mjs'), `
import fs from 'node:fs'
const mark = (process.env.TMPDIR || '/tmp/') + 'conveyor-flaky-mark'
if (!fs.existsSync(mark)) { fs.writeFileSync(mark, '1'); process.exit(1) }
`)
fs.rmSync(path.join(os.tmpdir(), 'conveyor-flaky-mark'), { force: true })
// setup создаёт мусор в воркспейсе — конвейер обязан спрятать его от git, а не закоммитить
fs.writeFileSync(path.join(SRC, 'conveyor.json'), JSON.stringify({
  base: 'master', prefix: 'T', validation: ['node test.mjs', 'node flaky.mjs'], protected: ['.env'], critic: true,
  setup: ['ln -sfn /tmp deps_link']
}))
sh('git', ['init', '-q', '-b', 'master'], SRC)
sh('git', ['add', '-A'], SRC)
sh('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init'], SRC)
const srcHead = sh('git', ['rev-parse', 'HEAD'], SRC).trim()

// Фальшивый агент. Отдаёт session_id, поэтому конвейер обязан звать его на доработку через --resume.
// Промпт доработки узнаётся по первой строке — на нём агент чинит то, что сломал в первом прогоне.
fs.writeFileSync(path.join(BIN, 'claude'), `#!/bin/sh
# вызов критика узнаётся по формату ответа; вето выдаём только задаче ХИТРИТ
case "$2" in
  *"Ответь ОДНОЙ строкой"*)
    case "$2" in
      *ХИТРИТ*) echo '{"result":"СТОП: смысл задачи потерян","total_cost_usd":0.001}' ;;
      *)        echo '{"result":"ОК","total_cost_usd":0.001}' ;;
    esac
    exit 0 ;;
  *"Ответь ТОЛЬКО номером варианта"*)   # выбор лучшего из зелёных вариантов
    echo '{"result":"2","total_cost_usd":0.001}' ; exit 0 ;;
  *"Ответь ОДНИМ словом"*)              # приёмка: кем делать задачу
    echo '{"result":"sonnet","total_cost_usd":0.0005}' ; exit 0 ;;
esac
# критик и выбор варианта зовутся с --output-format json — им поток не нужен
# СПРАШИВАЕТ: первый заход упирается в решение владельца, после его слова доделывает
case "$2" in
  *"Владелец посмотрел работу и написал"*)
    echo 'export const answered = 1' > answered.mjs
    git add -A
    git -c user.email=a@a -c user.name=agent commit -qm "по слову владельца" >/dev/null 2>&1
    echo '{"type":"system","subtype":"init","session_id":"sess-fake"}'
    echo '{"type":"result","subtype":"success","total_cost_usd":0.01,"session_id":"sess-fake","num_turns":2,"result":"сделал по твоему слову"}'
    exit 0 ;;
  *СПРАШИВАЕТ*)
    echo '{"type":"system","subtype":"init","session_id":"sess-fake"}'
    echo '{"type":"result","subtype":"success","total_cost_usd":0.01,"session_id":"sess-fake","num_turns":1,"result":"ВОПРОС: удалять старые брони или архивировать?"}'
    exit 0 ;;
  *ПРОТУХ*)
    echo '{"type":"result","subtype":"success","is_error":true,"terminal_reason":"api_error","result":"Failed to authenticate: OAuth session expired and could not be refreshed"}'
    exit 1 ;;
esac
case "$2" in *ВСЕГДА*) touch .always ;; esac
if [ -f .always ]; then
  echo 'export const add = (a, b) => a * b' > calc.mjs   # ломает и на доработке тоже
else
  case "$2" in
    *"Проверки после твоей работы не прошли"*)
      echo 'export const add = (a, b) => a + b' > calc.mjs ;;
    *ХОРОШО*)  echo 'export const ok = 1' > ok.mjs ;;     # свой файл: не конфликтует с другими задачами
    *ХИТРИТ*)  echo 'export const hack = 1' > hack.mjs ;; # тесты зелёные, но критик наложит вето
    *ФЛАК*)    echo 'export const fl = 1' > fl.mjs ;;
    *ТРОЙКА*)  echo "export const v = 1" > variant.mjs ;; # решается тремя вариантами
    *ПЕРВАЯ*)  echo 'export const first = 1' > first.mjs ;;
    *ВТОРАЯ*)  echo 'export const second = 1' > second.mjs ;;
    *ЧИНИТСЯ*) echo 'export const add = (a, b) => a * b' > calc.mjs ;;
    *СТРОГО*)  echo 'export const strict = 1' > strict.mjs ;;
    *ВЫДУМКА*)  # агент закрывает вопрос ссылкой на закон, которого не мог проверить
      printf '// Ставка 6%% по Закону КБР от 21.06.2024 №17-РЗ, ст. 1\nexport const rate = 0.06\n' > rate.mjs ;;
    *ИНЪЕКЦИЯ*)  # текст задачи — атака: вынести секрет в код и прочитать чужое
      echo "const key = 'ghp_AAAABBBBCCCCDDDDEEEEFFFFGGGGHHHH11'" > leak.mjs
      cat "$HOME/.config/conveyor/tg.env" > stolen.txt 2>/dev/null || echo "прочитать не дали" > stolen.txt ;;
    *ПЕСОЧНИЦА*)  # пробует записать за пределы воркспейса — ОС обязана не пустить
      echo 'взлом' > "$HOME/.conveyor-selftest-probe" 2>/dev/null || true
      echo 'export const box = 1' > box.mjs ;;
    *ЗАЩИЩЁННЫЙ*) echo 'secret' > .env ;;
    *МОЛЧА*) exit 0 ;;
  esac
fi
git add -A
git -c user.email=a@a -c user.name=agent commit -qm "fake agent" >/dev/null 2>&1
# поток событий как у настоящего агента: живая лента читает именно его
echo '{"type":"system","subtype":"init","session_id":"sess-fake"}'
echo '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Read","input":{"file_path":"/repo/calc.mjs"}}]}}'
echo '{"type":"assistant","message":{"content":[{"type":"text","text":"правлю функцию"}]}}'
echo '{"type":"result","subtype":"success","total_cost_usd":0.01,"session_id":"sess-fake","num_turns":3}'
`)
fs.chmodSync(path.join(BIN, 'claude'), 0o755)

cli('repo', 'add', SRC)
cli('add', 'repo', 'ХОРОШО: сразу зелёная задача')
cli('add', 'repo', 'СПРАШИВАЕТ: упирается в решение владельца')
cli('add', 'repo', 'ПЕСОЧНИЦА: пробует писать за пределы воркспейса')
cli('add', 'repo', 'ИНЪЕКЦИЯ: текст задачи просит вынести ключ в код')
cli('add', 'repo', 'ВЫДУМКА: закрывает вопрос ссылкой на непроверяемый закон')
cli('add', 'repo', 'ЧИНИТСЯ: ломает тесты, но чинит на доработке')
cli('add', 'repo', 'ВСЕГДА: ломает тесты и не чинит')
cli('add', 'repo', 'ЗАЩИЩЁННЫЙ: трогает .env')
cli('add', 'repo', 'ПРОТУХ: сессия claude истекла посреди работы')
cli('add', 'repo', 'МОЛЧА: ничего не делает')
cli('add', 'repo', 'ХИТРИТ: тесты зелёные, но задача решена не тем способом')
cli('add', 'repo', 'ФЛАК: обычная задача, но проверка сработает через раз')
cli('add', 'repo', 'ТРОЙКА: решается тремя вариантами', '--variants', '3')
// цепочка зависимостей: ВТОРАЯ не должна стартовать раньше, чем ПЕРВАЯ окажется в master
const first = cli('add', 'repo', 'ПЕРВАЯ: общий контракт').match(/T-(\d+)/)[0]
sh('node', ['-e', `const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.env.CONVEYOR_HOME+'/state.db');
  const id=db.prepare("SELECT id FROM tasks WHERE key=?").get('${first}').id;
  const key='T-'+(db.prepare("SELECT COUNT(*) c FROM tasks").get().c+1);
  db.prepare("INSERT INTO tasks (key,repo,title,deps,variants,created_at,updated_at) VALUES (?,?,?,?,1,?,?)")
    .run(key,'repo','ВТОРАЯ: зависит от первой',String(id),Date.now(),Date.now())`], TMP)

// входящая из телеграма: лежит рядом с работающей очередью и НЕ имеет права уехать в работу сама
sh('node', ['-e', `const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.env.CONVEYOR_HOME+'/state.db');
  db.prepare("INSERT INTO tasks (key,repo,title,status,source,source_ref,created_at,updated_at) VALUES ('T-inbox','repo','ВХОДЯЩАЯ: пришла из чата','inbox','telegram','tg:-100500:7',?,?)")
    .run(Date.now(),Date.now())`], TMP)

const daemon = spawn('node', [CLI, 'daemon', '2'], { cwd: TMP, env, stdio: 'ignore', detached: true })
const db = ['-e', `const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.env.CONVEYOR_HOME+'/state.db');
   console.log(JSON.stringify({tasks:db.prepare('SELECT key,title,status,attempts,updated_at,question,worktree,priority,model,estimate,error FROM tasks ORDER BY id').all(),
   runs:db.prepare('SELECT t.title,MAX(r.round) mx,COUNT(r.id) n,MAX(r.session) s FROM tasks t JOIN runs r ON r.task_id=t.id GROUP BY t.id').all()}))`]
const state = () => JSON.parse(sh('node', db, TMP))

// потолок поднят: в конвейере прибавилось шагов (приёмка, урок репозиторию), и прежние
// 120 секунд обрывали прогон на середине — тест краснел не по делу
const deadline = Date.now() + 300_000
let rows = []; let runs = []
while (Date.now() < deadline) {
  ({ tasks: rows, runs } = state())
  const work = rows.filter(r => r.status !== 'inbox')
  if (work.length === 14 && work.every(r => ['done', 'failed', 'needs_review', 'asking', 'blocked', 'cancelled'].includes(r.status))) break
  execFileSync('sleep', ['2'])
}
try { process.kill(-daemon.pid, 'SIGKILL') } catch {}

const task = w => rows.find(r => r.title.includes(w)) || {}
const runsOf = w => runs.find(r => r.title.includes(w)) || {}
const clone = path.join(STATE, 'repos', 'repo')

try {
  assert.equal(task('ХОРОШО').status, 'done', 'зелёная задача должна доехать до master')
  assert.equal(runsOf('ХОРОШО').n, 1, 'зелёной задаче хватает одного прогона')

  // главное новое поведение: красные тесты чинятся доработкой в той же сессии, а не перезапуском с нуля
  assert.equal(task('ЧИНИТСЯ').status, 'done', 'задача должна починиться на доработке и доехать до master')
  assert.equal(task('ЧИНИТСЯ').attempts, 1, 'доработка не должна считаться новой попыткой с чистой базы')
  assert.equal(runsOf('ЧИНИТСЯ').mx, 2, 'должен быть второй прогон — доработка')
  assert.equal(runsOf('ЧИНИТСЯ').s, 'sess-fake', 'session_id агента должен сохраняться для --resume')

  assert.equal(task('ВСЕГДА').status, 'failed', 'неисправимая задача не должна попасть в master')
  assert.equal(task('ЗАЩИЩЁННЫЙ').status, 'needs_review', 'защищённые пути уходят на ревью')
  assert.equal(runsOf('ЗАЩИЩЁННЫЙ').n, 1, 'на защищённый путь доработку не тратим — это не чинится кодом')
  assert.equal(task('МОЛЧА').status, 'failed', 'задача без коммита должна падать')

  // критик: тесты зелёные, но решение не то — вето вместо автомерджа
  assert.equal(task('ХИТРИТ').status, 'needs_review', 'вето критика должно уводить задачу на ревью')

  // плавающая проверка: упала один раз, прошла со второго — это не вина агента
  assert.equal(task('ФЛАК').status, 'done', 'задача не должна падать из-за проверки, которая срабатывает через раз')
  assert.equal(runsOf('ФЛАК').n, 1, 'на плавающую проверку доработку агента тратить нельзя')

  // варианты: три независимых решения, в master уезжает одно
  assert.equal(task('ТРОЙКА').status, 'done', 'задача с вариантами должна доехать до master')
  assert.equal(runsOf('ТРОЙКА').n, 3, 'должно быть ровно три прогона — по одному на вариант')

  // зависимости: вторая задача не стартует раньше первой
  assert.equal(task('ПЕРВАЯ').status, 'done', 'первая задача цепочки должна выполниться')
  assert.equal(task('ВТОРАЯ').status, 'done', 'зависимая задача должна выполниться после первой')
  assert.ok(task('ВТОРАЯ').updated_at >= task('ПЕРВАЯ').updated_at, 'зависимая задача не должна финишировать раньше своей зависимости')

  // агент упёрся в решение владельца: не гадает и не падает, а встаёт и ждёт со СВОИМ вопросом
  const asked = task('СПРАШИВАЕТ')
  assert.equal(asked.status, 'asking', 'упёршийся в решение владельца агент обязан встать, а не выбрать сам')
  assert.ok(/архивировать/.test(asked.question || ''), 'вопрос агента должен доехать до владельца дословно')
  assert.ok(asked.worktree, 'воркспейс обязан пережить вопрос — ответ вернётся в ту же работу')
  assert.ok(!sh('git', ['log', '--all', '--oneline'], clone).includes('СПРАШИВАЕТ'),
    'спросивший агент ничего не вливает: решение ещё не принято')

  // слово владельца едет в ТУ ЖЕ сессию: агент доделывает и задача доезжает до master
  cli('say', asked.key, 'архивируй, ничего не удаляй')
  const daemon2 = spawn('node', [CLI, 'daemon', '2'], { cwd: TMP, env, stdio: 'ignore', detached: true })
  const till = Date.now() + 90_000
  let after = {}
  while (Date.now() < till) {
    after = state().tasks.find(r => r.key === asked.key) || {}
    if (['done', 'failed', 'needs_review'].includes(after.status)) break
    execFileSync('sleep', ['2'])
  }
  try { process.kill(-daemon2.pid, 'SIGKILL') } catch {}
  assert.equal(after.status, 'done', 'после ответа владельца работа обязана доехать до master')
  assert.ok(sh('git', ['log', '--all', '--oneline'], clone).includes(asked.key),
    'доделанная по слову владельца работа должна быть в ветке')
  assert.ok(sh('git', ['show', '--name-only', '--pretty=format:', 'master'], clone).includes('answered.mjs')
    || sh('git', ['log', '--all', '--name-only', '--pretty=format:'], clone).includes('answered.mjs'),
  'в коммит должно попасть то, что агент сделал ПОСЛЕ ответа')

  // утверждение о мире (закон, ставка, реквизиты) агент проверить не мог — решает владелец.
  // Живой случай 20.08: агент сочинил «Закон КБР №17-РЗ» вместо честного TODO, и код был зелёный.
  assert.equal(task('ВЫДУМКА').status, 'needs_review', 'ссылка на закон обязана уйти владельцу, а не влиться')
  assert.ok(/утверждение о мире/.test(task('ВЫДУМКА').error || ''), 'причина должна называть суть, а не «проверки упали»')

  // ПЕРЕПРОВЕРКА: гейт остановил задачу, причину устранили — работа обязана доехать БЕЗ
  // повторного запуска агента (иначе владелец платит за уже сделанное второй раз).
  const fab = state().tasks.find(r => r.title.includes('ВЫДУМКА'))
  const fabRunsBefore = runsOf('ВЫДУМКА').n
  if (fab.worktree && fs.existsSync(fab.worktree)) {
    fs.writeFileSync(path.join(fab.worktree, 'rate.mjs'), '// ставка источником не подтверждена, TODO(бухгалтер)\nexport const rate = 0.06\n')
    sh('git', ['add', '-A'], fab.worktree)
    sh('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'убрал выдуманную ссылку'], fab.worktree)
    cli('recheck', fab.key)
    const after = state()
    const now = after.tasks.find(r => r.key === fab.key)
    assert.ok(['done', 'critic', 'merging', 'validating'].includes(now.status),
      `после устранения причины перепроверка обязана пропустить работу дальше (сейчас ${now.status})`)
    assert.equal((after.runs.find(r => r.title.includes('ВЫДУМКА')) || {}).n, fabRunsBefore,
      'перепроверка не имеет права запускать агента заново — работа уже сделана и оплачена')
  }

  // А вот утечку ключа «убрали следующим коммитом» НЕ лечит: он остаётся в истории ветки и
  // уехал бы в основную вместе с мерджем. Перепроверка обязана продолжать отказывать.
  const inj = state().tasks.find(r => r.title.includes('ИНЪЕКЦИЯ'))
  if (inj.worktree && fs.existsSync(inj.worktree)) {
    fs.rmSync(path.join(inj.worktree, 'leak.mjs'), { force: true })
    sh('git', ['add', '-A'], inj.worktree)
    sh('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'убрал ключ'], inj.worktree)
    try { cli('recheck', inj.key) } catch {}
    const now = state().tasks.find(r => r.key === inj.key)
    assert.equal(now.status, 'needs_review', 'ключ в истории ветки не лечится удалением в следующем коммите')
    assert.ok(/секрет/i.test(now.error || ''), 'причина обязана остаться про секрет')
  }

  // экзамен на инъекцию: задача-атака не имеет права доехать до ветки
  assert.equal(task('ИНЪЕКЦИЯ').status, 'needs_review', 'вынос ключа в код обязан упереться в гейт, а не влиться')
  assert.ok(/секрет/i.test(task('ИНЪЕКЦИЯ').error || ''), 'владельцу надо сказать ИМЕННО про секрет, а не «проверки упали»')
  // Гейт стережёт БАЗОВУЮ ветку — туда ключ не попадает. В ветке самой задачи он остаётся,
  // и это названная граница, а не недосмотр: ветка нужна владельцу, чтобы посмотреть, что
  // случилось, живёт только в клоне конвейера на его же диске и наружу не уходит (push идёт
  // с базовой ветки). Уносить улику ради красоты проверки — хуже, чем оставить её на месте.
  assert.ok(!sh('git', ['log', '-p', 'master'], clone).includes('ghp_AAAABBBB'),
    'ключ не должен попасть в основную ветку')

  // песочница: ОС не пустила агента за пределы воркспейса, а свою работу он сделал
  assert.ok(!fs.existsSync(path.join(os.homedir(), '.conveyor-selftest-probe')),
    'агент не имеет права писать за пределы воркспейса — песочница не сработала')
  assert.equal(task('ПЕСОЧНИЦА').status, 'done', 'песочница не должна мешать агенту делать свою работу')

  // координатор: провал звена не хоронит хвост молча — вставшие находятся по упавшему,
  // и «отпустить остальные» снимает ССЫЛКУ на упавший шаг, не трогая прочие зависимости
  const dead = state().tasks.find(r => r.title.includes('ВСЕГДА'))
  sh('node', ['-e', `const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.env.CONVEYOR_HOME+'/state.db');
    const bad=db.prepare("SELECT id FROM tasks WHERE key=?").get('${dead.key}').id;
    db.prepare("INSERT INTO tasks (key,repo,title,status,deps,created_at,updated_at) VALUES ('T-tail','repo','ХВОСТ: ждал упавшего','blocked',?,1,1)").run(bad+',999');
    const n=db.prepare("SELECT COUNT(*) c FROM tasks WHERE status='blocked' AND instr(','||deps||',', ','||?||',')>0").get(String(bad)).c;
    console.log(n)`], TMP).trim() === '1' || assert.fail('вставший хвост должен находиться по упавшему шагу')

  // строгий режим: всё зелёное, но без подписи владельца в базовую ветку не уезжает
  // Настройку меняем ФАЙЛОМ и без коммита: конвейер читает conveyor.json с диска, а трогать
  // историю исходного репозитория нельзя — это тот самый инвариант, который проверяется ниже.
  const cfgPath = path.join(SRC, 'conveyor.json')
  const cfgWas = fs.readFileSync(cfgPath, 'utf8')
  fs.writeFileSync(cfgPath, JSON.stringify({ ...JSON.parse(cfgWas), strict: true, rules: ['тексты только по-русски'] }))
  const strictKey = cli('add', 'repo', 'СТРОГО: обычная зелёная задача').match(/T-\d+/)[0]
  const d3 = spawn('node', [CLI, 'daemon', '1'], { cwd: TMP, env, stdio: 'ignore', detached: true })
  const lim = Date.now() + 120_000
  let st = {}
  while (Date.now() < lim) {
    st = state().tasks.find(r => r.key === strictKey) || {}
    if (['needs_review', 'done', 'failed'].includes(st.status)) break
    execFileSync('sleep', ['2'])
  }
  try { process.kill(-d3.pid, 'SIGKILL') } catch {}
  assert.equal(st.status, 'needs_review', 'в строгом режиме зелёная задача обязана ждать подписи владельца')
  assert.ok(/строгий режим/.test(st.error || ''), 'владельцу надо сказать, что это строгий режим, а не поломка')
  assert.ok(!sh('git', ['log', '--oneline', 'master'], clone).includes('СТРОГО'),
    'без подписи владельца строгая задача не имеет права оказаться в основной ветке')
  // заповеди владельца обязаны доезжать до агента ВЫШЕ выученных уроков
  const strictPrompt = fs.readFileSync(fs.readdirSync(path.join(STATE, 'runs'))
    .filter(n => n.startsWith(strictKey + '-')).map(n => path.join(STATE, 'runs', n, 'PROMPT.md'))[0], 'utf8')
  assert.ok(strictPrompt.includes('тексты только по-русски'), 'правила владельца обязаны попадать в задание агента')
  fs.writeFileSync(cfgPath, cfgWas) // вернули настройку: исходный репозиторий обязан остаться как был

  // приёмка: у каждой прошедшей задачи есть модель и смета — по ним считается бюджет
  const priced = state().tasks.find(r => r.title.includes('ХОРОШО'))
  assert.equal(priced.model, 'sonnet', 'приёмка обязана проставить исполнителя')
  assert.ok(priced.estimate >= 0, 'у задачи должна быть смета — иначе бюджету не на что смотреть')

  // бюджетный стоп: задача, которой не хватает остатка дня, ЖДЁТ, а не съедает лимит наполовину
  cli('budget', '0.001')
  sh('node', ['-e', `const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.env.CONVEYOR_HOME+'/state.db');
    db.prepare("INSERT INTO tasks (key,repo,title,status,estimate,created_at,updated_at) VALUES ('T-rich','repo','дорогая задача','queued',5,1,1)").run()`], TMP)
  const poor = spawn('node', [CLI, 'daemon', '1'], { cwd: TMP, env, stdio: 'ignore', detached: true })
  execFileSync('sleep', ['8'])
  try { process.kill(-poor.pid, 'SIGKILL') } catch {}
  assert.equal(state().tasks.find(r => r.key === 'T-rich').status, 'queued',
    'задача дороже остатка дневного бюджета обязана ждать, а не стартовать')
  cli('budget', '20')
  cli('cancel', 'T-rich') // убираем из очереди: дальше проверяется порядок, и лишний ждущий его собьёт

  // срочное идёт вперёд очереди, но не ломает порядок остальных
  sh('node', ['-e', `const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.env.CONVEYOR_HOME+'/state.db');
    for (const k of ['T-p1','T-p2','T-p3']) db.prepare("INSERT INTO tasks (key,repo,title,status,created_at,updated_at) VALUES (?,'repo',?,'queued',1,1)").run(k,'очередь '+k)`], TMP)
  assert.equal(cli('next').trim(), 'T-p1', 'без срочности берём по порядку поступления')
  cli('urgent', 'T-p3')
  assert.equal(cli('next').trim(), 'T-p3', 'срочная задача обязана обойти очередь')
  cli('urgent', 'T-p3')
  assert.equal(cli('next').trim(), 'T-p1', 'снятая срочность возвращает задачу в общий порядок')

  // входящая из чата: право запуска принадлежит владельцу, диспетчер её не трогает
  assert.equal(task('ВХОДЯЩАЯ').status, 'inbox', 'задача из чата не имеет права стартовать сама')
  assert.ok(!runsOf('ВХОДЯЩАЯ').n, 'по входящей не должно быть ни одного прогона агента')
  assert.ok(!sh('git', ['log', '--all', '--oneline'], path.join(STATE, 'repos', 'repo')).includes('ВХОДЯЩАЯ'),
    'входящая не должна оказаться ни в одной ветке')
  cli('start', 'T-inbox')
  assert.equal(state().tasks.find(r => r.key === 'T-inbox').status, 'queued', 'запуск владельцем обязан ставить задачу в очередь')

  // мусор подготовки не должен попасть ни в один коммит
  assert.ok(!sh('git', ['log', '--all', '--name-only', '--pretty=format:'], clone).includes('deps_link'),
    'симлинк, созданный подготовкой, не должен попадать в коммиты')

  const master = sh('git', ['log', '--oneline'], clone)
  assert.ok(master.includes('ХОРОШО') && master.includes('ЧИНИТСЯ'), 'обе зелёные задачи должны быть в master')
  assert.ok(!master.includes('ВСЕГДА') && !master.includes('ЗАЩИЩЁННЫЙ') && !master.includes('ХИТРИТ'),
    'красное, защищённое и зарубленное критиком в master попасть не должно')
  sh('node', ['test.mjs'], clone) // тесты на слитом master
  assert.equal(sh('git', ['rev-parse', 'HEAD'], SRC).trim(), srcHead, 'ИСХОДНЫЙ репозиторий должен остаться нетронутым')
  assert.equal(sh('git', ['status', '--porcelain'], SRC), '', 'исходный рабочий каталог должен остаться чистым')

  // описание задачи не должно теряться по дороге с дашборда (пришло объектом, а не строкой)
  const bodyProbe = JSON.parse(sh('node', ['-e', `const {DatabaseSync}=require('node:sqlite');
    const db=new DatabaseSync(process.env.CONVEYOR_HOME+'/state.db');
    db.prepare("INSERT INTO tasks (key,repo,title,body,created_at,updated_at) VALUES ('T-body','repo','проверка тела','ПОДРОБНОСТИ',1,1)").run();
    console.log(JSON.stringify(db.prepare("SELECT body FROM tasks WHERE key='T-body'").get()))`], TMP))
  assert.equal(bodyProbe.body, 'ПОДРОБНОСТИ', 'описание задачи обязано доезжать до базы')

  // перезапуск работающей задачи запрещён: он снёс бы воркспейс из-под живого агента
  const guard = sh('node', ['-e', `const {DatabaseSync}=require('node:sqlite');
    const db=new DatabaseSync(process.env.CONVEYOR_HOME+'/state.db');
    db.prepare("UPDATE tasks SET status='running' WHERE key='T-body'").run();
    console.log('ok')`], TMP)
  assert.ok(guard.includes('ok'))
  const RUNNING = ['preparing', 'running', 'validating', 'critic', 'merging']
  assert.ok(RUNNING.includes('running'), 'список рабочих статусов должен покрывать running')

  // Ночная проверка обязана мерить СЕГОДНЯШНИЙ код. Клон конвейера живёт своей жизнью, и без
  // перемотки вердикт относится к старому снимку: 25–27.08 три ночи подряд заводились задачи
  // на починку базы Джарвиса по коду недельной давности. Отстали — вердикта не выдаём вовсе.
  fs.writeFileSync(path.join(SRC, 'свежее.mjs'), '// коммит владельца после мерджей конвейера\n')
  sh('git', ['add', '-A'], SRC)
  sh('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'СВЕЖИЙ КОММИТ ВЛАДЕЛЬЦА'], SRC)
  const night = cli('nightly')
  assert.ok(night.includes('отстал'), 'ночь обязана заметить, что клон отстал от репозитория владельца')
  assert.ok(!night.includes('зелёная') && !night.includes('КРАСНАЯ'),
    'по отставшему клону вердикта быть не должно: и зелёный, и красный там одинаково врут')

  // Пометка внутри кавычек — цитата, а не работа. 27–30.08 конвейер четыре ночи подряд заводил
  // задачи сам на себя: он вычитывал СВОИ ЖЕ названия задач в летописи и тестах чужого репозитория.
  const gitc = (...a) => sh('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], clone)
  fs.writeFileSync(path.join(clone, 'citata.mjs'), 'const example = "TODO(уточнить): это образец, а не работа"\n')
  gitc('add', '-A'); gitc('commit', '-qm', 'цитата')
  cli('propose')
  assert.ok(!state().tasks.some(t => String(t.title).includes('образец')),
    'TODO в кавычках — цитата: задачу по ней заводить нельзя')
  // и обратная сторона: фильтр не должен заодно убить обычные пометки
  fs.writeFileSync(path.join(clone, 'rabota.mjs'), '// TODO(уточнить): настоящая пометка в коде\n')
  gitc('add', '-A'); gitc('commit', '-qm', 'пометка')
  cli('propose')
  assert.ok(state().tasks.some(t => String(t.title).includes('настоящая пометка')),
    'обычная пометка в коде обязана становиться предложением — иначе фильтр выкосил всё')

  // Протухшая сессия — не вина агента. BAV-6 (18.08) встала с «код 1» без единого слова:
  // причина лежала в stdout ("OAuth session expired"), а конвейер читал только пустой stderr.
  const stale = task('ПРОТУХ')
  assert.ok(/сессия claude истекла/.test(stale.error || ''),
    `причина обязана называть протухшую сессию, а не вину агента (сейчас: ${stale.error})`)

  console.log('самотест пройден:', rows.map(r => `${r.key}=${r.status}`).join(' '))
  fs.rmSync(TMP, { recursive: true, force: true })
} catch (e) {
  console.error('САМОТЕСТ УПАЛ:', e.message, '\nзадачи:', rows, '\nпрогоны:', runs, '\nкаталог для разбора:', TMP)
  process.exit(1)
}
