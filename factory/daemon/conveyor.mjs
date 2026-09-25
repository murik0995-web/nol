#!/usr/bin/env node
// Конвейер тасков: очередь задач -> git worktree на задачу -> агент claude -p -> гейты -> автомердж.
// Зависимостей нет: node:sqlite, node:http, git, claude.
import { DatabaseSync } from 'node:sqlite'
import { spawn, execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import readline from 'node:readline'

const HOME = os.homedir()
const SANDBOX = process.env.CONVEYOR_HOME     // задан только в самотесте: всё состояние уезжает во временный каталог
const ROOT = SANDBOX || process.env.NOL_FACTORY_HOME || path.join(HOME, '.nol-factory') // состояние демона: state.db, runs/, shots/, daemon.log
const REPOS = SANDBOX ? path.join(SANDBOX, 'repos') : path.join(HOME, 'conveyor-repos')      // клоны, которыми владеет конвейер
const TREES = SANDBOX ? path.join(SANDBOX, 'worktrees') : path.join(HOME, 'conveyor-worktrees') // по воркспейсу на задачу
const RUNS = path.join(ROOT, 'runs')
const PORT = Number(process.env.CONVEYOR_PORT || 7777)
const VERSION = '1.0.0'
const AGENT_TIMEOUT_MS = 45 * 60 * 1000
const MAX_ATTEMPTS = 2   // полных перезапусков с чистой базы
const FIX_ROUNDS = 2     // доработок в той же сессии агента, без потери контекста
const MAX_VARIANTS = 3   // независимых решений одной задачи
const RUNNING_STATUSES = ['preparing', 'running', 'validating', 'critic', 'merging']

for (const d of [ROOT, REPOS, TREES, RUNS]) fs.mkdirSync(d, { recursive: true })

const db = new DatabaseSync(path.join(ROOT, 'state.db'))
db.exec(`
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS repos (
  name TEXT PRIMARY KEY, src TEXT NOT NULL, clone TEXT NOT NULL,
  base TEXT NOT NULL, prefix TEXT NOT NULL, cfg TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY, key TEXT UNIQUE, repo TEXT NOT NULL,
  title TEXT NOT NULL, body TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'queued',
  branch TEXT, worktree TEXT, base_sha TEXT, attempts INTEGER DEFAULT 0,
  error TEXT, cost REAL DEFAULT 0, model TEXT, variants INTEGER DEFAULT 1, deps TEXT,
  source TEXT DEFAULT 'local', source_ref TEXT UNIQUE, created_at INTEGER, updated_at INTEGER);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY, task_id INTEGER, ts INTEGER, kind TEXT, msg TEXT);
CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY, repo TEXT NOT NULL, text TEXT NOT NULL,
  task_id INTEGER, hits INTEGER DEFAULT 0, created_at INTEGER);
CREATE TABLE IF NOT EXISTS decisions (
  id INTEGER PRIMARY KEY, task_id INTEGER, ts INTEGER, kind TEXT, text TEXT);
CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY, repo TEXT NOT NULL, title TEXT NOT NULL,
  every_h INTEGER NOT NULL, next_at INTEGER NOT NULL, model TEXT, last_key TEXT);
CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY, task_id INTEGER, pid INTEGER, round INTEGER,
  started_at INTEGER, ended_at INTEGER, exit_code INTEGER,
  log TEXT, cost REAL DEFAULT 0, turns INTEGER, session TEXT);
CREATE TABLE IF NOT EXISTS epics (
  id INTEGER PRIMARY KEY, key TEXT UNIQUE,            -- 'NOL-E1'
  repo TEXT NOT NULL, title TEXT NOT NULL, goal TEXT NOT NULL,
  branch TEXT NOT NULL,                               -- 'epic/nol-e1'
  status TEXT NOT NULL DEFAULT 'open',                -- open | finalizing | done | failed
  waves INTEGER NOT NULL, wave INTEGER NOT NULL DEFAULT 1,  -- всего волн, текущая волна
  auto_accept INTEGER NOT NULL DEFAULT 0,             -- 1 = волна принимается сама, когда все её задачи done
  base_sha TEXT, created_at INTEGER, updated_at INTEGER);
`)
for (const sql of ['ALTER TABLE tasks ADD COLUMN model TEXT', 'ALTER TABLE tasks ADD COLUMN effort TEXT', 'ALTER TABLE tasks ADD COLUMN variants INTEGER DEFAULT 1',
  'ALTER TABLE tasks ADD COLUMN deps TEXT', "ALTER TABLE tasks ADD COLUMN source TEXT DEFAULT 'local'",
  'ALTER TABLE tasks ADD COLUMN source_ref TEXT', 'ALTER TABLE tasks ADD COLUMN merge_sha TEXT',
  // диалог владельца с живой сессией агента: его слово едет в ту же сессию, где агент помнит контекст
  'ALTER TABLE tasks ADD COLUMN question TEXT', 'ALTER TABLE tasks ADD COLUMN owner_note TEXT',
  'ALTER TABLE tasks ADD COLUMN ask_msg INTEGER', 'ALTER TABLE tasks ADD COLUMN priority INTEGER DEFAULT 0',
  'ALTER TABLE tasks ADD COLUMN reverted_at INTEGER', 'ALTER TABLE tasks ADD COLUMN estimate REAL',
  'ALTER TABLE tasks ADD COLUMN pr_url TEXT', 'ALTER TABLE tasks ADD COLUMN owner_ok INTEGER DEFAULT 0', 'ALTER TABLE tasks ADD COLUMN shot TEXT',
  // эпики (ZAVOD-TZ раздел 3): NULL = обычная задача, не часть волны
  'ALTER TABLE tasks ADD COLUMN epic_id INTEGER', 'ALTER TABLE tasks ADD COLUMN wave INTEGER',
  // WAVE1 3.3: таймаут оставил WIP-коммит в живом воркспейсе — следующая попытка обязана
  // продолжить эту же сессию агента (opts.resume), а не пересоздавать воркспейс с нуля
  'ALTER TABLE tasks ADD COLUMN resume_session TEXT',
  'CREATE UNIQUE INDEX IF NOT EXISTS tasks_source_ref ON tasks(source_ref) WHERE source_ref IS NOT NULL'
]) { try { db.exec(sql) } catch {} } // старые базы

const now = () => Date.now()
const q = (sql, ...a) => db.prepare(sql).all(...a)
const q1 = (sql, ...a) => db.prepare(sql).get(...a)
const run = (sql, ...a) => db.prepare(sql).run(...a)

const get = (k, def) => q1('SELECT v FROM settings WHERE k=?', k)?.v ?? def
const set = (k, v) => run('INSERT INTO settings (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v', k, String(v))
const spentToday = () => {
  const d = new Date(); d.setHours(0, 0, 0, 0)
  return q1('SELECT ROUND(COALESCE(SUM(cost),0),2) c FROM runs WHERE started_at >= ?', d.getTime()).c
}

// Уведомления: баннер macOS работает сразу, телеграм подключается сам, если заданы CONVEYOR_TG_TOKEN и CONVEYOR_TG_CHAT.
function notify (title, text) {
  if (SANDBOX) return // в самотесте не шумим
  const clean = s => String(s).replace(/["\\]/g, "'").replace(/\s+/g, ' ').slice(0, 220)
  try { spawn('osascript', ['-e', `display notification "${clean(text)}" with title "${clean(title)}"`], { stdio: 'ignore' }).unref() } catch {}
  const [tok, chat] = [process.env.CONVEYOR_TG_TOKEN, process.env.CONVEYOR_TG_CHAT]
  if (tok && chat) {
    fetch(`https://api.telegram.org/bot${tok}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: `${title}\n${text}`.slice(0, 3500) })
    }).catch(() => {})
  }
}
// Квота подписки Claude для «Завода»: токен демона, не задачи. В самотесте всегда «нет токена» —
// иначе тест бьёт по реальному ключу и живой квоте владельца вместо офлайновой проверки формы ответа.
function usageToken () {
  if (SANDBOX) return null
  try {
    const out = execFileSync('security', ['find-generic-password', '-s', 'Claude Code-credentials', '-w'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    const t = JSON.parse(out)?.claudeAiOauth?.accessToken
    if (t) return t
  } catch {}
  try {
    const t = JSON.parse(fs.readFileSync(path.join(HOME, '.claude', '.credentials.json'), 'utf8'))?.claudeAiOauth?.accessToken
    if (t) return t
  } catch {}
  return null
}
let usageCache = null // { at, data } — кэш 60 с: чипы шапки опрашивают раз в минуту, токену незачем ходить чаще
async function usage () {
  if (usageCache && now() - usageCache.at < 60000) return usageCache.data
  // Самотест конвейера: реальной квоты у него нет (usageToken() в SANDBOX всегда null),
  // а планировщик (WAVE1 3.2) нужно проверять офлайн — без сети и без живого токена владельца.
  if (SANDBOX && process.env.CONVEYOR_FAKE_USAGE) {
    const data = JSON.parse(process.env.CONVEYOR_FAKE_USAGE)
    usageCache = { at: now(), data }
    return data
  }
  const token = usageToken()
  let data
  if (!token) {
    data = { limits: [], breakdown: [], error: 'нет токена подписки Claude' }
  } else {
    try {
      const res = await fetch('https://api.anthropic.com/api/oauth/usage', {
        headers: { authorization: `Bearer ${token}`, 'anthropic-beta': 'oauth-2025-04-20' }
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const raw = await res.json()
      data = {
        limits: (raw.limits || []).map(l => ({ kind: l.kind, group: l.group, percent: l.percent, resets_at: l.resets_at, scope: l.scope || null, is_active: l.is_active })),
        breakdown: (raw.seven_day_breakdown?.rows || []).map(r => ({ key: r.key, display_name: r.display_name, percent: r.percent })),
        as_of: new Date().toISOString()
      }
    } catch (e) {
      // короткая причина без токена внутри — ошибка сети не имеет права унести секрет в ответ API
      data = { limits: [], breakdown: [], error: `квота недоступна: ${e.message}`.slice(0, 200) }
    }
  }
  usageCache = { at: now(), data }
  return data
}
const TERMINAL = { done: 'влито в базовую ветку', failed: 'упало', needs_review: 'ждёт твоего ревью' }
// Человеческие слова о статусе — общие для телеграма и отчётов: два словаря разошлись бы.
const STATUS_WORD = {
  inbox: '📥 во входящих', queued: '⏳ в очереди', preparing: '⚙️ готовим', running: '🔨 агент работает',
  validating: '🧪 проверки', critic: '🧪 проверки', merging: '📦 принимаем', done: '✅ принято',
  failed: '❌ не вышло', needs_review: '👀 ждёт владельца', asking: '❓ агент спросил',
  blocked: '⛔️ ждёт другую задачу', cancelled: '✖️ убрано', reverted: '↩️ откачено'
}
// Покой — это НЕ «не работа»: задача, ждущая слова владельца, тоже стоит.
// Список один на весь файл: восстановление после рестарта и диспетчер обязаны понимать покой одинаково.
const REST_STATUSES = ['inbox', 'queued', 'done', 'failed', 'needs_review', 'asking', 'blocked', 'cancelled', 'reverted']

// `code` не в PATH — берём бинарь из самого приложения, с фолбэком на open
function openInVSCode (dir) {
  const bin = '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code'
  try { spawn(fs.existsSync(bin) ? bin : 'open', fs.existsSync(bin) ? [dir] : ['-a', 'Visual Studio Code', dir], { stdio: 'ignore' }).unref() } catch {}
}

function log (taskId, kind, msg) {
  run('INSERT INTO events (task_id, ts, kind, msg) VALUES (?,?,?,?)', taskId, now(), kind, String(msg).slice(0, 4000))
  console.log(`[${new Date().toLocaleTimeString('ru-RU')}] ${kind}${taskId ? ` #${taskId}` : ''}: ${msg}`)
}
function setStatus (id, status, extra = {}) {
  // отменённую задачу не воскрешаем: агент может дописать статус уже после отмены. Оживить можно только через очередь.
  if (status !== 'queued' && q1('SELECT status FROM tasks WHERE id=?', id)?.status === 'cancelled') return
  const cols = Object.keys(extra)
  run(`UPDATE tasks SET status=?, updated_at=?${cols.map(c => `, ${c}=?`).join('')} WHERE id=?`,
    status, now(), ...cols.map(c => extra[c]), id)
  log(id, 'status', status + (extra.error ? `: ${extra.error}` : ''))
  if (TERMINAL[status]) { // одна точка на все пути завершения — ни уведомление, ни ответ источнику не забудутся
    const t = q1('SELECT key, title, error, source, source_ref FROM tasks WHERE id=?', id)
    notify(`${t.key} — ${TERMINAL[status]}`, status === 'done' ? t.title : (t.error || t.title))
    const tail = status === 'done' ? '' : `\n${(t.error || '').slice(0, 800)}`
    // источник спрашивается ЯВНО: ключ телеграма (tg:…) в Jira не существует, и комментарий ушёл бы в пустоту
    if (t.source === 'jira' && t.source_ref) {
      jiraComment(t.source_ref, `${t.key} — ${TERMINAL[status]}.${tail}`)
      if (status === 'done') jiraDone(t.source_ref) // комментарий говорит, а статус — показывает
    }
    if (t.source === 'telegram') tgTell(t.source_ref, `${STATUS_WORD[status]} ${t.key} — ${t.title}${tail}`)
    if (t.source === 'nol' && t.source_ref) {
      const cost = q1('SELECT cost FROM tasks WHERE id=?', id)?.cost
      const money = cost ? ` · $${Number(cost).toFixed(2)}` : ''
      if (status === 'done') nolUpdate(t.source_ref, 'Done', `Готово: влито ${t.key}${extra.merge_sha ? ' (' + String(extra.merge_sha).slice(0, 7) + ')' : ''}${money}`)
      else if (status === 'failed') nolUpdate(t.source_ref, 'Blocked', `Не вышло: ${t.key}. ${(t.error || '').slice(0, 1500)}${money}`)
      else nolUpdate(t.source_ref, 'Review', `Ждёт ревью: ${t.key}. ${(t.error || '').slice(0, 1500)}${money}`)
    }
    webhook(status, id)
  }
  if (status === 'asking') {
    const t = q1('SELECT key, source, source_ref, question FROM tasks WHERE id=?', id)
    if (t?.source === 'nol') nolUpdate(t.source_ref, 'Asking', `Вопрос от агента ${t.key}: ${(extra.question || t.question || '').slice(0, 2000)}\n\nОтветьте заметкой здесь или в Telegram.`)
  }
  if (status === 'cancelled') {
    const t = q1('SELECT key, source, source_ref FROM tasks WHERE id=?', id)
    if (t?.source === 'nol') nolUpdate(t.source_ref, 'Queued', `Снято с конвейера: ${t.key}`)
  }
  // отмена не «терминальна» для баннера на маке (их было бы слишком много), но человек,
  // попросивший задачу в чате, обязан узнать, что её сняли — иначе он ждёт молча
  if (status === 'cancelled') {
    const t = q1('SELECT key, title, source, source_ref FROM tasks WHERE id=?', id)
    if (t?.source === 'telegram') tgTell(t.source_ref, `✖️ ${t.key} — снято. ${t.title}`)
  }
}
// stderr не наружу, а в текст ошибки: иначе безобидные проверки сыплют красным в консоль
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64e6, stdio: ['ignore', 'pipe', 'pipe'] }).trim()

// ---------- репозитории ----------
// push по умолчанию выключен: master растёт в клоне конвейера, в GitHub уезжает только по явному согласию
const DEFAULT_CFG = { setup: [], validation: [], protected: [], slots: 2, model: null, push: false, critic: false, critic_model: 'sonnet', rules: [] }

function repoAdd (srcPath) {
  const src = path.resolve(srcPath.replace(/^~/, HOME))
  const name = path.basename(src)
  const clone = path.join(REPOS, name)
  const srcBranch = git(src, 'rev-parse', '--abbrev-ref', 'HEAD')
  if (!fs.existsSync(clone)) execFileSync('git', ['clone', '--no-checkout', '--quiet', src, clone], { stdio: 'inherit' })
  const cfg = readCfg(src, clone)
  const base = cfg.base || srcBranch
  // клон приезжает только с remote-ветками: локальную базовую ветку создаём сами, иначе rev-parse её не найдёт
  try { git(clone, 'checkout', '-B', base, `origin/${base}`) } catch { git(clone, 'checkout', '-B', base) }
  // origin у клона: настоящий remote исходника, если он есть, иначе сам исходник (офлайн-режим)
  let remote = null
  try { remote = git(src, 'remote', 'get-url', 'origin') } catch {}
  git(clone, 'remote', 'set-url', 'origin', remote || src)
  const prefix = (cfg.prefix || name.replace(/[^a-zA-Z]/g, '').slice(0, 4) || 'task').toUpperCase()
  run(`INSERT INTO repos (name, src, clone, base, prefix, cfg) VALUES (?,?,?,?,?,?)
       ON CONFLICT(name) DO UPDATE SET src=excluded.src, clone=excluded.clone, base=excluded.base,
       prefix=excluded.prefix, cfg=excluded.cfg`, name, src, clone, base, prefix, JSON.stringify(cfg))
  console.log(`репо «${name}» подключён: клон ${clone}, база ${base}, префикс ${prefix}`)
  return name
}
// conveyor.json редактируется в рабочей копии, поэтому она главнее клона; читаем каждый раз, чтобы правки подхватывались
function readCfg (src, clone) {
  for (const f of [path.join(src, 'conveyor.json'), path.join(clone, 'conveyor.json')]) {
    if (fs.existsSync(f)) return { ...DEFAULT_CFG, ...JSON.parse(fs.readFileSync(f, 'utf8')) }
  }
  return { ...DEFAULT_CFG }
}
function repoRm (name) {
  const r = q1('SELECT * FROM repos WHERE name=?', name)
  if (!r) return console.log(`репо «${name}» и так не подключён`)
  fs.rmSync(path.join(TREES, name), { recursive: true, force: true })
  fs.rmSync(r.clone, { recursive: true, force: true })
  run('DELETE FROM events WHERE task_id IN (SELECT id FROM tasks WHERE repo=?)', name)
  run('DELETE FROM tasks WHERE repo=?', name)
  run('DELETE FROM repos WHERE name=?', name)
  console.log(`репо «${name}» отключено: клон и воркспейсы удалены, твоя рабочая копия не тронута`)
}
const getRepo = name => {
  const r = q1('SELECT * FROM repos WHERE name=?', name)
  if (!r) throw new Error(`репо «${name}» не подключён (conveyor repo add <путь>)`)
  return { ...r, cfg: readCfg(r.src, r.clone) }
}

// ---------- задачи ----------
function taskAdd (repoName, title, opts = {}) {
  const repo = getRepo(repoName)
  const n = (q1('SELECT COUNT(*) c FROM tasks WHERE repo=?', repoName).c || 0) + 1
  const key = `${repo.prefix}-${n}`
  const id = run(`INSERT INTO tasks (key, repo, title, body, model, effort, deps, variants, source, source_ref, status, epic_id, wave, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, key, repoName, title, opts.body || '', opts.model || null, opts.effort || null, opts.deps || null,
  opts.variants || 1, opts.source || 'local', opts.source_ref || null, opts.status || 'queued', opts.epic_id || null, opts.wave || null, now(), now()).lastInsertRowid
  if (opts.priority) run('UPDATE tasks SET priority=? WHERE id=?', opts.priority, id)
  log(Number(id), 'add', `${key} ${title}`)
  return q1('SELECT * FROM tasks WHERE id=?', id)
}

// ---------- Jira ----------
// Токен лежит вне репозитория с правами 600 и в git не попадает никогда.
const JIRA_ENV = path.join(HOME, '.config', 'conveyor', 'jira.env')
const JIRA_LABEL = 'agent-ready'
function jiraCfg () {
  if (!fs.existsSync(JIRA_ENV)) return null
  const env = {}
  for (const line of fs.readFileSync(JIRA_ENV, 'utf8').split('\n')) {
    const i = line.indexOf('=')
    if (i > 0 && !line.trimStart().startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  if (!env.JIRA_URL || !env.JIRA_EMAIL || !env.JIRA_TOKEN) return null
  return { url: env.JIRA_URL.replace(/\/$/, ''), auth: 'Basic ' + Buffer.from(`${env.JIRA_EMAIL}:${env.JIRA_TOKEN}`).toString('base64') }
}
// Через curl, не fetch: у долгоживущего демона после сна макбука протухают keep-alive-соединения
// и встроенный fetch зависает в «fetch failed» навсегда. Свежий процесс на запрос — гнить нечему.
function jira (pathname, init = {}) {
  const c = jiraCfg()
  if (!c) return Promise.reject(new Error(`Jira не настроена: заполни ${JIRA_ENV}`))
  const args = ['-sS', '-m', '25', '-w', '\n%{http_code}', '-H', `Authorization: ${c.auth}`,
    '-H', 'Accept: application/json', '-H', 'Content-Type: application/json']
  if (init.method) args.push('-X', init.method)
  if (init.body) args.push('--data-binary', '@-')
  args.push(c.url + pathname)
  return new Promise((resolve, reject) => {
    const child = spawn('curl', args, { stdio: [init.body ? 'pipe' : 'ignore', 'pipe', 'pipe'] })
    if (init.body) { child.stdin.write(init.body); child.stdin.end() }
    const out = []; const err = []
    child.stdout.on('data', c => out.push(c))
    child.stderr.on('data', c => err.push(c))
    child.on('exit', code => {
      if (code !== 0) return reject(new Error(`Jira ${pathname}: curl ${code} ${String(Buffer.concat(err)).trim().slice(0, 200)}`))
      const all = Buffer.concat(out).toString()
      const nl = all.lastIndexOf('\n')
      const [body, status] = [all.slice(0, nl), Number(all.slice(nl + 1))]
      if (status < 200 || status >= 300) return reject(new Error(`Jira ${pathname} → ${status}: ${body.slice(0, 300)}`))
      resolve(body.trim() ? JSON.parse(body) : null)
    })
  })
}
// Описание задачи приходит деревом ADF — вытаскиваем из него простой текст
function adfText (n) {
  if (!n) return ''
  if (n.type === 'text') return n.text || ''
  const inner = (n.content || []).map(adfText).join('')
  return ['paragraph', 'heading', 'listItem', 'codeBlock'].includes(n.type) ? inner + '\n' : inner
}
// Влили — значит задача сделана, и доска обязана это показывать сама. Переход ищем ПО ИМЕНИ
// среди доступных: у каждого проекта свой процесс, и угаданный id перевёл бы задачу не туда.
async function jiraDone (key) {
  try {
    const res = await jira(`/rest/api/3/issue/${key}/transitions`)
    const t = (res?.transitions || []).find(x =>
      /^(done|готово|выполнено|closed|завершено)$/i.test(String(x.name).trim()) ||
      String(x.to?.statusCategory?.key) === 'done')
    if (!t) return log(null, 'jira', `${key}: не нашёл перехода в «Готово» — оставляю как есть`)
    await jira(`/rest/api/3/issue/${key}/transitions`, { method: 'POST', body: JSON.stringify({ transition: { id: t.id } }) })
    log(null, 'jira', `${key} переведена в «${t.name}»`)
  } catch (e) { log(null, 'jira', `${key}: перевести в готово не вышло — ${e.message.slice(0, 200)}`) }
}

const jiraComment = (key, text) => jira(`/rest/api/3/issue/${key}/comment`, {
  method: 'POST',
  body: JSON.stringify({ body: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: text.slice(0, 3000) }] }] } })
}).catch(e => log(null, 'jira', `коммент к ${key} не ушёл: ${e.message}`))

// Забираем задачи с меткой agent-ready в очередь. Повторно одну и ту же не берём: source_ref уникален.
async function jiraSync () {
  if (!jiraCfg()) return 0
  let taken = 0
  for (const r of q('SELECT name FROM repos')) {
    let repo
    try { repo = getRepo(r.name) } catch { continue }
    const proj = repo.cfg.jira_project
    if (!proj) continue
    const jql = `project = ${proj} AND labels = ${JIRA_LABEL} AND statusCategory != Done ORDER BY created ASC`
    let res
    try {
      res = await jira(`/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=20&fields=summary,description`)
    } catch (e) { log(null, 'jira', e.message); continue }
    for (const iss of res.issues || []) {
      if (q1('SELECT id FROM tasks WHERE source_ref=?', iss.key)) continue
      const t = taskAdd(r.name, iss.fields.summary, {
        body: adfText(iss.fields.description).trim(), source: 'jira', source_ref: iss.key
      })
      taken++
      log(t.id, 'jira', `${iss.key} взята в очередь как ${t.key}`)
      await jiraComment(iss.key, `Конвейер взял задачу в работу: ${t.key}`)
    }
  }
  return taken
}

// ---------- Доска NOL как источник задач ----------
// Пространство NOL — приватный репозиторий компании на GitHub (tasks.json, notes.json — по файлу на коллекцию).
// Карточка проекта «Factory» со статусом Queued забирается в очередь, статусы и заметки пишутся обратно,
// ответ владельца заметкой на карточке возвращается агенту как ответ на ВОПРОС. Токен — из связки git credential,
// тот же, что у git push; в файлы конвейера он не попадает.
let ghToken = null
function ghAuth () {
  if (ghToken) return ghToken
  const out = execFileSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8' })
  ghToken = (out.match(/^password=(.*)$/m) || [])[1] || ''
  if (!ghToken) throw new Error('нет токена GitHub в git credential')
  return ghToken
}
function gh (pathname, init = {}) {
  const args = ['-sS', '-m', '25', '-w', '\n%{http_code}', '-H', `Authorization: Bearer ${ghAuth()}`,
    '-H', 'Accept: application/vnd.github+json', '-H', 'X-GitHub-Api-Version: 2022-11-28', '-H', 'Content-Type: application/json']
  if (init.method) args.push('-X', init.method)
  if (init.body) args.push('--data-binary', '@-')
  args.push('https://api.github.com' + pathname)
  return new Promise((resolve, reject) => {
    const child = spawn('curl', args, { stdio: [init.body ? 'pipe' : 'ignore', 'pipe', 'pipe'] })
    if (init.body) { child.stdin.write(init.body); child.stdin.end() }
    const out = []; const err = []
    child.stdout.on('data', c => out.push(c)); child.stderr.on('data', c => err.push(c))
    child.on('exit', code => {
      if (code !== 0) return reject(new Error(`GitHub ${pathname}: curl ${code} ${String(Buffer.concat(err)).trim().slice(0, 200)}`))
      const all = Buffer.concat(out).toString(); const nl = all.lastIndexOf('\n')
      const [body, status] = [all.slice(0, nl), Number(all.slice(nl + 1))]
      if (status === 404) return resolve(null)
      if (status < 200 || status >= 300) { const e = new Error(`GitHub ${pathname} → ${status}: ${body.slice(0, 200)}`); e.status = status; return reject(e) }
      resolve(body.trim() ? JSON.parse(body) : null)
    })
  })
}
// contents API отдаёт содержимое и sha ОДНИМ ответом — они согласованы; писать назад можно только с этим sha
async function nolFile (ws, name) {
  if (SANDBOX && process.env.CONVEYOR_FAKE_NOL) return { items: JSON.parse(process.env.CONVEYOR_FAKE_NOL)[name] || [], sha: 'fake' }
  const f = await gh(`/repos/${ws}/contents/${name}.json?ref=main`)
  return f ? { items: JSON.parse(Buffer.from(f.content, 'base64').toString('utf8')), sha: f.sha } : { items: [], sha: null }
}
async function nolPut (ws, name, items, sha, msg) {
  if (SANDBOX && process.env.CONVEYOR_FAKE_NOL) return null
  const body = { message: msg, content: Buffer.from(JSON.stringify(items)).toString('base64'), branch: 'main' }
  if (sha) body.sha = sha
  return gh(`/repos/${ws}/contents/${name}.json`, { method: 'PUT', body: JSON.stringify(body) })
}
// правка с повтором: другой клиент мог записать файл между чтением и записью (409/422)
async function nolEdit (ws, name, mutate, msg) {
  for (let i = 0; i < 4; i++) {
    const { items, sha } = await nolFile(ws, name)
    if (mutate(items) === false) return
    try { return await nolPut(ws, name, items, sha, msg) } catch (e) { if (![409, 422].includes(e.status) || i === 3) throw e; await new Promise(r => setTimeout(r, 700 * (i + 1))) }
  }
}
const NOL_AUTHOR = 'Конвейер'
const nolRef = (ws, id) => `nol:${ws}:${id}`
const nolParse = ref => { const m = /^nol:([^:]+\/[^:]+):(.+)$/.exec(ref || ''); return m ? { ws: m[1], id: m[2] } : null }
// статус карточки на доске + заметка в «Активность». Ошибки сети не должны ронять диспетчер — только в лог.
function nolUpdate (sourceRef, status, note) {
  const p = nolParse(sourceRef); if (!p) return Promise.resolve()
  const stamp = new Date().toISOString()
  return nolEdit(p.ws, 'tasks', tasks => { const t = tasks.find(x => x.id === p.id); if (!t) return false; if (status) t.status = status; t.updated = stamp }, `conveyor: ${status || 'note'} ${p.id}`)
    .then(() => note && nolEdit(p.ws, 'notes', notes => { notes.push({ id: crypto.randomUUID(), created: stamp, coll: 'tasks', ref: p.id, text: String(note).slice(0, 4000), author: NOL_AUTHOR }) }, `conveyor: note ${p.id}`))
    .catch(e => log(null, 'nol', `не смог обновить доску ${p.id}: ${e.message}`))
}
async function nolSync () {
  let taken = 0
  for (const r of q('SELECT name FROM repos')) {
    let repo
    try { repo = getRepo(r.name) } catch { continue }
    const ws = repo.cfg.nol_workspace
    if (!ws) continue
    const project = repo.cfg.nol_project || 'Factory'
    const batch = repo.cfg.nol_batch || 3
    const { items: tasks } = await nolFile(ws, 'tasks')
    const inFlight = Number(q1("SELECT COUNT(*) c FROM tasks WHERE repo=? AND source='nol' AND status NOT IN ('done','failed','cancelled','reverted','needs_review')", r.name)?.c || 0)
    const queued = tasks.filter(t => t.project === project && t.status === 'Queued' && !t.deleted).sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9))
    for (const t of queued) {
      if (inFlight + taken >= batch) break
      const ref = nolRef(ws, t.id)
      const existing = q1('SELECT id, key, status FROM tasks WHERE source_ref=?', ref)
      if (existing && !['cancelled', 'failed'].includes(existing.status)) continue
      if (existing) { // снятую или упавшую карточку, которую снова поставили в Queued, берём той же задачей: source_ref уникален
        // NOL-99/W1-4: модель прошлого захода (например opus от эскалации) не должна пережить возврат в очередь
        const model = MODELS.includes(t.model) ? t.model : (repo.cfg.model || null)
        run('UPDATE tasks SET attempts=0, error=NULL, model=? WHERE id=?', model, existing.id); setStatus(existing.id, 'queued')
        taken++; log(existing.id, 'nol', `карточка «${t.title}» снова в очереди как ${existing.key}`)
        await nolUpdate(ref, 'Building', `Конвейер снова взял в работу: ${existing.key}`); continue
      }
      const task = taskAdd(r.name, t.title, { body: t.description || '', source: 'nol', source_ref: ref, priority: t.priority === 'high' ? 1 : null, model: MODELS.includes(t.model) ? t.model : null, effort: EFFORTS.includes(t.effort) ? t.effort : null })
      taken++
      log(task.id, 'nol', `карточка «${t.title}» взята в очередь как ${task.key}`)
      await nolUpdate(ref, 'Building', `Конвейер взял в работу: ${task.key}`)
    }
    // ответы владельца: заметка на карточке в статусе Asking, написанная не конвейером и позже вопроса
    const asking = q("SELECT * FROM tasks WHERE repo=? AND source='nol' AND status='asking'", r.name)
    if (asking.length) {
      const { items: notes } = await nolFile(ws, 'notes')
      for (const task of asking) {
        const p = nolParse(task.source_ref); if (!p) continue
        const answer = notes.filter(n => n.coll === 'tasks' && n.ref === p.id && !n.deleted && n.author !== NOL_AUTHOR && Date.parse(n.created) > task.updated_at).sort((a, b) => Date.parse(a.created) - Date.parse(b.created)).pop()
        if (!answer) continue
        ownerSays(task, answer.text)
        log(task.id, 'nol', `ответ владельца с доски: ${answer.text.slice(0, 120)}`)
        await nolUpdate(task.source_ref, 'Building', `Ответ получен, продолжаю: ${answer.text.slice(0, 200)}`)
      }
    }
  }
  return taken
}

