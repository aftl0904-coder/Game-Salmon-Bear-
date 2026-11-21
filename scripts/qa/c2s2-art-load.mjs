// Decode-time for current vs 32-bit full vs 128-color far/guard PNGs. Does not start the game.
import { chromium } from 'playwright'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const root = path.resolve(process.argv[2] || '/tmp/c2-32bit-gs')
const files = []
function walk(dir, prefix = '') {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    if (fs.statSync(p).isDirectory()) walk(p, prefix + name + '/')
    else if (name.endsWith('.png')) files.push(prefix + name)
  }
}
walk(root)
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.replace(/^\//, ''))
  const fp = path.join(root, rel)
  if (!fp.startsWith(root) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end(); return }
  res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store', 'access-control-allow-origin': '*' })
  fs.createReadStream(fp).pipe(res)
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
const port = server.address().port
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage()
const results = []
for (const f of files.sort()) {
  const url = `http://127.0.0.1:${port}/${f}`
  const m = await page.evaluate(async (url) => {
    const t0 = performance.now()
    const blob = await fetch(url, { cache: 'no-store' }).then(r => r.blob())
    const tFetch = performance.now()
    const bmp = await createImageBitmap(blob)
    const tDecode = performance.now()
    const { width, height } = bmp
    bmp.close()
    return { bytes: blob.size, fetchMs: tFetch - t0, decodeMs: tDecode - tFetch, width, height }
  }, url)
  results.push({ file: f, ...m })
}
await browser.close()
server.close()
const out = { at: new Date().toISOString(), root, results }
fs.mkdirSync('docs/qa-c2s2', { recursive: true })
fs.writeFileSync('docs/qa-c2s2/art-load-32bit.json', JSON.stringify(out, null, 2) + '\n')
console.log(JSON.stringify({ n: results.length, maxDecode: Math.max(...results.map(r => r.decodeMs)), maxFetch: Math.max(...results.map(r => r.fetchMs)) }))
