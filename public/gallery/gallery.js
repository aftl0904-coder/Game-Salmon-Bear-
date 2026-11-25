/**
 * 鮭鮭熊圖集 — sprite-sheet gallery (guide visual language).
 * Unlock reads game localStorage + durable gallery key (survives 重新開始).
 */
const GALLERY_KEY = 'sake-kuma-gallery-v1'
const PROGRESS_KEY = 'sake-kuma-progress-v1'
const FRIENDS_KEY = 'sake-kuma-friends-v1'
const C2_KEY = 'sake-kuma-c2-cleared-v1'

const state = {
  catalog: null,
  tab: 'heroes',
  focus: 0,
  cards: [],
  modal: null,
  modalAnim: 0,
  sheetCache: new Map(),
  raf: 0,
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback
  } catch {
    return fallback
  }
}

function writeGallery(data) {
  try {
    localStorage.setItem(GALLERY_KEY, JSON.stringify(data))
  } catch {
    /* private mode */
  }
}

/** Merge live progress into durable gallery unlocks (never shrinks). */
function syncUnlocks() {
  const g = readJson(GALLERY_KEY, {
    heroes: [],
    friends: [],
    enemies: [],
    bosses: [],
    scenes: [],
    stories: [],
  })
  const max = Number(readJson(PROGRESS_KEY, {}).maxStage) || 1
  const friends = readJson(FRIENDS_KEY, [])
  const c2 = localStorage.getItem(C2_KEY) === '1'

  const add = (arr, id) => {
    if (id && !arr.includes(id)) arr.push(id)
  }

  // Always-on cast
  ;['lunbo', 'kibobo', 'pupu'].forEach((id) => add(g.heroes, id))
  for (const id of friends) add(g.friends, id)

  // Stages 1–10: entered / cleared.
  // Stage 10 has no "max > 10" (progress caps at 10) — treat c2 clear as stage-10 clear.
  for (let st = 1; st <= 10; st++) {
    if (max >= st) add(g.scenes, `scene-${st}`)
    const cleared = max > st || (st === 10 && c2)
    if (cleared) {
      add(g.bosses, bossIdForStage(st))
      for (const e of enemiesForStage(st)) add(g.enemies, e.id)
    }
  }
  // Stage 10 boss if c2 cleared or maxStage already past 10 somehow
  if (c2 || max > 10) add(g.bosses, 'leon')

  // Story heuristics from progress + explicit marks
  if (max >= 1) {
    ;['c1-picnic', 'c1-hollow', 'c1-mama'].forEach((id) => add(g.stories, id))
  }
  for (let st = 1; st <= 10; st++) {
    if (max > st) {
      storyIdsForClear(st).forEach((id) => add(g.stories, id))
    }
    if (max >= st) {
      storyIdsForEnter(st).forEach((id) => add(g.stories, id))
    }
  }
  if (c2) {
    for (let i = 1; i <= 10; i++) add(g.stories, `ending-c2-${String(i).padStart(2, '0')}`)
  }

  writeGallery(g)
  return g
}

function bossIdForStage(st) {
  const map = {
    1: 'warriorking',
    2: 'queen',
    3: 'mirrorowl',
    4: 'mudmane',
    5: 'triboss',
    6: 'mall-scrubber',
    7: 'trainer',
    8: 'researcher',
    9: 'warden',
    10: 'leon',
  }
  return map[st]
}

function enemiesForStage(st) {
  const tab = state.catalog?.tabs?.find((t) => t.id === 'enemies')
  const g = tab?.groups?.find((x) => x.stage === st)
  return g?.items ?? []
}

function storyIdsForClear(st) {
  const map = {
    1: ['c2-note'],
    2: ['s2-boss-intro', 'c3-queen'],
    3: ['s3-boss-intro', 'c4-taxi'],
    4: ['s4-boss-intro', 'c6-screen'],
    5: ['c7-boss', 'c10-unmask', 'ending-1', 'ending-2', 'ending-3'],
  }
  return map[st] ?? []
}