// Откат влитой задачи. Идёт ЧЕРЕЗ мердж-очередь и с прогоном проверок: откат — такое же
// изменение базовой ветки, как мердж, и «починили откатом, а сломали другим» узнавать надо здесь,
// а не завтра. Не вышло — возвращаем ветку как было: полуоткаченное состояние хуже честно старого.
async function revertTask (task, repo) {
  const head = git(repo.clone, 'rev-parse', repo.base)
  git(repo.clone, 'checkout', repo.base)
  try { git(repo.clone, 'fetch', 'origin', repo.base); git(repo.clone, 'merge', '--ff-only', `origin/${repo.base}`) } catch {}
  try {
    // -m 1: у мердж-коммита два родителя, откатываем относительно базовой ветки
    git(repo.clone, 'revert', '--no-edit', '-m', '1', task.merge_sha)
  } catch (e) {
    try { git(repo.clone, 'revert', '--abort') } catch {}
    throw new Error(`откат не применился (конфликт с более поздними изменениями): ${e.message.slice(0, 300)}`)
  }
  for (const cmd of repo.cfg.validation) {
    const r = await shell(cmd, repo.clone)
    if (r.code !== 0) {
      git(repo.clone, 'reset', '--hard', head)
      throw new Error(`после отката упала проверка «${cmd}» — ветка возвращена как была:\n${r.out.slice(-1200)}`)
    }
  }
  const sha = git(repo.clone, 'rev-parse', repo.base)
  let pushed = ''
  if (repo.cfg.push && /^(https?|git@|ssh)/.test(git(repo.clone, 'remote', 'get-url', 'origin'))) {
    try { git(repo.clone, 'push', 'origin', repo.base); pushed = ' + запушено' } catch (e) { log(task.id, 'warn', 'push отката не прошёл: ' + e.message) }
  }
  setStatus(task.id, 'reverted', { reverted_at: now(), error: null })
  log(task.id, 'откат', `откачено из ${repo.base} (${sha.slice(0, 7)})${pushed}`)
  notify(`${task.key} — откачено`, task.title)
  if (task.source === 'telegram') tgTell(task.source_ref, `↩️ ${task.key} — работа откачена из ${repo.base}.`)
}

// ---------- Телеграм: канал как вход задач ----------
// Смысл: кто угодно в подключённом чате КЛАДЁТ задачу, но запускает её только владелец.
// Поэтому сообщение становится задачей в статусе inbox — она видна, посчитана и никуда не бежит,
// пока не нажата кнопка. Агент работает с полными правами на машине владельца: право запуска
// не может зависеть от того, кто написал в чат.
const TG_ENV = path.join(HOME, '.config', 'conveyor', 'tg.env')
function tgCfg () {
  let token = process.env.CONVEYOR_TG_TOKEN || ''
  let owner = process.env.CONVEYOR_TG_CHAT || ''
  if ((!token || !owner) && fs.existsSync(TG_ENV)) { // окружение от launchd сильнее файла — файл это запасной путь
    for (const line of fs.readFileSync(TG_ENV, 'utf8').split('\n')) {
      const i = line.indexOf('=')
      if (i < 0 || line.trimStart().startsWith('#')) continue
      const [k, v] = [line.slice(0, i).trim(), line.slice(i + 1).trim()]
      if (k === 'CONVEYOR_TG_TOKEN' && !token) token = v
      if (k === 'CONVEYOR_TG_CHAT' && !owner) owner = v
    }
  }
  return token ? { token, owner: String(owner || '') } : null
}
// Через curl по той же причине, что Jira: у демона, пережившего сон макбука, встроенный fetch виснет навсегда.
function tg (method, params = {}) {
  const c = tgCfg()
  if (!c) return Promise.reject(new Error('телеграм не подключён'))
  return new Promise((resolve, reject) => {
    const child = spawn('curl', ['-sS', '-m', '60', '-H', 'Content-Type: application/json',
      '--data-binary', '@-', `https://api.telegram.org/bot${c.token}/${method}`], { stdio: ['pipe', 'pipe', 'pipe'] })
    child.on('error', e => reject(e))
    const out = []; const err = []
    child.stdout.on('data', d => out.push(d)); child.stderr.on('data', d => err.push(d))
    child.stdin.on('error', () => {}) // curl мог умереть раньше, чем мы дописали тело
    child.stdin.end(JSON.stringify(params))
    child.on('exit', code => {
      if (code !== 0) return reject(new Error(`телеграм ${method}: curl ${code} ${String(Buffer.concat(err)).trim().slice(0, 200)}`))
      let j
      try { j = JSON.parse(Buffer.concat(out).toString()) } catch { return reject(new Error(`телеграм ${method}: ответ не разобрать`)) }
      if (!j.ok) return reject(new Error(`телеграм ${method}: ${j.description}`))
      resolve(j.result)
    })
  })
}
const tgChats = () => { try { return JSON.parse(get('tg_chats', '{}')) } catch { return {} } }
const tgChatSet = (id, patch) => {
  const m = tgChats(); m[String(id)] = { ...(m[String(id)] || {}), ...patch }; set('tg_chats', JSON.stringify(m))
}
const repoNames = () => q('SELECT name FROM repos ORDER BY name').map(r => r.name)
// Репозиторий задачи решает ЧАТ, а не текст сообщения: иначе автор письма выбирал бы, где запустят агента.
function tgRepoFor (chatId) {
  const all = repoNames()
  const bound = tgChats()[String(chatId)]?.repo
  if (bound && all.includes(bound)) return bound
  const dflt = get('tg_repo', '')
  return all.includes(dflt) ? dflt : all[0]
}
const tgKeyboard = id => ({ inline_keyboard: [[{ text: '▶️ Запустить', callback_data: `go:${id}` }, { text: '✖️ Убрать', callback_data: `no:${id}` }]] })
const tgSend = (chat, text, extra = {}) => tg('sendMessage', { chat_id: chat, text: text.slice(0, 3900), ...extra })
  .catch(e => log(null, 'телеграм', `не отправилось в ${chat}: ${e.message}`))
// Отчёт летит в ТОТ чат, откуда пришла задача: человек, попросивший её, узнаёт исход сам.
function tgTell (sourceRef, text) {
  const m = String(sourceRef || '').match(/^tg:(-?\d+):/)
  if (m && tgCfg()) tgSend(m[1], text)
}

// Чем агент занят прямо сейчас — та же строка, что в приложении на карточке.
function liveNow (taskId) {
  const r = q1('SELECT log FROM runs WHERE task_id=? ORDER BY id DESC LIMIT 1', taskId)
  if (!r?.log) return ''
  const feed = liveFeed(r.log, 8).filter(f => f.kind === 'do' || f.kind === 'say')
  return feed.length ? feed[feed.length - 1].text : ''
}

// Голосовое → текст. Своего распознавания у конвейера нет и заводить его ради этого нельзя:
// на машине уже стоит Джарвис со своей моделью, зовём его венв. Нет Джарвиса — честно говорим,
// что не расслышали, а не роняем сообщение молча.
function tgVoiceText (fileId) {
  const c = tgCfg()
  const stt = path.join(HOME, 'jarvis', '.venv', 'bin', 'python')
  if (!c || !fs.existsSync(stt)) return null
  try {
    const info = JSON.parse(execFileSync('curl', ['-sS', '-m', '20',
      `https://api.telegram.org/bot${c.token}/getFile?file_id=${encodeURIComponent(fileId)}`], { encoding: 'utf8' }))
    if (!info?.ok) return null
    const ogg = path.join(os.tmpdir(), `conveyor-voice-${Date.now()}.ogg`)
    execFileSync('curl', ['-sS', '-m', '60', '-o', ogg,
      `https://api.telegram.org/file/bot${c.token}/${info.result.file_path}`])
    const text = execFileSync(stt, ['-c',
      'import sys;from pathlib import Path;from jarvis.voice import stt;print(stt.transcribe_compressed(Path(sys.argv[1])))', ogg],
    { cwd: path.join(HOME, 'jarvis'), encoding: 'utf8', timeout: 180000 }).trim()
    fs.rmSync(ogg, { force: true })
    return text || null
  } catch (e) { log(null, 'телеграм', `голосовое не расшифровано: ${String(e.message).slice(0, 160)}`); return null }
}

// Дифф словами: владелец решает про работу, а не читает `+42 −7` в чате.
function changedSummary (t) {
  const d = taskDiff(t, 200000)
  if (!d || !d.includes('+++ b/')) return ''
  const files = {}
  let cur = null
  for (const l of d.split('\n')) {
    const m = l.match(/^\+\+\+ b\/(.+)$/)
    if (m) { cur = files[m[1]] = { p: 0, mi: 0 }; continue }
    if (!cur) continue
    if (l[0] === '+' && !l.startsWith('+++')) cur.p++
    if (l[0] === '-' && !l.startsWith('---')) cur.mi++
  }
  const names = Object.keys(files)
  const head = names.slice(0, 6).map(f => `  ${f} +${files[f].p} −${files[f].mi}`).join('\n')
  return `Изменено файлов: ${names.length}\n${head}${names.length > 6 ? `\n  и ещё ${names.length - 6}` : ''}`
}

// Карточка на подпись. reply-кнопка «На доделку» просит текст ОТВЕТОМ на это сообщение —
// так конвейер потом точно знает, к какой задаче относится написанное (см. tgUpdate).
async function tgReview (task) {
  const c = tgCfg()
  if (!c?.owner) return
  const why = String(task.error || '').replace(/^REVIEW:\s*/, '')
  const text = [`👀 ${task.key} · ${task.repo}`, task.title, '', why ? `Почему остановился: ${why}` : '',
    changedSummary(task)].filter(Boolean).join('\n')
  const m = await tg('sendMessage', {
    chat_id: c.owner, text: text.slice(0, 3900),
    reply_markup: { inline_keyboard: [
      [{ text: '✅ Принять', callback_data: `ok:${task.id}` }, { text: '✍️ На доделку', callback_data: `fix:${task.id}` }],
      [{ text: '📄 Показать изменения', callback_data: `diff:${task.id}` },
       { text: '🔁 Перепроверить', callback_data: `recheck:${task.id}` }]] }
  }).catch(e => { log(task.id, 'телеграм', `карточка ревью не ушла: ${e.message}`); return null })
  if (m?.message_id) run('UPDATE tasks SET ask_msg=? WHERE id=?', m.message_id, task.id)
}

// Снимки владельцу: он решает про сайт глазами, а не по числу изменённых строк.
function tgShots (task, before, after, veto) {
  const c = tgCfg()
  if (!c?.owner || !after) return
  const cap = `${veto ? '🔴' : '👁'} ${task.key} — ${task.title}`.slice(0, 900) + (veto ? `\n${veto.replace(/^REVIEW:\s*/, '')}` : '')
  const media = [before, after].filter(Boolean)
  const args = ['-sS', '-m', '90', `https://api.telegram.org/bot${c.token}/sendMediaGroup`,
    '-F', `chat_id=${c.owner}`,
    '-F', `media=${JSON.stringify(media.map((f, i) => ({
      type: 'photo', media: `attach://f${i}`, ...(i === 0 ? { caption: cap } : {})
    })))}`]
  media.forEach((f, i) => args.push('-F', `f${i}=@${f}`))
  try { spawn('curl', args, { stdio: 'ignore' }).unref() } catch (e) { log(task.id, 'глаза', `снимки не ушли: ${e.message}`) }
}

// Кадры падений браузерных тестов. Берём не все подряд, а первые три: пачка из двадцати
// одинаковых снимков — не помощь, а завал, и владелец перестанет их открывать.
function tgFailShots (task, dir) {
  const c = tgCfg()
  if (!c?.owner || !fs.existsSync(dir)) return
  const shots = []
  const walk = d => {
    for (const n of fs.readdirSync(d, { withFileTypes: true })) {
      if (shots.length >= 3) return
      const p = path.join(d, n.name)
      if (n.isDirectory()) walk(p)
      else if (/\.png$/i.test(n.name)) shots.push({ p, name: path.basename(d) })
    }
  }
  try { walk(dir) } catch { return }
  if (!shots.length) return
  const cap = `🔴 ${task.key} — браузерный тест упал\n${shots.map(s => '· ' + s.name.replace(/-chromium$/, '').slice(0, 70)).join('\n')}`
  const args = ['-sS', '-m', '90', `https://api.telegram.org/bot${c.token}/sendMediaGroup`, '-F', `chat_id=${c.owner}`,
    '-F', `media=${JSON.stringify(shots.map((s, i) => ({ type: 'photo', media: `attach://f${i}`, ...(i === 0 ? { caption: cap.slice(0, 1000) } : {}) })))}`]
  shots.forEach((s, i) => args.push('-F', `f${i}=@${s.p}`))
  try { spawn('curl', args, { stdio: 'ignore' }).unref(); log(task.id, 'глаза', `отправил ${shots.length} кадр(ов) падения`) } catch {}
}

// Вопрос агента. force_reply открывает у владельца поле ответа сразу — иначе он ответит
// «в воздух» новым сообщением, и оно уедет новой задачей вместо ответа.
async function tgAsk (task) {
  const c = tgCfg()
  if (!c?.owner) return
  const m = await tg('sendMessage', {
    chat_id: c.owner,
    text: `❓ ${task.key} · ${task.repo}\n${task.title}\n\nАгент спрашивает:\n${task.question}\n\nОтветь на это сообщение — он продолжит с твоим ответом.`.slice(0, 3900),
    reply_markup: { force_reply: true, input_field_placeholder: 'ответ агенту' }
  }).catch(e => { log(task.id, 'телеграм', `вопрос не ушёл: ${e.message}`); return null })
  if (m?.message_id) run('UPDATE tasks SET ask_msg=? WHERE id=?', m.message_id, task.id)
}

// Слово владельца живой сессии — одна дверь на все входы (кнопка в чате, ответ на вопрос,
// поле в приложении). Ставит задачу в очередь: слот, бюджет и пауза считаются как обычно.
function ownerSays (task, note) {
  run('UPDATE tasks SET owner_note=?, attempts=0, error=NULL WHERE id=?', String(note).slice(0, 4000), task.id)
  setStatus(task.id, 'queued')
  log(task.id, 'владелец', String(note).slice(0, 300))
}

const tgUnknownTold = new Set() // о новом чате говорим один раз за жизнь демона, а не на каждое сообщение

