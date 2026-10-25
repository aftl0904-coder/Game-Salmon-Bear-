import {
  TERRAIN,
  HAZARDS,
  ENEMIES,
  CAMERA,
  SIGNS,
  STAGES,
  ENVIRONMENT,
  PALETTE,
  stageTint,
} from '../game/config/gameData'

function el(html: string) {
  const d = document.createElement('div')
  d.innerHTML = html
  return d.firstElementChild as HTMLElement
}

function table(headers: string[], rows: string[][]) {
  const head = headers.map((h) => `<th>${h}</th>`).join('')
  const body = rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}

const panels: { id: string; label: string; node: HTMLElement }[] = []

function panel(id: string, label: string, html: string) {
  const node = el(`<div class="panel" id="panel-${id}" role="tabpanel" data-panel="${id}"></div>`)
  node.appendChild(el(html))
  panels.push({ id, label, node })
}

/** —— 場景（environment.json）—— */
{
  const cards = ENVIRONMENT.stages
    .map((st) => {
      const tint = stageTint(st.id) ?? '#888888'
      const layers = st.layers
        .map(
          (l) =>
            `<li><code>${l.id}</code> ${l.type} · speed=${l.speed} · ${l.content}${
              'saturation' in l && l.saturation != null ? ` · sat=${l.saturation}` : ''
            }${'alpha' in l && l.alpha != null ? ` · α=${l.alpha}` : ''}</li>`,
        )
        .join('')
      const fog =
        st.lighting.fog != null
          ? `fog ${st.lighting.fog.color} dens=${st.lighting.fog.density}`
          : 'fog —'
      const flicker =
        'flicker' in st.lighting && st.lighting.flicker
          ? ` · flicker every ${st.lighting.flicker.everyMs}ms / ${st.lighting.flicker.durationMs}ms`
          : ''
      return `<article class="stage-card" data-testid="stage-${st.id}" id="stage-${st.id}">
        <h3>
          <code>${st.id}</code> ${st.name}
          <span class="tint" style="display:inline-flex;margin-left:8px;vertical-align:middle">
            <span class="chip" style="background:${tint}" title="perStageTint"></span>
            <code>${tint}</code>
          </span>
        </h3>
        <p class="meta">ground: ${st.ground.material} · ${st.ground.tileSizePx}px · variants=${st.ground.variants} · ${st.ground.shading} · dither=${st.ground.dither}</p>
        <p class="meta">detail: ${(st.ground.detail ?? []).join('、')} · edgeHighlight=${st.ground.edgeHighlight}</p>
        <p class="meta">props: ${st.props.join('、')} · particles: ${st.particles.join('、')}</p>
        <p class="meta">light: ambient <code>${st.lighting.ambient}</code> · ${st.lighting.light} · ${fog}${flicker}</p>
        <ul class="layer-list">${layers}</ul>
      </article>`
    })
    .join('')

  panel(
    'scenes',
    '場景',
    `<section id="sec-environment" data-testid="sec-environment">
      <h2>場景 · data/environment.json</h2>
      <p class="meta">style: ${ENVIRONMENT.style} · ${ENVIRONMENT.stages.length} stages</p>
      ${cards}
    </section>`,
  )
}

/** —— 色板（palette.json）—— */
{
  const awaiting = PALETTE.awaitingConfirmation === true
  const swatches = PALETTE.main.colors
    .map(
      (c, i) =>
        `<div class="swatch" data-testid="swatch-${i}" title="${c}">
          <div class="chip" style="background:${c}"></div>
          <code>${c}</code>
        </div>`,
    )
    .join('')
  const tints = Object.entries(PALETTE.perStageTint)
    .map(
      ([id, hex]) =>
        `<div class="tint" data-testid="tint-${id}">
          <span class="chip" style="background:${hex}"></span>
          <span><code>${id}</code> ${hex}</span>
        </div>`,
    )
    .join('')

  panel(
    'palette',
    '色板',
    `<section id="sec-palette" data-testid="sec-palette">
      <h2>色板 · data/palette.json
        ${
          awaiting
            ? '<span class="badge" data-testid="palette-awaiting">待確認 proposed</span>'
            : '<span class="badge">已確認</span>'
        }
      </h2>
      <p class="meta">maxColors=${PALETTE.main.maxColors} · status=${PALETTE.main.status ?? '—'} · license=${PALETTE.main.license ?? '—'}</p>
      <p class="meta">source: ${PALETTE.main.source ?? '—'}</p>
      <p class="meta">rules: outline=${PALETTE.rules.outline} · light=${PALETTE.rules.lightDirection} · noPureBlack=${PALETTE.rules.noPureBlack}</p>
      ${PALETTE.note ? `<p class="meta" data-testid="palette-note">${PALETTE.note}</p>` : ''}
      <h3>main.colors（${PALETTE.main.colors.length}）</h3>
      <div class="swatch-grid" data-testid="swatch-grid">${swatches}</div>
      <h3>perStageTint</h3>
      <div class="tint-row">${tints}</div>
    </section>`,
  )
}

