// Pure text regression; no game or browser is started.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { wrapVerse } from '../../src/game/ui/verseWrap.ts'
const verses = JSON.parse(fs.readFileSync(new URL('../../data/verses.json', import.meta.url), 'utf8'))
const punctuation = /[，。！？；：、,.!?;:]$/u
for (const [stage, { text }] of Object.entries(verses)) {
  for (const width of [22, 24]) {
    const wrapped = wrapVerse(text, width)
    assert.equal(wrapped.replaceAll('\n', ''), `「${text}」`, `stage ${stage}: preserve original`)
    for (const line of wrapped.split('\n').slice(0, -1)) assert.match(line, punctuation, `stage ${stage}: only break at punctuation`)
    if (Number(stage) === 6) assert.ok(wrapped.includes('站立得穩'), 'do not split 站立得穩')
    console.log(`PASS stage=${stage} width=${width} ${JSON.stringify(wrapped)}`)
  }
}
for (const text of ['無標點的完整句子', '，開首標點！', '連續標點？！接下去。', '', '一整段非常非常非常非常長但沒有標點的句子']) {
  const wrapped=wrapVerse(text, 6)
  assert.equal(wrapped.replaceAll('\n',''), `「${text}」`)
  for (const line of wrapped.split('\n').slice(0,-1)) assert.match(line,punctuation)
}
console.log('PASS edge cases: original text preserved without arbitrary breaks')
