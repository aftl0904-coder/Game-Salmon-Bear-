import {
  TERRAIN,
  HAZARDS,
  ENEMIES,
  CAMERA,
  SIGNS,
  STAGES,
  ENVIRONMENT,
  PALETTE,
  CHARACTERS,
  COMPANION,
  stageTint,
} from '../game/config/gameData'

function el(html: string) {
  const d = document.createElement('div')
  d.innerHTML = html.trim()
  if (d.childElementCount === 1) return d.firstElementChild as HTMLElement
  const wrap = document.createElement('div')
  while (d.firstChild) wrap.appendChild(d.firstChild)
  return wrap
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

/** —— 角色／夥伴（characters + companion）—— */
{
  const awaiting =
    CHARACTERS.awaitingConfirmation === true || COMPANION.awaitingConfirmation === true
  const cards = CHARACTERS.characters
    .map((c) => {
      const atk = (() => {
        const a = c.attack
        if (a.type === 'projectile' && a.projectile) {
          return `projectile ${a.projectile.name} dmg=${a.projectile.damage} spd=${a.projectile.speed} cd=${a.cooldownMs}ms`
        }
        if (a.type === 'melee' && a.combo) {
          return `melee combo×${a.combo.length} window=${a.comboWindowMs}ms cd=${a.cooldownMs}ms`
        }
        return a.type
      })()
      const fan =
        'backFan' in c && c.backFan
          ? `<p class="meta">風扇：${c.backFan.name} · glide fall×${c.backFan.glide.fallSpeedMultiplier} max=${c.backFan.glide.maxMs}ms · +${c.backFan.glide.extraDistanceTiles} tile</p>`
          : ''
      const special =
        'shots' in c.special
          ? `${c.special.name} ×${c.special.shots} / ${c.special.intervalMs}ms dmg=${c.special.damage} cost=${c.special.cost}`
          : `${c.special.name} dmg=${c.special.damage} r=${'radiusPx' in c.special ? c.special.radiusPx : '—'} cost=${c.special.cost}`
      return `<article class="stage-card" data-testid="char-${c.id}" id="char-${c.id}">
        <h3><code>${c.id}</code> ${c.name} <span class="badge">${c.role} · ${c.difficulty}</span></h3>
        <p class="meta">hp=${c.hp} · moveSpeed=<strong data-testid="speed-${c.id}">${c.moveSpeed}</strong> · jumpV=${c.jumpVelocity}</p>
        <p class="meta">武器：${c.weapon.name} — ${c.weapon.look}</p>
        <p class="meta">攻擊：${atk}</p>
        ${fan}
        <p class="meta">絕招：${special}</p>
        <p class="meta">弱點：${c.weakness}</p>
      </article>`
    })
    .join('')

  const assists = COMPANION.assists
    .map(
      (a) =>
        `<tr><td><code>${a.id}</code></td><td>${a.name}</td><td>${a.type}</td><td>${
          'effect' in a && a.effect
            ? String(a.effect)
            : [
                'cooldownMs' in a ? `cd=${a.cooldownMs}` : '',
                'damage' in a ? `dmg=${a.damage}` : '',
                'range' in a ? `range=${a.range}` : '',
                'radiusPx' in a ? `r=${a.radiusPx}` : '',
                'items' in a && Array.isArray(a.items) ? `items=${a.items.join(',')}` : '',
                'triggerEverySec' in a ? `every=${a.triggerEverySec}s` : '',
              ]
                .filter(Boolean)
                .join(' · ')
        }</td></tr>`,
    )
    .join('')

  const sh = CHARACTERS.shared
  panel(
    'cast',
    '角色',
    `<section id="sec-characters" data-testid="sec-characters">
      <h2>角色 · data/characters.json
        ${awaiting ? '<span class="badge" data-testid="cast-awaiting">待確認</span>' : '<span class="badge">已確認</span>'}
      </h2>
      <p class="meta">shared hitbox stand ${sh.hitbox.standing.w}×${sh.hitbox.standing.h} / crouch ${sh.hitbox.crouch.w}×${sh.hitbox.crouch.h} · jump g=${sh.jump.gravity} coyote=${sh.jump.coyoteMs} buffer=${sh.jump.bufferMs} · tap/full ${sh.jump.targetHeightPx.tap}/${sh.jump.targetHeightPx.full}px</p>
      <p class="meta">balance: DPS 琪/倫 ${CHARACTERS.balanceTargets.dpsRatioGirlToBoy.join('–')} · bot 倫 ${CHARACTERS.balanceTargets.clearRateBotBoy.join('–')} · bot 琪 ${CHARACTERS.balanceTargets.clearRateBotGirl.join('–')}</p>
      ${CHARACTERS.note ? `<p class="meta">${CHARACTERS.note}</p>` : ''}
      ${cards}
    </section>
    <section id="sec-companion" data-testid="sec-companion">
      <h2>夥伴 · data/companion.json · <code>${COMPANION.id}</code> ${COMPANION.name}</h2>
      <p class="meta">follow ${COMPANION.follow.target}→${COMPANION.follow.fallback} · trail ${COMPANION.follow.trailDistancePx.join('–')}px · delay=${COMPANION.follow.delayMs}ms · teleport=${COMPANION.follow.teleportIfFarPx}px</p>
      <p class="meta">invulnerable=${COMPANION.invulnerable} · downed ${COMPANION.downed.onHit} ${COMPANION.downed.recoverMs}ms · limits bossKill=${!COMPANION.limits.cannotKillBoss} block=${!COMPANION.limits.noBlockingPlayer}</p>
      <table data-testid="companion-assists"><thead><tr><th>id</th><th>name</th><th>type</th><th>detail</th></tr></thead><tbody>${assists}</tbody></table>
    </section>`,
  )
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