async function tgUpdate (u) {
  if (u.callback_query) return tgCallback(u.callback_query)
  const m = u.message || u.channel_post
  if (!m) return
  // надиктовал за рулём — задача. Расшифровку показываем в ответе: владелец должен видеть,
  // ЧТО расслышали, иначе агент уедет исполнять неверно понятое слово.
  const voice = m.voice || m.video_note
  let text = String(m.text || m.caption || '').trim()
  if (!text && voice) {
    text = tgVoiceText(voice.file_id) || ''
    if (!text) return tgSend(m.chat.id, 'Голосовое не разобрал — напиши текстом.')
    log(null, 'телеграм', `голосовое расшифровано: ${text.slice(0, 120)}`)
  }
  if (!text) return
  const chatId = m.chat.id
  const c = tgCfg()
  const isOwner = String(m.from?.id || '') === c.owner || String(chatId) === c.owner

  // Ответ НА наше сообщение — это слово живой сессии, а не новая задача. Проверяем до всего
  // остального: иначе «оставь как есть» уехало бы отдельной задачей, а агент ждал бы вечно.
  const replyTo = m.reply_to_message?.message_id
  if (replyTo && isOwner) {
    const t = q1('SELECT * FROM tasks WHERE ask_msg=?', replyTo)
    if (t) {
      if (!['asking', 'needs_review', 'failed'].includes(t.status)) return tgSend(chatId, `${t.key} уже ${STATUS_WORD[t.status] || t.status} — отвечать поздно.`)
      ownerSays(t, text)
      return tgSend(chatId, `Передал агенту: ${t.key} продолжит с твоим словом.`)
    }
  }
  if (text.startsWith('/')) return tgCommand(text, m, isOwner)

  // Владелец написал обычным сообщением, а на его слово кто-то ЖДЁТ. Раньше такое молча
  // уезжало новой задачей, агент ждал вечно, а владелец был уверен, что ответил (случай 21.08:
  // ответ «Не знаю» стал задачей BAV-13). Угадывать намерение нельзя — оба варианта осмысленны,
  // поэтому спрашиваем одним нажатием: это ответ или новая задача.
  const waiting = isOwner ? q(`SELECT id, key, title, question FROM tasks
    WHERE status IN ('asking','needs_review') AND ask_msg IS NOT NULL ORDER BY updated_at DESC LIMIT 3`) : []
  if (waiting.length) {
    set('pending_text', JSON.stringify({ text, chat: chatId, msg: m.message_id }))
    const rows = waiting.map(t => [{ text: `↩︎ ответ на ${t.key}`, callback_data: `ansq:${t.id}` }])
    rows.push([{ text: '➕ это новая задача', callback_data: 'newt:0' }])
    return tgSend(chatId, `Тебя ждёт ${waiting.length === 1 ? 'вопрос' : 'несколько вопросов'}:\n` +
      waiting.map(t => `  ${t.key} — ${String(t.question || t.title).slice(0, 90)}`).join('\n') +
      `\n\nТвоё «${text.slice(0, 60)}» — это ответ или новая задача?`, { reply_markup: { inline_keyboard: rows } })
  }

  const known = String(chatId) === c.owner || tgChats()[String(chatId)]
  if (!known) { // чужой чат молча игнорируем, но владельцу показываем кнопку подключения — иначе он не узнает про канал
    if (tgUnknownTold.has(String(chatId))) return
    tgUnknownTold.add(String(chatId))
    const names = repoNames()
    if (!names.length || !c.owner) return
    return tgSend(c.owner, `Новый чат пишет боту: «${m.chat.title || m.chat.username || chatId}» (${chatId}).\nПодключить его к репозиторию?`,
      { reply_markup: { inline_keyboard: names.slice(0, 6).map((n, i) => [{ text: `Подключить → ${n}`, callback_data: `add:${chatId}:${i}` }]) } })
  }

  const ref = `tg:${chatId}:${m.message_id}`
  if (q1('SELECT id FROM tasks WHERE source_ref=?', ref)) return // повторный опрос не должен плодить дубли
  const repo = tgRepoFor(chatId)
  if (!repo) return tgSend(chatId, 'В конвейере пока нет ни одного репозитория — задачу некуда положить.')
  // «#срочно» и «#opus» словами, а не кнопками: пишут на бегу, лишний шаг просто не сделают
  const urgent = /(^|\s)#(срочно|urgent)\b/i.test(text)
  const asked = MODELS.find(m => new RegExp(`(^|\\s)#${m}\\b`, 'i').test(text))
  const lines = text.replace(/(^|\s)#(срочно|urgent|haiku|sonnet|opus)\b/ig, '').trim().split('\n')
  const t = taskAdd(repo, lines[0].slice(0, 200), {
    body: lines.slice(1).join('\n').trim(), source: 'telegram', source_ref: ref, status: 'inbox',
    priority: urgent ? 1 : 0, model: asked || null
  })
  log(t.id, 'телеграм', `${t.key} принята из чата ${chatId}`)
  await tgSend(chatId, `📥 ${t.key} · ${repo}${urgent ? ' · срочно' : ''}${asked ? ' · ' + asked : ''}\n${t.title}\n\nЛежит во входящих. Запустит владелец.`,
    { reply_to_message_id: m.message_id, reply_markup: tgKeyboard(t.id) })
}

async function tgCommand (text, m, isOwner) {
  const chatId = m.chat.id
  const [cmd, ...args] = text.replace(/@\S+/, '').split(/\s+/)
  if (['/start', '/помощь', '/help'].includes(cmd)) {
    return tgSend(chatId, `Это конвейер задач.\n\nНапиши сюда (или надиктуй голосом), что нужно сделать — первая строка станет названием, остальное описанием. Задача ляжет во входящие, запустит её владелец.\n\nСлова в тексте: #срочно — вне очереди, #opus или #haiku — выбрать агента вручную (обычно конвейер подбирает сам).\n\n/статус — чем заняты агенты прямо сейчас\n/отчёт — что вышло за сегодня и за неделю\n/план <цель> — разбить большую цель на задачи\n\nID этого чата: ${chatId}`)
  }
  if (['/задачи', '/list', '/список', '/статус', '/status'].includes(cmd)) {
    const rows = q(`SELECT * FROM tasks WHERE status NOT IN ('done','cancelled','reverted') ORDER BY priority DESC, id DESC LIMIT 15`)
    if (!rows.length) return tgSend(chatId, 'Сейчас ничего не делается.')
    const spent = spentToday()
    const lines = rows.map(r => {
      // живая строка агента — то же, что видно на карточке в приложении: чем он занят ПРЯМО СЕЙЧАС
      const now = RUNNING_STATUSES.includes(r.status) ? liveNow(r.id) : ''
      return `${STATUS_WORD[r.status] || r.status} ${r.key} — ${String(r.title).slice(0, 60)}` +
        (now ? `\n    ▸ ${now}` : '') + (r.status === 'asking' && r.question ? `\n    ❓ ${String(r.question).slice(0, 120)}` : '')
    })
    const day = new Date(); day.setHours(0, 0, 0, 0)
    const fp = firstTryRate(day.getTime())
    return tgSend(chatId, `Потрачено сегодня $${spent} из $${get('budget', 20)}` +
      (fp == null ? '' : ` · с первой попытки ${fp}%`) + `\n\n` + lines.join('\n'))
  }
  if (['/план', '/plan'].includes(cmd)) {
    if (!isOwner) return tgSend(chatId, 'Разбивать цель на задачи может только владелец.')
    const goal = args.join(' ').trim()
    if (!goal) return tgSend(chatId, 'Напиши цель: /план сделать страницу бронирования с оплатой')
    await tgSend(chatId, 'Думаю, как это разбить…')
    try {
      const keys = await planGoal(tgRepoFor(chatId), goal)
      return tgSend(chatId, `Разбил на ${keys.length}:\n${keys.join('\n')}\n\nВсе стоят в очереди — зависимые дождутся своих.`)
    } catch (e) { return tgSend(chatId, `Не смог разбить: ${e.message.slice(0, 300)}`) }
  }
  if (['/отчёт', '/отчет', '/digest'].includes(cmd)) {
    const from = new Date(); from.setHours(0, 0, 0, 0)
    return tgSend(chatId, [digestText(from.getTime(), Date.now()) || 'Сегодня ещё ничего не закончено.', trendText()].filter(Boolean).join('\n\n'))
  }
  if (['/репо', '/repo'].includes(cmd)) {
    if (!isOwner) return tgSend(chatId, 'Репозиторий чата меняет только владелец.')
    if (!repoNames().includes(args[0])) return tgSend(chatId, `Есть репозитории: ${repoNames().join(', ') || '—'}`)
    tgChatSet(chatId, { repo: args[0], title: m.chat.title || '' })
    return tgSend(chatId, `Задачи из этого чата пойдут в ${args[0]}.`)
  }
}

async function tgCallback (cb) {
  const c = tgCfg()
  const ans = text => tg('answerCallbackQuery', { callback_query_id: cb.id, text: text?.slice(0, 190) }).catch(() => {})
  // Единственная настоящая граница: кнопку жмёт владелец. Всё остальное в чате — заявки, а не команды.
  if (String(cb.from?.id || '') !== c.owner) return ans('Запускает только владелец конвейера')
  const [cmd, a, b] = String(cb.data || '').split(':')
  const edit = text => tg('editMessageText', { chat_id: cb.message.chat.id, message_id: cb.message.message_id, text }).catch(() => {})

  if (cmd === 'add') {
    const repo = repoNames()[Number(b)]
    if (!repo) return ans('Репозитория больше нет')
    tgChatSet(a, { repo })
    await edit(`Чат ${a} подключён к ${repo}. Задачи оттуда будут приходить во входящие.`)
    return ans('Подключено')
  }
  const t = q1('SELECT * FROM tasks WHERE id=?', Number(a))
  if (!t) return ans('Задачи уже нет')
  if (cmd === 'go') {
    if (t.status !== 'inbox') return ans(`${t.key} уже ${STATUS_WORD[t.status] || t.status}`)
    // кто именно решил пустить агента — это первое, что спросят, если он сделает не то
    log(t.id, 'телеграм', 'владелец нажал «Запустить» в телеграме')
    setStatus(t.id, 'queued')
    await edit(`▶️ ${t.key} · ${t.repo}\n${t.title}\n\nВзято в работу.`)
    return ans('Запущено')
  }
  if (cmd === 'no') {
    if (!['inbox', 'queued'].includes(t.status)) return ans('Задача уже в работе — останови её в приложении')
    setStatus(t.id, 'cancelled')
    await edit(`✖️ ${t.key} — убрано из конвейера.\n${t.title}`)
    return ans('Убрано')
  }
  if (cmd === 'ok') { // принять работу, ждущую владельца
    if (t.status !== 'needs_review') return ans(`${t.key} уже ${STATUS_WORD[t.status] || t.status}`)
    log(t.id, 'владелец', 'принял работу из телеграма')
    run('UPDATE tasks SET owner_ok=1 WHERE id=?', t.id)
    decide(t.id, 'принято владельцем', 'нажал «Принять» в телеграме')
    enqueueMerge(() => mergeTask(q1('SELECT * FROM tasks WHERE id=?', t.id), getRepo(t.repo)), t.repo)
      .catch(e => log(t.id, 'мердж', `принятие из телеграма не прошло: ${e.message}`))
    await edit(`✅ ${t.key} — принято, вливаю.\n${t.title}`)
    return ans('Принято')
  }
  // развилка «ответ или новая задача»: текст владельца ждал в настройках, пока он решает
  if (cmd === 'ansq' || cmd === 'newt') {
    let pend = null
    try { pend = JSON.parse(get('pending_text', '')) } catch {}
    if (!pend?.text) return ans('Сообщение уже устарело — напиши заново')
    set('pending_text', '')
    if (cmd === 'newt') {
      const repo = tgRepoFor(pend.chat)
      const lines = pend.text.split('\n')
      const nt = taskAdd(repo, lines[0].slice(0, 200), {
        body: lines.slice(1).join('\n').trim(), source: 'telegram', status: 'inbox',
        source_ref: `tg:${pend.chat}:${pend.msg}`
      })
      await edit(`📥 ${nt.key} · ${repo}\n${nt.title}\n\nЛежит во входящих.`)
      await tg('editMessageReplyMarkup', { chat_id: cb.message.chat.id, message_id: cb.message.message_id, reply_markup: tgKeyboard(nt.id) }).catch(() => {})
      return ans('Поставлено задачей')
    }
    const target = q1('SELECT * FROM tasks WHERE id=?', Number(a))
    if (!target) return ans('Задачи уже нет')
    ownerSays(target, pend.text)
    await edit(`↩︎ ${target.key} — передал агенту: «${pend.text.slice(0, 200)}»`)
    return ans('Передал агенту')
  }
  if (cmd === 'free') { // отпустить хвост цепочки: снимаем ССЫЛКУ на упавший шаг, остальные зависимости целы
    const rest = blockedBy(t.id)
    for (const b of rest) {
      const deps = String(b.deps || '').split(',').filter(d => d && d !== String(t.id)).join(',')
      run("UPDATE tasks SET deps=?, status='queued', error=NULL WHERE id=?", deps || null, b.id)
      decide(b.id, 'план', `владелец отпустил шаг без ${t.key}`)
    }
    log(t.id, 'план', `владелец отпустил ${rest.length} шагов без этого`)
    await edit(`▶️ Отпущено без ${t.key}: ${rest.map(r => r.key).join(', ') || '—'}`)
    return ans('Пущено в работу')
  }
  if (cmd === 'kill') {
    const rest = blockedBy(t.id)
    rest.forEach(b => setStatus(b.id, 'cancelled'))
    await edit(`✖️ Цепочка снята: ${rest.map(r => r.key).join(', ') || '—'}`)
    return ans('Снято')
  }
  if (cmd === 'recheck') {
    if (RUNNING_STATUSES.includes(t.status)) return ans(`${t.key} сейчас работает`)
    recheckTask(t).catch(e => log(t.id, 'перепроверка', e.message))
    await edit(`🔁 ${t.key} — гоняю проверки заново по готовой работе.\n${t.title}`)
    return ans('Перепроверяю')
  }
  if (cmd === 'diff') {
    const d = taskDiff(t, 400000)
    const f = path.join(os.tmpdir(), `${t.key}.diff`)
    fs.writeFileSync(f, d || 'изменений нет')
    // документом, а не текстом: в сообщение дифф не влезает, а обрезанный дифф — это решение
    // по половине картины, то есть худший вид «показал»
    try {
      spawn('curl', ['-sS', '-m', '90', `https://api.telegram.org/bot${c.token}/sendDocument`,
        '-F', `chat_id=${cb.message.chat.id}`, '-F', `caption=${t.key}: ${String(t.title).slice(0, 900)}`,
        '-F', `document=@${f}`], { stdio: 'ignore' }).unref()
    } catch (e) { log(t.id, 'телеграм', `дифф не ушёл: ${e.message}`) }
    return ans('Отправляю файлом')
  }
  if (cmd === 'fix') { // на доделку: просим текст ОТВЕТОМ, чтобы знать, к какой задаче он относится
    if (!['needs_review', 'failed'].includes(t.status)) return ans(`${t.key} уже ${STATUS_WORD[t.status] || t.status}`)
    const m = await tg('sendMessage', {
      chat_id: cb.message.chat.id,
      text: `✍️ ${t.key}: что переделать? Ответь на это сообщение — агент продолжит с того места, где остановился.`,
      reply_markup: { force_reply: true, input_field_placeholder: 'что переделать' }
    }).catch(() => null)
    if (m?.message_id) run('UPDATE tasks SET ask_msg=? WHERE id=?', m.message_id, t.id)
    return ans('Напиши, что переделать')
  }
}

// Опрос телеграма живёт своим циклом: долгий запрос держится 30 секунд и не имеет права тормозить диспетчер.
async function tgLoop () {
  if (!tgCfg()) return
  // Первый запуск: телеграм хранит сутки непрочитанного, и без этого вчерашняя переписка
  // разом превратилась бы в задачи. Проверено живьём: так и случилось.
  if (get('tg_offset', '') === '') {
    try {
      const last = await tg('getUpdates', { offset: -1, timeout: 0 })
      const id = last?.[0]?.update_id
      set('tg_offset', id ? id + 1 : 0)
      log(null, 'телеграм', 'подключён; всё, что написано до этой минуты, пропущено')
    } catch (e) { log(null, 'телеграм', `не удалось подключиться: ${e.message}`); return }
  }
  let lastErr = ''
  for (;;) {
    try {
      const ups = await tg('getUpdates', {
        offset: Number(get('tg_offset', 0)), timeout: 30, allowed_updates: ['message', 'channel_post', 'callback_query']
      })
      if (lastErr) { log(null, 'телеграм', 'связь восстановилась'); lastErr = '' }
      for (const u of ups) {
        set('tg_offset', u.update_id + 1) // сдвигаем ДО разбора: сообщение, на котором мы споткнулись, не должно крутиться вечно
        try { await tgUpdate(u) } catch (e) { log(null, 'телеграм', `сообщение ${u.update_id}: ${e.message}`) }
      }
    } catch (e) {
      if (e.message !== lastErr) { log(null, 'телеграм', e.message); lastErr = e.message }
      await new Promise(r => setTimeout(r, 15000))
    }
  }
}

// Декомпозиция: цель одной строкой -> список задач с зависимостями. Диспетчер сам запустит те, у кого зависимости закрыты.
async function planGoal (repoName, goal) {
  const repo = getRepo(repoName)
  const ask = [
    `Цель: ${goal}`, '',
    'Ты смотришь на реальный репозиторий в текущем каталоге. Разбей цель на самостоятельные задачи для параллельных агентов.',
    'Правила:',
    '- Каждая задача выполнима отдельным агентом за один заход и содержит критерий готовности.',
    '- Задачи, меняющие одни и те же файлы, ставь в зависимость друг от друга, а не параллельно.',
    '- Общие типы, схемы и контракты — отдельной первой задачей, остальные зависят от неё.',
    '- От 2 до 8 задач. Не выдумывай работу, которой цель не требует.', '',
    'Ответь ТОЛЬКО JSON-массивом, без пояснений:',
    '[{"title":"что сделать, с критерием готовности","deps":[номера задач, начиная с 1]}]'
  ].join('\n')
  const args = ['-p', ask, '--output-format', 'json', '--model', repo.cfg.plan_model || 'sonnet', '--allowedTools', 'Read', 'Glob', 'Grep']
  const text = await new Promise(resolve => {
    const out = []
    const child = spawn('claude', args, { cwd: repo.clone, stdio: ['ignore', 'pipe', 'ignore'] })
    child.stdout.on('data', c => out.push(c))
    setTimeout(() => { try { child.kill('SIGKILL') } catch {} }, 10 * 60 * 1000)
    child.on('exit', () => { try { resolve(String(JSON.parse(out.join('')).result || '')) } catch { resolve('') } })
  })
  const m = text.match(/\[[\s\S]*\]/)
  if (!m) throw new Error('не удалось разобрать план: ' + text.slice(0, 200))
  const plan = JSON.parse(m[0])
  const ids = []
  const keys = []
  for (const [i, p] of plan.entries()) {
    const deps = (p.deps || []).map(d => ids[d - 1]).filter(Boolean).join(',')
    const t = taskAdd(repoName, String(p.title).slice(0, 300), { model: p.model || null, deps })
    ids.push(t.id); keys.push(`${t.key}${deps ? ' (после ' + deps + ')' : ''}: ${t.title}`)
    console.log(keys[keys.length - 1])
  }
  return keys
}

// Декомпозиция цели эпики на волны (ZAVOD-TZ раздел 6.7.2): как planGoal, но с волнами —
// следующая волна опирается на то, что предыдущая целиком влила в ветку эпики.
async function planEpic (repoName, goal) {
  const repo = getRepo(repoName)
  const ask = [
    `Цель эпики: ${goal}`, '',
    'Ты смотришь на реальный репозиторий в текущем каталоге. Разбей цель на волны параллельных задач.',
    'Правила:',
    '- От 2 до 4 волн. В каждой волне от 2 до 6 задач.',
    '- Внутри одной волны задачи независимы по файлам — их делают параллельные агенты одновременно.',
    '- Между волнами зависимость по смыслу: следующая волна опирается на то, что сделала предыдущая.',
    '- Общие типы, схемы и контракты — отдельной первой волной, если это нужно.',
    '- Каждая задача содержит критерий готовности. Не выдумывай работу, которой цель не требует.', '',
    'Ответь ТОЛЬКО JSON-массивом волн, без пояснений:',
    '[{"wave":номер волны с 1,"title":"что сделать, с критерием готовности","deps":[номера задач по всему плану, начиная с 1]}]'
  ].join('\n')
  const args = ['-p', ask, '--output-format', 'json', '--model', repo.cfg.plan_model || 'sonnet', '--allowedTools', 'Read', 'Glob', 'Grep']
  const askOnce = () => new Promise(resolve => {
    const out = []
    const child = spawn('claude', args, { cwd: repo.clone, stdio: ['ignore', 'pipe', 'ignore'] })
    child.stdout.on('data', c => out.push(c))
    setTimeout(() => { try { child.kill('SIGKILL') } catch {} }, 10 * 60 * 1000)
    child.on('exit', () => { try { resolve(String(JSON.parse(out.join('')).result || '')) } catch { resolve('') } })
  })
  const parse = text => { const m = text.match(/\[[\s\S]*\]/); if (!m) return null; try { return JSON.parse(m[0]) } catch { return null } }
  let text = await askOnce()
  let plan = parse(text)
  if (!plan || !plan.length) { text = await askOnce(); plan = parse(text) } // мусор с первого раза — одна повторная попытка, не более
  if (!plan || !plan.length) throw new Error('не удалось разобрать план волн: ' + text.slice(0, 200))
  return plan
}

// Воркспейс ветки эпики: свой на эпику, живёт рядом с воркспейсами задач и тем же путём находится всегда.
function epicWorktree (repo, epic) { return path.join(TREES, repo.name, epic.key) }

// Эпика: цель в волны параллельных задач. В master эпика попадает только целиком, через свою ветку
// (ZAVOD-TZ раздел 6.7.3).
async function epicAdd (repoName, { title, goal, auto_accept }) {
  const repo = getRepo(repoName)
  const plan = await planEpic(repoName, goal)
  const waves = plan.reduce((m, p) => Math.max(m, Number(p.wave) || 1), 1)
  const n = (q1('SELECT COUNT(*) c FROM epics WHERE repo=?', repoName).c || 0) + 1
  const key = `${repo.prefix}-E${n}`
  const branch = `epic/${key.toLowerCase()}`
  syncBase(repo)
  const baseSha = git(repo.clone, 'rev-parse', repo.base)
  const ewt = epicWorktree(repo, { key })
  try { git(repo.clone, 'worktree', 'remove', '--force', ewt) } catch {}
  fs.rmSync(ewt, { recursive: true, force: true })
  git(repo.clone, 'worktree', 'prune')
  try { git(repo.clone, 'branch', '-D', branch) } catch {}
  git(repo.clone, 'worktree', 'add', '-b', branch, ewt, baseSha)
  if (repo.cfg.push && /^(https?|git@|ssh)/.test(git(repo.clone, 'remote', 'get-url', 'origin'))) {
    try { git(ewt, 'push', '-u', 'origin', branch) } catch (e) { log(null, 'эпика', `ветка ${branch} не запушена: ${e.message}`) }
  }
  const epicId = Number(run(`INSERT INTO epics (key, repo, title, goal, branch, status, waves, wave, auto_accept, base_sha, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, key, repoName, title, goal, branch, 'open', waves, 1, auto_accept ? 1 : 0, baseSha, now(), now()).lastInsertRowid)

  const ws = repo.cfg.nol_workspace
  const project = repo.cfg.nol_project || 'Factory'
  const ids = []
  const keys = []
  plan.forEach((p, i) => {
    const deps = (p.deps || []).map(d => ids[d - 1]).filter(Boolean).join(',')
    const cardId = `epic-${key}-${i + 1}`
    const t = taskAdd(repoName, String(p.title).slice(0, 300), {
      deps, epic_id: epicId, wave: Number(p.wave) || 1, source: 'epic',
      source_ref: ws ? nolRef(ws, cardId) : null
    })
    ids.push(t.id); keys.push(t.key)
  })
  log(epicId, 'эпика', `${key}: ${waves} волн(ы), ${plan.length} задач(и) — ${title}`)

  if (ws) {
    const stamp = new Date().toISOString()
    await nolEdit(ws, 'tasks', cards => {
      cards.push({ id: `epic-${key}`, title, status: 'Building', project, epic: key, kind: 'epic', description: goal, assignee: 'Factory agent', created: stamp, updated: stamp })
      plan.forEach((p, i) => {
        cards.push({ id: `epic-${key}-${i + 1}`, title: p.title, status: 'Queued', project, epic: key, wave: Number(p.wave) || 1, assignee: 'Factory agent', description: `${goal}\n\n${p.title}`, created: stamp, updated: stamp })
      })
    }, `конвейер: эпика ${key}`).catch(e => log(epicId, 'nol', `карточки эпики не создались: ${e.message}`))
  }
  return { key, waves, keys }
}

// ---------- этапы конвейера ----------
// Перемотать клон на свежую базу владельца и сказать, на сколько он всё ещё отстал (0 — свели).
// Чужую историю не сливаем сами: у клона свои мердж-коммиты конвейера, а исходник — репозиторий
// владельца, и решать, как их свести, вправе только он (conveyor sync).
function syncBase (repo, taskId = null) {
  // Origin у клона — настоящий remote исходника, если он есть (github), иначе сам каталог владельца.
  // Ночью машина спит и до github не дозвониться: это НЕ «база протухла», это «свериться не с чем».
  // Сказать, по какому репо, обязаны: безымянный warn читался как беда соседнего репозитория.
  try { git(repo.clone, 'fetch', 'origin', repo.base) } catch { log(taskId, 'warn', `${repo.name}: свериться с origin не вышло`) }
  try { git(repo.clone, 'merge', '--ff-only', `origin/${repo.base}`) } catch {}
  // А ГЛАВНЫЙ источник — рабочая копия владельца. При push:false в origin не уезжает ничего, у
  // mir-os нужной ветки там нет вовсе, и все четыре репо работают именно так: человек коммитит
  // себе, конвейер вливает себе. Локальный путь под рукой и от сети не зависит. Порядок важен:
  // origin первым, его ref переживает следующий fetch, а FETCH_HEAD — нет.
  try {
    git(repo.clone, 'fetch', repo.src, repo.base)
    try { git(repo.clone, 'merge', '--ff-only', 'FETCH_HEAD'); return 0 } catch {}
    return Number(git(repo.clone, 'rev-list', '--count', `${repo.base}..FETCH_HEAD`) || 0)
  } catch { return 0 }
}

function prepare (task, repo, variant = '') {
  const name = task.key + variant
  const wt = path.join(TREES, repo.name, name)
  const branch = `agent/${name}`
  // Идемпотентность: снести хвосты прошлой попытки (воркспейс + ветку), иначе retry падает на «branch already exists».
  try { git(repo.clone, 'worktree', 'remove', '--force', wt) } catch {}
  fs.rmSync(wt, { recursive: true, force: true })
  git(repo.clone, 'worktree', 'prune')
  try { git(repo.clone, 'branch', '-D', branch) } catch {}
  // Задача эпики стартует с верхушки её ветки (там уже лежат прошлые волны), а не с базы владельца:
  // следующая волна опирается на смысл, который предыдущая влила в epic/<key> (ZAVOD-TZ раздел 3).
  const epic = task.epic_id ? q1('SELECT * FROM epics WHERE id=?', task.epic_id) : null
  let baseSha
  if (epic) {
    baseSha = git(repo.clone, 'rev-parse', epic.branch)
  } else {
    // Клон разошёлся с рабочей копией владельца: у него свои мердж-коммиты, у владельца свои.
    // Перемотка не проходит, и агент садится работать на СТАРОМ коде — молчать об этом нельзя,
    // это тихо обесценивает всю работу.
    const behindBase = syncBase(repo, task.id)
    if (behindBase) log(task.id, 'база', `клон отстал от твоего репозитория на ${behindBase} коммит(ов) — агент работает без них. Свести: conveyor sync ${repo.name}`)
    baseSha = git(repo.clone, 'rev-parse', repo.base)
  }
  git(repo.clone, 'worktree', 'add', '-b', branch, wt, baseSha)
  // при нескольких вариантах поля задачи заполняет победитель, а не последний стартовавший
  if (!variant) setStatus(task.id, 'running', { branch, worktree: wt, base_sha: baseSha })
  return { wt, branch, baseSha }
}

function prompt (task, repo) {
  const c = repo.cfg
  const lessons = lessonsFor(task.repo)
  return [
    `# ${task.key}: ${task.title}`, '',
    task.body || '', '',
    // ЗАПОВЕДИ владельца идут первыми и отдельно от уроков: уроки агенты вывели сами и могут
    // ошибаться, а это — прямое слово хозяина продукта, и оно не обсуждается.
    (c.rules || []).length ? ['## Правила владельца — соблюдать всегда',
      ...c.rules.map(r => `- ${r}`), ''].join('\n') : '',
    // Опыт прошлых агентов в ЭТОМ репозитории. Подаётся как знание о месте, а не как приказ:
    // урок мог устареть, и слепое следование ему хуже, чем его отсутствие.
    lessons.length ? ['## Что уже знают про этот репозиторий',
      'Это выжимки прошлых агентов. Считай их подсказками, а не законом — если код говорит другое, верь коду.',
      ...lessons.map(l => `- ${l}`), ''].join('\n') : '',
    '## Правила выполнения',
    '- Ты работаешь в изолированном git-воркспейсе. Меняй только файлы в текущем каталоге.',
    c.protected.length ? `- НЕ ТРОГАЙ эти пути: ${c.protected.join(', ')}` : '',
    c.validation.length ? `- Перед коммитом прогони проверки: ${c.validation.join(' && ')}` : '',
    `- Закончи работу ОДНИМ коммитом: git commit -am "${task.key}: <что сделано>"`,
    '- Если задача невыполнима — не коммить ничего и объясни причину текстом.', '',
    '## Факты о мире',
    'Ты можешь проверить КОД — прочитав его. Ты не можешь проверить МИР: закон, ставку налога,',
    'реквизиты, цену поставщика, срок действия документа, чужой договор.',
    'Правило простое: не можешь сослаться на источник ВНУТРИ этого репозитория — не пиши это',
    'как факт. Ни в коде, ни в комментарии, ни в документации.',
    'Оставь пометку как была и спроси владельца маркером ВОПРОС (см. ниже).',
    'Замер 20.08: агент на такой задаче сочинил закон с номером и датой вместо честного TODO.',
    'Тесты этого не ловят — выдуманный закон проходит их ровно так же, как настоящий,',
    'а бухгалтер потом читает твою выдумку как проверенный факт.',
    'Честное «не знаю» стоит владельцу одного вопроса. Уверенная неправда — денег и доверия.', '',
    '## Когда решать не тебе',
    'Упёрся в развилку, которую должен решить ВЛАДЕЛЕЦ бизнеса, а не исполнитель —',
    'несовместимые варианты поведения, удаление чужих данных, смена внешнего договора,',
    'цена или условия для клиента, НЕИЗВЕСТНЫЙ ТЕБЕ ФАКТ О МИРЕ, — НЕ ГАДАЙ и не выбирай «на свой вкус».',
    'Останови работу и последней строкой ответа напиши ровно так:',
    'ВОПРОС: <один вопрос простыми словами, с вариантами, если они есть>',
    'Тебя спросят и вернут ответ в эту же сессию — контекст не потеряется.',
    'Это не поражение и не повод откладывать выполнимое: сделай всё, что не зависит от ответа,',
    'закоммить сделанное и только потом спроси. Вопрос ради вопроса дороже разумного допущения —',
    'спрашивай только там, где ошибка стоит владельцу денег или доверия клиентов.'
  ].filter(Boolean).join('\n')
}

// Хвост файла построчно: лог агента растёт неограниченно, читать целиком нельзя.
function tailLines (file, bytes = 3e6) {
  try {
    const size = fs.statSync(file).size
    const fd = fs.openSync(file, 'r')
    const buf = Buffer.alloc(Math.min(size, bytes))
    fs.readSync(fd, buf, 0, buf.length, Math.max(0, size - buf.length))
    fs.closeSync(fd)
    return buf.toString('utf8').split('\n').filter(Boolean)
  } catch { return [] }
}

// На таймауте процесс убит до того, как успел напечатать финальную строку result — сессию
// неоткуда взять с хвоста лога. Но она известна с самого начала: она приходит первой строкой
// (type=system, subtype=init), задолго до убийства. Читаем только голову файла, не весь лог.
function headSession (dir) {
  try {
    const fd = fs.openSync(path.join(dir, 'stdout.log'), 'r')
    const buf = Buffer.alloc(8192)
    const n = fs.readSync(fd, buf, 0, buf.length, 0)
    fs.closeSync(fd)
    const line = buf.toString('utf8', 0, n).split('\n')[0]
    const j = JSON.parse(parseLogLine(line).text)
    return j.type === 'system' && j.subtype === 'init' ? j.session_id : null
  } catch { return null }
}

// Одна строка stdout.log — старый формат (голый JSON события) или новый (`<epoch мс>\t<JSON>`).
// Единственное место, которое знает оба вида: liveFeed, разбор итоговой строки и agentSaid все проходят через неё.
function parseLogLine (line) {
  const m = /^(\d+)\t([\s\S]*)$/.exec(line)
  return m ? { ts: Number(m[1]), text: m[2] } : { ts: null, text: line }
}

// Поток агента человеческим языком: владелец не должен читать JSON и имена инструментов.
const TOOL_WORDS = {
  Read: f => `читает ${short(f.file_path)}`,
  Edit: f => `правит ${short(f.file_path)}`,
  Write: f => `пишет ${short(f.file_path)}`,
  NotebookEdit: f => `правит ${short(f.notebook_path)}`,
  Bash: f => `выполняет: ${String(f.command || '').slice(0, 90)}`,
  Grep: f => `ищет «${f.pattern}»`,
  Glob: f => `ищет файлы ${f.pattern}`,
  TodoWrite: () => 'намечает шаги',
  Task: f => `поднимает помощника: ${String(f.description || '').slice(0, 60)}`,
  WebFetch: f => `смотрит ${String(f.url || '').slice(0, 60)}`,
  WebSearch: f => `ищет в вебе: ${f.query}`
}
const short = p => String(p || '').split('/').slice(-2).join('/')

function liveFeed (dir, limit = 40) {
  const out = []
  for (const line of tailLines(path.join(dir, 'stdout.log'))) {
    const { ts, text } = parseLogLine(line)
    let e; try { e = JSON.parse(text) } catch { continue }
    if (e.type === 'assistant') {
      for (const c of e.message?.content || []) {
        if (c.type === 'tool_use') {
          const w = TOOL_WORDS[c.name]
          out.push({ kind: 'do', text: w ? w(c.input || {}) : `${c.name}`, ts })
        } else if (c.type === 'text' && c.text?.trim()) {
          out.push({ kind: 'say', text: c.text.trim().replace(/\s+/g, ' ').slice(0, 300), ts })
        }
      }
    } else if (e.type === 'result') {
      out.push({ kind: e.subtype === 'success' ? 'ok' : 'bad', text: e.subtype === 'success' ? 'работа закончена' : `остановился: ${e.subtype}`, ts })
    }
  }
  return out.slice(-limit)
}

// Дифф задачи. У влитой воркспейса уже нет — тогда читаем сам мердж-коммит в клоне:
// иначе принятая работа выглядит так, будто агент ничего не менял.
function taskDiff (t, cap = 200000) {
  try {
    if (t.worktree && fs.existsSync(t.worktree)) {
      // у работающей задачи коммитов ещё нет — показываем, что агент трогает ПРЯМО СЕЙЧАС,
      // иначе «Дифф» на живом агенте отвечает пустотой и выглядит поломкой
      const done = git(t.worktree, 'diff', `${t.base_sha}..HEAD`)
      const live = git(t.worktree, 'diff')
      const untracked = git(t.worktree, 'status', '--porcelain').split('\n').filter(l => l.startsWith('??')).map(l => '+ новый файл: ' + l.slice(3)).join('\n')
      const parts = [done, live && `# ещё не закоммичено агентом:\n${live}`, untracked].filter(Boolean)
      return (parts.join('\n') || 'агент пока ничего не изменил').slice(0, cap)
    }
    if (t.merge_sha) {
      const clone = q1('SELECT clone FROM repos WHERE name=?', t.repo)?.clone
      if (clone && fs.existsSync(clone)) return git(clone, 'diff', `${t.merge_sha}^1..${t.merge_sha}`).slice(0, cap)
    }
    return 'воркспейс уже убран'
  } catch (e) { return e.message }
}

// Доработка вместо перезапуска: агент продолжает СВОЮ сессию, помня что уже сделал.
const fixPrompt = (task, bad) => [
  'Проверки после твоей работы не прошли. Почини причину.',
  'Не подгоняй тесты под сломанный код и не отключай их.', '',
  bad, '',
  // Живой прогон 18.08: получив красные тесты, агент написал ВОПРОС владельцу («в этой ветке
  // падало или в другом окружении?») вместо разбора. Красные тесты — не развилка владельца,
  // а работа исполнителя, и оставлять здесь дверь «спросить» значит поощрять увиливание.
  'ЗДЕСЬ СПРАШИВАТЬ НЕЧЕГО: это твоя работа, а не решение владельца. Маркер ВОПРОС на этом шаге',
  'не действует. Разберись сам; если починить действительно нельзя — объясни текстом, почему.', '',
  `Когда починишь — снова закоммить: git commit -am "${task.key}: <что исправлено>"`
].join('\n')

// ---------- глаза: как это ВЫГЛЯДИТ ----------
// Тесты отвечают «работает», но не отвечают «красиво ли». Для сайта это главный вопрос, и
// решать его владелец должен глазами, а не по диффу. Снимаем страницу до и после работы.
// Включается в conveyor.json: "preview": {"cmd": "npm run dev", "url": "http://localhost:5173"}
const SHOTS = path.join(ROOT, 'shots')
fs.mkdirSync(SHOTS, { recursive: true })

// why(...) — потому что молчаливый провал съёмки неотличим от «превью не настроено».
// Эту ошибку я допустил трижды за два дня (приёмка, память, глаза): любой путь с тихим
// возвратом null обязан говорить, ПОЧЕМУ он ничего не вернул.
async function screenshot (repo, wt, out, why = () => {}) {
  const p = repo.cfg.preview
  if (!p?.cmd || !p?.url) return null
  if (!fs.existsSync('/Applications/Google Chrome.app')) { why('нет Google Chrome — снимать нечем'); return null }
  const server = spawn('sh', ['-c', p.cmd], { cwd: wt, detached: true, stdio: 'ignore' })
  try {
    // ждём, пока сервер ответит: фиксированная пауза врёт в обе стороны — на быстром проекте
    // ждём зря, на медленном снимаем пустую страницу и объявляем её вёрсткой
    const till = Date.now() + (p.wait_s || 40) * 1000
    let up = false
    while (Date.now() < till) {
      if ((await shell(`curl -sS -o /dev/null -m 3 ${JSON.stringify(p.url)}`, wt, 8000)).code === 0) { up = true; break }
      await new Promise(r => setTimeout(r, 1500))
    }
    if (!up) { why(`превью не поднялось за ${p.wait_s || 40} с: «${p.cmd}» не ответило на ${p.url}`); return null }
    await new Promise(r => setTimeout(r, (p.settle_s || 3) * 1000)) // дать дорисоваться
    const r = await shell(`'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' --headless=new --disable-gpu \
      --screenshot=${JSON.stringify(out)} --window-size=${p.width || 1440},${p.height || 900} ${JSON.stringify(p.url)}`, wt, 90000)
    if (r.code !== 0 || !fs.existsSync(out)) { why(`Chrome не снял страницу: ${String(r.out).slice(-200)}`); return null }
    return out
  } finally {
    try { process.kill(-server.pid, 'SIGKILL') } catch { try { server.kill('SIGKILL') } catch {} }
  }
}

// Визуальный критик: смотрит НА КАРТИНКУ, а не на дифф. Ловит то, чего не видит ни один тест —
// разъехавшуюся вёрстку, пропавший блок, нечитаемый текст.
function lookCritic (task, before, after) {
  const files = [after, before].filter(Boolean)
  if (!files.length) return Promise.resolve(null)
  const ask = [
    `Задача была: ${task.title}`, '',
    // Файлы называем ЯВНО: без этого агент не знает, что смотреть, и отвечает про пустоту
    `Открой инструментом Read: ${files.map(f => path.basename(f)).join(' и ')}`,
    before ? `«${path.basename(after)}» — страница ПОСЛЕ работы, «${path.basename(before)}» — ДО неё. Сравни.` : 'Это страница после работы.',
    'Ищи ТОЛЬКО грубое: вёрстка разъехалась, блок пропал или наехал на другой,',
    'текст нечитаем, пустая страница, ошибка вместо содержимого.',
    'Вкус, цвета и «мне бы иначе» — не твоё дело.', '',
    'Ответь ОДНОЙ строкой: либо ОК, либо СТОП: <что именно сломано>.'
  ].join('\n')
  return new Promise(resolve => {
    const out = []
    const args = ['-p', ask, '--output-format', 'json', '--model', 'sonnet', '--allowedTools', 'Read']
    const child = spawn('claude', args, { cwd: path.dirname(files[0]), stdio: ['ignore', 'pipe', 'ignore'] })
    child.on('error', () => resolve(null))
    const timer = setTimeout(() => { try { child.kill('SIGKILL') } catch {} ; resolve(null) }, 180000)
    child.stdout.on('data', c => out.push(c))
    child.on('exit', () => {
      clearTimeout(timer)
      try {
        const t = String(JSON.parse(out.join('')).result || '').trim()
        resolve(/^стоп/i.test(t) ? `REVIEW: глазами видно — ${t.replace(/^стоп:?\s*/i, '')}` : null)
      } catch { resolve(null) }
    })
  })
}

// ---------- память репозитория ----------
// Каждый агент приходит в репозиторий ВПЕРВЫЕ и наступает на те же грабли, что и вчерашний.
// После удавшейся задачи выжимаем из её работы короткий урок и подкладываем его следующим.
// Уроки — про РЕПОЗИТОРИЙ, а не про задачу: «тесты гоняются так», «эта папка генерируется».
const LESSONS_MAX = 12
const lessonsFor = repoName =>
  q('SELECT text FROM lessons WHERE repo=? ORDER BY hits DESC, id DESC LIMIT ?', repoName, LESSONS_MAX).map(l => l.text)

function rememberLesson (repoName, taskId, text) {
  const clean = String(text || '').trim().replace(/^[-*·]\s*/, '').slice(0, 220)
  if (clean.length < 12) return
  // тот же урок дважды — не знание, а шум в промпте; повтор только поднимает вес прежнего
  const same = q1('SELECT id FROM lessons WHERE repo=? AND lower(text)=lower(?)', repoName, clean)
  if (same) return run('UPDATE lessons SET hits=hits+1 WHERE id=?', same.id)
  run('INSERT INTO lessons (repo,text,task_id,created_at) VALUES (?,?,?,?)', repoName, clean, taskId, now())
  log(taskId, 'память', clean)
}

// Урок достаём отдельным дешёвым вызовом с ТЕМ ЖЕ контекстом сессии: агент только что тут
// работал и знает, обо что споткнулся. Ответ «НЕТ» — нормальный и частый исход.
function harvestLesson (task, repo, wt, session) {
  if (!session || repo.cfg.memory === false) return Promise.resolve()
  const ask = [
    'Ты только что закончил задачу в этом репозитории.',
    'Вспомни, что из УЗНАННОГО пригодится ЛЮБОМУ следующему агенту в этом же репозитории:',
    'как тут устроены тесты и сборка, какие места ломкие, где генерируемый код, чего делать нельзя.',
    '', 'НЕ пиши: что сделала твоя задача, общие советы по программированию, похвалу себе.',
    'Пиши ТОЛЬКО то, чего не видно из беглого чтения кода и что сэкономит следующему время.',
    '', 'Ответь ОДНОЙ строкой до 200 символов. Если такого знания нет — ответь ровно: НЕТ'
  ].join('\n')
  return new Promise(resolve => {
    const out = []
    const child = spawn('claude', ['-p', ask, '--output-format', 'json', '--model', 'haiku',
      '--resume', session, '--allowedTools', 'Read'], { cwd: wt, stdio: ['ignore', 'pipe', 'ignore'] })
    child.on('error', () => resolve())
    const timer = setTimeout(() => { try { child.kill('SIGKILL') } catch {} ; resolve() }, 120000)
    child.stdout.on('data', c => out.push(c))
    child.on('exit', code => {
      clearTimeout(timer)
      // Молчание и отказ обязаны звучать по-разному: «уроков нет» и «спросить не вышло» —
      // разные новости, и путать их значит однажды чинить исправное (уже проходили с приёмкой).
      let text = null
      try { text = String(JSON.parse(out.join('')).result || '').trim() } catch {}
      if (text === null) log(task.id, 'память', `спросить урок не вышло (код ${code})`)
      else if (/^нет\b/i.test(text)) log(task.id, 'память', 'агенту нечего добавить про репозиторий')
      else rememberLesson(task.repo, task.id, text.split('\n')[0])
      resolve()
    })
  })
}

// Хроника решений: почему выбран этот вариант, что сказал критик, кто нажал «принять».
// Через месяц вопрос «а почему так сделали» обязан иметь ответ.
const decide = (taskId, kind, text) =>
  run('INSERT INTO decisions (task_id,ts,kind,text) VALUES (?,?,?,?)', taskId, now(), kind, String(text).slice(0, 900))

// ---------- песочница агента ----------
// Агент работает с полными правами внутри воркспейса и НЕ МОЖЕТ писать за его пределы.
// Это единственная граница, которая не зависит от того, что написано в промпте: инъекция в
// тексте задачи (а задачи приходят из чата) упирается в ядро ОС, а не в благоразумие модели.
// Замер 18.08: агент под ней создал файл в воркспейсе и получил «operation not permitted»
// на запись в домашний каталог.
const SANDBOX_PROFILE = path.join(ROOT, 'agent.sb')
// Секретные каталоги владельца. Агент исполняет ТЕКСТ ИЗ ЧАТА — то есть чужой текст, — и
// «заодно прочитай токен и вставь его в код» обязано упираться в ядро ОС, а не в вежливость
// модели. Список закрытый и короткий: чтение вообще нужно агенту для работы, режем точечно.
const SECRET_PATHS = ['/.ssh', '/.jarvis', '/.config/conveyor', '/.aws', '/.gnupg', '/.docker',
  '/.netrc', '/.npmrc', '/.git-credentials', '/Library/Application Support/Claude']
// Связку ключей НЕ трогаем сознательно: в ней лежат учётные данные самого claude, и запрет
// чтения сломал бы агента, которого мы защищаем. Честный потолок, а не недосмотр.

function writeSandboxProfile (extra = []) {
  // Чтение режем ТОЧЕЧНО: агенту нужны системные библиотеки, node_modules и git-конфиг,
  // перечислить всё нужное заранее нельзя. Запрещаем секреты, разрешаем остальное.
  const allow = [
    '(subpath (param "WT"))', '(subpath (param "GITDIR"))',
    '(subpath "/private/tmp")', '(subpath "/private/var")', '(subpath "/dev")',
    ...['/.claude', '/.cache', '/.npm', '/.bun', '/.cargo', '/Library/Caches', '/Library/Logs']
      .map(p => `(subpath (string-append (param "HOMEDIR") "${p}"))`),
    ...extra.map(p => `(subpath "${String(p).replace(/"/g, '')}")`)
  ]
  const secrets = SECRET_PATHS.map(p => `(subpath (string-append (param "HOMEDIR") "${p}"))`)
  fs.writeFileSync(SANDBOX_PROFILE, [
    '(version 1)', '(allow default)',
    '(deny file-write*)', `(allow file-write*\n  ${allow.join('\n  ')})`,
    // секреты владельца: ни прочитать, ни перечислить
    `(deny file-read* file-read-metadata\n  ${secrets.join('\n  ')})`, ''
  ].join('\n'))
}
// Обёртка вокруг вызова агента. Нет sandbox-exec или выключено в конфиге — идём как раньше,
// но говорим об этом в лог: молча снятая защита хуже отсутствующей.
function sandboxWrap (repo, wt, args) {
  if (repo.cfg.sandbox === false) return { cmd: 'claude', args }
  if (!fs.existsSync('/usr/bin/sandbox-exec')) return { cmd: 'claude', args }
  writeSandboxProfile(repo.cfg.sandbox_write || [])
  // .git воркспейса — файл-указатель в клон; коммит пишет ТУДА, поэтому запись в .git клона
  // обязана быть разрешена, иначе агент не сможет закоммитить собственную работу.
  const gitdir = path.join(repo.clone, '.git')
  return {
    cmd: '/usr/bin/sandbox-exec',
    args: ['-f', SANDBOX_PROFILE, '-D', `WT=${wt}`, '-D', `GITDIR=${gitdir}`, '-D', `HOMEDIR=${HOME}`, 'claude', ...args]
  }
}

// Вопрос владельцу агент отдаёт МАРКЕРОМ в последнем ответе — своего канала «спросить» у
// headless-агента нет. Ищем в конце: маркер, названный по ходу рассуждений, — не вопрос,
// а упоминание правила. Пустой вопрос отбрасываем: карточка «агент спросил: » бесполезна.
function askedOwner (text) {
  const lines = String(text || '').split('\n').map(l => l.trim()).filter(Boolean)
  for (const l of lines.slice(-4)) {
    const m = l.match(/^\**ВОПРОС:\**\s*(.+)$/)
    if (m && m[1].trim().length > 3) return m[1].trim().slice(0, 900)
  }
  return null
}

// Слово владельца агенту. Одно и то же и для ответа на вопрос, и для доработки: с точки зрения
// сессии это одно событие — хозяин работы сказал, что делать дальше.
const notePrompt = (task, note) => [
  'Владелец посмотрел работу и написал тебе:', '', note, '',
  'Сделай то, о чём он просит. Если это ответ на твой вопрос — продолжай работу с учётом ответа.',
  'Не переделывай то, чего он не просил, и не откатывай уже сделанное без его слова.',
  `Когда закончишь — закоммить: git commit -am "${task.key}: <что изменено по просьбе владельца>"`
].join('\n')

// WAVE2 3.3: живые заходы агентов по id задачи. Слово владельца во время 'running' идёт сюда:
// тот же WIP-коммит и SIGTERM, что и у таймаута, а продолжение — через ownerSays и --resume.
const liveAgents = new Map()

async function runAgent (task, repo, wt, opts = {}) {
  const round = opts.round || 1
  // попытка входит в имя: иначе вторая попытка затирает логи первой, и разбираться потом не по чему
  const dir = path.join(RUNS, `${task.key}${opts.variant || ''}-п${task.attempts || 1}-${round}`)
  fs.mkdirSync(dir, { recursive: true })
  const text = opts.note ? notePrompt(task, opts.note)
    : opts.feedback ? fixPrompt(task, opts.feedback)
      : prompt(task, repo)
  fs.writeFileSync(path.join(dir, 'PROMPT.md'), text)
  const outFd = fs.openSync(path.join(dir, 'stdout.log'), 'w')
  const err = fs.openSync(path.join(dir, 'stderr.log'), 'w')
  // Потоковый формат: агент пишет события ПО ХОДУ работы, а не один ответ в конце.
  // Только так видно, чем он занят прямо сейчас. --verbose обязателен, CLI иначе отказывается.
  // Задание идёт агенту через stdin, а НЕ аргументом: длинный текст в командной строке виден всем через ps,
  // и чужой pkill -f по любому слову из задания (06.09: «smoke») убивал соседних агентов.
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'bypassPermissions']
  const model = task.model || repo.cfg.model
  if (model) args.push('--model', model)
  if (task.effort) args.push('--effort', task.effort)
  if (repo.cfg.max_cost_usd) args.push('--max-budget-usd', String(repo.cfg.max_cost_usd))
  if (opts.resume) args.push('--resume', opts.resume)
  // ВТОРОЙ МОЗГ: вариант «-b» решает другой движок (codex), если он на машине есть и включён.
  // Смысл не в экономии, а в разнообразии: две модели ошибаются по-разному, и выбор лучшего
  // из двух РАЗНЫХ решений сильнее выбора из двух похожих. Ни один облачный сервис так не умеет —
  // они заперты в своей модели.
  // !SANDBOX обязателен: в самотесте PATH настоящий, и вариант Б позвал бы ЖИВОЙ codex —
  // самотест обязан оставаться бесплатным и офлайновым.
  const rival = !SANDBOX && opts.variant === '-b' && repo.cfg.rival !== false && !opts.resume &&
    (await shell('command -v codex', wt, 8000)).code === 0
  const box = rival
    ? { cmd: 'codex', args: ['exec', '--sandbox', 'workspace-write', '--skip-git-repo-check', text] }
    : sandboxWrap(repo, wt, args)
  if (rival) log(task.id, 'agent', 'вариант Б решает другой движок — codex')
  const promptFd = rival ? 'ignore' : fs.openSync(path.join(dir, 'PROMPT.md'), 'r')
  const child = spawn(box.cmd, box.args, { cwd: wt, detached: true, stdio: [promptFd, 'pipe', err] })
  if (promptFd !== 'ignore') child.on('spawn', () => { try { fs.closeSync(promptFd) } catch {} })
  // Время в ленте: сам агент часов не пишет — метка ставится тут, построчно, при получении демоном.
  // readline режет поток по строкам и сам чинит многобайтовые символы, порванные на границе чанков.
  // stdout.log хранит и старый формат (голый JSON), и новый (`<epoch мс>\t<JSON>`) — parseLogLine знает оба.
  readline.createInterface({ input: child.stdout }).on('line', l => { if (l) fs.writeSync(outFd, `${now()}\t${l}\n`) })
  const runId = run('INSERT INTO runs (task_id, pid, started_at, log, round) VALUES (?,?,?,?,?)',
    task.id, child.pid, now(), dir, round).lastInsertRowid
  log(task.id, 'agent', `${opts.resume ? 'доработка' : 'запуск'} ${round}: pid ${child.pid}${model ? ', модель ' + model : ''}`)

  return new Promise(resolve => {
    // Без этого обработчика пропавший бинарь claude вешает задачу НАВСЕГДА:
    // 'error' летит вместо 'exit', промис не разрешается, слот занят до конца жизни демона.
    child.on('error', e => {
      run('UPDATE runs SET ended_at=?, exit_code=-1 WHERE id=?', now(), runId)
      resolve({ code: -1, dir, cost: 0, startFailed: e.message })
    })
    const kill = sig => { try { process.kill(-child.pid, sig) } catch {} }
    // Раньше здесь стоял жёсткий AGENT_TIMEOUT_MS без учёта conveyor.json — правка timeout_min
    // 16.09 не подействовала на уже решавшую задачу Z7 (эпики/волны), она снова упёрлась в 45 мин
    // и потеряла попытку. Читаем per-repo потолок здесь же, как и остальные repo.cfg.*.
    const timeoutMs = (Number(repo.cfg.timeout_min) || AGENT_TIMEOUT_MS / 60000) * 60000
    let timedOut = false
    let interrupted = null
    // Мягкая посадка ДО убийства: чистый перезапуск (prepare()) сносит воркспейс с нуля,
    // а несохранённый дифф внутри него мог быть ценной работой (WAVE1 3.3).
    const land = (kind, msg) => {
      try {
        if (git(wt, 'status', '--porcelain')) {
          git(wt, 'add', '-A')
          git(wt, 'commit', '-m', msg)
          log(task.id, kind, 'незакоммиченная работа сохранена WIP-коммитом')
        }
      } catch (e) { log(task.id, kind, `WIP-коммит не удался: ${e.message}`) }
      kill('SIGTERM'); setTimeout(() => kill('SIGKILL'), 10000)
    }
    const timer = setTimeout(() => {
      timedOut = true
      log(task.id, 'timeout', `агент превысил ${timeoutMs / 60000} мин — убиваю`)
      land('timeout', 'WIP: таймаут захода, продолжение в следующей попытке')
    }, timeoutMs)
    const interrupt = note => {
      if (interrupted || timedOut) return false
      interrupted = note
      log(task.id, 'владелец', 'прерываю заход: продолжит с твоим словом')
      land('владелец', 'WIP: владелец прервал заход, продолжение с его словом')
      return true
    }
    liveAgents.set(task.id, interrupt)
    // 'close', не 'exit': на пайпе строки stdout ещё могут лежать в очереди 'data', когда
    // процесс уже вышел — 'close' ждёт, пока поток отдаст всё и дойдёт до 'end'.
    child.on('close', code => {
      clearTimeout(timer); fs.closeSync(outFd); fs.closeSync(err)
      if (liveAgents.get(task.id) === interrupt) liveAgents.delete(task.id)
      // итог — последняя строка потока с type=result; читаем хвостом, лог может быть огромным
      const j = tailLines(path.join(dir, 'stdout.log')).reverse()
        .map(l => { try { return JSON.parse(parseLogLine(l).text) } catch { return null } })
        .find(e => e && e.type === 'result') || {}
      const cost = j.total_cost_usd || 0
      // На таймауте строки result не будет: сессию берём из первой строки лога (headSession),
      // она известна с самого начала запуска, а не только по его завершении.
      const session = j.session_id || (timedOut || interrupted ? headSession(dir) : null)
      run('UPDATE runs SET ended_at=?, exit_code=?, cost=?, turns=?, session=? WHERE id=?',
        now(), code, cost, j.num_turns || 0, session || null, runId)
      // упёрся в потолок расхода — это не провал работы, а нехватка топлива: повторять бессмысленно
      resolve({
        code, dir, cost, session, turns: j.num_turns, timedOut, interrupted,
        broke: j.subtype === 'error_max_budget_usd', ask: askedOwner(j.result)
      })
    })
  })
}

// Фирменные формы ключей. Общего «api_key = ...» тут нет НАМЕРЕННО: половина кода мира
// содержит такую строку в примерах и тестах, и ложный стоп на каждой второй задаче быстрее
// научит владельца жать «принять не глядя», чем защитит его. Ловим то, что ни с чем не спутать.
const SECRET_FORMS = [
  [/sk-ant-[A-Za-z0-9_-]{20,}/, 'ключ Anthropic'],
  [/sk-[A-Za-z0-9]{32,}/, 'ключ OpenAI'],
  [/ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/, 'токен GitHub'],
  [/AKIA[0-9A-Z]{16}/, 'ключ AWS'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'приватный ключ'],
  [/\b\d{8,10}:[A-Za-z0-9_-]{35}\b/, 'токен телеграм-бота'],
  [/ATATT[A-Za-z0-9_\-=]{20,}/, 'токен Jira'],
  [/xox[baprs]-[A-Za-z0-9-]{10,}/, 'токен Slack']
]
// УТВЕРЖДЕНИЯ О МИРЕ. Найдено живым замером 20.08: агент, которому велели «не выдумывай»,
// закрыл бухгалтерский TODO ссылкой на несуществующий «Закон КБР от 21.06.2024 №17-РЗ».
// Код проверяется тестами, а утверждение о законе или ставке — ничем: агент не мог его
// сверить, а выглядит оно увереннее прежнего честного TODO. Такое решает владелец.
// ВНИМАНИЕ на \b: в JavaScript граница слова знает только латиницу, и «№17-РЗ\b» не совпадает
// никогда — на этом шаблон молча не срабатывал. Для кириллицы граница пишется через \p{L} и
// флаг u, либо не пишется вовсе.
const CLAIM_FORMS = [
  [/№\s?\d+\s?[-–]\s?(ФЗ|РЗ|ПП|ЗРК)/iu, 'ссылка на закон'],
  [/(^|[^\p{L}])ст(атья|\.)\s?\d+/iu, 'ссылка на статью закона'],
  [/(НК|ГК|ТК|КоАП)\s?РФ/iu, 'ссылка на кодекс'],
  [/(ГОСТ|СанПиН|СНиП|ОКВЭД)/iu, 'ссылка на норматив'],
  [/(ИНН|ОГРН|ОГРНИП|БИК|КПП)\s*[:=]?\s*\d/iu, 'реквизиты организации'],
  [/(ставк|тариф)\p{L}*[^\n]{0,40}\d+([.,]\d+)?\s?%/iu, 'налоговая или тарифная ставка']
]
// Строка, В КОТОРОЙ агент сам признаётся, что не знает, — это не утверждение о мире, а честная
// пометка. Ловить её гейтом значит наказывать за ровно то поведение, которого мы добивались,
// и учить владельца жать «принять» не глядя. Поймано живьём 21.08: агент по просьбе владельца
// оставил TODO «ставка источником не подтверждена», а гейт зацепился за слова НК РФ и ОКВЭД
// внутри самого признания.
const ADMITS = /TODO|FIXME|не подтвержд|не удалось|уточнить|неизвестн|проверить|нужно сверить|\?\?\?/i

function claimsIn (diff) {
  const lines = String(diff).split('\n')
  const added = lines.filter(l => l.startsWith('+') && !l.startsWith('+++'))
    .filter(l => !ADMITS.test(l)).join('\n')
  // Всё, что БЫЛО вокруг: удалённые строки и неизменённый контекст. Если такая же ссылка уже
  // жила в этом месте файла, агент её не выдумал, а переписал — это не новое утверждение о
  // мире. Иначе гейт срабатывал на переформулировке соседней строки (случай 21.08).
  const было = lines.filter(l => l.startsWith('-') || l.startsWith(' ')).join('\n')
  const hits = CLAIM_FORMS.filter(([re]) => re.test(added) && !re.test(было)).map(([, n]) => n)
  return hits.length ? [...new Set(hits)].join(', ') : null
}

function secretsIn (diff) {
  // смотрим ТОЛЬКО добавленные строки: то, что и так лежало в репозитории, — не наша утечка
  const added = String(diff).split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).join('\n')
  for (const [re, name] of SECRET_FORMS) if (re.test(added)) return name
  return null
}