function storyIdsForEnter(st) {
  const map = {
    1: ['c1-picnic', 'c1-hollow', 'c1-mama'],
    2: ['c2-bike'],
    3: ['c3-market'],
    4: ['c5-bus'],
    5: ['c7-site'],
    8: ['s8-recv', 's8-pipe', 's8-mon'],
  }
  return map[st] ?? []
}

function maxStageNow() {
  return Number(readJson(PROGRESS_KEY, {}).maxStage) || 1
}

function isUnlocked(item, unlocks) {
  const u = item.unlock || { type: 'always' }
  if (u.type === 'always') return true
  if (u.type === 'friend') return unlocks.friends.includes(u.friendId)
  if (u.type === 'stageClear') {
    const c2 = localStorage.getItem(C2_KEY) === '1'
    return (
      unlocks.bosses.includes(item.id) ||
      unlocks.enemies.includes(item.id) ||
      maxStageNow() > u.stage ||
      // Stage 10 clear is recorded via c2 flag (maxStage never exceeds 10).
      (u.stage === 10 && c2)
    )
  }
  if (u.type === 'stageEnter') {
    if (String(item.id || '').startsWith('scene-')) {
      return unlocks.scenes.includes(item.id) || maxStageNow() >= u.stage
    }
    return unlocks.stories.includes(item.id) || maxStageNow() >= u.stage
  }
  if (u.type === 'c2Clear') return unlocks.stories.includes(item.id) || localStorage.getItem(C2_KEY) === '1'
  if (u.type === 'story') return unlocks.stories.includes(item.id)
  return unlocks.heroes.includes(item.id)
}

function flatItems(tab) {
  if (tab.id === 'enemies') return tab.groups.flatMap((g) => g.items.map((it) => ({ ...it, _group: g.label })))
  return tab.items.map((it) => ({ ...it }))
}

function tabStats(tab, unlocks) {
  const items = flatItems(tab)
  const unlocked = items.filter((it) => isUnlocked(it, unlocks)).length
  return { unlocked, total: items.length }
}

async function loadSheet(url) {
  if (state.sheetCache.has(url)) return state.sheetCache.get(url)
  const img = new Image()
  img.decoding = 'async'
  const p = new Promise((resolve, reject) => {
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('sheet ' + url))
  })
  img.src = url
  try {
    const got = await p
    state.sheetCache.set(url, got)
    return got
  } catch {
    state.sheetCache.set(url, null)
    return null
  }
}

function frameIndex(anim, tick) {
  const frames = anim.frames
  const count = frames ? frames.length : anim.count
  if (count <= 1) return frames ? frames[0] : anim.start
  const fps = Math.max(1, anim.fps || 8)
  let i = Math.floor(tick / (1000 / fps))
  if (anim.loop) i = i % count
  else i = Math.min(count - 1, i)
  return frames ? frames[i] : anim.start + i
}

/** Opaque pixel bbox inside one sheet frame (for fitContent). */
function frameContentBox(img, sx, sy, fw, fh) {
  const c = document.createElement('canvas')
  c.width = fw
  c.height = fh
  const x = c.getContext('2d')
  x.drawImage(img, sx, sy, fw, fh, 0, 0, fw, fh)
  const d = x.getImageData(0, 0, fw, fh).data
  let minX = fw
  let minY = fh
  let maxX = 0
  let maxY = 0
  let found = false
  for (let y = 0; y < fh; y++) {
    for (let px = 0; px < fw; px++) {
      if (d[(y * fw + px) * 4 + 3] > 8) {
        found = true
        if (px < minX) minX = px
        if (y < minY) minY = y
        if (px > maxX) maxX = px
        if (y > maxY) maxY = y
      }
    }
  }
  return found ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } : { x: 0, y: 0, w: fw, h: fh }
}