/** —— 資料（1–4）—— */
{
  panel(
    'data',
    '資料 1–4',
    `<section id="sec-camera">
      <h2>Camera · data/camera.json</h2>
      <p>mode=<code>${CAMERA.mode}</code> · deadZone=<code>${CAMERA.deadZonePx.x}×${CAMERA.deadZonePx.y}</code></p>
      <div id="cam-lookahead" data-testid="cam-lookahead">lookAheadPx = <strong>${CAMERA.lookAheadPx}</strong></div>
      ${table(
        ['stage', 'fromTile', 'toTile', 'reason'],
        CAMERA.lockZones.map((z) => [
          `<code>${z.stage}</code>`,
          String(z.fromTile),
          String(z.toTile),
          z.reason,
        ]),
      )}
    </section>
    <section id="sec-terrain">
      <h2>Terrain · data/terrain.json</h2>
      ${table(
        ['id', 'type', 'note'],
        TERRAIN.tiles.map((t) => [
          `<code>${t.id}</code>`,
          t.type,
          'note' in t && t.note ? String(t.note) : '—',
        ]),
      )}
    </section>
    <section id="sec-hazards">
      <h2>Hazards · data/hazards.json</h2>
      ${table(
        ['id', 'name', 'type', 'answer'],
        HAZARDS.map((h) => [
          `<code>${h.id}</code>`,
          h.name,
          h.type,
          `<code>${h.answer}</code>`,
        ]),
      )}
    </section>
    <section id="sec-enemies">
      <h2>Enemies · data/enemies.json</h2>
      ${table(
        ['id', 'name', 'role', 'answer'],
        ENEMIES.map((e) => [
          `<code>${e.id}</code>`,
          e.name,
          e.role,
          `<code>${e.answer}</code>`,
        ]),
      )}
    </section>
    <section id="sec-signs">
      <h2>Signs · data/signs.json</h2>
      ${table(
        ['id', 'name', 'type', 'detail'],
        SIGNS.map((s) => [
          `<code>${s.id}</code>`,
          s.name,
          s.type,
          'text' in s && s.text
            ? String(s.text)
            : 'note' in s && s.note
              ? String(s.note)
              : '—',
        ]),
      )}
    </section>
    <section id="sec-stages">
      <h2>Stages · data/stages.json（stub）</h2>
      ${table(
        ['id', 'name'],
        STAGES.map((s) => [`<code>${s.id}</code>`, s.name]),
      )}
    </section>`,
  )
}

/** —— 音樂（尚未開始；項目 3）—— */
panel(
  'music',
  '音樂',
  `<section id="sec-music" data-testid="sec-music">
    <h2>音樂 · data/music.json</h2>
    <p class="meta" data-testid="music-pending">尚未製作（等確認環境／色板後先做項目 3）。播放器同 loop 測試暫緩。</p>
  </section>`,
)

const root = document.getElementById('root')!
const tabsNav = document.getElementById('tabs')!
root.innerHTML = ''

for (const p of panels) {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.role = 'tab'
  btn.id = `tab-${p.id}`
  btn.dataset.tab = p.id
  btn.textContent = p.label
  btn.setAttribute('aria-controls', `panel-${p.id}`)
  btn.setAttribute('aria-selected', 'false')
  tabsNav.appendChild(btn)
  p.node.hidden = true
  root.appendChild(p.node)
}

function selectTab(id: string) {
  for (const p of panels) {
    const on = p.id === id
    p.node.hidden = !on
    const btn = tabsNav.querySelector(`[data-tab="${p.id}"]`) as HTMLButtonElement | null
    if (btn) btn.setAttribute('aria-selected', on ? 'true' : 'false')
  }
  const hash = id === 'scenes' ? '' : id
  if (hash) history.replaceState(null, '', `#${hash}`)
  else history.replaceState(null, '', location.pathname)
}

tabsNav.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest('[data-tab]') as HTMLElement | null
  if (t?.dataset.tab) selectTab(t.dataset.tab)
})

const initial =
  (location.hash.replace(/^#/, '') &&
  panels.some((p) => p.id === location.hash.replace(/^#/, ''))
    ? location.hash.replace(/^#/, '')
    : 'scenes') || 'scenes'
selectTab(initial)

document.title = `鮭鮭熊・圖鑑 (${ENVIRONMENT.stages.length} scenes / ${PALETTE.main.colors.length} colors)`