// Гейты. Возвращает null если всё чисто, иначе причину отказа.
async function validate (task, repo, wt, baseSha = task.base_sha) {
  const dirty = git(wt, 'status', '--porcelain')
  if (dirty) { // агент не закоммитил — коммитим сами, иначе работа пропадёт
    git(wt, 'add', '-A'); git(wt, 'commit', '-m', `${task.key}: ${task.title}`)
    log(task.id, 'gate', 'агент не закоммитил — коммит сделан конвейером')
  }
  const commits = git(wt, 'rev-list', '--count', `${baseSha}..HEAD`)
  if (commits === '0') return 'агент не сделал ни одного коммита'

  // Секрет, уехавший в ветку, обратно не отзовёшь: его надо считать утёкшим и менять.
  // Проверка ДЕТЕРМИНИРОВАННАЯ, а не «критик заметит»: критик — модель, он думает, а не гарантирует.
  const fullDiff = git(wt, 'diff', `${baseSha}..HEAD`)
  // Секрет ищем по ВСЕЙ серии коммитов ветки, а не по итоговому диффу. Поймано самотестом
  // 21.08: ключ, добавленный одним коммитом и убранный следующим, из итогового диффа исчезает,
  // но остаётся в ИСТОРИИ — и мердж вносит его в основную ветку навсегда. «Убрали потом» не
  // лечит утечку: чтобы её не было, коммита с ключом не должно быть вовсе.
  const series = git(wt, 'log', '-p', '--no-color', `${baseSha}..HEAD`).slice(0, 2000000)
  const leak = secretsIn(series)
  if (leak) return `REVIEW: в изменениях похоже на секрет — ${leak}. Проверь сам: влитый ключ придётся менять, а не «убирать»`
  // Проверять факты о мире умеешь только ты: у агента нет доступа ни к реестру законов, ни к
  // твоей бухгалтерии. Тесты тут бесполезны — выдуманный закон проходит их так же, как настоящий.
  const claim = repo.cfg.check_claims === false ? null : claimsIn(fullDiff)
  if (claim) return `REVIEW: агент добавил утверждение о мире (${claim}) — этого он проверить не мог. Сверь сам: неправда, поданная уверенно, хуже честного «не знаю»`

  const changed = git(wt, 'diff', '--name-only', `${baseSha}..HEAD`).split('\n').filter(Boolean)
  const hit = changed.filter(f => repo.cfg.protected.some(p => f === p || f.startsWith(p.replace(/\/?$/, '/'))))
  if (hit.length) return `REVIEW: тронуты защищённые пути: ${hit.join(', ')}`

  for (const cmd of repo.cfg.validation) {
    let r = await shell(cmd, wt)
    if (r.code !== 0) {
      // Упал браузерный тест — у него есть КАДР момента падения. Строка из лога говорит
      // «expect failed», кадр показывает, что именно увидел гость. Шлём кадр владельцу.
      if (repo.cfg.e2e_shots) tgFailShots(task, path.join(wt, repo.cfg.e2e_shots))
      // Плавающие тесты — чужая беда, но платил за неё агент: под нагрузкой от параллельных агентов
      // падают тайминг-зависимые тесты. Второй прогон бесплатен по токенам и снимает этот налог.
      const second = await shell(cmd, wt)
      if (second.code === 0) { log(task.id, 'флак', `«${cmd}» упала и прошла со второго раза — считаю плавающей`); continue }
      r = second
      return `проверка «${cmd}» упала дважды подряд:\n${r.out.slice(-2000)}`
    }
  }
  return null
}

// execFileSync блокировал единственный поток Node на всё время команды — гейт (5–20 мин)
// вешал и HTTP-сервер дашборда, и приём новых задач. spawn + Promise не держит поток:
// пока эта команда идёт, /api/state и остальные запросы отвечают как обычно.
function shell (cmd, cwd, timeout = 20 * 60 * 1000) {
  return new Promise(resolve => {
    const cap = 32e6
    let outBuf = ''; let errBuf = ''; let killed = false
    const child = spawn('sh', ['-c', cmd], { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    child.stdout.on('data', d => { if (outBuf.length < cap) outBuf += d })
    child.stderr.on('data', d => { if (errBuf.length < cap) errBuf += d })
    const timer = setTimeout(() => { killed = true; child.kill('SIGTERM') }, timeout)
    child.on('error', e => { clearTimeout(timer); resolve({ code: 1, out: outBuf + errBuf + e.message, killed: false }) })
    child.on('close', code => {
      clearTimeout(timer)
      if (killed) return resolve({ code: code ?? 1, out: `команда не уложилась в ${Math.round(timeout / 60000)} мин и была прервана`, killed: true })
      resolve(code === 0 ? { code: 0, out: outBuf, killed: false } : { code, out: outBuf + errBuf, killed: false })
    })
  })
}

// «exit -1» владельцу не говорит ничего. Разбираем хвост stderr и называем причину словами:
// список закрытый и короткий — незнакомое показываем как есть, выдумывать диагноз нельзя.
const EXIT_HINTS = [
  [/command not found: ?(\S+)|(\S+): command not found/i, m => `на машине нет команды «${m[1] || m[2]}»`],
  [/OAuth session expired|Failed to authenticate|Invalid API key|run \/login/i,
    () => 'сессия claude истекла — задача не виновата: залогинься (claude → /login) и запусти её заново'],
  [/ENOSPC|no space left/i, () => 'на диске кончилось место'],
  [/EACCES|permission denied/i, () => 'отказано в доступе к файлу'],
  [/operation not permitted/i, () => 'песочница не пустила агента за пределы воркспейса (это защита, а не поломка)'],
  [/ENOMEM|out of memory|JavaScript heap/i, () => 'кончилась память'],
  [/ENOTFOUND|ECONNREFUSED|network|getaddrinfo/i, () => 'не было сети'],
  [/rate.?limit|429/i, () => 'упёрлись в ограничение модели по частоте'],
  [/invalid api key|authentication|401/i, () => 'claude не авторизован — проверь вход в CLI']
]
// claude сообщает фатальную причину JSON'ом в stdout, а stderr при этом остаётся ПУСТ.
// BAV-6 (18.08) встала с «агент не доработал: код 1» без единого слова объяснения, хотя в
// stdout лежало «Failed to authenticate: OAuth session expired» — владелец видел вину агента
// вместо своей протухшей сессии. Ищем причину там, где она есть, а не только в stderr.
function agentSaid (dir) {
  const out = tailLines(path.join(dir, 'stdout.log'), 20000).slice(-5).map(l => parseLogLine(l).text).join('\n')
  const m = out.match(/"result"\s*:\s*"((?:[^"\\]|\\.)*)"/)
  return m ? m[1].replace(/\\n/g, ' ') : ''
}

// Лимит подписки Claude — не вина задачи и не повод сжигать попытки: всё окно квоты закрыто до сброса.
// Читаем хвост вывода агента; если это лимит — конвейер встаёт на паузу до указанного времени и возвращает задачу в очередь.
const LIMIT_RE = /hit your \w+ limit|(session|usage|weekly|monthly|daily) limit|usage credits|out of credits|rate limit|limit reached|too many requests|overloaded|upgrade to continue|resets? (at|on|Sep|Oct|Nov|Dec|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug)/i
// Протухшая сессия claude — беда окружения, а не задачи: 07.09 двенадцать задач подряд легли в failed
// за две минуты, доска встала на Blocked, и завод простоял восемь часов на пустом месте.
const AUTH_RE = /OAuth session expired|Failed to authenticate|Invalid API key|run \/login|сессия claude истекла/i
function limitHit (dir) {
  const tail = [tailLines(path.join(dir, 'stderr.log'), 20000).slice(-40).join('\n'), agentSaid(dir)].join('\n')
  if (AUTH_RE.test(tail)) return { until: Date.now() + 10 * 60000, text: 'сессия claude истекла — жду и пробую снова' }
  if (!LIMIT_RE.test(tail)) return null
  const m = tail.match(/resets?\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
  let until = Date.now() + 60 * 60000
  if (m) {
    let h = Number(m[1]) % 12; if ((m[3] || '').toLowerCase() === 'pm') h += 12; if (!m[3] && Number(m[1]) === 24) h = 0
    const d = new Date(); d.setHours(h, Number(m[2] || 0), 0, 0); if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1)
    until = d.getTime() + 60000
  }
  return { until, text: (tail.match(/[^\n]*limit[^\n]*/i) || [''])[0].trim().slice(0, 160) }
}
let limitTold = 0
function pauseForLimit (task, repo, lim) {
  set('paused_until', String(lim.until))
  if (task.source === 'nol' && task.source_ref) nolUpdate(task.source_ref, 'Queued', `Пауза: ${lim.text || 'лимит'}. Задача вернётся в работу сама.`)
  const when = new Date(lim.until).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  try { cleanup(task, repo) } catch {}
  run('UPDATE tasks SET attempts = MAX(attempts - 1, 0) WHERE id=?', task.id)
  setStatus(task.id, 'queued', { error: `лимит подписки Claude — пауза до ${when}` })
  log(task.id, 'лимит', `${lim.text || 'лимит подписки'} → пауза до ${when}, задача вернётся в очередь сама`)
  if (limitTold !== lim.until) { limitTold = lim.until; notify('Конвейер: лимит подписки Claude', `Агенты ждут до ${when}. Задачи в очереди, ничего не потеряно.`) }
}
function explainExit (code, dir) {
  const tail = tailLines(path.join(dir, 'stderr.log'), 20000).slice(-40).join('\n') || agentSaid(dir)
  for (const [re, say] of EXIT_HINTS) { const m = tail.match(re); if (m) return say(m) }
  return tail ? `код ${code}; последнее из вывода: ${tail.slice(-300)}` : `код ${code}`
}