function drawFrame(ctx, img, item, frame, fitW, fitH) {
  const fw = item.frameWidth
  const fh = item.frameHeight
  const cols = item.columns || Math.max(1, Math.floor(img.width / fw))
  const sx = (frame % cols) * fw
  const sy = Math.floor(frame / cols) * fh
  ctx.clearRect(0, 0, fitW, fitH)
  ctx.imageSmoothingEnabled = false
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, fitW, fitH)
  ctx.clip()

  if (item.fitContent) {
    // Scale by opaque content so large-pad sheets fill the card without cropping limbs.
    const box = frameContentBox(img, sx, sy, fw, fh)
    const pad = typeof item.fitPad === 'number' ? item.fitPad : 0.18
    const availW = fitW * (1 - 2 * pad)
    const availH = fitH * (1 - 2 * pad)
    const scale = Math.min(availW / box.w, availH / box.h)
    const dw = Math.max(1, Math.floor(box.w * scale))
    const dh = Math.max(1, Math.floor(box.h * scale))
    ctx.drawImage(
      img,
      sx + box.x,
      sy + box.y,
      box.w,
      box.h,
      Math.floor((fitW - dw) / 2),
      Math.floor((fitH - dh) / 2),
      dw,
      dh,
    )
  } else {
    // Optional zoom (keep ≤1 unless you accept clipping). Prefer fitContent for Manus pads.
    const zoom = typeof item.zoom === 'number' && item.zoom > 0 ? item.zoom : 1
    const scale = Math.min(fitW / fw, fitH / fh) * zoom
    const dw = Math.max(1, Math.floor(fw * scale))
    const dh = Math.max(1, Math.floor(fh * scale))
    ctx.drawImage(img, sx, sy, fw, fh, Math.floor((fitW - dw) / 2), Math.floor((fitH - dh) / 2), dw, dh)
  }
  ctx.restore()

  if (item.tint) applyTint(ctx, fitW, fitH, item.tint)
}

/** Multiply non-transparent pixels by a Phaser-style hex tint. */
function applyTint(ctx, w, h, tint) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(tint).trim())
  if (!m) return
  const hex = parseInt(m[1], 16)
  const tr = ((hex >> 16) & 255) / 255
  const tg = ((hex >> 8) & 255) / 255
  const tb = (hex & 255) / 255
  const id = ctx.getImageData(0, 0, w, h)
  const d = id.data
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 8) continue
    d[i] = Math.min(255, Math.round(d[i] * tr))
    d[i + 1] = Math.min(255, Math.round(d[i + 1] * tg))
    d[i + 2] = Math.min(255, Math.round(d[i + 2] * tb))
  }
  ctx.putImageData(id, 0, 0)
}

/** Pixel whistle + leash markers so trainer ≠ △畝大佬 at a glance. */
function paintMarkers(ctx, item, fitW, fitH) {
  const marks = item.markers
  if (!marks || !marks.length) return
  ctx.imageSmoothingEnabled = false
  // Left side — keep clear of top-right badge plate.
  const cx = Math.floor(fitW * 0.18)
  const cy = Math.floor(fitH * 0.32)
  if (marks.includes('whistle')) {
    // silver whistle with cord (readable at card scale)
    ctx.fillStyle = 'rgba(12,10,18,0.55)'
    ctx.fillRect(cx - 8, cy - 14, 28, 24)
    ctx.fillStyle = '#2a2218'
    ctx.fillRect(cx - 1, cy - 12, 2, 12)
    ctx.fillStyle = '#e8eef6'
    ctx.fillRect(cx - 5, cy - 3, 12, 7)
    ctx.fillStyle = '#9aa3b0'
    ctx.fillRect(cx + 6, cy, 5, 3)
    ctx.fillStyle = '#6a7380'
    ctx.fillRect(cx - 4, cy, 4, 2)
  }
  if (marks.includes('leash')) {
    const lx = Math.floor(fitW * 0.22)
    const ly = Math.floor(fitH * 0.58)
    ctx.strokeStyle = '#8a5030'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(lx, ly)
    ctx.quadraticCurveTo(lx + 22, ly + 6, lx + 14, ly + 28)
    ctx.quadraticCurveTo(lx - 4, ly + 34, lx - 8, ly + 18)
    ctx.stroke()
    ctx.fillStyle = '#c47840'
    ctx.fillRect(lx - 4, ly - 4, 8, 6)
  }
}

