#!/usr/bin/env node
// Проверка демона: node --check на каждый factory/daemon/*.mjs;
// селфтест гоняем только когда conveyor.mjs менялся относительно origin/main — он минуты, а не секунды.
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' })

for (const f of readdirSync('factory/daemon').filter(f => f.endsWith('.mjs'))) {
  sh('node', ['--check', `factory/daemon/${f}`])
  console.log(`--check ок: factory/daemon/${f}`)
}

let changed = []
try {
  const base = sh('git', ['merge-base', 'HEAD', 'origin/main']).trim()
  changed = sh('git', ['diff', '--name-only', `${base}..HEAD`]).trim().split('\n')
} catch { console.log('origin/main недоступен — селфтест пропущен') }

if (changed.includes('factory/daemon/conveyor.mjs')) {
  console.log('conveyor.mjs менялся — запускаю селфтест')
  execFileSync('node', ['factory/daemon/selftest.mjs'], { stdio: 'inherit' })
} else {
  console.log('conveyor.mjs не менялся — селфтест не нужен')
}
console.log('daemon-check: ок')
