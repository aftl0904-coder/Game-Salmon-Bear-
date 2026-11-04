#!/usr/bin/env node
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
const base = '077af8b14b34b3e26d776e36705772fdd691639b'
const get = path => JSON.parse(execFileSync('git', ['show', `${base}:${path}`], { encoding: 'utf8' }))
const original = get('data/story.json')
const current = JSON.parse(fs.readFileSync('data/story.json', 'utf8'))
const cleaned = structuredClone(current)
for (const id of ['C11', 'C11_PERFECT']) {
  const steps = current.scenes[id].steps
  const photos = steps.filter(s => s.still === 'ending-3')
  assert.equal(photos.length, 1)
  assert.deepEqual(photos[0], { still: 'ending-3', hideDialog: true, holdMs: 5000 })
  const cleanedPhoto = cleaned.scenes[id].steps.find(s => s.still === 'ending-3')
  delete cleanedPhoto.hideDialog; delete cleanedPhoto.holdMs
  assert.equal(steps[steps.indexOf(photos[0]) + 1].still, null)
}
assert.deepEqual(cleaned, original, 'all story text, actions, branch structure and image names unchanged')
assert.deepEqual(JSON.parse(fs.readFileSync('data/ending-c2.json', 'utf8')), get('data/ending-c2.json'), 'C2 card list unchanged')
assert.equal(current.scenes.C11.steps.find(s => s.text?.includes('由 Alan 自己寫'))?.say, 'kibobo')
assert.equal(current.scenes.C11_PERFECT.steps.filter(s => s.text?.includes('待 Alan 填寫')).length, 7)
assert.ok(current.scenes.C11_PERFECT.steps.some(s => s.sub?.includes('待 Alan 填寫')))
for (const path of ['src/game/EndingC2Scene.ts', ...Array.from({length:10}, (_, i) => `public/art/story/ending-c2-${String(i + 1).padStart(2, '0')}.png`)]) {
  const originalBlob = execFileSync('git', ['rev-parse', `${base}:${path}`], {encoding:'utf8'}).trim()
  const currentBlob = execFileSync('git', ['hash-object', path], {encoding:'utf8'}).trim()
  assert.equal(currentBlob, originalBlob, `${path} unchanged`)
}
console.log(`PASS main ${base}: only two ending-3 options added; entire original story otherwise identical`)
console.log('PASS C11 existing Alan placeholder and all seven C11_PERFECT dialogue placeholders + card remain intact')
console.log('PASS C2 card JSON, replay scene and all ten image blobs unchanged')