/** In-game stage-7 / trainer badges drawn on top so lookalikes stay distinct. */
async function paintBadge(ctx, item, fitW, fitH) {
  if (!item.badge) return
  const badge = await loadSheet(item.badge)
  if (!badge) return
  ctx.imageSmoothingEnabled = false
  const mode = item.badgeMode || 'corner'
  // Keep badges readable but never covering the whole figure.
  const bw = Math.max(32, Math.floor(fitW * 0.3))
  const bh = Math.max(32, Math.floor((bw * badge.height) / badge.width))
  let bx, by
  if (mode === 'head') {
    bx = Math.floor((fitW - bw) / 2)
    by = 2
  } else {
    bx = fitW - bw - 4
    by = 4
  }
  ctx.fillStyle = 'rgba(12, 10, 18, 0.82)'
  ctx.fillRect(bx - 3, by - 3, bw + 6, bh + 6)
  ctx.strokeStyle = 'rgba(220, 170, 50, 1)'
  ctx.lineWidth = 2
  ctx.strokeRect(bx - 3.5, by - 3.5, bw + 7, bh + 7)
  ctx.drawImage(badge, bx, by, bw, bh)
}

function firstFrame(item) {
  const anim = (item.anims && (item.anims.idle || Object.values(item.anims)[0])) || null
  if (!anim) return 0
  if (anim.frames && anim.frames.length) return anim.frames[0]
  return anim.start ?? 0
}

/** Paint card art; locked heroes/enemies use frame-0 silhouette (not a black box). */
async function paintCardCanvas(canvas, item, unlocked) {
  const img = await loadSheet(item.sheet)
  const ctx = canvas.getContext('2d')
  const w = (canvas.width = 160)
  const h = (canvas.height = 120)
  ctx.clearRect(0, 0, w, h)
  if (!img) {
    if (unlocked) {
      ctx.fillStyle = '#1a1420'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#ffe9a8'
      ctx.font = '14px sans-serif'
      ctx.fillText('?', 72, 66)
    }
    return
  }
  const anim = item.anims.idle || Object.values(item.anims || {})[0]
  const frame = unlocked ? frameIndex(anim, performance.now()) : firstFrame(item)
  if (item.still) {
    ctx.imageSmoothingEnabled = false
    const scale = Math.min(w / img.width, h / img.height)
    const dw = img.width * scale
    const dh = img.height * scale
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
    if (item.tint) applyTint(ctx, w, h, item.tint)
  } else {
    drawFrame(ctx, img, item, frame, w, h)
  }
  paintMarkers(ctx, item, w, h)
  await paintBadge(ctx, item, w, h)
  if (!unlocked) {
    // Keep alpha so the sprite outline reads as a silhouette against the card.
    const id = ctx.getImageData(0, 0, w, h)
    const d = id.data
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8) {
        d[i + 3] = 0
        continue
      }
      d[i] = 0
      d[i + 1] = 0
      d[i + 2] = 0
      d[i + 3] = 255
    }
    ctx.putImageData(id, 0, 0)
  }
}