// Агент-критик: свежий взгляд на дифф перед мерджем. Тесты ловят «не работает», критик — «работает не то».
// Дешёвая модель, доступ только на чтение, ответ — одна строка.
async function critic (task, repo, wt) {
  if (!repo.cfg.critic) return null
  const diff = git(wt, 'diff', `${task.base_sha}..HEAD`)
  if (!diff) return null
  if (diff.length > 60000) return null // слишком большой дифф критику не по зубам — пропускаем, гейт остаётся на тестах
  const ask = [
    `Задача была: ${task.title}`, '',
    'Ниже дифф, который агент предлагает влить в основную ветку. Тесты уже зелёные.',
    'Найди ТОЛЬКО серьёзное: задача решена не тем способом, потеряна функциональность,',
    'сломана безопасность, тесты подогнаны под код, оставлен мусор или заглушки.',
    'Стиль и вкусовщину игнорируй.', '',
    'ОБЛАСТЬ: оценивай ТОЛЬКО строки, добавленные и удалённые в этом диффе.',
    'Код, который задача не трогала, — не твоё дело, даже если он кажется тебе кривым:',
    'за него отвечают тесты, и они уже зелёные. Претензия к нетронутому файлу = ложный стоп.',
    'ПРОВЕРКА: у тебя есть Read — прежде чем возражать, ОТКРОЙ файл и убедись, что он и правда такой.',
    'Не рассуждай о «типичных паттернах»: типичное поведение кода ничего не доказывает про этот код.',
    'Сомневаешься или не смог проверить — отвечай ОК. Ложный стоп дороже пропущенной мелочи.', '',
    'Ответь ОДНОЙ строкой: либо ОК, либо СТОП: <причина с указанием файла и строки>.', '',
    '```diff', diff.slice(0, 60000), '```'
  ].join('\n')
  // Критик стоит одинаково на диффе в пять строк и в пятьсот, и на мелких задачах его доля
  // доходила до 22% расходов (замер 20.08). Правка в несколько строк — работа для дешёвой
  // модели; сложное решение остаётся у сильной. Порог явный, а не «на глаз».
  const small = diff.split('\n').filter(l => /^[+-]/.test(l) && !/^[+-]{3}/.test(l)).length <= (repo.cfg.critic_small_lines || 50)
  const model = small ? (repo.cfg.critic_model_small || 'haiku') : (repo.cfg.critic_model || 'haiku')
  const args = ['-p', ask, '--output-format', 'json', '--model', model,
    '--allowedTools', 'Read', '--permission-mode', 'acceptEdits']
  return new Promise(resolve => {
    const out = []
    const child = spawn('claude', args, { cwd: wt, stdio: ['ignore', 'pipe', 'ignore'] })
    child.on('error', () => resolve(null))
    child.stdout.on('data', c => out.push(c))
    const timer = setTimeout(() => { try { child.kill('SIGKILL') } catch {} }, 5 * 60 * 1000)
    child.on('exit', () => {
      clearTimeout(timer)
      let verdict = ''
      const raw = out.join('')
      try { const j = JSON.parse(raw); verdict = String(j.result || ''); run('UPDATE tasks SET cost=cost+? WHERE id=?', j.total_cost_usd || 0, task.id) } catch {}
      if (LIMIT_RE.test(raw) || LIMIT_RE.test(verdict)) { log(task.id, 'критик', 'критик не смог поработать: лимит подписки'); return resolve('LIMIT') }
      const stop = verdict.match(/СТОП[:\s]+(.+)/i)
      log(task.id, 'критик', `${model}: ${stop ? `СТОП: ${stop[1].slice(0, 200)}` : 'ОК'}`)
      resolve(stop ? `REVIEW: критик остановил мердж — ${stop[1].trim()}` : null)
    })
  })
}

// Мердж-очередь СВОЯ НА РЕПОЗИТОРИЙ: внутри одного строго по одному (иначе две задачи
// правят одну ветку), а разные репозитории друг друга не ждут — общая очередь заставляла
// задачу Бавуко стоять за задачей mir-os, у которых нет ни одного общего файла.
const mergeChains = new Map()
const enqueueMerge = (fn, repoName = '*') => {
  const prev = mergeChains.get(repoName) || Promise.resolve()
  const next = prev.then(fn, fn)
  mergeChains.set(repoName, next)
  return next
}

// Режим пул-реквеста: результат не вливается сам, а уезжает веткой на GitHub и ждёт ревью
// ТАМ. Для репозитория, где кроме конвейера работают люди, это единственный честный способ:
// влитое без их ведома они увидят уже в конфликте.
async function openPR (task, repo, wt) {
  git(wt, 'push', '-u', 'origin', task.branch)
  const body = `Задача конвейера ${task.key}.\n\n${task.body || ''}\n\nПроверки пройдены, критик не возражал.`
  const r = await shell(`gh pr create --base ${repo.base} --head ${task.branch} --title ${JSON.stringify(task.key + ': ' + task.title)} --body ${JSON.stringify(body)}`, wt, 120000)
  const url = (r.out.match(/https:\/\/github\.com\/\S+/) || [])[0]
  if (r.code !== 0 || !url) throw new Error(`gh pr create не прошёл: ${r.out.slice(-400)}`)
  setStatus(task.id, 'needs_review', { pr_url: url, error: `REVIEW: ждёт ревью на GitHub: ${url}` })
  log(task.id, 'PR', url)
  notify(`${task.key} — открыт пул-реквест`, url)
  const c = tgCfg()
  if (c?.owner) tgSend(c.owner, `🔀 ${task.key} — пул-реквест открыт\n${task.title}\n${url}`)
}

async function mergeTask (task, repo) {
  // отмена могла прийти, пока задача стояла в мердж-очереди: влить отменённое — худшая из возможных лжей
  if (cancelled(task.id)) return log(task.id, 'мердж', 'задача отменена, вливать не буду')
  // Строгий режим боевого репозитория: гейты пройдены, но последнее слово за владельцем.
  // Не подпись «на всякий случай», а решение владельца о СВОЁМ продукте.
  if (repo.cfg.strict && !task.owner_ok) {
    setStatus(task.id, 'needs_review', { error: 'REVIEW: строгий режим — проверки пройдены, жду твоего слова' })
    log(task.id, 'строгий режим', 'всё зелёное, но вливаю только по твоей кнопке')
    tgReview(q1('SELECT * FROM tasks WHERE id=?', task.id))
    return
  }
  if (repo.cfg.pr) {
    // Ветка уезжает на GitHub, а базовая ветка не трогается вовсе — решает ревьюер там.
    if ((await shell('command -v gh', repo.clone, 15000)).code !== 0) return fail(task, 'REVIEW: для режима пул-реквестов нужен gh CLI (brew install gh)')
    try { return await openPR(task, repo, task.worktree) } catch (e) { return fail(task, `REVIEW: ${e.message}`) }
  }
  setStatus(task.id, 'merging')
  const wt = task.worktree
  // Задача эпики вливается в свой воркспейс ветки epic/<key>, а не в клон репозитория владельца:
  // эпика попадает к нему только целиком, через finalizeEpic (ZAVOD-TZ раздел 3).
  const epic = task.epic_id ? q1('SELECT * FROM epics WHERE id=?', task.epic_id) : null
  const dir = epic ? epicWorktree(repo, epic) : repo.clone
  const targetName = epic ? epic.branch : repo.base
  if (!epic) {
    try { git(repo.clone, 'fetch', 'origin', repo.base) } catch {}
    try { git(repo.clone, 'merge', '--ff-only', `origin/${repo.base}`) } catch {}
  }
  const head = git(dir, 'rev-parse', 'HEAD')
  if (head !== task.base_sha) { // база (или волна эпики) уехала — пересаживаем ветку и перепроверяем
    log(task.id, 'merge', `${targetName} сдвинулась — rebase и повторные проверки`)
    try { git(wt, 'rebase', head) } catch (e) {
     try {
      try { git(wt, 'rebase', '--abort') } catch {} // иначе воркспейс застревает в незавершённом rebase
      // Конфликт — не повод выбрасывать готовую работу и платить за неё второй раз (06.09: параллельные
      // агенты NOL дрались за общие файлы, и каждый конфликт стоил полного перезапуска). Вливаем свежую базу
      // в ветку задачи и даём агенту разрешить конфликты на месте; провал здесь — уже настоящий провал.
      if (!fs.existsSync(wt)) return fail(task, `воркспейс задачи исчез (${wt}) — перезапуск с чистой базы`)
      try { git(wt, 'merge', '--no-edit', head) } catch (e2) {
        const conflicted = git(wt, 'diff', '--name-only', '--diff-filter=U').split('\n').filter(Boolean)
        log(task.id, 'merge', `конфликт в ${conflicted.join(', ') || 'дереве'} — агент разрешает на месте`)
        setStatus(task.id, 'running')
        const res = await runAgent(task, repo, wt, { round: 9, feedback: [`Ветка задачи не сливается со свежей ${targetName}. Конфликты в файлах:`, ...conflicted.map(f => '- ' + f), '',
          'Разреши конфликты так, чтобы сохранить и своё изменение, и чужое (обе стороны нужны продукту). Убери все маркеры <<<<<<< ======= >>>>>>>.',
          `Потом: git add -A && git commit -m "merge ${targetName} into ${task.key}", прогони проверки: ${repo.cfg.validation.join(' && ')} и почини, если красные. Ничего не откатывай и не удаляй чужой код.`].join('\n') })
        run('UPDATE tasks SET cost=cost+? WHERE id=?', res.cost, task.id)
        const left = git(wt, 'diff', '--name-only', '--diff-filter=U')
        if (res.code !== 0 || left || git(wt, 'status', '--porcelain')) {
          try { git(wt, 'merge', '--abort') } catch {}
          return fail(task, `конфликт со свежим ${targetName} не разрешён (${left || 'агент не закоммитил'}) — перезапуск с новой базы`)
        }
        setStatus(task.id, 'merging')
      }
     } catch (e) { return fail(task, `не смог пересадить ветку на свежий ${targetName}: ${e.message.slice(0, 200)}`) }
    }
    for (const cmd of repo.cfg.validation) {
      const r = await shell(cmd, wt)
      if (r.code !== 0) return fail(task, `после rebase упала проверка «${cmd}»`)
    }
  }
  if (git(dir, 'rev-list', '--count', `HEAD..${task.branch}`) === '0') return fail(task, 'ветка задачи не содержит изменений относительно базы — вливать нечего (агент не сделал работу)')
  git(dir, 'merge', '--no-ff', '-m', `Merge ${task.key}: ${task.title}`, task.branch)
  const merged = git(dir, 'rev-parse', 'HEAD')
  let pushed = ''
  if (repo.cfg.push && /^(https?|git@|ssh)/.test(git(repo.clone, 'remote', 'get-url', 'origin'))) {
    try { git(dir, 'push', 'origin', targetName); pushed = ' + запушено в origin' } catch (e) { log(task.id, 'warn', 'push не прошёл: ' + e.message) }
  }
  cleanup(task, repo)
  setStatus(task.id, 'done', { merge_sha: merged })
  log(task.id, 'merge', `влито в ${targetName} (${merged.slice(0, 7)})${pushed}`)
  if (epic) closeWaveIfDone(epic)
  else afterMerge(task, repo, merged)
}

// Волна эпики закрыта, когда все её задачи done. auto_accept катит эпику дальше сама (или в
// финализацию на последней волне); иначе эпика ждёт кнопки владельца в приложении (ZAVOD-TZ 6.7.6).
function closeWaveIfDone (epic) {
  const e = q1('SELECT * FROM epics WHERE id=?', epic.id)
  if (!e || e.status !== 'open') return
  const tasks = q('SELECT status FROM tasks WHERE epic_id=? AND wave=?', e.id, e.wave)
  if (!tasks.length || tasks.some(t => t.status !== 'done')) return // failed/needs_review в волне — волна не закрывается, эпика остаётся open
  if (!e.auto_accept) {
    log(null, 'эпика', `${e.key}: волна W${e.wave} закрыта, ждёт принятия`)
    return
  }
  if (e.wave >= e.waves) {
    log(null, 'эпика', `${e.key}: волна W${e.wave} закрыта — финализация`)
    enqueueMerge(() => finalizeEpic(e.id), e.repo).catch(err => log(null, 'эпика', `${e.key}: финализация не прошла — ${err.message}`))
  } else {
    run('UPDATE epics SET wave=wave+1, updated_at=? WHERE id=?', now(), e.id)
    log(null, 'эпика', `${e.key}: волна W${e.wave} закрыта — начинаю W${e.wave + 1}`)
  }
}

// Финализация: последняя волна принята — эпика вливается в базовую ветку ЦЕЛИКОМ, одним служебным
// шагом без агента (ZAVOD-TZ раздел 3). Гейты те же (validation, критик на полном диффе); провал
// откатывает клон до коммита, с которого стартовали, — владелец решает про упавшую ветку сам.
async function finalizeEpic (epicId) {
  const e = q1('SELECT * FROM epics WHERE id=?', epicId)
  if (!e) throw new Error('нет эпики')
  const repo = getRepo(e.repo)
  run("UPDATE epics SET status='finalizing', updated_at=? WHERE id=?", now(), e.id)
  const key = `${e.key}-FINAL`
  const taskId = Number(run(`INSERT INTO tasks (key, repo, title, body, status, source, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?)`, key, e.repo, `${e.key}: слияние эпики в ${repo.base}`, e.goal, 'merging', 'epic-final', now(), now()).lastInsertRowid)
  log(taskId, 'эпика', `${e.key}: финализация — вливаю ${e.branch} в ${repo.base}`)
  try { git(repo.clone, 'fetch', 'origin', repo.base) } catch {}
  try { git(repo.clone, 'merge', '--ff-only', `origin/${repo.base}`) } catch {}
  const before = git(repo.clone, 'rev-parse', repo.base)
  try {
    git(repo.clone, 'merge', '--no-ff', '-m', `Merge ${e.key}: ${e.title}`, e.branch)
    for (const cmd of repo.cfg.validation) {
      const r = await shell(cmd, repo.clone)
      if (r.code !== 0) throw new Error(`проверка «${cmd}» упала на финализации:\n${r.out.slice(-1500)}`)
    }
    const veto = await critic({ id: taskId, title: e.title, base_sha: before }, repo, repo.clone)
    if (veto) throw new Error(veto === 'LIMIT' ? 'лимит подписки на критике финализации' : veto)
    const merged = git(repo.clone, 'rev-parse', repo.base)
    let pushed = ''
    if (repo.cfg.push && /^(https?|git@|ssh)/.test(git(repo.clone, 'remote', 'get-url', 'origin'))) {
      try { git(repo.clone, 'push', 'origin', repo.base); pushed = ' + запушено в origin' } catch (err) { log(taskId, 'warn', 'push не прошёл: ' + err.message) }
    }
    try { git(repo.clone, 'worktree', 'remove', '--force', epicWorktree(repo, e)) } catch {}
    try { git(repo.clone, 'worktree', 'prune') } catch {}
    setStatus(taskId, 'done', { merge_sha: merged })
    run("UPDATE epics SET status='done', updated_at=? WHERE id=?", now(), e.id)
    log(taskId, 'merge', `эпика ${e.key} влита в ${repo.base} (${merged.slice(0, 7)})${pushed}`)
    epicCardFinish(repo, e, 'Done', `Готово: эпика влита в ${repo.base}${merged ? ' (' + merged.slice(0, 7) + ')' : ''}`)
    afterMerge(q1('SELECT * FROM tasks WHERE id=?', taskId), repo, merged)
  } catch (err) {
    try { git(repo.clone, 'reset', '--hard', before) } catch {}
    setStatus(taskId, 'failed', { error: err.message })
    run("UPDATE epics SET status='failed', updated_at=? WHERE id=?", now(), e.id)
    log(taskId, 'эпика', `${e.key}: финализация не прошла — ${err.message}`)
    epicCardFinish(repo, e, 'Blocked', `Не вышло: ${String(err.message).slice(0, 1500)}`)
  }
}

// Отмена эпики владельцем: её queued-задачи снимаются, ветка остаётся — можно разобрать вручную.
// Карточки на доске обязаны уйти с Queued: epicAdd создаёт их сразу в Queued и больше не трогает
// (статус волны видит только БД), так что оставь их как есть — и nolSync подберёт «свободную»
// карточку на следующем опросе и воскресит отменённую задачу.
function cancelEpic (e) {
  run("UPDATE tasks SET status='cancelled', updated_at=? WHERE epic_id=? AND status='queued'", now(), e.id)
  run("UPDATE epics SET status='failed', updated_at=? WHERE id=?", now(), e.id)
  log(null, 'эпика', `${e.key}: отменена владельцем — ветка ${e.branch} остаётся`)
  let repo
  try { repo = getRepo(e.repo) } catch { return }
  const note = `Эпика ${e.key} отменена владельцем`
  epicCardFinish(repo, e, 'Blocked', note)
  for (const t of q('SELECT source_ref FROM tasks WHERE epic_id=? AND source_ref IS NOT NULL', e.id)) {
    nolUpdate(t.source_ref, 'Blocked', note)
  }
}

function epicCardFinish (repo, e, status, note) {
  const ws = repo.cfg.nol_workspace
  if (!ws) return
  nolUpdate(nolRef(ws, `epic-${e.key}`), status, note).catch(err => log(null, 'nol', `карточка эпики ${e.key} не обновилась: ${err.message}`))
}
// Пост-мердж шаг из conveyor.json ("after_merge": "node factory/tester.mjs"): тестировщик, который смотрит на
// ЖИВОЙ продукт глазами пользователя после деплоя. Отвязан от диспетчера: его падение или долгота не держат очередь.
// Что он сказал — в события задачи; баги он ставит сам на доску NOL, откуда конвейер их и заберёт.
function afterMerge (task, repo, merged) {
  const cmd = repo.cfg.after_merge
  if (!cmd) return
  log(task.id, 'qa', `запускаю пост-мердж шаг: ${cmd}`)
  const env = { ...process.env, TASK_KEY: task.key, TASK_TITLE: task.title, TASK_BODY: task.body || '', MERGE_SHA: merged, TASK_SOURCE_REF: task.source_ref || '', REPO_NAME: repo.name }
  const child = spawn('/bin/zsh', ['-lc', cmd], { cwd: repo.clone, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true })
  const out = []
  child.stdout.on('data', c => out.push(c)); child.stderr.on('data', c => out.push(c))
  child.on('exit', code => {
    const text = Buffer.concat(out).toString().trim()
    const tail = text.split('\n').filter(Boolean).slice(-12).join('\n').slice(0, 1500)
    log(task.id, 'qa', (code === 0 ? 'тестировщик закончил' : `тестировщик вышел с кодом ${code}`) + (tail ? ':\n' + tail : ''))
  })
  child.unref()
}

// Ночная проверка: гоняем полные тесты на базовой ветке каждого репо.
// Автомердж пропускает по одной задаче, но их сумма может оказаться красной — ловим это до утра.
// «Проверить нечем» и «сломано» — разные вещи, и путать их дороже, чем молчать. Четыре ночи
// подряд (19–22.08) конвейер объявлял базу Джарвиса красной и заводил задачи на починку, а на
// деле в клоне просто не было .venv: подготовка репозитория выполняется в воркспейсе задачи, а
// ночной прогон идёт в клоне, где её никто не делал.
const CANT_RUN = /no such file or directory|command not found|not found: |: 127\b|permission denied/i

async function nightly () {
  for (const r of q('SELECT name FROM repos')) {
    let repo
    try { repo = getRepo(r.name) } catch { continue }
    if (!repo.cfg.validation.length) continue
    // Ночь судит по КЛОНУ, а он живёт своей жизнью. Без перемотки вердикт относится к снимку
    // недельной давности: 25–27.08 конвейер три ночи подряд объявлял базу Джарвиса красной и
    // заводил JRV-6/7/8, меряя код от 17.08. Отстали — не судим вовсе: зелёное на старом коде
    // это ложное «всё хорошо», а красное — задача на починку того, что уже починено.
    const behind = syncBase(repo)
    if (behind) {
      log(null, 'ночь', `${r.name}: клон отстал от твоего репозитория на ${behind} коммит(ов) — судить по нему нечего. Свести: conveyor sync ${r.name}`)
      continue
    }
    // та же подготовка, что у задачи: без неё проверка судит не код, а отсутствие окружения
    for (const cmd of repo.cfg.setup) await shell(cmd, repo.clone, 10 * 60000)
    // Сколько ждать полный набор. У mir-os он живёт на границе: 12–20 минут по ночам, и 01.09
    // одна ночь вышла за дефолтные 20 — родилась MIR-3 «почини базу», хотя чинить было нечего.
    const limit = (Number(repo.cfg.timeout_min) || 20) * 60000
    for (const cmd of repo.cfg.validation) {
      const res = await shell(cmd, repo.clone, limit)
      // Прервали по сроку — это «не успели измерить», а не «сломано». Разница та же, что у
      // «проверить нечем»: вердикт, которого не было, нельзя подавать как красный.
      if (res.killed) {
        log(null, 'ночь', `${r.name}: «${cmd}» не уложилась в ${Math.round(limit / 60000)} мин — вердикта нет. Поднять срок: "timeout_min" в conveyor.json`)
        break
      }
      if (res.code !== 0 && CANT_RUN.test(res.out)) {
        log(null, 'ночь', `${r.name}: проверить нечем — «${cmd}» не запускается: ${res.out.trim().split('\n')[0].slice(0, 140)}`)
        break // это беда окружения, а не кода: чинить тут агенту нечего
      }
      if (res.code !== 0) {
        const sha = git(repo.clone, 'rev-parse', '--short', repo.base)
        log(null, 'ночь', `${r.name}: ${repo.base} КРАСНАЯ на ${sha} — «${cmd}»`)
        notify(`${r.name}: ${repo.base} красная`, `упало «${cmd}» на ${sha}. Последние мерджи под подозрением.`)
        // Баннер на маке видит тот, кто у мака. Ночью там никого, и до обеда владелец не
        // узнает, что база сломана — а это ровно та новость, ради которой ночной прогон есть.
        const c = tgCfg()
        const last = q(`SELECT key, title FROM tasks WHERE repo=? AND status='done' ORDER BY updated_at DESC LIMIT 3`, r.name)
        if (c?.owner) {
          tgSend(c.owner, [`🔴 ${r.name}: ветка ${repo.base} красная на ${sha}`,
            `Упало: ${cmd}`, '', 'Последнее влитое (под подозрением):',
            ...last.map(t => `  ${t.key} ${String(t.title).slice(0, 60)}`),
            '', `Откатить: conveyor revert <ключ>`, res.out.slice(-700)].join('\n'))
        }
        // не только сказать, но и положить готовую задачу: утром одна кнопка вместо разбирательства
        const fix = proposeRepair(r.name, cmd, res.out)
        if (fix && c?.owner) tgSend(c.owner, `🛠 ${fix.key} — задача на починку базы лежит во входящих.`, { reply_markup: tgKeyboard(fix.id) })
        return
      }
    }
    log(null, 'ночь', `${r.name}: ${repo.base} зелёная`)
  }
}

function cleanup (task, repo) {
  try { git(repo.clone, 'worktree', 'remove', '--force', task.worktree) } catch {}
  try { git(repo.clone, 'worktree', 'prune') } catch {}
}
function fail (task, reason, r) {
  const t = q1('SELECT * FROM tasks WHERE id=?', task.id)
  const review = reason.startsWith('REVIEW:')
  // повтор помогает от случайности, но не от нехватки бюджета и не от защищённых путей
  const noRetry = review || reason.startsWith('БЮДЖЕТ:')
  decide(task.id, review ? 'ушло на ревью' : 'не вышло', reason)
  if (!noRetry && t.attempts < MAX_ATTEMPTS) {
    // WAVE1 3.3: таймаут с WIP-коммитом в живом воркспейсе — следующая попытка продолжает
    // ЭТУ ЖЕ сессию (opts.resume) вместо чистого перезапуска, который стёр бы уже сделанное.
    const resumeSession = r?.timedOut && r?.session && t.worktree && fs.existsSync(t.worktree) ? r.session : null
    if (resumeSession) {
      // Продолжение — не новая попытка того же агента: он не «не справился», ему не хватило
      // времени. Смена модели на полпути session ломает контекст, который --resume обязан пронести.
      log(task.id, 'retry', `таймаут с WIP-коммитом — продолжаю сессию ${resumeSession.slice(0, 8)}`)
    } else {
      // Повторять тем же агентом бессмысленно: он уже показал, что не тянет. Ступень вверх —
      // дёшево пробуем, дорого добиваем. Выше opus ступеней нет, там просто повтор.
      // Жёсткий repo.cfg.model — это потолок владельца, не подсказка: 16.09 эскалация сама
      // подняла sonnet до opus на Z7 в обход этого потолка и удвоила стоимость провала.
      let repoModel = null; try { repoModel = getRepo(task.repo).cfg.model } catch {}
      const next = repoModel ? null : MODELS[Math.min(MODELS.indexOf(t.model || 'sonnet') + 1, MODELS.length - 1)]
      if (next && next !== t.model) {
        run('UPDATE tasks SET model=?, estimate=NULL WHERE id=?', next, task.id)
        log(task.id, 'повтор', `${t.model || 'sonnet'} не справился — беру ${next}`)
        decide(task.id, 'смена агента', `${t.model || 'sonnet'} → ${next}`)
      }
    }
    setStatus(task.id, 'queued', { error: reason, resume_session: resumeSession })
    log(task.id, 'retry', `попытка ${t.attempts + 1} из ${MAX_ATTEMPTS}`)
  } else {
    setStatus(task.id, review ? 'needs_review' : 'failed', { error: reason })
    // остановились на владельце — зовём его туда, где он живёт, с кнопками решения,
    // а не молча оставляем карточку в приложении, которое он может не открыть до вечера
    if (review) tgReview(q1('SELECT * FROM tasks WHERE id=?', task.id))
  }
}

const cancelled = id => q1('SELECT status FROM tasks WHERE id=?', id).status === 'cancelled'

// Один вариант решения: свой воркспейс, свой агент, свои доработки. Возвращает результат, не меняя статус задачи.
async function runVariant (task, repo, variant = '', opts = {}) {
  // Продолжение (ответ владельца / доработка) идёт в СУЩЕСТВУЮЩИЙ воркспейс: пересоздать его
  // значило бы стереть то, ради чего мы разговор и затевали.
  const resuming = Boolean(opts.resume && task.worktree && fs.existsSync(task.worktree))
  const { wt, branch, baseSha } = resuming
    ? { wt: task.worktree, branch: task.branch, baseSha: task.base_sha }
    : prepare(task, repo, variant)
  if (!resuming) {
    // свежий воркспейс пустой: npm ci / venv и прочее ставим до агента.
    // Продолжению это не нужно — там всё уже стоит, а повтор стоил бы минут на каждое слово владельца.
    const untracked = () => new Set(git(wt, 'status', '--porcelain').split('\n').filter(Boolean))
    const before = untracked()
    // Свой потолок у подготовки: зависший npm ci держал бы слот все 45 минут агентского
    // таймаута, а «не скачалось» и «агент думает» — разные беды с разной ценой ожидания.
    const setupMs = Number(repo.cfg.setup_timeout_min || 10) * 60000
    for (const cmd of repo.cfg.setup) {
      const r = await shell(cmd, wt, setupMs)
      if (r.code !== 0) return { wt, branch, baseSha, bad: `подготовка «${cmd}» ${r.killed ? 'зависла' : 'упала'}:\n${r.out.slice(-1500)}` }
    }
    // Всё, что создала подготовка, прячем от git: иначе `git add -A` заметает симлинки на node_modules
    // и .venv прямо в коммит — с абсолютными путями этой машины.
    const created = [...untracked()].filter(l => l.startsWith('??') && !before.has(l)).map(l => l.slice(3).replace(/\/$/, ''))
    if (created.length) {
      const ex = git(wt, 'rev-parse', '--git-path', 'info/exclude')
      fs.appendFileSync(path.isAbsolute(ex) ? ex : path.join(wt, ex), '\n' + created.join('\n') + '\n')
      log(task.id, 'setup', `скрыто от git: ${created.join(', ')}`)
    }
  }
  const tag = variant ? `вариант ${variant.slice(1).toUpperCase()}: ` : ''
  const outOfFuel = r => `БЮДЖЕТ: ${tag}агент упёрся в потолок $${repo.cfg.max_cost_usd} на прогон и не доделал. Подними max_cost_usd в conveyor.json — повторять с тем же потолком бессмысленно (см. ${r.dir})`
  // Продолжение начатого разговора: слово владельца едет в ТУ ЖЕ сессию, где агент помнит контекст.
  // Иначе доработка означала бы пересказ всей задачи заново и потерю всего, что агент уже понял.
  // «До» снимаем ДО работы агента: потом исходное состояние уже не воспроизвести
  let shotBefore = null
  if (repo.cfg.preview && !resuming) {
    shotBefore = await screenshot(repo, wt, path.join(SHOTS, `${task.key}${variant}-до.png`),
      m => log(task.id, 'глаза', `снимка «до» не будет: ${m}`)).catch(() => null)
    if (shotBefore) log(task.id, 'глаза', 'снял, как страница выглядела до работы')
  }
  let res = await runAgent(task, repo, wt, { variant, resume: resuming ? opts.resume : null, note: opts.note })
  run('UPDATE tasks SET cost=cost+? WHERE id=?', res.cost, task.id)
  if (cancelled(task.id)) return { wt, branch, baseSha, bad: 'отменено' }
  if (res.interrupted) return { wt, branch, baseSha, interrupted: res.interrupted, session: res.session }
  if (res.broke) return { wt, branch, baseSha, bad: outOfFuel(res) }
  if (res.ask) return { wt, branch, baseSha, ask: res.ask, session: res.session, variant }
  if (res.code !== 0) { const lim = limitHit(res.dir); if (lim) return { wt, branch, baseSha, limit: lim } }
  if (res.code !== 0) {
    return { wt, branch, baseSha, bad: `${tag}агент не доработал: ${explainExit(res.code, res.dir)} (см. ${res.dir})`, timedOut: res.timedOut, session: res.session }
  }

  let bad = await validate(task, repo, wt, baseSha)
  // красные проверки — не повод выбрасывать работу: продолжаем ту же сессию с логом падения
  for (let round = 2; bad && !bad.startsWith('REVIEW:') && res.session && round <= 1 + FIX_ROUNDS; round++) {
    log(task.id, 'доработка', `${tag}${bad.slice(0, 120)}`)
    res = await runAgent(task, repo, wt, { resume: res.session, feedback: bad, round, variant })
    run('UPDATE tasks SET cost=cost+? WHERE id=?', res.cost, task.id)
    if (cancelled(task.id)) return { wt, branch, baseSha, bad: 'отменено' }
    if (res.interrupted) return { wt, branch, baseSha, interrupted: res.interrupted, session: res.session }
    // Вопрос на доработке НЕ слушаем — и это не грубость, а замер: агент, которому показали
    // красные тесты, спросил владельца вместо разбора. Правило одно с промптом выше.
    if (res.ask) log(task.id, 'вопрос', `на доработке спрашивать нечего, продолжаю проверки: ${res.ask.slice(0, 120)}`)
    if (res.code !== 0) { const lim = limitHit(res.dir); if (lim) return { wt, branch, baseSha, limit: lim } }
    bad = res.broke ? outOfFuel(res) : res.code === 0 ? await validate(task, repo, wt, baseSha) : `${tag}агент упал на доработке с кодом ${res.code}`
  }
  return { wt, branch, baseSha, bad, variant, session: res.session, shotBefore, timedOut: res.timedOut }
}

