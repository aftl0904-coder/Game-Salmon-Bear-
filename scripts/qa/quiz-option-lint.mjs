/**
 * Quiz option lint (playtest8 follow-up + old-bank polish).
 *
 * Checks every question in data/quiz-mall.json:
 *  (a) Banned substrings must not appear in any choice (or prompt for agency/meta bans)
 *  (b) Parentheses （）() are banned in choices (no meta notes)
 *  (c) If the correct answer is a plain number / $n / n/n / n%, every choice must contain a digit
 *  (d) max(choice length) / min(choice length) <= 3
 *  (e) Absolute-word trap: if exactly one choice contains 一定|永遠|完全|全部, FAIL
 *  (f) Buy-context words 首期|按揭|貸款額|訂金 in prompt or choices → FAIL
 *
 * Usage:
 *   node scripts/qa/quiz-option-lint.mjs              # lint current file → exit 0/1
 *   node scripts/qa/quiz-option-lint.mjs --file PATH  # lint another JSON
 *
 * Acceptance fixture:
 *   OLD (1ac1b9e broken options) must FAIL
 *   NEW (current) must PASS
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')

const BAN =
  /忽略|當成|干擾項|差一步|漏咗|亂加|亂對調|任意|隨意|完全省略|公開員工評語|就得|隨時得|鼓勵|當展覽|免費倉|似是而非|潛規則|投票結果|旅遊發展局|旅發局|康文署|漁護署|程式碼|錯誤處理|唯一依據|單獨規管|全部條文自動適用|即日/

const PAREN = /[（）()]/
const ABS = /一定|永遠|完全|全部/
const BUY = /首期|按揭|貸款額|訂金/

const args = process.argv.slice(2)
let file = path.join(ROOT, 'data/quiz-mall.json')
const fi = args.indexOf('--file')
if (fi >= 0 && args[fi + 1]) file = path.resolve(args[fi + 1])

function isPlainNumericAnswer(s) {
  const t = String(s).trim()
  return (
    /^[\d.]+$/.test(t) ||
    /^\$\d+$/.test(t) ||
    /^\d+\/\d+$/.test(t) ||
    /^\d+%$/.test(t) ||
    /^\d+°$/.test(t)
  )
}

export function lintQuizBank(data) {
  const questions = data.questions || []
  const errors = []
  for (const q of questions) {
    const id = q.id || '?'
    const choices = q.choices || []
    if (choices.length !== 4) {
      errors.push({ id, rule: 'count', detail: `expected 4 choices, got ${choices.length}` })
      continue
    }
    const ans = choices[q.answerIndex]
    if (ans == null) {
      errors.push({ id, rule: 'answerIndex', detail: `invalid answerIndex ${q.answerIndex}` })
      continue
    }
    for (const c of choices) {
      if (BAN.test(c)) {
        errors.push({ id, rule: 'ban', detail: c })
      }
      if (PAREN.test(c)) {
        errors.push({ id, rule: 'paren', detail: c })
      }
    }
    if (BAN.test(String(q.prompt || ''))) {
      errors.push({ id, rule: 'ban-prompt', detail: q.prompt })
    }
    const blob = `${q.prompt || ''} ${choices.join(' ')}`
    if (BUY.test(blob)) {
      errors.push({ id, rule: 'buy-context', detail: blob.match(BUY)?.[0] })
    }
    const absFlags = choices.map((c) => ABS.test(c))
    if (absFlags.filter(Boolean).length === 1) {
      errors.push({
        id,
        rule: 'abs-unique',
        detail: `exactly one choice has 一定/永遠/完全/全部: ${choices[absFlags.indexOf(true)]}`,
      })
    }
    if (isPlainNumericAnswer(ans)) {
      for (const c of choices) {
        if (!/\d/.test(c)) {
          errors.push({ id, rule: 'numeric', detail: `correct is numeric "${ans}" but choice lacks digit: ${c}` })
        }
      }
    }
    const lens = choices.map((c) => [...c].length) // code-point length
    const mn = Math.min(...lens)
    const mx = Math.max(...lens)
    if (mn === 0 || mx > 3 * mn) {
      errors.push({
        id,
        rule: 'length',
        detail: `lengths ${lens.join(',')} (max/min > 3)`,
      })
    }
  }
  return { ok: errors.length === 0, total: questions.length, errors }
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

const runSelfTest = args.includes('--self-test')

if (runSelfTest) {
  // OLD broken commit must FAIL; current must PASS
  const tmp = path.join(ROOT, 'docs/qa-playtest8')
  fs.mkdirSync(tmp, { recursive: true })
  const oldPath = path.join(tmp, 'quiz-mall-1ac1b9e.json')
  try {
    const raw = execSync('git show 1ac1b9e:data/quiz-mall.json', { cwd: ROOT, encoding: 'utf8', maxBuffer: 20e6 })
    fs.writeFileSync(oldPath, raw)
  } catch (e) {
    console.error('self-test: cannot load 1ac1b9e quiz-mall.json', e.message)
    process.exit(2)
  }
  const oldResult = lintQuizBank(loadJson(oldPath))
  const newResult = lintQuizBank(loadJson(path.join(ROOT, 'data/quiz-mall.json')))
  const summary = {
    old: { ok: oldResult.ok, errors: oldResult.errors.length, sample: oldResult.errors.slice(0, 5) },
    neu: { ok: newResult.ok, errors: newResult.errors.length, total: newResult.total },
  }
  fs.writeFileSync(path.join(tmp, 'quiz-option-lint.json'), JSON.stringify(summary, null, 2) + '\n')
  console.log(JSON.stringify(summary, null, 2))
  if (oldResult.ok) {
    console.error('SELF-TEST FAIL: old 1ac1b9e unexpectedly PASSED')
    process.exit(1)
  }
  if (!newResult.ok) {
    console.error('SELF-TEST FAIL: current unexpectedly FAILED')
    console.error(newResult.errors.slice(0, 20))
    process.exit(1)
  }
  console.log('SELF-TEST PASS: old FAIL + new PASS')
  process.exit(0)
}

const result = lintQuizBank(loadJson(file))
console.log(
  JSON.stringify(
    {
      file,
      ok: result.ok,
      total: result.total,
      errorCount: result.errors.length,
      errors: result.errors.slice(0, 40),
    },
    null,
    2,
  ),
)
process.exit(result.ok ? 0 : 1)