function render() {
  const unlocks = syncUnlocks()
  const root = document.getElementById('app')
  const tab = state.catalog.tabs.find((t) => t.id === state.tab)
  const stats = Object.fromEntries(
    state.catalog.tabs.map((t) => {
      const s = tabStats(t, unlocks)
      return [t.id, s]
    }),
  )

  const tabsHtml = state.catalog.tabs
    .map((t) => {
      const s = stats[t.id]
      return `<button type="button" class="tab" role="tab" data-tab="${t.id}" aria-selected="${t.id === state.tab}">${t.label}<span class="count">${s.unlocked}/${s.total}</span></button>`
    })
    .join('')

  let body = ''
  state.cards = []
  if (tab.id === 'enemies') {
    for (const g of tab.groups) {
      body += `<h2 class="group-title">${g.label}</h2><div class="grid" data-group="${g.stage}">`
      for (const item of g.items) {
        body += cardHtml(item, unlocks, tab.id)
        state.cards.push(item)
      }
      body += '</div>'
    }
  } else {
    body += `<div class="grid">`
    for (const item of tab.items) {
      body += cardHtml(item, unlocks, tab.id)
      state.cards.push(item)
    }
    body += '</div>'
  }

  root.innerHTML = `
    <div class="tabs" role="tablist">${tabsHtml}</div>
    <div id="panel">${body}</div>
    <p class="hint">方向鍵／Enter　Q E 換頁　Esc 返回　·　手掣十字／A／L R／B　·　手機可掃同撳卡</p>
  `

  root.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.tab = btn.dataset.tab
      state.focus = 0
      render()
    })
  })

  const cardEls = [...root.querySelectorAll('.card')]
  cardEls.forEach((el, i) => {
    el.addEventListener('click', () => openModal(state.cards[i], unlocks))
    el.addEventListener('focus', () => {
      state.focus = i
      updateFocus(cardEls)
    })
  })
  updateFocus(cardEls)

  // paint canvases
  cardEls.forEach(async (el, i) => {
    const item = state.cards[i]
    const unlocked = isUnlocked(item, unlocks)
    const canvas = el.querySelector('canvas')
    if (canvas) await paintCardCanvas(canvas, item, unlocked)
  })

  // idle anim loop for unlocked sheet cards
  cancelAnimationFrame(state.raf)
  const tick = async () => {
    const unlocksNow = syncUnlocks()
    const els = [...document.querySelectorAll('.card')]
    for (let i = 0; i < els.length; i++) {
      const item = state.cards[i]
      if (!item || item.still) continue
      if (!isUnlocked(item, unlocksNow)) continue
      const canvas = els[i].querySelector('canvas')
      if (canvas) await paintCardCanvas(canvas, item, true)
    }
    state.raf = requestAnimationFrame(tick)
  }
  state.raf = requestAnimationFrame(tick)
}

function cardHtml(item, unlocks, tabId) {
  const unlocked = isUnlocked(item, unlocks)
  const bossLike = !unlocked && (tabId === 'bosses' || tabId === 'scenes' || tabId === 'stories')
  const name = unlocked ? item.name : tabId === 'heroes' || tabId === 'enemies' ? '？？？' : '？'
  const blurb = unlocked ? item.blurb : ''
  if (bossLike) {
    return `<button type="button" class="card locked boss-like" data-id="${item.id}" aria-label="未解鎖"><span class="qmark">？</span></button>`
  }
  return `<button type="button" class="card ${unlocked ? '' : 'locked'}" data-id="${item.id}" aria-label="${name}">
    <canvas width="160" height="120" aria-hidden="true"></canvas>
    <div class="name">${name}</div>
    <div class="blurb">${blurb}</div>
  </button>`
}

function updateFocus(cardEls) {
  cardEls.forEach((el, i) => el.classList.toggle('is-focus', i === state.focus))
  cardEls[state.focus]?.focus({ preventScroll: false })
}