// Из нескольких зелёных вариантов выбираем лучший чужими глазами: тесты уже сказали «работает», вопрос — что чище.
async function chooseBest (task, repo, greens) {
  const diffs = greens.map((g, i) => `## Вариант ${i + 1}\n\`\`\`diff\n${git(g.wt, 'diff', `${g.baseSha}..HEAD`).slice(0, 25000)}\n\`\`\``)
  const ask = [`Задача: ${task.title}`, '',
    `Ниже ${greens.length} независимых решения одной задачи. Все проходят тесты.`,
    'Выбери лучшее: проще, меньше побочных изменений, не ломает существующее поведение.',
    'Ответь ТОЛЬКО номером варианта.', '', ...diffs].join('\n')
  const args = ['-p', ask, '--output-format', 'json', '--model', repo.cfg.critic_model || 'haiku', '--allowedTools', 'Read']
  return new Promise(resolve => {
    const out = []
    const child = spawn('claude', args, { cwd: greens[0].wt, stdio: ['ignore', 'pipe', 'ignore'] })
    child.on('error', () => resolve(greens[0]))
    child.stdout.on('data', c => out.push(c))
    const timer = setTimeout(() => { try { child.kill('SIGKILL') } catch {} }, 5 * 60 * 1000)
    child.on('exit', () => {
      clearTimeout(timer)
      let pick = 0
      try {
        const j = JSON.parse(out.join(''))
        run('UPDATE tasks SET cost=cost+? WHERE id=?', j.total_cost_usd || 0, task.id)
        const n = String(j.result || '').match(/\d+/)
        if (n) pick = Math.min(Math.max(Number(n[0]) - 1, 0), greens.length - 1)
      } catch {}
      log(task.id, 'выбор', `из ${greens.length} зелёных выбран вариант ${pick + 1}`)
      resolve(greens[pick])
    })
  })
}

async function processTask (task) {
  const repo = getRepo(task.repo)
  run('UPDATE tasks SET attempts=attempts+1 WHERE id=?', task.id)
  try {
    // Владелец что-то сказал живой сессии — это продолжение разговора, а не новая задача.
    // Записку гасим СРАЗУ: иначе повтор задачи прокрутил бы её ещё раз как свежую просьбу.
    const note = task.owner_note
    if (note) {
      run('UPDATE tasks SET owner_note=NULL, question=NULL, ask_msg=NULL WHERE id=?', task.id)
      const session = lastSession(task.id)
      if (!session || !task.worktree || !fs.existsSync(task.worktree)) {
        // Сессии или воркспейса уже нет: продолжать нечего, но и терять слово владельца нельзя —
        // оно становится частью задачи, и она поедет с чистой базы.
        run('UPDATE tasks SET body = TRIM(COALESCE(body,\'\') || ?) WHERE id=?', `\n\nВладелец добавил: ${note}`, task.id)
        log(task.id, 'доработка', 'сессии агента уже нет — слово владельца ушло в текст задачи, стартуем заново')
      } else {
        setStatus(task.id, 'running')
        const r = await runVariant(q1('SELECT * FROM tasks WHERE id=?', task.id), repo, '', { resume: session, note })
        return afterVariant(task, repo, r)
      }
    }
    // Прошлый заход убит по таймауту, но успел оставить WIP-коммит в живом воркспейсе
    // (WAVE1 3.3) — продолжаем ТУ ЖЕ сессию агента, а не пересоздаём воркспейс с нуля.
    const resumeSession = task.resume_session
    if (resumeSession) {
      run('UPDATE tasks SET resume_session=NULL WHERE id=?', task.id)
      if (task.worktree && fs.existsSync(task.worktree)) {
        setStatus(task.id, 'running')
        const r = await runVariant(q1('SELECT * FROM tasks WHERE id=?', task.id), repo, '', { resume: resumeSession })
        return afterVariant(task, repo, r)
      }
      log(task.id, 'retry', 'сессия после таймаута была, но воркспейса уже нет — стартую с чистой базы')
    }
    const n = Math.min(Math.max(task.variants || 1, 1), MAX_VARIANTS)
    let winner
    if (n === 1) {
      winner = await runVariant(task, repo)
      if (winner.ask || winner.bad || winner.limit || winner.interrupted) return afterVariant(task, repo, winner)
    } else {
      // ponytail: варианты занимают один слот демона на всех, потолок MAX_VARIANTS. Если станет тесно — считать слоты по агентам.
      setStatus(task.id, 'running')
      log(task.id, 'варианты', `${n} независимых решения одной задачи`)
      const all = await Promise.all(['-a', '-b', '-c'].slice(0, n).map(v => runVariant(task, repo, v)))
      if (cancelled(task.id)) return
      const limited = all.find(r => r.limit)
      if (limited) { all.filter(r => r !== limited).forEach(r => dropVariant(repo, r)); return pauseForLimit(task, repo, limited.limit) }
      const greens = all.filter(r => !r.bad && !r.ask && !r.limit)
      if (!greens.length) {
        // Спросивший вариант — не провал: у него есть живая сессия и незаконченная работа.
        // Оставляем его воркспейс, остальные сносим, и идём к владельцу с вопросом.
        const asked = all.find(r => r.ask)
        all.filter(r => r !== asked).forEach(r => dropVariant(repo, r))
        return asked ? askOwner(task, asked) : fail(task, all[0].bad)
      }
      winner = greens.length === 1 ? greens[0] : await chooseBest(task, repo, greens)
      all.filter(r => r !== winner).forEach(r => dropVariant(repo, r))
      log(task.id, 'варианты', `зелёных ${greens.length} из ${n}, победитель ${(winner.variant || '-a').slice(1).toUpperCase()}`)
    }
    await settle(task, repo, winner)
  } catch (e) {
    fail(task, e.message)
  }
}

// Один исход одного захода — одно место, где решается, что дальше. Иначе развилка «спросил /
// не вышло / готово» разъедется по трём веткам и однажды разойдётся в поведении.
async function afterVariant (task, repo, r) {
  if (cancelled(task.id)) return
  if (r.limit) return pauseForLimit(task, repo, r.limit)
  // прерван словом владельца: заход уже посажен WIP-коммитом, сессия в runs — дальше обычный путь слова
  if (r.interrupted) return ownerSays(task, r.interrupted)
  if (r.ask) return askOwner(task, r)
  if (r.bad) return fail(task, r.bad, r)
  return settle(task, repo, r)
}

// Работа принята агентом — дальше свежий взгляд критика и мердж-очередь.
async function settle (task, repo, r) {
  if (r.limit) return pauseForLimit(task, repo, r.limit) // страховка: результат с лимитом не должен дойти до критика и мерджа
  if (r.bad) return fail(task, r.bad)
  setStatus(task.id, 'critic', { branch: r.branch, worktree: r.wt, base_sha: r.baseSha })
  const t = q1('SELECT * FROM tasks WHERE id=?', task.id)
  const veto = await critic(t, repo, r.wt)
  if (veto === 'LIMIT') return pauseForLimit(t, repo, { until: Date.now() + 30 * 60000, text: 'лимит подписки на критике' })
  decide(task.id, 'критик', veto || 'возражений нет')
  if (veto) return fail(t, veto)
  // Глаза: снимаем результат и показываем владельцу. Для сайта это главный гейт —
  // зелёные тесты ничего не говорят о том, не развалилась ли вёрстка.
  if (repo.cfg.preview) {
    const after = await screenshot(repo, r.wt, path.join(SHOTS, `${t.key}-после.png`),
      m => log(t.id, 'глаза', `снимка «после» не будет: ${m}`)).catch(() => null)
    if (after) {
      run('UPDATE tasks SET shot=? WHERE id=?', after, t.id)
      const seen = await lookCritic(t, r.shotBefore, after).catch(() => null)
      decide(task.id, 'глазами', seen || 'вёрстка на вид цела')
      tgShots(t, r.shotBefore, after, seen)
      if (seen) return fail(t, seen)
    }
  }
  // Урок снимаем ДО мерджа: после него воркспейс и сессия уже не нужны и будут снесены.
  await harvestLesson(t, repo, r.wt, r.session).catch(() => {})
  await enqueueMerge(() => mergeTask(q1('SELECT * FROM tasks WHERE id=?', task.id), repo), task.repo)
}

// Перепроверить УЖЕ СДЕЛАННУЮ работу нынешними гейтами, не запуская агента заново.
// Нужно, когда остановил не агент, а гейт: правило починили или владелец не согласен с
// вердиктом. «Запустить снова» тут не годится — оно выбрасывает готовую работу и платит
// за неё второй раз (случай 21.08: задача стоила $2.27 вместо $0.60 из-за этого).
async function recheckTask (task) {
  const repo = getRepo(task.repo)
  const wt = task.worktree
  if (!wt || !fs.existsSync(wt)) throw new Error('воркспейса уже нет — перепроверять нечего, нужен полный перезапуск')
  log(task.id, 'перепроверка', 'гоняю проверки заново по готовой работе')
  setStatus(task.id, 'validating')
  const bad = await validate(task, repo, wt, task.base_sha)
  if (bad) {
    // Провал перепроверки — НЕ повод запускать работу заново: агент своё сделал, вопрос к
    // результату. Возвращаем задачу владельцу с новой причиной, а не в очередь.
    const review = bad.startsWith('REVIEW:')
    setStatus(task.id, review ? 'needs_review' : 'failed', { error: bad })
    decide(task.id, 'перепроверка', bad.slice(0, 300))
    if (review) tgReview(q1('SELECT * FROM tasks WHERE id=?', task.id))
    return
  }
  decide(task.id, 'перепроверка', 'проверки пройдены заново')
  await settle(task, repo, { wt, branch: task.branch, baseSha: task.base_sha, session: lastSession(task.id) })
}

// Агент упёрся в решение владельца. Воркспейс и ветку СОХРАНЯЕМ: ответ вернётся в эту же
// сессию, и всё, что агент успел понять и сделать, должно его дождаться.
function askOwner (task, r) {
  setStatus(task.id, 'asking', { question: r.ask, branch: r.branch, worktree: r.wt, base_sha: r.baseSha })
  log(task.id, 'вопрос', r.ask.slice(0, 300))
  notify(`${task.key} — агент спрашивает`, r.ask)
  tgAsk(q1('SELECT * FROM tasks WHERE id=?', task.id))
}

// Об одной сломанной цепочке говорим ОДИН раз за жизнь демона: диспетчер крутится каждые
// две секунды, и без этого владелец получил бы то же сообщение тысячу раз за час.
const coordinated = new Set()

const lastSession = taskId =>
  q1('SELECT session FROM runs WHERE task_id=? AND session IS NOT NULL ORDER BY id DESC LIMIT 1', taskId)?.session || null

// ---------- пульт с телефона ----------
// Наружу ведёт ОТДЕЛЬНЫЙ процесс cloudflared, а не «слушать 0.0.0.0»: его видно в списке
// процессов и убивается он одним движением, тогда как открытый сокет живёт, пока о нём не
// вспомнят. Выключено по умолчанию — интернет не приходит сам, его впускают решением.
const tunnelKey = () => {
  let k = get('tunnel_key', '')
  if (!k) { k = [...crypto.getRandomValues(new Uint8Array(18))].map(b => b.toString(36)).join('').slice(0, 24); set('tunnel_key', k) }
  return k
}
const localRequest = req => {
  const a = req.socket.remoteAddress || ''
  return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1'
}
const hasKey = (req, qs) => {
  const k = tunnelKey()
  return new URLSearchParams(qs || '').get('k') === k || String(req.headers.cookie || '').includes(`ck=${k}`)
}

// Сторож туннеля: quick tunnel — сервис без обещаний, и без присмотра пульт живёт до первого
// обрыва, а кнопка в чате ведёт в никуда. Переоткрываем МОЛЧА (это не новость), говорим только
// о новом адресе. Тот же закон, что у сторожей Джарвиса.
function keepTunnel () {
  if (get('tunnel_on', '0') !== '1') return
  let child = openTunnel()
  const revive = () => {
    if (get('tunnel_on', '0') !== '1') return
    setTimeout(() => { log(null, 'пульт', 'связь оборвалась — переоткрываю'); child = openTunnel(); child.on('exit', revive) }, 15000)
  }
  child.on('exit', revive)
}

function openTunnel () {
  const child = spawn('cloudflared', ['tunnel', '--url', `http://127.0.0.1:${PORT}`], { stdio: ['ignore', 'pipe', 'pipe'] })
  child.on('error', () => log(null, 'пульт', 'нет cloudflared: brew install cloudflared'))
  let told = false
  const watch = buf => {
    const m = String(buf).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)
    if (!m || told) return
    told = true
    const url = `${m[0]}/?k=${tunnelKey()}`
    log(null, 'пульт', `открыт снаружи: ${m[0]}`)
    const c = tgCfg()
    if (c?.owner) tgSend(c.owner, `📱 Пульт конвейера открыт с телефона:\n${url}\n\nСсылка со встроенным ключом — не пересылай её. Адрес живёт до перезапуска.`)
    else console.log(url)
  }
  child.stdout.on('data', watch); child.stderr.on('data', watch)
  return child
}

// Дверь наружу для своих же систем (mir-os, ШТАТ:0): задача завершилась — стучимся по адресу
// из настроек. Через curl и без ожидания: чужой сервис не имеет права задерживать конвейер.
function webhook (status, taskId) {
  const url = get('webhook', '')
  if (!url) return
  const t = q1('SELECT key, repo, title, status, cost, merge_sha, pr_url FROM tasks WHERE id=?', taskId)
  try {
    spawn('curl', ['-sS', '-m', '20', '-X', 'POST', '-H', 'Content-Type: application/json',
      '--data-binary', JSON.stringify({ event: status, task: t }), url], { stdio: 'ignore' }).unref()
  } catch (e) { log(taskId, 'webhook', e.message) }
}

// ---------- координатор плана ----------
// Провал одного звена глушил весь хвост цепочки МОЛЧА: задачи вставали в «ждёт другую» и
// стояли так вечно. Координатор смотрит, что осталось, спрашивает совета у дешёвой модели и
// несёт развилку владельцу. Сам план он НЕ переписывает: владелец подписывал эти задачи,
// и подменять их нашим пересказом — то же, что решать за него.
function blockedBy (failedId) {
  return q(`SELECT * FROM tasks WHERE status='blocked'
    AND instr(','||deps||',', ','||?||',')>0 ORDER BY id`, String(failedId))
}

function planAdvice (failed, rest) {
  const ask = [
    'В плане работ провалился один шаг. Оцени, можно ли делать оставшиеся без него.', '',
    `Провалился: ${failed.title}`, `Причина: ${String(failed.error || '').slice(0, 400)}`, '',
    'Оставшиеся шаги, которые его ждали:',
    ...rest.map((t, i) => `${i + 1}. ${t.title}`), '',
    'Ответь ОДНОЙ строкой до 160 символов: можно ли пускать оставшиеся независимо и почему.'
  ].join('\n')
  const neutral = fs.mkdtempSync(path.join(os.tmpdir(), 'conveyor-plan-'))
  return new Promise(resolve => {
    const out = []
    const done = v => { fs.rmSync(neutral, { recursive: true, force: true }); resolve(v) }
    const child = spawn('claude', ['-p', ask, '--output-format', 'json', '--model', 'haiku'],
      { cwd: neutral, stdio: ['ignore', 'pipe', 'ignore'] })
    child.on('error', () => done(null))
    const timer = setTimeout(() => { try { child.kill('SIGKILL') } catch {} ; done(null) }, 90000)
    child.stdout.on('data', c => out.push(c))
    child.on('exit', () => {
      clearTimeout(timer)
      try { done(String(JSON.parse(out.join('')).result || '').trim().split('\n')[0] || null) } catch { done(null) }
    })
  })
}

async function coordinate (failedId) {
  const rest = blockedBy(failedId)
  if (!rest.length) return
  const failed = q1('SELECT * FROM tasks WHERE id=?', failedId)
  log(failedId, 'план', `из-за этого встали: ${rest.map(t => t.key).join(', ')}`)
  const advice = await planAdvice(failed, rest).catch(() => null)
  decide(failedId, 'план встал', `${rest.length} шагов ждут: ${advice || 'совета нет'}`)
  const c = tgCfg()
  if (!c?.owner) return
  await tgSend(c.owner, [`⛔️ План встал: ${failed.key} не вышел`,
    String(failed.error || '').replace(/^REVIEW:\s*/, '').slice(0, 300), '',
    `Из-за этого стоят ${rest.length}:`, ...rest.slice(0, 8).map(t => `  ${t.key} ${String(t.title).slice(0, 58)}`),
    advice ? `\nСовет: ${advice}` : ''].filter(Boolean).join('\n'),
  { reply_markup: { inline_keyboard: [[
    { text: '▶️ Пустить остальные', callback_data: `free:${failedId}` },
    { text: '✖️ Снять цепочку', callback_data: `kill:${failedId}` }]] } })
}