async function openModal(item, unlocks) {
  const unlocked = isUnlocked(item, unlocks)
  const modal = document.getElementById('modal')
  state.modal = item
  state.modalAnim = 0
  const animNames = Object.keys(item.anims || { idle: 1 })
  modal.classList.add('open')
  modal.innerHTML = `<div class="modal-panel" role="dialog" aria-modal="true">
    <h2>${unlocked ? item.name : '？？？'}</h2>
    <div class="desc">${unlocked ? item.blurb : ''}</div>
    <div class="stage" id="modal-stage"></div>
    <div class="actions" id="modal-actions"></div>
    <div class="nav-row">
      <button type="button" id="prev-anim" aria-label="上一個動作">◀</button>
      <button type="button" class="back-btn" id="close-modal">返回</button>
      <button type="button" id="next-anim" aria-label="下一個動作">▶</button>
    </div>
  </div>`

  if (!unlocked) {
    document.getElementById('modal-stage').innerHTML = `<div class="lock-msg">打過呢關先睇到。</div>`
    document.getElementById('modal-actions').innerHTML = ''
  } else {
    const actions = document.getElementById('modal-actions')
    actions.innerHTML = animNames
      .map(
        (n, i) =>
          `<button type="button" class="chip" data-i="${i}" aria-current="${i === 0}">${item.anims[n].label || n}</button>`,
      )
      .join('')
    actions.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        state.modalAnim = Number(chip.dataset.i)
        refreshModalAnim()
      })
    })
    const stage = document.getElementById('modal-stage')
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 240
    stage.appendChild(canvas)
    state.modalCanvas = canvas
    state.modalAnimNames = animNames
    state.modalT0 = performance.now()
    refreshModalAnim()
    const loop = async () => {
      if (!state.modal) return
      await paintModalFrame()
      state.modalRaf = requestAnimationFrame(loop)
    }
    cancelAnimationFrame(state.modalRaf)
    state.modalRaf = requestAnimationFrame(loop)
  }

  document.getElementById('close-modal').onclick = closeModal
  document.getElementById('prev-anim').onclick = () => shiftAnim(-1)
  document.getElementById('next-anim').onclick = () => shiftAnim(1)
}

function shiftAnim(dir) {
  if (!state.modal || !state.modalAnimNames?.length) return
  const n = state.modalAnimNames.length
  state.modalAnim = (state.modalAnim + dir + n) % n
  state.modalT0 = performance.now()
  refreshModalAnim()
}

function refreshModalAnim() {
  const actions = document.getElementById('modal-actions')
  if (!actions) return
  actions.querySelectorAll('.chip').forEach((chip, i) => chip.setAttribute('aria-current', i === state.modalAnim ? 'true' : 'false'))
}

async function paintModalFrame() {
  const item = state.modal
  const canvas = state.modalCanvas
  if (!item || !canvas) return
  const img = await loadSheet(item.sheet)
  const ctx = canvas.getContext('2d')
  if (!img) return
  if (item.still) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.imageSmoothingEnabled = false
    const scale = Math.min(canvas.width / img.width, canvas.height / img.height)
    const dw = img.width * scale
    const dh = img.height * scale
    ctx.drawImage(img, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh)
    if (item.tint) applyTint(ctx, canvas.width, canvas.height, item.tint)
    paintMarkers(ctx, item, canvas.width, canvas.height)
    await paintBadge(ctx, item, canvas.width, canvas.height)
    return
  }
  const name = state.modalAnimNames[state.modalAnim]
  const anim = item.anims[name]
  const frame = frameIndex(anim, performance.now() - (state.modalT0 || 0))
  drawFrame(ctx, img, item, frame, canvas.width, canvas.height)
  paintMarkers(ctx, item, canvas.width, canvas.height)
  await paintBadge(ctx, item, canvas.width, canvas.height)
}

function closeModal() {
  state.modal = null
  cancelAnimationFrame(state.modalRaf)
  document.getElementById('modal').classList.remove('open')
  document.getElementById('modal').innerHTML = ''
}

function moveFocus(dir) {
  if (state.modal) return
  const n = state.cards.length
  if (!n) return
  const cols = window.matchMedia('(max-width:720px)').matches ? 3 : 4
  let next = state.focus
  if (dir === 'left') next -= 1
  if (dir === 'right') next += 1
  if (dir === 'up') next -= cols
  if (dir === 'down') next += cols
  state.focus = Math.max(0, Math.min(n - 1, next))
  const els = [...document.querySelectorAll('.card')]
  updateFocus(els)
  els[state.focus]?.scrollIntoView({ block: 'nearest' })
}

function bindInput() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state.modal) closeModal()
      return
    }
    if (state.modal) {
      if (e.key === 'ArrowLeft' || e.key === 'q' || e.key === 'Q') shiftAnim(-1)
      if (e.key === 'ArrowRight' || e.key === 'e' || e.key === 'E') shiftAnim(1)
      if (e.key === 'Enter') closeModal()
      return
    }
    if (e.key === 'ArrowLeft') moveFocus('left')
    if (e.key === 'ArrowRight') moveFocus('right')
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveFocus('up')
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveFocus('down')
    }
    if (e.key === 'q' || e.key === 'Q') {
      const tabs = state.catalog.tabs
      const i = tabs.findIndex((t) => t.id === state.tab)
      state.tab = tabs[(i - 1 + tabs.length) % tabs.length].id
      state.focus = 0
      render()
    }
    if (e.key === 'e' || e.key === 'E') {
      const tabs = state.catalog.tabs
      const i = tabs.findIndex((t) => t.id === state.tab)
      state.tab = tabs[(i + 1) % tabs.length].id
      state.focus = 0
      render()
    }
    if (e.key === 'Enter') {
      const unlocks = syncUnlocks()
      openModal(state.cards[state.focus], unlocks)
    }
  })

  // Touch swipe on modal
  let sx = 0
  document.getElementById('modal').addEventListener(
    'touchstart',
    (e) => {
      sx = e.changedTouches[0].clientX
    },
    { passive: true },
  )
  document.getElementById('modal').addEventListener(
    'touchend',
    (e) => {
      const dx = e.changedTouches[0].clientX - sx
      if (Math.abs(dx) < 40) return
      if (dx > 0) shiftAnim(-1)
      else shiftAnim(1)
    },
    { passive: true },
  )

  // Gamepad poll (1P or 2P)
  let prev = {}
  const poll = () => {
    const pads = navigator.getGamepads?.() || []
    for (const p of pads) {
      if (!p) continue
      const edge = (i) => p.buttons[i]?.pressed && !prev[p.index + ':' + i]
      prev = prev || {}
      const mark = () => {
        for (let i = 0; i < p.buttons.length; i++) prev[p.index + ':' + i] = !!p.buttons[i]?.pressed
      }
      if (edge(1) || edge(0) && state.modal) {
        /* B = 0 on some, 1 on others — treat 1 as B cancel, 0 as A confirm */
      }
      if (edge(1)) {
        if (state.modal) closeModal()
        mark()
        break
      }
      if (edge(0)) {
        if (state.modal) shiftAnim(1)
        else openModal(state.cards[state.focus], syncUnlocks())
        mark()
        break
      }
      if (edge(4)) {
        // L
        if (state.modal) shiftAnim(-1)
        else {
          const tabs = state.catalog.tabs
          const i = tabs.findIndex((t) => t.id === state.tab)
          state.tab = tabs[(i - 1 + tabs.length) % tabs.length].id
          state.focus = 0
          render()
        }
        mark()
        break
      }
      if (edge(5)) {
        if (state.modal) shiftAnim(1)
        else {
          const tabs = state.catalog.tabs
          const i = tabs.findIndex((t) => t.id === state.tab)
          state.tab = tabs[(i + 1) % tabs.length].id
          state.focus = 0
          render()
        }
        mark()
        break
      }
      const ax = p.axes[0] || 0
      const ay = p.axes[1] || 0
      const key = p.index + ':stick'
      const now = performance.now()
      if (!prev[key + ':t']) prev[key + ':t'] = 0
      if (now - prev[key + ':t'] > 180) {
        if (ax < -0.5) {
          moveFocus('left')
          prev[key + ':t'] = now
        } else if (ax > 0.5) {
          moveFocus('right')
          prev[key + ':t'] = now
        } else if (ay < -0.5) {
          moveFocus('up')
          prev[key + ':t'] = now
        } else if (ay > 0.5) {
          moveFocus('down')
          prev[key + ':t'] = now
        }
      }
      mark()
    }
    requestAnimationFrame(poll)
  }
  requestAnimationFrame(poll)
}

async function main() {
  const res = await fetch('./catalog.json')
  state.catalog = await res.json()
  syncUnlocks()
  render()
  bindInput()
}

main()