// ---------- конвейер сам находит себе работу ----------
// Завод, которому нужно приносить каждую деталь, — наполовину завод. Раз в сутки проходим по
// TODO/FIXME в базовой ветке и кладём предложения ВО ВХОДЯЩИЕ: запускает по-прежнему владелец.
async function proposeWork () {
  for (const r of q('SELECT name FROM repos')) {
    let repo
    try { repo = getRepo(r.name) } catch { continue }
    if (repo.cfg.propose === false) continue
    const found = await shell(`git grep -n -I -E "(TODO|FIXME)[:( ]" ${repo.base} -- . | head -40`, repo.clone, 60000)
    if (found.code !== 0) continue
    for (const line of found.out.split('\n').filter(Boolean)) {
      const m = line.match(/^[^:]+:([^:]+):(\d+):\s*(.+)$/)
      if (!m) continue
      const [, file, ln, text] = m
      const note = text.replace(/^[\s/*#-]+/, '').slice(0, 160)
      // TODO(бухгалтер) и TODO(владелец) адресованы ЧЕЛОВЕКУ и требуют знания, которого у
      // агента нет. Превращать их в задачи — гонять его по кругу: он снова спросит владельца.
      // Поймано 22.08: конвейер предложил задачу по TODO, который сам же честно и написал.
      if (/(TODO|FIXME)\s*\((?:[^)]*(?:владел|бухгалт|юрист|человек|owner)[^)]*)\)/i.test(text)) continue
      // Пометка ВНУТРИ кавычек — цитата, а не работа. 27–30.08 конвейер четыре дня подряд заводил
      // задачи сам на себя: летопись Джарвиса пересказывает старое название задачи, а тест держит
      // его как образец обрезанного заголовка — и в обоих текстах есть «TODO(...)». Признак простой:
      // перед маркером на строке уже открыта кавычка. Настоящая пометка стоит сразу за // или #.
      if (/["'«`]/.test(text.slice(0, text.search(/(TODO|FIXME)[:( ]/i)))) continue
      const ref = `todo:${r.name}:${file}:${note.slice(0, 40)}` // тот же TODO дважды не предлагаем
      if (q1('SELECT id FROM tasks WHERE source_ref=?', ref)) continue
      taskAdd(r.name, `Разобраться с пометкой в коде: ${note}`, {
        body: `В файле ${file}, строка ${ln}, оставлена пометка:\n${text.trim()}\n\nРазберись, актуальна ли она. Если да — сделай; если нет — убери пометку.`,
        status: 'inbox', source: 'todo', source_ref: ref
      })
      return // по одному предложению за проход: пачка из сорока штук — не помощь, а завал
    }
  }
}

// Ночной прогон нашёл красное — не только будим, но и кладём готовую задачу «почини базу».
function proposeRepair (repoName, cmd, out) {
  const ref = `repair:${repoName}:${new Date().toISOString().slice(0, 10)}`
  if (q1('SELECT id FROM tasks WHERE source_ref=?', ref)) return
  // Пока прежняя задача на починку ЖДЁТ владельца, новая — не помощь, а шум: за четыре ночи
  // так накопились JRV-4…JRV-7, четыре копии одной и той же беды.
  const waiting = q1(`SELECT key FROM tasks WHERE repo=? AND source='repair'
    AND status IN ('inbox','queued','needs_review','asking')`, repoName)
  if (waiting) return log(null, 'ночь', `${repoName}: база всё ещё красная, но ${waiting.key} уже ждёт тебя — новую не завожу`)
  const t = taskAdd(repoName, `Почини базовую ветку: упала проверка «${cmd}»`, {
    body: `Ночной прогон на базовой ветке показал красное.\n\nКоманда: ${cmd}\n\nХвост вывода:\n${String(out).slice(-2500)}\n\nНайди причину и почини. Не отключай проверку и не подгоняй её под сломанный код.`,
    status: 'inbox', source: 'repair', source_ref: ref, priority: 1
  })
  log(t.id, 'ночь', 'задача на починку базы лежит во входящих')
  return t
}

// Доля задач, прошедших С ПЕРВОЙ ПОПЫТКИ, — единственное число, по которому видно,
// становится конвейер лучше или хуже. Считаем по прогонам: один прогон = без доработок.
function firstTryRate (fromTs) {
  const rows = q(`SELECT t.id, COUNT(r.id) n FROM tasks t JOIN runs r ON r.task_id=t.id
    WHERE t.status='done' AND t.updated_at >= ? GROUP BY t.id`, fromTs)
  if (!rows.length) return null
  return Math.round(rows.filter(r => r.n === 1).length * 100 / rows.length)
}

// ---------- повторяющиеся задачи ----------
// «Каждую пятницу обнови зависимости» — работа, о которой владелец не должен помнить.
// Задача ставится во ВХОДЯЩИЕ, а не в очередь: расписание решает КОГДА напомнить, а пускать
// ли агента — по-прежнему решение владельца (то же правило, что для задач из чата).
function fireSchedules () {
  for (const s of q('SELECT * FROM schedules WHERE next_at <= ?', now())) {
    run('UPDATE schedules SET next_at=? WHERE id=?', now() + s.every_h * 3600e3, s.id)
    try {
      const t = taskAdd(s.repo, s.title, { model: s.model, status: 'inbox', source: 'schedule' })
      run('UPDATE schedules SET last_key=? WHERE id=?', t.key, s.id)
      log(t.id, 'расписание', `по расписанию (раз в ${s.every_h} ч) — лежит во входящих`)
      const c = tgCfg()
      if (c?.owner) {
        tgSend(c.owner, `🗓 ${t.key} · ${s.repo}\n${t.title}\n\nПо расписанию. Запустить?`,
          { reply_markup: tgKeyboard(t.id) })
      }
    } catch (e) { log(null, 'расписание', `${s.repo}: ${e.message}`) }
  }
}

// ---------- проверка окружения ----------
// Опечатка в командах проверки обнаруживалась только ПОСЛЕ потраченных на агента токенов.
// Здесь проверяется то, что можно проверить бесплатно и заранее.
async function checkRepo (name) {
  const bad = []
  let r
  try { r = getRepo(name) } catch (e) { return [`репозиторий не читается: ${e.message}`] }
  const c = r.cfg
  if (!fs.existsSync(r.clone)) bad.push(`нет клона ${r.clone} — переподключи: conveyor repo add ${r.src}`)
  else {
    try { git(r.clone, 'rev-parse', '--verify', r.base) } catch { bad.push(`в клоне нет базовой ветки «${r.base}»`) }
  }
  for (const key of ['setup', 'validation', 'protected']) {
    if (!Array.isArray(c[key])) bad.push(`«${key}» в conveyor.json должен быть списком строк`)
  }
  if (!c.validation?.length) bad.push('нет ни одной команды проверки: агента никто не проверит, задачи будут вливаться на слово')
  // первое слово команды — это программа; её отсутствие видно без запуска самой команды
  for (const cmd of [...(c.setup || []), ...(c.validation || [])]) {
    const bin = String(cmd).trim().split(/\s+/)[0]
    if (/^[a-z0-9_.\-/]+$/i.test(bin) && (await shell(`command -v ${bin}`, r.clone, 15000)).code !== 0) {
      bad.push(`команда «${cmd}»: на машине нет программы «${bin}»`)
    }
  }
  if (c.model && !MODELS.includes(c.model)) bad.push(`модель «${c.model}» неизвестна, ожидаю одну из: ${MODELS.join(', ')}`)
  return bad
}

async function doctor () {
  const ok = []; const warn = []
  const bin = async (n, hint) => (await shell(`command -v ${n}`, ROOT, 15000)).code === 0 ? ok.push(`${n} на месте`) : warn.push(`нет ${n}${hint ? ' — ' + hint : ''}`)
  await bin('git'); await bin('claude', 'без него агенты не запустятся: npm i -g @anthropic-ai/claude-code')
  fs.existsSync('/usr/bin/sandbox-exec') ? ok.push('песочница агента доступна') : warn.push('нет sandbox-exec: агент будет работать без изоляции')
  ok.push(`node ${process.version}`)
  const repos = q('SELECT name FROM repos')
  if (!repos.length) warn.push('не подключён ни один репозиторий: conveyor repo add <путь>')
  for (const r of repos) {
    const bad = await checkRepo(r.name)
    bad.length ? bad.forEach(b => warn.push(`${r.name}: ${b}`)) : ok.push(`${r.name}: настроен верно`)
  }
  tgCfg() ? ok.push('телеграм подключён') : warn.push('телеграм не подключён: conveyor tg <токен бота>')
  jiraCfg() ? ok.push('Jira подключена') : ok.push('Jira не подключена (не обязательно)')
  const free = Number((await shell("df -g . | awk 'NR==2{print $4}'", ROOT, 15000)).out.trim()) || 0
  free && free < 5 ? warn.push(`на диске всего ${free} ГБ — воркспейсам может не хватить`) : ok.push(`на диске ${free} ГБ`)
  // Сколько конвейер весит и во что обходится обвязка — два числа, за которыми надо следить,
  // потому что растут они молча: воркспейсы и снимки на диске, приёмка с критиком в счёте.
  const du = async p => Number((await shell(`du -sm ${JSON.stringify(p)} 2>/dev/null | cut -f1`, ROOT, 20000)).out.trim()) || 0
  const weight = (await du(ROOT)) + (await du(REPOS)) + (await du(TREES))
  ok.push(`на диске занимает ${weight} МБ (клоны, воркспейсы, логи, снимки)`)
  const week = now() - 7 * 864e5
  const full = q1("SELECT COALESCE(SUM(cost),0) c FROM tasks WHERE status IN ('done','reverted') AND updated_at>=?", week).c
  const work = q1(`SELECT COALESCE(SUM(r.cost),0) c FROM runs r JOIN tasks t ON t.id=r.task_id
    WHERE t.status IN ('done','reverted') AND t.updated_at>=?`, week).c
  if (full > 0) {
    const share = Math.round((full - work) * 100 / full)
    const line = `обвязка за неделю: ${share}% расходов (приёмка, критик, уроки)`
    share > 35 ? warn.push(line + ' — многовато, задачи слишком мелкие для такой проверки') : ok.push(line)
  }
  const fp = firstTryRate(week)
  if (fp != null) (fp < 50 ? warn : ok).push(`с первой попытки за неделю: ${fp}%`)
  const stuck = q1(`SELECT COUNT(*) c FROM tasks WHERE status IN ('needs_review','asking','failed')`).c
  if (stuck) warn.push(`${stuck} задач ждут твоего решения: conveyor list`)
  const spent = spentToday(); const budget = Number(get('budget', 20))
  spent >= budget ? warn.push(`дневной бюджет $${budget} исчерпан ($${spent}) — новые задачи не берутся`) : ok.push(`бюджет: $${spent} из $${budget}`)
  return { ok, warn }
}

// ---------- вечерний отчёт ----------
// Числа, а не приборная панель: владельцу нужен ответ «что сегодня вышло и во сколько встало»,
// а не график, за которым надо ходить. Раз в сутки, вечером, одним сообщением.
function digestText (from, to) {
  const rows = q(`SELECT status, key, title, cost FROM tasks WHERE updated_at BETWEEN ? AND ?
    AND status IN ('done','failed','needs_review','asking','reverted')`, from, to)
  const spent = q1('SELECT ROUND(COALESCE(SUM(cost),0),2) c FROM runs WHERE started_at BETWEEN ? AND ?', from, to).c
  if (!rows.length && !spent) return null // тихий день — не новость; сообщение «ничего» учит не читать отчёты
  const by = s => rows.filter(r => r.status === s)
  const line = (t, list) => list.length ? `${t}: ${list.length}\n` + list.slice(0, 8).map(r => `  ${r.key} ${String(r.title).slice(0, 58)}`).join('\n') : ''
  return ['📊 За сегодня',
    line('✅ Принято', by('done')), line('👀 Ждёт тебя', by('needs_review')),
    line('❓ Агент спросил', by('asking')), line('❌ Не вышло', by('failed')),
    line('↩️ Откачено', by('reverted')),
    `\nПотрачено $${spent} из $${get('budget', 20)}`,
    (() => { const p = firstTryRate(from); return p == null ? '' : `С первой попытки: ${p}%` })()
  ].filter(Boolean).join('\n')
}

// Неделя: дешевеет ли задача и растёт ли доля принятого. Сравнение с ПРОШЛОЙ неделей —
// одно число без «стало лучше или хуже» не говорит ничего.
function trendText (now = Date.now()) {
  const week = 7 * 864e5
  const slice = (a, b) => {
    const done = q1(`SELECT COUNT(*) n, ROUND(COALESCE(AVG(cost),0),2) avg FROM tasks
      WHERE status='done' AND updated_at BETWEEN ? AND ?`, a, b)
    const all = q1(`SELECT COUNT(*) n FROM tasks WHERE status IN ('done','failed','needs_review','reverted')
      AND updated_at BETWEEN ? AND ?`, a, b)
    return { done: done.n, avg: done.avg, share: all.n ? Math.round(done.n * 100 / all.n) : null }
  }
  const cur = slice(now - week, now)
  const prev = slice(now - 2 * week, now - week)
  if (!cur.done && !prev.done) return null
  const move = (a, b, unit, less) => {
    if (a == null || b == null || !b) return ''
    const d = Math.round((a - b) / b * 100)
    if (Math.abs(d) < 5) return ' (как на прошлой неделе)'
    const better = less ? d < 0 : d > 0
    return ` (${d > 0 ? '+' : ''}${d}% к прошлой — ${better ? 'лучше' : 'хуже'})`
  }
  return ['📈 Неделя',
    `Принято задач: ${cur.done}${move(cur.done, prev.done, '', false)}`,
    `Средняя цена принятой: $${cur.avg}${move(cur.avg, prev.avg, '$', true)}`,
    cur.share != null ? `Доходит до конца: ${cur.share}%${move(cur.share, prev.share, '%', false)}` : ''
  ].filter(Boolean).join('\n')
}

// Утренняя планёрка: одно сообщение вместо россыпи за ночь. Открыл чат — за минуту принял
// все решения. Кнопки даём только у входящих: остальное — сводка, по ней идёшь в приложение.
function morningText () {
  const inb = q("SELECT key, title, repo FROM tasks WHERE status='inbox' ORDER BY priority DESC, id")
  const ask = q("SELECT key, title, question FROM tasks WHERE status='asking' ORDER BY id")
  const need = q("SELECT key, title FROM tasks WHERE status IN ('needs_review','failed') ORDER BY id")
  const night = new Date(); night.setHours(0, 0, 0, 0)
  const doneN = q1("SELECT COUNT(*) c FROM tasks WHERE status='done' AND updated_at >= ?", night.getTime() - 864e5).c
  if (!inb.length && !ask.length && !need.length) return null // тишина — не новость
  const part = (t, list, f) => list.length ? `${t} (${list.length}):\n` + list.slice(0, 6).map(f).join('\n') : ''
  return ['☀️ Планёрка',
    part('❓ Ждут твоего ответа', ask, t => `  ${t.key} — ${String(t.question || t.title).slice(0, 90)}`),
    part('👀 Ждут решения', need, t => `  ${t.key} — ${String(t.title).slice(0, 70)}`),
    part('📥 Во входящих', inb, t => `  ${t.key} · ${t.repo} — ${String(t.title).slice(0, 70)}`),
    `\nЗа вчера принято: ${doneN}. Потрачено сегодня $${spentToday()}.`
  ].filter(Boolean).join('\n\n')
}

function maybeMorning () {
  const d = new Date()
  if (d.getHours() < Number(get('morning_hour', 9)) || d.getHours() > 11) return
  const today = d.toISOString().slice(0, 10)
  if (get('morning_day', '') === today) return
  set('morning_day', today)
  const text = morningText()
  const c = tgCfg()
  if (!text || !c?.owner) return
  const first = q1("SELECT id FROM tasks WHERE status='inbox' ORDER BY priority DESC, id LIMIT 1")
  tgSend(c.owner, text, first ? { reply_markup: tgKeyboard(first.id) } : {})
}

// Раз в сутки после DIGEST_HOUR. Дата последнего отчёта — в настройках, а не в памяти:
// демон перезапускается десятки раз в день, и отчёт приходил бы на каждый старт.
function maybeDigest () {
  const d = new Date()
  if (d.getHours() < Number(get('digest_hour', 21))) return
  const today = d.toISOString().slice(0, 10)
  if (get('digest_day', '') === today) return
  set('digest_day', today)
  const from = new Date(d); from.setHours(0, 0, 0, 0)
  const text = digestText(from.getTime(), Date.now())
  if (!text) return
  const trend = d.getDay() === 0 ? trendText() : null // воскресенье — ещё и неделя
  notify('Конвейер за сегодня', text.split('\n').slice(1, 3).join(' '))
  const c = tgCfg()
  if (c?.owner) tgSend(c.owner, [text, trend].filter(Boolean).join('\n\n'))
}

// ---------- приёмка: сколько это будет стоить и кем делать ----------
const MODELS = ['haiku', 'sonnet', 'opus']
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] // mirrors `claude --help`'s --effort levels (checked 2026-09-16, see journal/events)
// Цену берём из ИСТОРИИ этого репозитория, а не у модели: она про свою стоимость знает
// не больше нашего, а прошлые задачи — настоящие числа. Медиана, а не среднее: одна
// задача за $20 не должна объявлять дорогими все следующие.
function pastCost (repoName, model) {
  const rows = q(`SELECT cost FROM tasks WHERE repo=? AND status IN ('done','reverted') AND cost>0
    ${model ? 'AND model=?' : ''} ORDER BY id DESC LIMIT 12`, ...(model ? [repoName, model] : [repoName]))
  if (!rows.length) return null
  const c = rows.map(r => r.cost).sort((a, b) => a - b)
  return c[Math.floor(c.length / 2)]
}

// Кем делать. Спрашиваем самую дешёвую модель одним словом: строчка в README не должна
// стоить как миграция схемы. Не ответила или ответила ерунду — берём sonnet, как раньше:
// неизвестность обязана падать в прежнее поведение, а не в дешёвое.
//
// Спрашиваем в ПУСТОМ каталоге, а не в репозитории. Замер 18.08: тот же вопрос в
// conveyor-sandbox дал sonnet, в пустом каталоге трижды подряд haiku — файлы вокруг влияют
// на ответ, хотя вопрос только про текст задачи. Плюс это честнее: приёмщик судит задачу,
// а не код, и лезть ему в репозиторий незачем.
function pickModel (task, repo) {
  const ask = [
    'Ты приёмщик задач. Оцени, агент какой мощности нужен.',
    'haiku — механическая правка: текст, README, переименование, опечатка, одна строка.',
    'sonnet — обычная работа: функция с тестом, починка бага, небольшая доработка.',
    'opus — трудное: миграция данных, схема, архитектура, безопасность, многофайловый рефактор.',
    '', `Задача: ${task.title}`, task.body ? `Подробности: ${String(task.body).slice(0, 1500)}` : '',
    '', 'Ответь ОДНИМ словом: haiku, sonnet или opus.'
  ].filter(Boolean).join('\n')
  const neutral = fs.mkdtempSync(path.join(os.tmpdir(), 'conveyor-intake-'))
  return new Promise(resolve => {
    const out = []
    const done = v => { fs.rmSync(neutral, { recursive: true, force: true }); resolve(v) }
    const child = spawn('claude', ['-p', ask, '--output-format', 'json', '--model', 'haiku'],
      { cwd: neutral, stdio: ['ignore', 'pipe', 'ignore'] })
    child.on('error', () => done(null))
    const timer = setTimeout(() => { try { child.kill('SIGKILL') } catch {} }, 90000)
    child.stdout.on('data', c => out.push(c))
    child.on('exit', () => {
      clearTimeout(timer)
      try {
        const word = String(JSON.parse(out.join('')).result || '').toLowerCase()
        done(MODELS.find(m => word.includes(m)) || null)
      } catch { done(null) }
    })
  })
}

// Одна приёмка на задачу: модель и ожидаемая цена. Нужна ДО старта — по ней решается,
// хватит ли на неё сегодняшнего бюджета.
// Сам вопрос «кем делать» стоит денег (замер: ~$0.024 — базовый контекст CLI, от нашего
// промпта почти не зависит). Значит там, где задачи и так дешевле этого, приёмка — чистый
// убыток: спрашивать за 2 цента, чтобы сэкономить один, глупо.
const INTAKE_COST = 0.025

async function intake (task, repo) {
  let model = task.model || repo.cfg.model || null
  let how = model ? 'выбрано заранее' : ''
  const typical = pastCost(task.repo, null)
  if (!model && repo.cfg.auto_model !== false) {
    if (typical != null && typical < INTAKE_COST * 3) {
      how = `не спрашивал: задачи тут и так по $${typical.toFixed(2)}`
    } else {
      model = await pickModel(task, repo)
      // Отказ и выбор обязаны звучать по-разному: иначе «приёмка: sonnet» одинаково
      // означает и решение приёмщика, и наш молчаливый запасной вариант — а это
      // ровно то, на чём я потерял час, гоняясь за «почему он выбрал sonnet».
      how = model ? 'выбрал приёмщик' : 'приёмщик не ответил — беру как раньше'
    }
  }
  model = model || 'sonnet'
  // цена — по прошлым задачам ЭТОЙ модели в ЭТОМ репо; нет истории — по репо целиком; нет и её — по умолчанию
  const est = pastCost(task.repo, model) ?? typical ?? Number(get('estimate_default', 0.3))
  run('UPDATE tasks SET model=?, estimate=? WHERE id=?', model, est, task.id)
  log(task.id, 'приёмка', `${model} (${how || 'по умолчанию'}), ожидаю около $${est.toFixed(2)}`)
  return { model, est }
}

// Квота подписки как планировщик (WAVE1 3.2): дорогая задача на почти пустой сессии
// иначе останавливает Завод на часы без предупреждения. Пороги не точный бюджет,
// а мягкая осторожность — % берём из того же usage(), что уже кормит шапку дашборда.
function quotaSessionPct (u) {
  const l = (u.limits || []).find(x => x.kind === 'session')
  return l ? Number(l.percent) : 0
}
// weekly_all — общий 7-дневный лимит (см. apps/factory.html:quotaChip); предупреждаем один раз
// на смену resets_at, ничего в расписании не трогаем — это отдельная задача, если понадобится.
function quotaWeeklyNote (u) {
  const l = (u.limits || []).find(x => x.kind === 'weekly_all')
  if (!l || !(Number(l.percent) > 90) || !l.resets_at) return null
  const resets = new Date(l.resets_at).getTime()
  if (!(resets > Date.now()) || resets - Date.now() > 864e5) return null
  return { at: l.resets_at, msg: `неделя занята на ${Math.round(l.percent)}%, сброс ${new Date(resets).toLocaleString('ru-RU')}` }
}

// Кого берём следующим. Отдельной функцией, а не строкой внутри цикла демона: очередь —
// то, о чём владелец судит («почему срочное стоит?»), и проверять её надо ТЕМ ЖЕ кодом,
// которым она живёт, а не копией запроса в тесте.
function nextTask () {
  // зависимость провалилась — дальше по цепочке идти незачем, помечаем и не крутим впустую
  const info = run(`UPDATE tasks SET status='blocked', error='зависимость не выполнена' WHERE status='queued'
       AND deps IS NOT NULL AND deps<>'' AND EXISTS (SELECT 1 FROM tasks d
       WHERE instr(','||deps||',', ','||d.id||',')>0 AND d.status IN ('failed','cancelled','needs_review','blocked'))`)
  // Кто-то только что встал — значит план сломался, и владелец должен узнать об этом сегодня,
  // а не обнаружить через неделю задачи, простоявшие в «ждёт другую».
  if (info.changes && !SANDBOX) {
    for (const f of q(`SELECT DISTINCT d.id FROM tasks t JOIN tasks d
      ON instr(','||t.deps||',', ','||d.id||',')>0
      WHERE t.status='blocked' AND d.status IN ('failed','needs_review','cancelled')`)) {
      if (!coordinated.has(f.id)) { coordinated.add(f.id); coordinate(f.id).catch(e => log(f.id, 'план', e.message)) }
    }
  }
  // Зависимость обязана СУЩЕСТВОВАТЬ и быть done. Раньше несуществующий id считался
  // выполненным (NOT EXISTS не находит несуществующее) — задача стартовала раньше контракта.
  // Срочное вперёд, при равном приоритете — по очереди поступления.
  // Задача эпики берётся, только пока её эпика открыта и стоит именно на её волне (ZAVOD-TZ 6.7.4).
  return q1(`SELECT * FROM tasks t WHERE t.status='queued'
       AND (t.deps IS NULL OR t.deps='' OR (
         SELECT COUNT(*) FROM tasks d WHERE instr(','||t.deps||',', ','||d.id||',')>0 AND d.status='done'
       ) = (LENGTH(t.deps) - LENGTH(REPLACE(t.deps, ',', '')) + 1))
       AND (t.epic_id IS NULL OR EXISTS (SELECT 1 FROM epics e WHERE e.id=t.epic_id AND e.status='open' AND e.wave=t.wave))
       ORDER BY t.priority DESC, t.id LIMIT 1`)
}

function dropVariant (repo, r) {
  try { git(repo.clone, 'worktree', 'remove', '--force', r.wt) } catch {}
  try { git(repo.clone, 'branch', '-D', r.branch) } catch {}
}

// ---------- уборка после падения демона ----------
// Агенты запускаются detached, поэтому переживают смерть демона: без этого они жгут токены
// и коммитят в брошенные ветки. PID сам по себе доверия не заслуживает — система их переиспользует,
// поэтому убиваем только процесс, в командной строке которого стоит НАШ воркспейс.
function reapOrphans () {
  for (const r of q('SELECT r.id, r.pid, t.key, t.worktree FROM runs r JOIN tasks t ON t.id=r.task_id WHERE r.ended_at IS NULL AND r.pid IS NOT NULL')) {
    let ours = false
    try {
      const cmd = execFileSync('ps', ['-p', String(r.pid), '-o', 'command='], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      ours = Boolean(r.worktree) && cmd.includes(r.worktree)
    } catch {} // процесса уже нет — просто закрываем запись
    if (ours) {
      try { process.kill(-r.pid, 'SIGKILL') } catch { try { process.kill(r.pid, 'SIGKILL') } catch {} }
      log(null, 'уборка', `${r.key}: убит осиротевший агент (pid ${r.pid})`)
    }
    run('UPDATE runs SET ended_at=?, exit_code=COALESCE(exit_code,-1) WHERE id=?', now(), r.id)
  }
  // воркспейсы задач, которые давно завершились: git worktree prune их не видит, пока каталог на месте
  for (const repo of q('SELECT name, clone FROM repos')) {
    const dir = path.join(TREES, repo.name)
    if (!fs.existsSync(dir)) continue
    for (const name of fs.readdirSync(dir)) {
      const key = name.replace(/-[abc]$/, '')
      const t = q1('SELECT status FROM tasks WHERE key=?', key)
      if (t && !['done', 'failed', 'cancelled'].includes(t.status)) continue // живая или ждёт ревью — не трогаем
      const wt = path.join(dir, name)
      try { git(repo.clone, 'worktree', 'remove', '--force', wt) } catch { fs.rmSync(wt, { recursive: true, force: true }) }
      log(null, 'уборка', `убран брошенный воркспейс ${repo.name}/${name}`)
    }
    try { git(repo.clone, 'worktree', 'prune') } catch {}
  }
}

// Уборка раз в сутки. Всё, что растёт от работы, обязано иметь потолок:
// иначе через месяц конвейер съедает диск молча, а лог перестают читать.
function housekeep () {
  run("DELETE FROM events WHERE ts < ? AND kind NOT IN ('критик','merge')", now() - 14 * 864e5)
  // Копилка знаний, которую никто не чистит, за полгода становится шумом в КАЖДОМ промпте —
  // и владелец платит за неё в каждой задаче. Урок, ни разу не подтверждённый повтором за
  // месяц, уходит; подтверждённые живут, их вес и есть доказательство пользы.
  const gone = run('DELETE FROM lessons WHERE hits=0 AND created_at < ?', now() - 30 * 864e5)
  if (gone.changes) log(null, 'уборка', `забыто неподтверждённых уроков: ${gone.changes}`)
  // снимки «до/после» копятся вечно: держим последние 120, остальное — архив ради архива
  try {
    const shots = fs.readdirSync(SHOTS).map(n => ({ n, t: fs.statSync(path.join(SHOTS, n)).mtimeMs }))
      .sort((a, b) => b.t - a.t).slice(120)
    for (const f of shots) fs.rmSync(path.join(SHOTS, f.n), { force: true })
    if (shots.length) log(null, 'уборка', `удалено старых снимков: ${shots.length}`)
  } catch {}
  run('DELETE FROM runs WHERE started_at < ?', now() - 30 * 864e5)
  try { db.exec('PRAGMA wal_checkpoint(TRUNCATE)') } catch {} // WAL сам не сжимается и растёт на гигабайты
  try { db.exec('VACUUM') } catch {}
  // логи прогонов: держим последние 200 каталогов, остальное — археология
  try {
    const dirs = fs.readdirSync(RUNS).map(n => ({ n, t: fs.statSync(path.join(RUNS, n)).mtimeMs }))
      .sort((a, b) => b.t - a.t).slice(200)
    for (const d of dirs) fs.rmSync(path.join(RUNS, d.n), { recursive: true, force: true })
    if (dirs.length) log(null, 'уборка', `удалено старых логов прогонов: ${dirs.length}`)
  } catch {}
  // журнал демона: launchd дописывает бесконечно, обрезаем хвостом
  try {
    const f = path.join(ROOT, 'daemon.log')
    if (fs.statSync(f).size > 5e6) {
      const tail = fs.readFileSync(f, 'utf8').split('\n').slice(-2000).join('\n')
      fs.writeFileSync(f, tail)
      log(null, 'уборка', 'журнал демона обрезан до последних 2000 строк')
    }
  } catch {}
}

// ---------- демон ----------
async function daemon (maxAgents) {
  // Один сбойный ход не имеет права ронять весь конвейер: логируем и живём дальше.
  // launchd поднимет упавший процесс, но при этом теряется живой прогресс всех агентов.
  process.on('unhandledRejection', e => { try { log(null, 'сбой', 'unhandledRejection: ' + (e && e.message || e)) } catch {} })
  process.on('uncaughtException', e => { try { log(null, 'сбой', 'uncaughtException: ' + (e && e.stack || e).slice(0, 400)) } catch {} })
  const active = new Set()
  // восстановление после рестарта: подвисшие задачи возвращаем в очередь
  reapOrphans()
  // перечисляем состояния покоя, а не работы: добавится новый рабочий статус — он не потеряется при рестарте
  const stuck = q(`SELECT id FROM tasks WHERE status NOT IN (${REST_STATUSES.map(() => '?').join(',')})`, ...REST_STATUSES)
  // перезапуск демона — не вина задачи: возвращаем попытку обратно, иначе она молча съедает ретрай
  for (const s of stuck) {
    run('UPDATE tasks SET attempts = MAX(attempts - 1, 0) WHERE id=?', s.id)
    setStatus(s.id, 'queued', { error: 'демон был перезапущен' })
  }
  housekeep()
  setInterval(housekeep, 24 * 3600 * 1000).unref()
  if (!SANDBOX) setInterval(() => { try { maybeDigest(); maybeMorning() } catch (e) { log(null, 'отчёт', e.message) } }, 5 * 60000).unref()
  setInterval(() => { try { fireSchedules() } catch (e) { log(null, 'расписание', e.message) } }, 60000).unref()
  if (!SANDBOX) setInterval(() => { proposeWork().catch(e => log(null, 'предложения', e.message)) }, 24 * 3600 * 1000).unref()
  console.log(`конвейер запущен: до ${maxAgents} агентов, бюджет $${get('budget', 20)}/сутки, дашборд http://localhost:${PORT}`)
  if (jiraCfg()) console.log(`Jira подключена: задачи с меткой «${JIRA_LABEL}» забираются автоматически`)
  keepTunnel()
  if (tgCfg()) {
    const chats = Object.keys(tgChats()).length
    console.log(`Телеграм подключён: задачи приходят из чатов (подключено ${chats}), запуск — кнопкой владельца`)
    tgLoop() // свой цикл: длинный опрос не имеет права задерживать диспетчер
  }
  dashboard(maxAgents, active)
  let quiet = ''
  let quietBudget = '' // о придержанной задаче говорим один раз, а не каждые две секунды
  let quietQuota = ''
  let weeklyQuotaNotedAt = '' // resets_at последнего залогированного предупреждения — не долбим лог каждые 2 сек
  let nextJira = 0
  let lastNolErr = ''
  let lastJiraErr = '' // одинаковые ошибки не пишем повторно: один сбой сети успел насыпать 4000 строк в events
  for (;;) {
    if (Date.now() > nextJira) { // раз в полминуты: чаще Jira незачем, реже — заметно ждёшь
      nextJira = Date.now() + 30000
      nolSync().catch(e => { if (e.message !== lastNolErr) { log(null, 'nol', e.message); lastNolErr = e.message } })
      jiraSync().then(() => { if (lastJiraErr) { log(null, 'jira', 'связь восстановилась'); lastJiraErr = '' } })
        .catch(e => {
          if (e.message !== lastJiraErr) { log(null, 'jira', e.message); lastJiraErr = e.message }
          nextJira = Date.now() + 5 * 60000 // при сбое не долбим каждые 30 сек
        })
    }
    while (active.size < maxAgents) {
      const stop = get('paused', '0') === '1' ? 'на паузе'
        : Number(get('paused_until', 0)) > Date.now() ? `лимит подписки Claude до ${new Date(Number(get('paused_until', 0))).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
        : spentToday() >= Number(get('budget', 20)) ? `дневной бюджет $${get('budget', 20)} исчерпан` : null
      if (stop) { // молчим, пока причина не изменилась, иначе лог зальёт диск
        if (quiet !== stop && q1("SELECT 1 x FROM tasks WHERE status='queued'")) { log(null, 'пауза', `новые задачи не берём: ${stop}`); quiet = stop }
        break
      }
      quiet = ''
      const t = nextTask()
      if (!t) break
      // квота подписки (WAVE1 3.2): выше 95% сессии берём только срочное — ДО приёмки,
      // чтобы не тратить и эти токены тоже, пока их почти не осталось.
      const u = await usage()
      const weekly = quotaWeeklyNote(u)
      if (weekly && weeklyQuotaNotedAt !== weekly.at) { log(null, 'квота', weekly.msg); weeklyQuotaNotedAt = weekly.at }
      const sessionPct = quotaSessionPct(u)
      if (sessionPct > 95 && t.priority !== 1) {
        if (quietQuota !== t.key) { log(t.id, 'квота', `придержал: сессия занята на ${Math.round(sessionPct)}%, берём только срочное`); quietQuota = t.key }
        break
      }
      // приёмка один раз на задачу: кем делать и во сколько встанет. Оценка нужна ДО старта —
      // иначе бюджет узнаёт о задаче, когда она уже съела половину остатка.
      const est = t.estimate ?? (await intake(t, getRepo(t.repo)).catch(() => ({ est: 0 }))).est
      if (sessionPct > 80) {
        const median = pastCost(t.repo, null)
        if (median != null && est > median) {
          if (quietQuota !== t.key) { log(t.id, 'квота', `придержал: сессия занята на ${Math.round(sessionPct)}%, дороже медианы $${median.toFixed(2)} по репо`); quietQuota = t.key }
          break
        }
      }
      quietQuota = ''
      const left = Number(get('budget', 20)) - spentToday()
      if (est > left) {
        const why = `на ${t.key} нужно около $${Number(est).toFixed(2)}, а до дневного потолка осталось $${left.toFixed(2)}`
        if (quietBudget !== t.key) {
          log(t.id, 'бюджет', `придержал: ${why}`)
          notify('Конвейер придержал задачу', `${why}. Поднять потолок: conveyor budget <сумма>`)
          quietBudget = t.key
        }
        break
      }
      quietBudget = ''
      setStatus(t.id, 'preparing')
      const p = processTask(t).finally(() => active.delete(p))
      active.add(p)
    }
    await new Promise(r => setTimeout(r, 2000))
  }
}

// ---------- дашборд ----------
function dashboard (maxAgents, active) {
  createServer((req, res) => {
    const [url, qs] = req.url.split('?')
    // no-store обязателен: WKWebView кэширует страницу намертво и показывает вчерашний интерфейс
    const send = (code, body, type = 'application/json') => {
      res.writeHead(code, { 'content-type': type + '; charset=utf-8', 'cache-control': 'no-store, must-revalidate' })
      res.end(body)
    }
    // Пока дашборд слушает только петлю, «попал сюда» = «сидит за этим маком», и пароля не нужно.
    // Туннель это допущение отменяет: снаружи постучаться может кто угодно, а кнопки здесь
    // запускают агентов. Поэтому чужой запрос обязан принести ключ — в ссылке или в куке.
    if (!localRequest(req) && !hasKey(req, qs)) {
      res.writeHead(401, { 'content-type': 'text/plain; charset=utf-8' })
      return res.end('нужен ключ доступа')
    }
    if (qs && hasKey(req, qs) && !localRequest(req)) res.setHeader('set-cookie', `ck=${tunnelKey()}; Path=/; HttpOnly; Max-Age=86400`)
    // NOL «Завод» на github.io читает состояние локального демона: CORS + Private Network Access (Chrome шлёт
    // preflight OPTIONS с Access-Control-Request-Private-Network на адреса локальной сети и ждёт явного разрешения)
    if (url === '/api/state' || url === '/api/usage' || url === '/api/epics') {
      res.setHeader('access-control-allow-origin', '*'); res.setHeader('access-control-allow-private-network', 'true')
      res.setHeader('access-control-allow-methods', 'GET, OPTIONS'); res.setHeader('access-control-allow-headers', '*')
      if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }
    }
    try { route(url, req, send) } catch (e) { send(500, JSON.stringify({ error: e.message })) } // дашборд не имеет права ронять агентов
  }).listen(PORT).on('error', e => {
    // Порт занят = демон уже работает. Два демона на одной базе дерутся за очередь и удваивают агентов.
    console.error(e.code === 'EADDRINUSE'
      ? `конвейер уже запущен (порт ${PORT} занят). Второй демон не нужен: смотри http://localhost:${PORT}`
      : `дашборд не поднялся: ${e.message}`)
    process.exit(1)
  })

  function route (url, req, send) {
    if (url === '/') return send(200, HTML(), 'text/html')
    // Собранный NOL с того же origin, что и API: браузеры не пускают https-сайт к localhost без разрешений,
    // а отсюда «Завод» видит живой демон напрямую. dist/ собирается пост-мердж шагом (см. after_merge в conveyor.json).
    if (url === '/nol' || url.startsWith('/nol/')) {
      const r = q1('SELECT clone FROM repos WHERE name=?', 'nol'); if (!r) return send(404, 'nol не подключён', 'text/plain')
      let rel = decodeURIComponent(url.replace(/^\/nol\/?/, '')) || 'index.html'; if (rel.endsWith('/')) rel += 'index.html'
      const f = path.join(r.clone, 'dist', rel)
      if (!f.startsWith(path.join(r.clone, 'dist')) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return send(404, 'нет файла', 'text/plain')
      const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.xml': 'application/xml' }
      return send(200, fs.readFileSync(f), MIME[path.extname(f)] || 'application/octet-stream')
    }
    if (url === '/api/state') {
      const tasks = q("SELECT * FROM tasks ORDER BY (status IN ('done','failed','cancelled')), id DESC LIMIT 60")
      // Автоматика читается с репозитория продукта: остальные подключённые репо (если есть) — служебные.
      const stateRepo = q1('SELECT * FROM repos WHERE name=?', 'nol') || q1('SELECT * FROM repos LIMIT 1')
      const stateCfg = stateRepo ? readCfg(stateRepo.src, stateRepo.clone) : DEFAULT_CFG
      return send(200, JSON.stringify({
        tasks, slots: maxAgents, busy: active.size,
        cost: q1('SELECT ROUND(SUM(cost),2) c FROM tasks').c || 0,
        today: spentToday(), budget: Number(get('budget', 20)), paused: get('paused', '0') === '1', paused_until: Number(get('paused_until', 0)),
        events: q('SELECT * FROM events ORDER BY id DESC LIMIT 25'),
        version: VERSION,
        automation: {
          review: !!stateCfg.critic, merge: !!stateCfg.push, conflicts: true,
          tester: String(stateCfg.after_merge || '').includes('tester')
        },
        epics: q('SELECT id, key, title, status, waves, wave FROM epics ORDER BY id DESC').map(e => {
          const c = q1("SELECT COUNT(*) total, SUM(status='done') done FROM tasks WHERE epic_id=?", e.id)
          return { ...e, done_tasks: c.done || 0, total_tasks: c.total || 0 }
        })
      }))
    }
    if (url === '/api/usage') {
      usage().then(data => send(200, JSON.stringify(data)))
        .catch(e => send(200, JSON.stringify({ limits: [], breakdown: [], error: e.message })))
      return
    }
    // слово владельца живой сессии: и ответ на вопрос агента, и «переделай вот так»
    const nm = url.match(/^\/api\/task\/(\d+)\/(say|urgent|revert|recheck)$/)
    if (nm && req.method === 'POST') {
      const t = q1('SELECT * FROM tasks WHERE id=?', Number(nm[1]))
      if (!t) return send(404, '{"error":"нет задачи"}')
      if (nm[2] === 'urgent') {
        run('UPDATE tasks SET priority=CASE WHEN priority>0 THEN 0 ELSE 1 END WHERE id=?', t.id)
        return send(200, JSON.stringify({ ok: true, priority: q1('SELECT priority FROM tasks WHERE id=?', t.id).priority }))
      }
      if (nm[2] === 'recheck') {
        if (RUNNING_STATUSES.includes(t.status)) return send(409, JSON.stringify({ error: `${t.key} сейчас работает` }))
        recheckTask(t).catch(e => { log(t.id, 'перепроверка', e.message); setStatus(t.id, 'needs_review', { error: 'REVIEW: ' + e.message }) })
        return send(200, '{"ok":true}')
      }
      if (nm[2] === 'revert') {
        if (t.status !== 'done' || !t.merge_sha) return send(409, '{"error":"откатывать нечего: задача не влита"}')
        enqueueMerge(() => revertTask(t, getRepo(t.repo)), t.repo)
          .catch(e => { log(t.id, 'откат', e.message); notify(`${t.key} — откат не прошёл`, e.message) })
        return send(200, '{"ok":true}')
      }
      let b = ''; req.on('data', c => { b += c }); req.on('end', () => {
        try {
          const note = String(JSON.parse(b).note || '').trim()
          if (!note) return send(400, '{"error":"пустая записка"}')
          if (t.status === 'running') {
            // WAVE2 3.3: работающего агента прерываем как по таймауту и продолжаем с этим словом
            const interrupt = (t.variants || 1) > 1 ? null : liveAgents.get(t.id)
            if (!interrupt || !interrupt(note)) return send(409, JSON.stringify({ error: `${t.key}: агент сейчас не на заходе — повтори через минуту` }))
            return send(200, '{"ok":true,"interrupted":true}')
          }
          if (!['asking', 'needs_review', 'failed'].includes(t.status)) return send(409, JSON.stringify({ error: `${t.key} сейчас ${STATUS_WORD[t.status] || t.status} — дождись остановки` }))
          ownerSays(t, note)
          send(200, '{"ok":true}')
        } catch (e) { send(400, JSON.stringify({ error: e.message })) }
      })
      return
    }
    const m = url.match(/^\/api\/task\/(\d+)\/(cancel|retry|open|approve|start)$/)
    if (m && req.method === 'POST') {
      const id = Number(m[1]); const t = q1('SELECT * FROM tasks WHERE id=?', id)
      if (!t) return send(404, '{"error":"нет задачи"}')
      if (m[2] === 'start') {
        if (t.status !== 'inbox') return send(409, JSON.stringify({ error: `${t.key} уже ${STATUS_WORD[t.status] || t.status}` }))
        setStatus(id, 'queued')
        if (t.source === 'telegram') tgTell(t.source_ref, `▶️ ${t.key} взята в работу.`)
      } else if (m[2] === 'cancel') setStatus(id, 'cancelled')
      else if (m[2] === 'retry') {
        // перезапуск работающей задачи снёс бы воркспейс из-под живого агента: две обработки одной задачи
        if (RUNNING_STATUSES.includes(t.status)) return send(409, JSON.stringify({ error: `${t.key} сейчас работает — сначала отмени` }))
        run("UPDATE tasks SET status='queued', attempts=0, error=NULL, updated_at=? WHERE id=?", now(), id)
      }
      else if (m[2] === 'open') {
        const dir = t.worktree && fs.existsSync(t.worktree) ? t.worktree : q1('SELECT clone FROM repos WHERE name=?', t.repo)?.clone
        if (dir) openInVSCode(dir)
      } else if (m[2] === 'approve') {
        if (t.status !== 'needs_review') return send(409, '{"error":"задача не ждёт ревью"}')
        run('UPDATE tasks SET owner_ok=1 WHERE id=?', id)
        decide(id, 'принято владельцем', 'нажал «Принять работу» в приложении')
        enqueueMerge(() => mergeTask(q1('SELECT * FROM tasks WHERE id=?', id), getRepo(t.repo)), t.repo)
          .catch(e => log(id, 'мердж', `ручное одобрение не прошло: ${e.message}`))
      }
      return send(200, '{"ok":true}')
    }
    if (url === '/api/add' && req.method === 'POST') {
      let b = ''; req.on('data', c => b += c); req.on('end', () => {
        // body третьим аргументом молча терялся: taskAdd ждёт объект настроек, а не строку
        try {
          const { repo, title, body, model, urgent } = JSON.parse(b)
          const t = taskAdd(repo, title, { body: body || '', model: MODELS.includes(model) ? model : null, priority: urgent ? 1 : 0 })
          send(200, JSON.stringify({ ok: true, key: t.key }))
        } catch (e) { send(400, JSON.stringify({ error: e.message })) }
      }); return
    }
    // разбить цель на задачи с зависимостями — то же, что conveyor plan, только кнопкой
    if (url === '/api/plan' && req.method === 'POST') {
      let b = ''; req.on('data', c => { b += c }); req.on('end', async () => {
        try {
          const { repo, goal } = JSON.parse(b)
          if (!String(goal || '').trim()) return send(400, '{"error":"пустая цель"}')
          const keys = await planGoal(repo, goal)
          send(200, JSON.stringify({ ok: true, keys }))
        } catch (e) { send(500, JSON.stringify({ error: e.message })) }
      }); return
    }
    if (url === '/api/pause' && req.method === 'POST') {
      set('paused', get('paused', '0') === '1' ? '0' : '1')
      return send(200, JSON.stringify({ paused: get('paused', '0') === '1' }))
    }
    if (url === '/api/repos') return send(200, JSON.stringify(q('SELECT name, base FROM repos')))
    // эпики: цель, разбитая на волны задач (ZAVOD-TZ раздел 4)
    if (url === '/api/epics') {
      const epics = q('SELECT id, key, title, goal, status, waves, wave, auto_accept, branch, created_at FROM epics ORDER BY id DESC').map(e => ({
        ...e, auto_accept: !!e.auto_accept,
        tasks: q('SELECT id, key, title, status, wave, cost, model FROM tasks WHERE epic_id=? ORDER BY wave, id', e.id)
      }))
      return send(200, JSON.stringify({ epics }))
    }
    if (url === '/api/epic' && req.method === 'POST') {
      let b = ''; req.on('data', c => { b += c }); req.on('end', async () => {
        try {
          const { repo, title, goal, auto_accept } = JSON.parse(b)
          if (!String(goal || '').trim()) return send(400, '{"error":"пустая цель"}')
          const r = await epicAdd(repo, { title: String(title || goal).slice(0, 200), goal, auto_accept: !!auto_accept })
          send(200, JSON.stringify({ ok: true, ...r }))
        } catch (e) { send(500, JSON.stringify({ error: e.message })) }
      }); return
    }
    const em = url.match(/^\/api\/epic\/(\d+)\/(accept|finalize|cancel)$/)
    if (em && req.method === 'POST') {
      const e = q1('SELECT * FROM epics WHERE id=?', Number(em[1]))
      if (!e) return send(404, '{"error":"нет эпики"}')
      if (em[2] === 'cancel') { cancelEpic(e); return send(200, '{"ok":true}') }
      if (e.status !== 'open') return send(409, JSON.stringify({ error: `эпика ${e.key} не в работе (${e.status})` }))
      const unclosed = q("SELECT key FROM tasks WHERE epic_id=? AND wave=? AND status<>'done'", e.id, e.wave)
      if (unclosed.length) return send(409, JSON.stringify({ error: `волна не закрыта: ${unclosed.map(t => t.key).join(', ')}` }))
      if (em[2] === 'finalize') {
        if (e.wave < e.waves) return send(409, JSON.stringify({ error: `волна W${e.wave} не последняя из ${e.waves}` }))
        enqueueMerge(() => finalizeEpic(e.id), e.repo).catch(err => log(null, 'эпика', `${e.key}: финализация не прошла — ${err.message}`))
        return send(200, '{"ok":true}')
      }
      if (e.wave >= e.waves) return send(409, JSON.stringify({ error: `волна W${e.wave} последняя — используй finalize` }))
      run('UPDATE epics SET wave=wave+1, updated_at=? WHERE id=?', now(), e.id)
      log(null, 'эпика', `${e.key}: волна W${e.wave} принята владельцем — начинаю W${e.wave + 1}`)
      return send(200, '{"ok":true}')
    }
    // чем агент занят прямо сейчас: последние события его потока
    const lm = url.match(/^\/api\/task\/(\d+)\/live$/)
    if (lm) {
      const t = q1('SELECT * FROM tasks WHERE id=?', Number(lm[1]))
      const r = t && q1('SELECT log FROM runs WHERE task_id=? ORDER BY id DESC LIMIT 1', t.id)
      // Заходов у задачи бывает много (доработки, попытки, варианты), и последний не
      // рассказывает, чем кончились прежние — а переделанная трижды задача это главный вопрос.
      const runs = t ? q(`SELECT round, started_at, ended_at, exit_code, cost, turns FROM runs
        WHERE task_id=? ORDER BY id`, t.id) : []
      const decisions = t ? q('SELECT ts, kind, text FROM decisions WHERE task_id=? ORDER BY id', t.id) : []
      return send(200, JSON.stringify({ feed: r?.log ? liveFeed(r.log) : [], runs, decisions }))
    }
    const dm = url.match(/^\/api\/task\/(\d+)\/diff$/)
    if (dm) {
      const t = q1('SELECT * FROM tasks WHERE id=?', Number(dm[1]))
      if (!t) return send(404, '{"error":"нет задачи"}')
      return send(200, JSON.stringify({ diff: taskDiff(t) }))
    }
    // для ассистента: вся задача одним запросом, с диффом и событиями — GET /api/task/BAV-5
    const k = url.match(/^\/api\/task\/([A-Z]+-\d+)$/)
    if (k) {
      const t = q1('SELECT * FROM tasks WHERE key=?', k[1])
      if (!t) return send(404, '{"error":"нет задачи"}')
      return send(200, JSON.stringify({
        ...t, diff: taskDiff(t, 100000),
        events: q('SELECT ts, kind, msg FROM events WHERE task_id=? ORDER BY id DESC LIMIT 15', t.id)
      }))
    }
    send(404, '{}')
  }
}

// Интерфейс живёт отдельным файлом: править вид, не трогая оркестратор.
const HTML = () => fs.readFileSync(path.join(import.meta.dirname, 'dashboard.html'), 'utf8')

// ---------- CLI ----------
const [cmd, ...rest] = process.argv.slice(2)
const cmds = {
  repo: () => {
    if (rest[0] === 'add') repoAdd(rest[1])
    else if (rest[0] === 'rm') repoRm(rest[1])
    else console.table(q('SELECT name, base, prefix, clone FROM repos'))
  },
  add: () => {
    const flag = f => { const i = rest.indexOf(f); return i > -1 ? rest[i + 1] : null }
    const cut = rest.findIndex(a => a.startsWith('--'))
    const words = (cut > -1 ? rest.slice(1, cut) : rest.slice(1)).join(' ')
    const [model, variants] = [flag('--model'), Number(flag('--variants')) || 1]
    // --after КЛЮЧ: задачи, правящие один файл, обязаны идти цепочкой, иначе гарантированный конфликт
    const after = flag('--after')
    const dep = after ? q1('SELECT id FROM tasks WHERE key=?', after) : null
    if (after && !dep) return console.error(`нет задачи ${after}, не на что ссылаться`)
    const t = taskAdd(rest[0], words, { model, variants, deps: dep ? String(dep.id) : null })
    console.log(`${t.key} в очереди${model ? `, модель ${model}` : ''}${variants > 1 ? `, вариантов ${variants}` : ''}${after ? `, после ${after}` : ''}`)
  },
  plan: () => planGoal(rest[0], rest.slice(1).join(' ')).catch(e => { console.error(e.message); process.exit(1) }),
  budget: () => { if (rest[0]) set('budget', Number(rest[0])); console.log(`бюджет $${get('budget', 20)}/сутки, сегодня потрачено $${spentToday()}`) },
  nightly: () => nightly().catch(e => { console.error(e.message); process.exitCode = 1 }),
  propose: () => proposeWork().catch(e => { console.error(e.message); process.exitCode = 1 }),
  // Твоя часть — только токен. Chat id, запись в автозапуск и проверку беру на себя.
  tg: async () => {
    const token = rest[0]
    if (!/^\d{8,10}:[\w-]{30,}$/.test(token || '')) {
      return console.error('нужен токен бота: conveyor tg 123456789:AA...\n(в телеграме напиши @BotFather → /newbot, потом напиши своему боту любое слово)')
    }
    const upd = await new Promise(res => {
      const out = []
      const c = spawn('curl', ['-sS', '-m', '20', `https://api.telegram.org/bot${token}/getUpdates`], { stdio: ['ignore', 'pipe', 'ignore'] })
      c.stdout.on('data', d => out.push(d))
      c.on('exit', () => { try { res(JSON.parse(Buffer.concat(out).toString())) } catch { res(null) } })
    })
    if (!upd?.ok) return console.error('телеграм не принял токен — проверь, что скопирован целиком')
    const chat = upd.result?.map(u => u.message?.chat?.id).filter(Boolean).pop()
    if (!chat) return console.error('напиши своему боту любое сообщение в телеграме и повтори команду — без этого он не имеет права писать тебе первым')
    const plist = path.join(HOME, 'Library', 'LaunchAgents', 'com.murat.conveyor.plist')
    let xml = fs.readFileSync(plist, 'utf8')
    xml = xml.replace(/\s*<key>CONVEYOR_TG_(TOKEN|CHAT)<\/key>\s*<string>[^<]*<\/string>/g, '')
      .replace('<key>PATH</key>', `<key>CONVEYOR_TG_TOKEN</key>\n    <string>${token}</string>\n    <key>CONVEYOR_TG_CHAT</key>\n    <string>${chat}</string>\n    <key>PATH</key>`)
    fs.writeFileSync(plist, xml)
    // и в файл: переустановка автозапуска затирает plist, а конвейер не должен от этого оглохнуть
    fs.mkdirSync(path.dirname(TG_ENV), { recursive: true })
    fs.writeFileSync(TG_ENV, `CONVEYOR_TG_TOKEN=${token}\nCONVEYOR_TG_CHAT=${chat}\n`, { mode: 0o600 })
    process.env.CONVEYOR_TG_TOKEN = token; process.env.CONVEYOR_TG_CHAT = String(chat)
    notify('Конвейер подключён', 'Пиши сюда задачи — они лягут во входящие.')
    console.log(`готово: чат ${chat}.
Теперь напиши боту задачу словами — она приедет во входящие с кнопкой «Запустить».
Чтобы задачи принимал целый канал: добавь бота админом в канал, напиши туда что-нибудь —
и в личке появится кнопка «Подключить». (В обычной ГРУППЕ у бота по умолчанию закрыт доступ
к сообщениям: у @BotFather → /setprivacy → Disable, либо используй канал.)
Перезапусти демон: launchctl kickstart -k gui/$(id -u)/com.murat.conveyor`)
  },
  // Новый токен Jira: проверяю его на живой Jira и только потом сохраняю поверх старого.
  'jira-token': async () => {
    const token = rest[0]
    if (!token) return console.error('нужен токен: conveyor jira-token ATATT...')
    const cur = fs.readFileSync(JIRA_ENV, 'utf8')
    fs.writeFileSync(JIRA_ENV + '.bak', cur, { mode: 0o600 })
    fs.writeFileSync(JIRA_ENV, cur.replace(/^JIRA_TOKEN=.*/m, `JIRA_TOKEN=${token}`), { mode: 0o600 })
    try {
      const me = await jira('/rest/api/3/myself')
      console.log(`токен принят: ${me.displayName} <${me.emailAddress}>. Старый можно смело отзывать в Atlassian.`)
      fs.rmSync(JIRA_ENV + '.bak', { force: true })
    } catch (e) {
      fs.writeFileSync(JIRA_ENV, cur, { mode: 0o600 })
      console.error(`токен не подошёл, вернул прежний. ${e.message}`)
      process.exit(1)
    }
  },
  jira: () => jiraSync().then(n => console.log(n ? `взято задач: ${n}` : `новых задач с меткой «${JIRA_LABEL}» нет`))
    .catch(e => { console.error(e.message); process.exit(1) }),
  nol: () => nolSync().then(n => console.log(n ? `взято карточек: ${n}` : 'новых карточек Queued на доске нет'))
    .catch(e => { console.error(e.message); process.exit(1) }),
  pause: () => { set('paused', '1'); console.log('конвейер на паузе: текущие агенты доработают, новые задачи не берутся') },
  go: () => { set('paused', '0'); console.log('конвейер снят с паузы') },
  cost: () => console.table(q(`SELECT t.key, t.status, COUNT(r.id) прогонов, ROUND(SUM(r.cost),2) "$",
    SUM(r.turns) ходов FROM tasks t LEFT JOIN runs r ON r.task_id=t.id GROUP BY t.id ORDER BY t.id DESC LIMIT 20`)),
  daemon: () => daemon(Number(rest[0] || process.env.CONVEYOR_AGENTS || 5)),
  list: () => console.table(q('SELECT id, key, repo, status, attempts, title FROM tasks ORDER BY id DESC LIMIT 40')),
  // слово владельца живой сессии: ответ на вопрос агента или «переделай вот так»
  say: () => {
    const t = q1('SELECT * FROM tasks WHERE key=?', rest[0])
    if (!t) return console.error(`нет задачи ${rest[0]}`)
    const note = rest.slice(1).join(' ').trim()
    if (!note) return console.error('что сказать агенту? conveyor say BAV-9 «архивируй, не удаляй»')
    if (!['asking', 'needs_review', 'failed'].includes(t.status)) return console.error(`${t.key} сейчас ${STATUS_WORD[t.status] || t.status} — дождись остановки`)
    ownerSays(t, note)
    console.log(`${t.key}: передано агенту, продолжит с твоим словом`)
  },
  recheck: async () => {
    const t = q1('SELECT * FROM tasks WHERE key=?', rest[0])
    if (!t) return console.error(`нет задачи ${rest[0]}`)
    await recheckTask(t).catch(e => { console.error(e.message); process.exitCode = 1 })
    console.log(`${t.key}: ${q1('SELECT status s FROM tasks WHERE id=?', t.id).s}`)
  },
  revert: async () => {
    const t = q1('SELECT * FROM tasks WHERE key=?', rest[0])
    if (!t?.merge_sha || t.status !== 'done') return console.error(`${rest[0]}: откатывать нечего — задача не влита`)
    await revertTask(t, getRepo(t.repo)).catch(e => { console.error(e.message); process.exitCode = 1 })
  },
  urgent: () => {
    const t = q1('SELECT * FROM tasks WHERE key=?', rest[0])
    if (!t) return console.error(`нет задачи ${rest[0]}`)
    run('UPDATE tasks SET priority=CASE WHEN priority>0 THEN 0 ELSE 1 END WHERE id=?', t.id)
    console.log(`${t.key}: ${q1('SELECT priority p FROM tasks WHERE id=?', t.id).p ? 'пойдёт вне очереди' : 'обычная очередь'}`)
  },
  // для самотеста: кого диспетчер возьмёт следующим — тем же кодом, которым он и берёт
  next: () => console.log(nextTask()?.key || ''),
  // пульт наружу: живёт, пока идёт эта команда — закрыть можно, просто нажав Ctrl+C
  // Пульт — РЕЖИМ, а не команда, живущая пока открыт терминал: телефон нужен тогда, когда
  // мака рядом нет, и «работает, пока не закрыл окно» — ровно наоборот тому, что требуется.
  tunnel: () => {
    const on = rest[0] !== 'off'
    set('tunnel_on', on ? '1' : '0')
    console.log(on
      ? 'пульт включён: демон держит его сам и переоткрывает при обрыве. Ссылка придёт в телеграм.\nВыключить: conveyor tunnel off'
      : 'пульт выключен (закроется при следующем перезапуске демона)')
    if (on && !q1('SELECT 1 x FROM settings WHERE k=?', 'tunnel_key')) tunnelKey()
  },
  // conveyor every <репо> <часов> <что делать> | conveyor every  (список) | conveyor every rm <id>
  every: () => {
    if (rest[0] === 'rm') { run('DELETE FROM schedules WHERE id=?', Number(rest[1])); return console.log('снято') }
    if (!rest.length) {
      const rows = q('SELECT * FROM schedules ORDER BY id')
      return console.log(rows.length
        ? rows.map(s => `${s.id}: ${s.repo} раз в ${s.every_h} ч, следующая ${new Date(s.next_at).toLocaleString('ru-RU')} — ${s.title}`).join('\n')
        : 'повторяющихся задач нет')
    }
    const [repoName, hours] = [rest[0], Number(rest[1])]
    const title = rest.slice(2).join(' ')
    if (!hours || !title) return console.error('conveyor every <репо> <часов> <что делать>\nнапример: conveyor every bavuko-booking 168 "обнови зависимости и прогони тесты"')
    getRepo(repoName)
    run('INSERT INTO schedules (repo,title,every_h,next_at) VALUES (?,?,?,?)', repoName, title, hours, now() + hours * 3600e3)
    console.log(`буду ставить раз в ${hours} ч: ${title}`)
  },
  // что конвейер узнал про репозиторий за всё время
  lessons: () => {
    if (rest[0] === 'rm') { run('DELETE FROM lessons WHERE id=?', Number(rest[1])); return console.log('урок забыт') }
    const rows = rest[0] ? q('SELECT * FROM lessons WHERE repo=? ORDER BY hits DESC, id DESC', rest[0])
      : q('SELECT * FROM lessons ORDER BY repo, hits DESC')
    console.log(rows.length ? rows.map(l => `${String(l.id).padStart(3)} [${l.repo}] ${l.text}${l.hits ? ` (подтверждено ${l.hits}×)` : ''}`).join('\n') : 'уроков пока нет')
    if (rows.length) console.log('\nзабыть лишнее: conveyor lessons rm <номер>')
  },
  webhook: () => { if (rest[0]) set('webhook', rest[0] === 'off' ? '' : rest[0]); console.log(get('webhook', '') || 'webhook не задан') },
  // свести клон конвейера с рабочей копией владельца: его коммиты → в базу агентов
  sync: () => {
    const r = getRepo(rest[0])
    git(r.clone, 'fetch', 'origin', r.base)
    const behind = Number(git(r.clone, 'rev-list', '--count', `${r.base}..origin/${r.base}`) || 0)
    if (!behind) return console.log(`${r.name}: клон и так свежий`)
    git(r.clone, 'checkout', r.base)
    try {
      git(r.clone, 'merge', '--no-edit', `origin/${r.base}`)
      console.log(`${r.name}: подтянул ${behind} коммит(ов) из твоего репозитория`)
    } catch (e) {
      try { git(r.clone, 'merge', '--abort') } catch {}
      console.error(`${r.name}: свести не вышло — конфликт с работой конвейера.\n${e.message.slice(0, 400)}`)
      process.exitCode = 1
    }
  },
  doctor: async () => {
    const { ok, warn } = await doctor()
    ok.forEach(s => console.log(`  ✓ ${s}`))
    warn.forEach(s => console.log(`  ! ${s}`))
    console.log(warn.length ? `\nРазобраться: ${warn.length}` : '\nВсё в порядке.')
    if (warn.length) process.exitCode = 1
  },
  digest: () => {
    const from = new Date(); from.setHours(0, 0, 0, 0)
    console.log(digestText(from.getTime(), Date.now()) || 'сегодня ещё ничего не закончено')
    console.log('\n' + (trendText() || 'на тренд пока мало данных'))
  },
  inbox: () => {
    const rows = q("SELECT key, repo, source, title FROM tasks WHERE status='inbox' ORDER BY id")
    console.log(rows.length ? '' : 'входящих нет')
    rows.forEach(r => console.log(`${r.key.padEnd(8)} ${r.repo.padEnd(18)} ${r.title}`))
  },
  start: () => {
    const t = q1('SELECT * FROM tasks WHERE key=?', rest[0])
    if (!t) return console.error(`нет задачи ${rest[0]}`)
    if (t.status !== 'inbox') return console.error(`${t.key} уже ${STATUS_WORD[t.status] || t.status}`)
    setStatus(t.id, 'queued')
    if (t.source === 'telegram') tgTell(t.source_ref, `▶️ ${t.key} взята в работу.`)
    console.log(`${t.key} в очереди`)
  },
  // Подключение чата/канала: repo решает, куда поедут задачи из него.
  'tg-chat': () => {
    const [cmd, id, repo] = rest
    if (cmd === 'add') {
      if (!repoNames().includes(repo)) return console.error(`нужен репозиторий из списка: ${repoNames().join(', ')}\nconveyor tg-chat add <id чата> <репо>`)
      tgChatSet(id, { repo }); return console.log(`чат ${id} → ${repo}`)
    }
    if (cmd === 'rm') { const m = tgChats(); delete m[String(id)]; set('tg_chats', JSON.stringify(m)); return console.log(`чат ${id} отключён`) }
    const m = tgChats()
    const keys = Object.keys(m)
    console.log(keys.length ? keys.map(k => `${k} → ${m[k].repo}${m[k].title ? ` (${m[k].title})` : ''}`).join('\n') : 'чатов не подключено')
  },
  show: () => {
    const t = q1('SELECT * FROM tasks WHERE key=? OR id=?', rest[0], Number(rest[0]) || -1)
    console.log(t); q('SELECT * FROM events WHERE task_id=? ORDER BY id', t.id).forEach(e =>
      console.log(new Date(e.ts).toLocaleTimeString('ru-RU'), e.kind, e.msg))
  },
  // Ручное одобрение — вторая половина статуса «ждёт ревью»: посмотрел дифф, согласен, влить.
  // ponytail: демон в этот момент теоретически может мерджить свою задачу; окно крошечное, очередь общая не нужна.
  // Мердж всегда идёт ЧЕРЕЗ ДЕМОН: он держит очередь. Свой git в том же клоне столкнулся бы с его.
  approve: async () => {
    const t = q1('SELECT * FROM tasks WHERE key=?', rest[0])
    if (!t) return console.error(`нет задачи ${rest[0]}`)
    if (t.status !== 'needs_review') return console.error(`${t.key} в статусе «${t.status}», одобрять нечего`)
    try {
      const r = await fetch(`http://localhost:${PORT}/api/task/${t.id}/approve`, { method: 'POST' })
      if (!r.ok) throw new Error((await r.json()).error || r.status)
      console.log(`${t.key} отправлена в мердж-очередь демона`)
    } catch (e) {
      console.error(`демон не ответил (${e.message}). Запусти его — мердж мимо очереди делать нельзя.`)
      process.exit(1)
    }
  },
  diff: () => {
    const t = q1('SELECT * FROM tasks WHERE key=?', rest[0])
    if (!t) return console.error(`нет задачи ${rest[0]}`)
    console.log(taskDiff(t))
  },
  open: () => {
    const t = q1('SELECT * FROM tasks WHERE key=?', rest[0])
    const dir = t?.worktree && fs.existsSync(t.worktree) ? t.worktree
      : q1('SELECT clone FROM repos WHERE name=?', t?.repo)?.clone
    if (!dir) return console.error(`нечего открывать у ${rest[0]}`)
    openInVSCode(dir)
    console.log(`открыт в VS Code: ${dir}`)
  },
  cancel: () => setStatus(q1('SELECT id FROM tasks WHERE key=?', rest[0]).id, 'cancelled'),
  retry: () => run("UPDATE tasks SET status='queued', attempts=0, error=NULL WHERE key=?", rest[0])
}
if (!cmds[cmd]) {
  console.log(`конвейер тасков
  conveyor repo add <путь>        подключить репозиторий
  conveyor repo rm <имя>          отключить (клон и воркспейсы удалятся, твоя копия — нет)
  conveyor repo                   список репозиториев
  conveyor add <репо> <заголовок> [--after КЛЮЧ] [--model haiku|sonnet|opus|fable] [--variants 2|3]
  conveyor plan <репо> <цель>     разбить цель на задачи с зависимостями и поставить в очередь
  conveyor daemon [N]             запустить конвейер на N агентов (по умолчанию 5)
  conveyor list | show <ключ> | cancel <ключ> | retry <ключ>
  conveyor diff <ключ>            дифф задачи, которая ждёт ревью
  conveyor approve <ключ>         одобрить и влить задачу из «ждёт ревью»
  conveyor budget [сумма]         дневной бюджет в долларах и сколько потрачено
  conveyor pause | go             приостановить набор новых задач / продолжить
  conveyor cost                   расход по задачам: прогоны, доллары, ходы
  conveyor nightly                полные тесты на базовых ветках всех репо (для ночного крона)
  conveyor propose                поискать TODO в базовых ветках и положить одно предложение
  conveyor jira                   забрать задачи с меткой agent-ready (демон делает это сам раз в 30 сек)
  conveyor jira-token <токен>     заменить токен Jira с проверкой на живой Jira
  conveyor tg <токен бота>        подключить телеграм: chat id и автозапуск настрою сам
  conveyor doctor                 проверить всё окружение: git, claude, репозитории, диск, бюджет
  conveyor digest                 что вышло за сегодня и за неделю
  conveyor every <репо> <часов> <что делать>   повторяющаяся задача (список: conveyor every)
  conveyor tunnel                 открыть пульт с телефона, ссылка придёт в телеграм
  conveyor say <ключ> <текст>     сказать живой сессии агента: ответ или что переделать
  conveyor recheck <ключ>         перепроверить готовую работу гейтами, не запуская агента заново
  conveyor revert <ключ>          откатить влитую задачу (с прогоном тестов)
  conveyor urgent <ключ>          пустить вне очереди
  conveyor inbox                  что пришло из телеграма и ждёт твоего запуска
  conveyor start <ключ>           запустить входящую задачу
  conveyor tg-chat [add <id> <репо> | rm <id>]   какие чаты и каналы кладут задачи
  дашборд: http://localhost:${PORT}`)
  process.exit(cmd ? 1 : 0)
}
cmds[cmd]()
